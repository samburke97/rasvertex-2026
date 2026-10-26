// lib/reports/inspection/generate.ts
//
// (report data) → blocks → pages. A pure port of the generator and paginator
// in the design reference (Inspection Report v4): no DOM, so the builder's
// preview and the PDF route lay out the report identically.
//
//   buildModel()  parses every photo label and turns the job into a flat list
//                 of blocks (section header, table header, table row, chapter
//                 header, photo row…), each with a gap above it, a keep-with-
//                 next flag and a force-new-page flag.
//   paginate()    stacks those blocks onto pages of 1620 page units, given the
//                 real height of each block (measured after render, keyed by
//                 block key). A table that breaks repeats its header on the
//                 next page; a chapter that breaks starts with "{Zone},
//                 continued"; a header is never left alone at a page foot.
//
// Pages: 1 Cover · 2 Contents · 3…n flowed pages · last Recommended works.

import {
  BANDS,
  BAND_ORDER,
  EXCLUSIONS,
  libraryFor,
  type Band,
  type CardDef,
  type ExtraDef,
} from "./codes";
import {
  COVER_ID,
  DEFAULT_COVER_POS,
  SITE_MAP_ID,
  choiceId,
  contactFor,
  parseLabel,
  photoLabel,
  type CoverPos,
  type InspectionPhoto,
  type InspectionReportData,
} from "./types";

export const PAGE_W = 1280;
export const PAGE_H = 1810;
export const FLOW_H = 1620;
/** Width of the content column the blocks are measured in. */
export const CONTENT_W = PAGE_W - 96 * 2;
const PER_ROW = 2;

const pad = (n: number) => String(n).padStart(2, "0");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const andList = (a: string[]) =>
  a.length < 2 ? (a[0] ?? "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

export const levelOrd = (l: string) => (l === "LG" ? 0 : l === "LR" ? 999 : parseInt(l.slice(1), 10));
export const levelName = (l: string) => (l === "LG" ? "Ground" : l === "LR" ? "Roof" : "Level " + l.slice(1));
export const zoneOrd = (z: string) => (z[0] === "D" ? 0 : 10000) + parseInt(z.slice(1), 10);
export const zoneTitle = (z: string) => (z[0] === "D" ? "Drop " : "Section ") + z.slice(1);
const unitOrd = (u: string | null) => (u ? parseInt(u.slice(1), 10) : -1);

// SimPRO attachment ids rise with each upload, so they give upload order.
const uploadOrd = (p: InspectionPhoto, i: number) => {
  const m = /(\d+)$/.exec(p.id);
  return m ? parseInt(m[1], 10) : i;
};

// ── Types ────────────────────────────────────────────────────────────────────

export interface Chip {
  code: string;
  fg: string;
  bg: string;
}

export interface ParsedPhoto {
  id: string;
  ord: number;
  zone: string;
  level: string;
  unit: string | null;
  codes: string[];
  note: string;
  head: string;
}

export interface PhotoView {
  id: string;
  num: string;
  chip: Chip;
  gname: string;
  desc: string;
}

export type SectionKey = "about" | "map" | "defects" | "findings" | "index" | "summary" | "works";

interface BlockBase {
  /** Unique per distinct block; doubles as its measured-height key. */
  key: string;
  gap: number;
  keep?: boolean;
  brk?: boolean;
  est: number;
  /** Placed first when this block opens a page (repeat header / continued). */
  cont?: Block;
  secKey?: SectionKey;
  chapKey?: string;
}

export interface SummaryRow {
  band: Band;
  name: string;
  count: string;
  text: string;
  n: number;
}

export type Block = BlockBase &
  (
    | { type: "sec"; label: string; title: string; intro: string }
    | { type: "why" }
    | { type: "ex"; photo: PhotoView; legend: { part: string; ex: string; mean: string }[] }
    | { type: "sub"; title: string }
    | { type: "kHead" }
    | { type: "kGroup"; band: Band; first: boolean }
    | { type: "kRow"; chip: Chip; name: string; count: string }
    | { type: "map"; photoId: string; pins: { zone: string; x: number; y: number }[] }
    | { type: "zones" }
    | { type: "dHead" }
    | { type: "defect"; chip: Chip; name: string; what: string; act: string }
    | { type: "chap"; title: string; meta: string }
    | { type: "cont"; text: string }
    | { type: "row"; photos: PhotoView[] }
    | { type: "ixHead" }
    | { type: "ixRow"; zone: string; level: string; unit: string; chips: Chip[]; photos: string }
    | {
        type: "sum";
        stats: { v: number; k: string }[];
        rows: SummaryRow[];
        note: string;
      }
  );

export type BlockType = Block["type"];

export interface ZoneRow {
  zone: string;
  title: string;
  levels: string;
  count: number;
}

export interface WorkItem {
  chip: Chip;
  name: string;
  why: string;
  zones: string;
}

export interface InspectionModel {
  parsed: ParsedPhoto[];
  rejected: { photo: InspectionPhoto; label: string; reason: string }[];
  /** Accepted labels with tokens that were ignored (likely typos). */
  warnings: { photo: InspectionPhoto; label: string; ignored: string[] }[];
  /** Site map image: the builder's choice, else a MAP/Aerial photo. */
  mapPhotoId: string | null;
  /** "label" = picked up from a photo labelled MAP / Aerial. */
  mapSource: "upload" | "satellite" | "photo" | "label" | null;
  /** A photo labelled MAP / Aerial, whether or not it's the one in use. */
  labelMapPhotoId: string | null;
  coverPhotoId: string | null;
  coverPos: CoverPos;
  facts: { k: string; v: string }[];
  sections: { key: SectionKey; title: string; label: string }[];
  blocks: Block[];
  zoneRows: ZoneRow[];
  hasOther: boolean;
  /** About this report cards for this report kind. */
  about: CardDef[];
  works: { items: WorkItem[]; extras: ExtraDef[]; href: string };
  nDefects: number;
}

// ── Model ────────────────────────────────────────────────────────────────────

export function buildModel(data: InspectionReportData): InspectionModel {
  const { job } = data;
  const lib = libraryFor(data.kind);
  const CODES = lib.codes;
  const CODE_MAP = lib.codeMap;
  const contact = contactFor(job.contact);
  const chip = (code: string): Chip => {
    const b = BANDS[CODE_MAP[code].band];
    return { code, fg: b.fg, bg: b.bg };
  };

  // Parse labels
  const parsed: ParsedPhoto[] = [];
  const rejected: InspectionModel["rejected"] = [];
  const warnings: InspectionModel["warnings"] = [];
  let mapPhotoId: string | null = null;
  data.photos.forEach((photo, i) => {
    const label = photoLabel(photo);
    const r = parseLabel(label, lib);
    if (r.kind === "map") {
      mapPhotoId ??= photo.id;
    } else if (r.kind === "rejected") {
      rejected.push({ photo, label, reason: r.reason });
    } else {
      if (r.ignored.length) warnings.push({ photo, label, ignored: r.ignored });
      parsed.push({
        id: photo.id,
        ord: uploadOrd(photo, i),
        zone: r.zone,
        level: r.level,
        unit: r.unit,
        codes: r.codes,
        note: r.note,
        head: r.head,
      });
    }
  });

  const labelMapId = mapPhotoId;
  const chosenMapId = choiceId(data, data.siteMap, SITE_MAP_ID);
  if (chosenMapId) mapPhotoId = chosenMapId;

  const sortLU = (a: ParsedPhoto, b: ParsedPhoto) =>
    levelOrd(a.level) - levelOrd(b.level) || unitOrd(a.unit) - unitOrd(b.unit) || a.ord - b.ord;
  const levelsTxt = (ps: ParsedPhoto[]) => {
    const lv = [...new Set(ps.map((p) => p.level))].sort((a, b) => levelOrd(a) - levelOrd(b));
    if (!lv.length) return "";
    return lv.length === 1 ? levelName(lv[0]) : levelName(lv[0]) + " to " + levelName(lv[lv.length - 1]);
  };
  const zones = [...new Set(parsed.map((p) => p.zone))].sort((a, b) => zoneOrd(a) - zoneOrd(b));

  // Chapters and photo numbering (Findings display order, OT last)
  let num = 0;
  const numOf = new Map<ParsedPhoto, number>();
  const assign = (p: ParsedPhoto) => {
    if (!numOf.has(p)) numOf.set(p, ++num);
  };
  const chapters = zones
    .map((zone) => {
      const ps = parsed.filter((p) => p.zone === zone);
      const groups: { code: string; ps: ParsedPhoto[] }[] = [];
      for (const c of CODES) {
        if (c.code === "OT") continue;
        const g = ps.filter((p) => p.codes.includes(c.code)).sort(sortLU);
        if (g.length) groups.push({ code: c.code, ps: g });
      }
      const ovi = groups.findIndex((g) => g.code === "OV");
      if (ovi > 0) groups.unshift(groups.splice(ovi, 1)[0]);
      groups.forEach((g) => g.ps.forEach(assign));
      return {
        zone,
        ps: ps.filter((p) => !(p.codes.length === 1 && p.codes[0] === "OT")),
        groups,
      };
    })
    .filter((ch) => ch.groups.length);
  const other = parsed
    .filter((p) => p.codes.includes("OT"))
    .sort((a, b) => zoneOrd(a.zone) - zoneOrd(b.zone) || sortLU(a, b));
  other.forEach(assign);

  const view = (p: ParsedPhoto, withZone: boolean, code: string): PhotoView => ({
    id: p.id,
    num: pad(numOf.get(p) ?? 0),
    chip: chip(code),
    gname: code === "OV" ? "Overview" : CODE_MAP[code].name,
    desc:
      (withZone ? zoneTitle(p.zone) + ", " : "") +
      levelName(p.level) +
      (p.unit ? ", Unit " + p.unit.slice(1) : "") +
      (p.note ? " · " + cap(p.note) : ""),
  });

  // Counts and generated copy
  const present = CODES.filter((c) => !c.system && parsed.some((p) => p.codes.includes(c.code))).map(
    (c) => c.code,
  );
  const withCode = (code: string) => parsed.filter((p) => p.codes.includes(code));
  const zonesOf = (code: string) =>
    [...new Set(withCode(code).map((p) => p.zone))].sort((a, b) => zoneOrd(a) - zoneOrd(b));

  const sumRows: SummaryRow[] = [];
  for (const band of BAND_ORDER) {
    const cs = present.filter((c) => CODE_MAP[c].band === band);
    if (!cs.length) continue;
    const n = cs.reduce((t, c) => t + withCode(c).length, 0);
    const parts = cs.map((c, i) => {
      const nm = CODE_MAP[c].name;
      return (i ? nm.charAt(0).toLowerCase() + nm.slice(1) : nm) + " at " + andList(zonesOf(c));
    });
    sumRows.push({
      band,
      name: BANDS[band].name,
      count: plural(n, "defect"),
      text: parts.join("; ") + ". " + BANDS[band].tail,
      n,
    });
  }
  const nDef = sumRows.reduce((t, r) => t + r.n, 0);
  const nRed = sumRows.find((r) => r.band === "red")?.n ?? 0;
  const zCount: Record<string, number> = {};
  for (const p of parsed) {
    const k = p.codes.filter((c) => !CODE_MAP[c].system).length;
    if (k) zCount[p.zone] = (zCount[p.zone] ?? 0) + k;
  }
  const topZ = Object.keys(zCount)
    .sort((a, b) => zCount[b] - zCount[a] || zoneOrd(a) - zoneOrd(b))
    .slice(0, 3);
  const nZones = chapters.length;
  const sumIntro =
    `We inspected ${plural(nZones, "zone")} and recorded ${plural(nDef, "defect")} across ${plural(present.length, "defect type")}. ` +
    (nRed ? `${nRed} ${nRed === 1 ? "needs" : "need"} attention now. ` : "None need urgent attention. ") +
    (topZ.length ? "Most were found at " + andList(topZ) + "." : "");

  const secDefs: [SectionKey, string, string][] = [
    ["about", "About this report", job.scope],
    [
      "map",
      "Site map",
      mapPhotoId
        ? "Zones are marked on the map. Each drop (D) and section (S) in this report matches a zone."
        : "Zones are taken from the photo labels. Each drop (D) and section (S) has its own chapter.",
    ],
    ["defects", "Defects explained", "Each defect found on this building, what it means and what we recommend."],
    ["findings", "Findings", "One chapter per zone. Overview photos come first, then defects in order of severity."],
    ["index", "Location index", "Every location inspected, the defects found there and the photos that show them."],
    ["summary", "Summary", sumIntro],
    ["works", "Recommended works", "What needs to be done, in order of priority, and why."],
  ];
  const N = secDefs.length;
  const sections = secDefs.map(([key, title], i) => ({
    key,
    title,
    label: `Section ${pad(i + 1)} / ${pad(N)}`,
  }));
  const secLabel = (k: SectionKey) => sections.find((s) => s.key === k)!.label;

  // ── Blocks ──
  const B: Block[] = [];
  const add = (b: Block) => {
    B.push(b);
    return b;
  };
  const sec = (key: SectionKey, force = false) => {
    const [, title, intro] = secDefs.find((s) => s[0] === key)!;
    add({
      type: "sec",
      key: "sec-" + key,
      label: secLabel(key),
      title,
      intro,
      gap: 140,
      keep: true,
      est: 260,
      brk: force,
      secKey: key,
    });
  };

  // 01 About
  sec("about");
  add({ type: "why", key: "why", gap: 56, est: 480 });
  const ordered = [...parsed].sort((a, b) => (numOf.get(a) ?? 0) - (numOf.get(b) ?? 0));
  const notOv = (p: ParsedPhoto) => p.codes.some((c) => c !== "OV");
  const exP =
    ordered.find((p) => notOv(p) && p.note && p.codes.some((c) => CODE_MAP[c].band === "red")) ??
    ordered.find((p) => notOv(p) && p.note) ??
    ordered.find(notOv) ??
    ordered[0];
  if (exP) {
    const exCode = exP.codes.find((c) => c !== "OV") ?? exP.codes[0];
    const exV = view(exP, true, exCode);
    add({
      type: "ex",
      key: "ex",
      photo: exV,
      legend: [
        { part: "Code", ex: exCode, mean: "The type of defect. Its colour shows the severity." },
        { part: "Photo number", ex: "Photo " + exV.num, mean: "Use it to find the photo in the Location index." },
        {
          part: "Location",
          ex: zoneTitle(exP.zone) + ", " + levelName(exP.level),
          mean: "D is a rope drop, S a section. LG is ground, LR the roof.",
        },
        { part: "Note", ex: exP.note ? cap(exP.note) : "—", mean: "The technician’s comment on site." },
      ],
      gap: 72,
      est: 720,
    });
  }
  add({ type: "sub", key: "sub-key", title: "Severity", gap: 0, keep: true, est: 44, brk: true });
  const kHead: Block = { type: "kHead", key: "khead", gap: 0, est: 40 };
  add({ ...kHead, gap: 40, keep: true });
  BAND_ORDER.forEach((band, gi) => {
    add({ type: "kGroup", key: "kg-" + band, band, first: gi === 0, gap: 0, keep: true, est: gi ? 86 : 62, cont: kHead });
    for (const c of CODES.filter((x) => x.band === band)) {
      const n = withCode(c.code).length;
      add({
        type: "kRow",
        key: "k-" + c.code,
        chip: chip(c.code),
        name: c.name,
        count: n ? plural(n, "photo") : "—",
        gap: 0,
        est: 53,
        cont: kHead,
      });
    }
  });

  // 02 Site map
  sec("map", true);
  const dl = chapters.map((c) => c.zone).filter((z) => z[0] === "D");
  const sl = chapters.map((c) => c.zone).filter((z) => z[0] !== "D");
  const defPos = (z: string): [number, number] => {
    const isD = z[0] === "D";
    const arr = isD ? dl : sl;
    const i = arr.indexOf(z);
    return isD ? [24 + (62 * (i + 0.5)) / arr.length, 69] : [32 + (48 * (i + 0.5)) / arr.length, 54];
  };
  if (mapPhotoId) {
    add({
      type: "map",
      key: "map",
      photoId: mapPhotoId,
      pins: chapters.map((c) => {
        const [x, y] = data.pins[c.zone] ?? defPos(c.zone);
        return { zone: c.zone, x, y };
      }),
      gap: 56,
      est: 725,
    });
  }
  const zoneRows: ZoneRow[] = chapters.map((c) => ({
    zone: c.zone,
    title: zoneTitle(c.zone),
    levels: levelsTxt(c.ps),
    count: c.ps.length,
  }));
  add({ type: "zones", key: "zones", gap: 72, est: 40 + zoneRows.length * 51 });

  // 03 Defects explained
  sec("defects");
  const dHead: Block = { type: "dHead", key: "dhead", gap: 0, est: 40 };
  add({ ...dHead, gap: 56, keep: true });
  for (const code of present) {
    const c = CODE_MAP[code];
    add({ type: "defect", key: "def-" + code, chip: chip(code), name: c.name, what: c.what, act: c.action, gap: 0, est: 92, cont: dHead });
  }

  // 04 Findings
  sec("findings", true);
  const chapList = chapters.map((ch) => ({
    key: ch.zone,
    title: zoneTitle(ch.zone),
    meta: plural(ch.ps.length, "photo") + " · " + levelsTxt(ch.ps),
    items: ch.groups.flatMap((g) => g.ps.map((p) => [p, g.code] as const)),
    withZone: false,
  }));
  if (other.length) {
    chapList.push({
      key: "OT",
      title: "Other items of note",
      meta: plural(other.length, "photo") + " · Items that do not fit a defect code",
      items: other.map((p) => [p, "OT"] as const),
      withZone: true,
    });
  }
  chapList.forEach((ch, ci) => {
    add({
      type: "chap",
      key: "chap-" + ch.key,
      title: ch.title,
      meta: ch.meta,
      gap: ci ? 96 : 56,
      keep: true,
      est: 120,
      chapKey: ch.key,
    });
    const cont: Block = { type: "cont", key: "cont-" + ch.key, text: ch.title + ", continued", gap: 0, est: 20 };
    for (let r = 0; r < ch.items.length; r += PER_ROW) {
      add({
        type: "row",
        key: `row-${ch.key}-${r}`,
        photos: ch.items.slice(r, r + PER_ROW).map(([p, c]) => view(p, ch.withZone, c)),
        gap: r ? 48 : 40,
        est: 560,
        cont,
      });
    }
  });

  // 05 Location index
  sec("index", true);
  const ixHead: Block = { type: "ixHead", key: "ixhead", gap: 0, est: 40 };
  add({ ...ixHead, gap: 56, keep: true });
  const ix = new Map<string, { p: ParsedPhoto; codes: Set<string>; nums: number[] }>();
  [...parsed]
    .sort((a, b) => zoneOrd(a.zone) - zoneOrd(b.zone) || sortLU(a, b))
    .forEach((p) => {
      const k = p.zone + "|" + p.level + "|" + (p.unit ?? "");
      if (!ix.has(k)) ix.set(k, { p, codes: new Set(), nums: [] });
      const e = ix.get(k)!;
      p.codes.forEach((c) => e.codes.add(c));
      e.nums.push(numOf.get(p) ?? 0);
    });
  [...ix.values()].forEach((e, i) => {
    let codes = CODES.map((c) => c.code).filter((c) => c !== "OV" && e.codes.has(c));
    if (!codes.length) codes = ["OV"];
    add({
      type: "ixRow",
      key: "ix-" + i,
      zone: e.p.zone,
      level: e.p.level,
      unit: e.p.unit ?? "",
      chips: codes.map(chip),
      photos: [...new Set(e.nums)].sort((a, b) => a - b).map(pad).join(", "),
      gap: 0,
      est: 54,
      cont: ixHead,
    });
  });

  // 06 Summary
  sec("summary", true);
  add({
    type: "sum",
    key: "sum",
    note: EXCLUSIONS.join(" "),
    rows: sumRows,
    stats: [
      { v: nDef, k: "Defects recorded" },
      { v: nRed, k: "Need action now" },
      { v: present.length, k: "Defect types" },
      { v: nZones, k: "Zones inspected" },
    ],
    gap: 56,
    est: 330 + sumRows.length * 210,
  });

  // 07 Recommended works (own page, rendered outside the flow)
  const items: WorkItem[] = present.map((code) => ({
    chip: chip(code),
    name: CODE_MAP[code].work,
    why: CODE_MAP[code].why,
    zones: zonesOf(code).join(", "),
  }));
  const extras = lib.extras.filter((x) => !x.whenAny || present.some((c) => x.whenAny!.includes(c)));
  const reportName = lib.label.toLowerCase() + " report";
  const firstName = contact.name.split(" ")[0] ?? "";
  const body =
    `Hi ${firstName},\n\nPlease quote the following works from ${reportName} ${job.ref} for ${job.site}, ${job.address}:\n\n` +
    items.map((w) => `- ${w.name} (${w.zones})`).join("\n") +
    "\n\nThanks,";
  const href =
    "mailto:" +
    contact.email +
    "?subject=" +
    encodeURIComponent(`Quote request, ${reportName} ${job.ref}, ${job.site}`) +
    "&body=" +
    encodeURIComponent(body);

  const coverPhotoId =
    choiceId(data, data.cover, COVER_ID) ??
    ordered.find((p) => p.codes.includes("OV"))?.id ??
    ordered[0]?.id ??
    null;

  return {
    parsed,
    rejected,
    warnings,
    mapPhotoId,
    mapSource: chosenMapId ? data.siteMap!.source : labelMapId ? "label" : null,
    labelMapPhotoId: labelMapId,
    coverPhotoId,
    coverPos: data.coverPos ?? DEFAULT_COVER_POS,
    facts: [
      { k: "Prepared for", v: job.forName },
      { k: "Prepared by", v: [job.by, job.byTitle].filter(Boolean).join(", ") },
      { k: "Report", v: `${lib.reportRef} #${job.ref}` },
      { k: "Date", v: job.date },
    ],
    sections,
    blocks: B,
    zoneRows,
    hasOther: other.length > 0,
    about: lib.about,
    works: { items, extras, href },
    nDefects: nDef,
  };
}

// ── Pagination ───────────────────────────────────────────────────────────────

export type PlacedBlock = Block & {
  /** Space above, in page units (0 at the top of a page). */
  pt: number;
  /** Table rows: draw the bottom rule (another row of the table follows). */
  ruled: boolean;
};

export interface Layout {
  pages: PlacedBlock[][];
  /** Page count including cover, contents and the works page. */
  total: number;
  secPage: Partial<Record<SectionKey, number>>;
  chapPage: Record<string, number>;
}

/** Table rows that lose their bottom rule as the last row on a page. */
const RULED: BlockType[] = ["kRow", "defect", "ixRow"];

/** First flowed page's number (after Cover and Contents). */
const FIRST_FLOW_PAGE = 3;

export function paginate(blocks: Block[], heights: Record<string, number>): Layout {
  const hOf = (b: Block) => heights[b.key] ?? b.est;
  const pages: PlacedBlock[][] = [];
  const startPage = new Map<Block, number>();
  let cur: PlacedBlock[] = [];
  let used = 0;
  const newPage = () => {
    cur = [];
    used = 0;
    pages.push(cur);
  };
  const place = (b: Block) => {
    const pt = cur.length ? b.gap : 0;
    cur.push({ ...b, pt, ruled: false });
    used += pt + hOf(b);
    if (!startPage.has(b)) startPage.set(b, pages.length - 1);
  };

  newPage();
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.brk && cur.length) newPage();
    let chain = (cur.length ? b.gap : 0) + hOf(b);
    for (let j = i; blocks[j].keep && j + 1 < blocks.length; j++) {
      chain += blocks[j + 1].gap + hOf(blocks[j + 1]);
    }
    if (cur.length && used + chain > FLOW_H) newPage();
    if (!cur.length && b.cont) place(b.cont);
    place(b);
  }

  for (const page of pages) {
    page.forEach((b, i) => {
      if (RULED.includes(b.type)) b.ruled = page[i + 1]?.type === b.type;
    });
  }

  const secPage: Layout["secPage"] = {};
  const chapPage: Layout["chapPage"] = {};
  for (const b of blocks) {
    const n = startPage.get(b);
    if (n == null) continue;
    if (b.secKey) secPage[b.secKey] = n + FIRST_FLOW_PAGE;
    if (b.chapKey) chapPage[b.chapKey] = n + FIRST_FLOW_PAGE;
  }
  const total = pages.length + FIRST_FLOW_PAGE;
  secPage.works = total;
  return { pages, total, secPage, chapPage };
}

export { pad as padPage };
