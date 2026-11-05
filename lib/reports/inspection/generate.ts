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

import { DEFAULT_TAGS } from "@/lib/reports/settings/defaults";
import { levelRank, readTag, tagText, zoneRank } from "@/lib/reports/settings/library";
import type { LocationTag } from "@/lib/reports/settings/types";
import {
  type Band,
  type BandDef,
  type CardDef,
  type ExtraDef,
  type ImageKey,
} from "./codes";
import { capFirst, notesIsEmpty, notesLineCount, sanitizeNotesHtml } from "@/lib/reports/richText";
import {
  COVER_ID,
  DEFAULT_COVER_POS,
  SITE_MAP_ID,
  choiceId,
  contactFor,
  libraryOf,
  parseLabel,
  photoLabel,
  type CoverPos,
  type InspectionPhoto,
  type InspectionReportData,
  type SectionKey,
  type PlanItem,
  sectionHidden,
} from "./types";
import type { PhotoPos } from "@/lib/reports/photos";

export const PAGE_W = 1280;
export const PAGE_H = 1810;
export const FLOW_H = 1620;
/** Width of the content column the blocks are measured in. */
export const CONTENT_W = PAGE_W - 96 * 2;
const PER_ROW = 2;
/** Lines a string wraps to at a font size and column width (estimate). */
const wrapLines = (s: string, px: number, w: number, bold = false) =>
  Math.max(1, Math.ceil((s.length * px * (bold ? 0.55 : 0.5)) / w));

/** The Recommended works page is one sheet, always ending with the quote
 *  button. What's left under the table decides whether "Also worth adding"
 *  shows with its photos (which then fill the space), as text only, or not
 *  at all. Heights follow the page's CSS. */
function worksFit(items: WorkItem[]): "images" | "text" | "none" {
  const rows = items.reduce(
    (h, w) => h + 32 + Math.max(wrapLines(w.name, 20, 340, true) * 28, wrapLines(w.why.replace(/<[^>]*>/g, ""), 17, 432) * 24, wrapLines(w.zones, 17, 180) * 24),
    0,
  );
  const left = PAGE_H - 80 - 96 - 115 /* label, title */ - 80 /* table head */ - rows - 210 /* button, contact */ - 30;
  const text = 240; // title, card titles and two lines each
  return left >= text + 140 ? "images" : left >= text ? "text" : "none";
}

const pad = (n: number) => String(n).padStart(2, "0");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const andList = (a: string[]) =>
  a.length < 2 ? (a[0] ?? "") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];

// Zone and level are optional: "" sorts last (zone) / first (level) and
// prints as nothing.
// What each tag means and prints as comes from the report's location tags.
export const levelOrd = (l: string, tags: LocationTag[] = DEFAULT_TAGS) => levelRank(l, tags);
export const levelName = (l: string, tags: LocationTag[] = DEFAULT_TAGS) => tagText(l, tags);
export const zoneOrd = (z: string, tags: LocationTag[] = DEFAULT_TAGS) => zoneRank(z, tags);
export const zoneTitle = (z: string, tags: LocationTag[] = DEFAULT_TAGS) => tagText(z, tags);
const unitOrd = (u: string | null, tags: LocationTag[]) => (u ? (readTag(u, tags)?.n ?? 0) : -1);

// SimPRO attachment ids rise with each upload, so they give upload order.
const uploadOrd = (p: InspectionPhoto, i: number) => {
  const m = /(\d+)$/.exec(p.id);
  return m ? parseInt(m[1], 10) : i;
};

/** A name mid-sentence: "Surface wear" → "surface wear", but acronyms stay
 *  ("UV degradation"). */
const lower = (s: string) => (/^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

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
  title?: string;
  desc?: string;
  pos?: PhotoPos;
  order?: number;
}

export interface PhotoView {
  id: string;
  /** A built-in image instead of a job photo (the "Reading a photo" example). */
  img?: ImageKey;
  num: string;
  /** Every code on the photo; the one it's filed under first. */
  chips: Chip[];
  gname: string;
  pos?: PhotoPos;
  /** Zone (outside a zone chapter), level and unit. */
  where: string;
  note: string;
  /** What the card says when the builder leaves title / description blank. */
  autoName: string;
  autoNote: string;
}

export type { SectionKey };

interface BlockBase {
  /** Unique per distinct block; doubles as its measured-height key. */
  key: string;
  gap: number;
  keep?: boolean;
  brk?: boolean;
  /** Opens a section that starts a new page unless all of it fits on this one. */
  whole?: boolean;
  est: number;
  /** Placed first when this block opens a page (repeat header / continued). */
  cont?: Block;
  secKey?: SectionKey;
  chapKey?: string;
}

export interface SummaryRow {
  band: Band;
  bg: string;
  fg: string;
  name: string;
  count: string;
  text: string;
  n: number;
}

export type Block = BlockBase &
  (
    | { type: "sec"; label: string; title: string; intro: string }
    | { type: "why" }
    | { type: "ex"; title: string; intro: string; photo: PhotoView; legend: { part: string; ex: string; mean: string }[] }
    | { type: "sub"; title: string }
    | { type: "kHead" }
    | { type: "kGroup"; band: Band; def: BandDef; first: boolean }
    | { type: "kRow"; chip: Chip; name: string; count: string }
    | { type: "map"; photoId: string; pins: { zone: string; x: number; y: number }[] }
    | { type: "zones" }
    | { type: "dHead" }
    | { type: "defect"; chip: Chip; name: string; what: string; act: string }
    | { type: "chap"; title: string; meta: string }
    | { type: "cont"; text: string }
    | { type: "row"; photos: PhotoView[] }
    | { type: "notes"; html: string }
    | { type: "planHead"; next: boolean }
    | { type: "planRow"; item: PlanItem; next: boolean }
    | { type: "planNotes"; html: string }
    | { type: "ixHead" }
    | { type: "ixMore"; n: number }
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
  sections: { key: SectionKey; title: string; intro: string; label: string }[];
  /** Findings chapters with a heading, for the contents. */
  chapters: { key: string; title: string }[];
  blocks: Block[];
  zoneRows: ZoneRow[];
  hasOther: boolean;
  /** About this report cards for this report kind. */
  about: CardDef[];
  /** fit: how much of "Also worth adding" the space under the works table
   *  holds: the cards with photos, the cards without, or nothing. */
  works: { items: WorkItem[]; extras: (ExtraDef & { n: number })[]; href: string; fit: "images" | "text" | "none" };
  nDefects: number;
}

// ── Model ────────────────────────────────────────────────────────────────────

export function buildModel(data: InspectionReportData): InspectionModel {
  const { job } = data;
  const lib = libraryOf(data);
  const BANDS = lib.bands;
  const BAND_ORDER = lib.bandOrder;
  const TAGS = lib.tags;
  const levelOrd = (l: string) => levelRank(l, TAGS);
  const levelName = (l: string) => tagText(l, TAGS);
  const zoneOrd = (z: string) => zoneRank(z, TAGS);
  const zoneTitle = (z: string) => tagText(z, TAGS);
  const CODES = lib.codes;
  const CODE_MAP = lib.codeMap;
  const contact = contactFor(job.contact);
  const chip = (code: string): Chip => {
    const b = BANDS[CODE_MAP[code].band];
    return { code, fg: b.fg, bg: b.bg };
  };

  /** Wording edited in the builder, else the generated text. */
  const T = (key: string, def: string) => {
    const v = data.text?.[key];
    return v != null && !notesIsEmpty(sanitizeNotesHtml(v)) ? v : def;
  };
  const hidden = data.hidden ?? {};

  // Parse labels
  const parsed: ParsedPhoto[] = [];
  const warnings: InspectionModel["warnings"] = [];
  let mapPhotoId: string | null = null;
  data.photos.forEach((photo, i) => {
    const label = photoLabel(photo);
    const r = parseLabel(label, lib);
    if (r.kind === "map") {
      mapPhotoId ??= photo.id;
    } else if (!photo.off) {
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
        title: photo.title?.trim() || undefined,
        desc: photo.desc && !notesIsEmpty(sanitizeNotesHtml(photo.desc)) ? photo.desc : undefined,
        pos: photo.pos,
        order: photo.order,
      });
    }
  });

  const labelMapId = mapPhotoId;
  const chosenMapId = choiceId(data, data.siteMap, SITE_MAP_ID);
  if (chosenMapId) mapPhotoId = chosenMapId;

  const sortLU = (a: ParsedPhoto, b: ParsedPhoto) =>
    (a.order ?? 1e6) - (b.order ?? 1e6) ||
    levelOrd(a.level) - levelOrd(b.level) || unitOrd(a.unit, TAGS) - unitOrd(b.unit, TAGS) || a.ord - b.ord;
  const levelsTxt = (ps: ParsedPhoto[]) => {
    const lv = [...new Set(ps.map((p) => p.level).filter(Boolean))].sort((a, b) => levelOrd(a) - levelOrd(b));
    if (!lv.length) return "";
    return lv.length === 1 ? levelName(lv[0]) : levelName(lv[0]) + " to " + levelName(lv[lv.length - 1]);
  };
  const zones = [...new Set(parsed.map((p) => p.zone))].sort((a, b) => zoneOrd(a) - zoneOrd(b));

  // A photo with several codes shows once, filed under its most severe
  // defect (else Overview, else Other), with every code as a chip.
  const codeOrd = (code: string) => CODES.findIndex((c) => c.code === code);
  const primary = (p: ParsedPhoto) =>
    [...p.codes].filter((c) => c !== "OV" && c !== "OT").sort((a, b) => codeOrd(a) - codeOrd(b))[0] ??
    (p.codes.includes("OV") ? "OV" : "OT");

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
        const g = ps.filter((p) => primary(p) === c.code).sort(sortLU);
        if (g.length) groups.push({ code: c.code, ps: g });
      }
      const ovi = groups.findIndex((g) => g.code === "OV");
      if (ovi > 0) groups.unshift(groups.splice(ovi, 1)[0]);
      groups.forEach((g) => g.ps.forEach(assign));
      return {
        zone,
        ps: ps.filter((p) => primary(p) !== "OT"),
        groups,
      };
    })
    .filter((ch) => ch.groups.length);
  const other = parsed
    .filter((p) => primary(p) === "OT")
    .sort((a, b) => zoneOrd(a.zone) - zoneOrd(b.zone) || sortLU(a, b));
  other.forEach(assign);

  /** "Membrane tear or puncture, UV degradation": every defect on the
   *  photo, the one it's filed under first. */
  const defectNames = (p: ParsedPhoto, code: string) => {
    const defects = [code, ...p.codes.filter((c) => c !== code)].filter((c) => !CODE_MAP[c].system);
    if (!defects.length) return code === "OV" ? "Overview" : CODE_MAP[code].name;
    return [...new Set(defects)]
      .sort((a, b) => (a === code ? -1 : b === code ? 1 : codeOrd(a) - codeOrd(b)))
      .map((c, i) => (i ? lower(CODE_MAP[c].name) : CODE_MAP[c].name))
      .join(", ");
  };
  const placeOf = (p: ParsedPhoto, withZone: boolean) =>
    [withZone ? zoneTitle(p.zone) : "", levelName(p.level), p.unit ? tagText(p.unit, TAGS) : ""].filter(Boolean).join(", ");
  const view = (p: ParsedPhoto, withZone: boolean, code: string): PhotoView => {
    // As in the proposal: the name in the label is the title, and a photo
    // that's only tags takes its defect names. The description is the
    // builder's own.
    const autoName = cap(p.note) || (p.codes.length ? (code === "OT" ? "Other item of note" : defectNames(p, code)) : "Site photo");
    const autoNote = "";
    return {
      id: p.id,
      num: pad(numOf.get(p) ?? 0),
      chips: [code, ...p.codes.filter((c) => c !== code).sort((a, b) => codeOrd(a) - codeOrd(b))].filter((c) => p.codes.includes(c)).map(chip),
      gname: capFirst(p.title ?? autoName),
      pos: p.pos,
      where: placeOf(p, withZone),
      note: capFirst(p.desc ?? autoNote),
      autoName,
      autoNote,
    };
  };

  // Counts and generated copy
  const present = CODES.filter((c) => !c.system && parsed.some((p) => p.codes.includes(c.code))).map(
    (c) => c.code,
  );
  const withCode = (code: string) => parsed.filter((p) => p.codes.includes(code));
  const zonesOf = (code: string) =>
    [...new Set(withCode(code).map((p) => p.zone).filter(Boolean))].sort((a, b) => zoneOrd(a) - zoneOrd(b));

  const sumRows: SummaryRow[] = [];
  for (const band of BAND_ORDER) {
    const cs = present.filter((c) => CODE_MAP[c].band === band);
    if (!cs.length) continue;
    const n = cs.reduce((t, c) => t + withCode(c).length, 0);
    const parts = cs.map((c, i) => {
      const nm = CODE_MAP[c].name;
      const z = zonesOf(c);
      return (i ? lower(nm) : nm) + (z.length ? " at " + andList(z) : "");
    });
    sumRows.push({
      band,
      bg: BANDS[band].bg,
      fg: BANDS[band].fg,
      name: BANDS[band].name,
      count: plural(n, "defect"),
      text: T(`sum.${band}`, parts.join("; ") + ". " + BANDS[band].tail),
      n,
    });
  }
  const nDef = sumRows.reduce((t, r) => t + r.n, 0);
  const nRed = sumRows.find((r) => r.band === "red")?.n ?? 0;
  const zCount: Record<string, number> = {};
  for (const p of parsed) {
    const k = p.codes.filter((c) => !CODE_MAP[c].system).length;
    if (k && p.zone) zCount[p.zone] = (zCount[p.zone] ?? 0) + k;
  }
  const topZ = Object.keys(zCount)
    .sort((a, b) => zCount[b] - zCount[a] || zoneOrd(a) - zoneOrd(b))
    .slice(0, 3);
  const nZones = chapters.filter((c) => c.zone).length;
  const hasZones = nZones > 0;
  const hasPlaces = parsed.some((p) => p.zone || p.level || p.unit);
  const sumIntro =
    (hasZones
      ? `We inspected ${plural(nZones, "zone")} and recorded ${plural(nDef, "defect")} across ${plural(present.length, "defect type")}. `
      : `We recorded ${plural(nDef, "defect")} across ${plural(present.length, "defect type")}. `) +
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
    [
      "plan",
      "Maintenance plan",
      "Future maintenance considerations and lifecycle planning to assist with ongoing asset management and budgeting.",
    ],
    ["works", "Recommended works", "What needs to be done, in order of priority, and why."],
  ];
  // The site map needs zones and the index needs locations; either can also
  // be hidden in the builder, as can Defects explained and the Summary.
  const shown = (k: SectionKey) =>
    !(k === "map" && !hasZones) &&
    !(k === "index" && !hasPlaces) &&
    !(k === "plan" && !data.plan?.items.length) &&
    (k === "about" || k === "findings" || k === "works" || !sectionHidden(data, k));
  const visible = secDefs.filter(([k]) => shown(k));
  const N = visible.length;
  const sections = visible.map(([key, title, intro], i) => ({
    key,
    title: T(`sec.${key}.title`, title),
    intro: key === "about" ? intro : T(`sec.${key}.intro`, intro),
    label: `Section ${pad(i + 1)} / ${pad(N)}`,
  }));
  const secLabel = (k: SectionKey) => sections.find((s) => s.key === k)!.label;

  // ── Blocks ──
  const B: Block[] = [];
  const add = (b: Block) => {
    B.push(b);
    return b;
  };
  const sec = (key: SectionKey, force = false, whole = false) => {
    const { title, intro } = sections.find((s) => s.key === key)!;
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
      whole,
      secKey: key,
    });
  };

  // 01 About
  sec("about");
  // About and "Reading a photo" always share the first page.
  add({ type: "why", key: "why", gap: 56, est: 480, keep: true });
  // "Reading a photo" uses a made-up example with a single code, so it
  // reads the same whatever the job's photos carry.
  {
    const ex = lib.example;
    const exV: PhotoView = {
      id: "example",
      img: ex.img,
      num: "01",
      chips: [chip(ex.code)],
      gname: ex.note,
      where: zoneTitle(ex.zone) + ", " + levelName(ex.level),
      note: "",
      autoName: ex.note,
      autoNote: "",
    };
    add({
      type: "ex",
      key: "ex",
      title: T("ex.title", "Reading a photo"),
      intro: T("ex.intro", "Every photo in this report is labelled the same way, like this example."),
      photo: exV,
      legend: [
        { part: "Code", ex: ex.code, mean: T("ex.mean.0", "The type of defect. Its colour shows the severity.") },
        { part: "Photo number", ex: "Photo 01", mean: T("ex.mean.1", "Use it to find the photo in the Location index.") },
        { part: "Location", ex: exV.where, mean: T("ex.mean.2", "D is a rope drop, S a section. LG is ground, LR the roof.") },
        { part: "Title", ex: ex.note, mean: T("ex.mean.3", "What we found at this spot.") },
      ],
      gap: 56,
      est: 720,
    });
  }
  // Severity: only the codes in this report, under the bands they're in.
  const keyBands = BAND_ORDER.map((band) => ({
    band,
    codes: CODES.filter((x) => x.band === band && !x.system && withCode(x.code).length),
  })).filter((g) => g.codes.length);
  if (keyBands.length) add({ type: "sub", key: "sub-key", title: "Severity", gap: 0, keep: true, est: 44, brk: true });
  const kHead: Block = { type: "kHead", key: "khead", gap: 0, est: 40 };
  if (keyBands.length) add({ ...kHead, gap: 40, keep: true });
  keyBands.forEach(({ band, codes }, gi) => {
    add({ type: "kGroup", key: "kg-" + band, band, def: BANDS[band], first: gi === 0, gap: 0, keep: true, est: gi ? 86 : 62, cont: kHead });
    for (const c of codes) {
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
  const zoned = chapters.filter((c) => c.zone);
  const dl = zoned.map((c) => c.zone).filter((z) => z[0] === "D");
  const sl = zoned.map((c) => c.zone).filter((z) => z[0] !== "D");
  const defPos = (z: string): [number, number] => {
    const isD = z[0] === "D";
    const arr = isD ? dl : sl;
    const i = arr.indexOf(z);
    return isD ? [24 + (62 * (i + 0.5)) / arr.length, 69] : [32 + (48 * (i + 0.5)) / arr.length, 54];
  };
  if (shown("map")) sec("map", true);
  if (shown("map") && mapPhotoId) {
    add({
      type: "map",
      key: "map",
      photoId: mapPhotoId,
      pins: zoned.map((c) => {
        const [x, y] = data.pins[c.zone] ?? defPos(c.zone);
        return { zone: c.zone, x, y };
      }),
      gap: 56,
      est: 725,
    });
  }
  const zoneRows: ZoneRow[] = zoned.map((c) => ({
    zone: c.zone,
    title: zoneTitle(c.zone),
    levels: levelsTxt(c.ps),
    count: c.ps.length,
  }));
  if (shown("map")) add({ type: "zones", key: "zones", gap: 72, est: 40 + zoneRows.length * 51 });

  // 03 Defects explained
  if (shown("defects")) {
    // On its own page, unless all of it fits under Severity.
    sec("defects", false, true);
    const dHead: Block = { type: "dHead", key: "dhead", gap: 0, est: 40 };
    add({ ...dHead, gap: 56, keep: true });
    for (const code of present) {
      const c = CODE_MAP[code];
      add({
        type: "defect",
        key: "def-" + code,
        chip: chip(code),
        name: c.name,
        what: T(`defect.${code}.what`, c.what),
        act: T(`defect.${code}.act`, c.action),
        gap: 0,
        est: 92,
        cont: dHead,
      });
    }
  }

  // 04 Findings
  sec("findings", true);
  // Photos with no zone: "Other areas" beside zoned chapters, or no
  // chapter heading at all when the report has no zones.
  const chapList = chapters.map((ch) => ({
    key: ch.zone || "ALL",
    title: zoneTitle(ch.zone) || (hasZones ? "Other areas" : ""),
    meta: [plural(ch.ps.length, "photo"), levelsTxt(ch.ps)].filter(Boolean).join(" · "),
    items: ch.groups.flatMap((g) => g.ps.map((p) => [p, g.code] as const)),
    withZone: false,
  }));
  if (other.length) {
    chapList.push({
      key: "OT",
      // On their own they just follow the Findings heading.
      title: chapters.length ? "Other items of note" : "",
      meta: plural(other.length, "photo") + " · Items that do not fit a defect code",
      items: other.map((p) => [p, "OT"] as const),
      withZone: true,
    });
  }
  chapList.forEach((ch, ci) => {
    if (ch.title) add({
      type: "chap",
      key: "chap-" + ch.key,
      title: ch.title,
      meta: ch.meta,
      gap: ci ? 96 : 56,
      keep: true,
      est: 120,
      chapKey: ch.key,
    });
    const cont: Block = { type: "cont", key: "cont-" + ch.key, text: (ch.title || "Findings") + ", continued", gap: 0, est: 20 };
    for (let r = 0; r < ch.items.length; r += PER_ROW) {
      add({
        type: "row",
        key: `row-${ch.key}-${r}`,
        photos: ch.items.slice(r, r + PER_ROW).map(([p, c]) => view(p, ch.withZone, c)),
        gap: r ? 48 : ch.title ? 40 : 56,
        est: 560,
        cont,
      });
    }
  });

  // Technician comments close the findings, as in the anchor report.
  const notesHtml = sanitizeNotesHtml(job.technicianNotes);
  if (!notesIsEmpty(notesHtml)) {
    add({
      type: "notes",
      key: "notes",
      html: notesHtml,
      gap: 96,
      est: 120 + notesLineCount(notesHtml) * 32,
    });
  }

  // 05 Location index
  if (shown("index")) {
    sec("index", true);
    const ixHead: Block = { type: "ixHead", key: "ixhead", gap: 0, est: 40 };
    add({ ...ixHead, gap: 56, keep: true });
    const ix = new Map<string, { p: ParsedPhoto; codes: Set<string>; nums: number[] }>();
    // Only located photos are listed; the rest are counted on a closing line.
    const located = parsed.filter((p) => p.zone || p.level || p.unit);
    [...located]
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
      if (!codes.length && e.codes.has("OV")) codes = ["OV"];
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
    const unlocated = parsed.length - located.length;
    if (unlocated) add({ type: "ixMore", key: "ix-more", n: unlocated, gap: 24, est: 30, cont: ixHead });
  }

  // 06 Summary
  if (shown("summary")) {
    sec("summary", true);
    add({
      type: "sum",
      key: "sum",
      note: T("sum.note", lib.exclusions.join(" ")),
      rows: sumRows,
      stats: [
        { v: nDef, k: "Defects recorded" },
        { v: nRed, k: "Need action now" },
        { v: present.length, k: "Defect types" },
        hasZones ? { v: nZones, k: "Zones inspected" } : { v: parsed.length, k: "Photos" },
      ],
      gap: 56,
      est: 330 + sumRows.length * 210,
    });
  }

  // 07 Maintenance plan (optional): required services first.
  if (shown("plan")) {
    sec("plan", true);
    const items = [...data.plan!.items].sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "required" ? -1 : 1));
    const next = items.some((x) => x.next?.trim());
    const planHead: Block = { type: "planHead", key: "planhead", next, gap: 0, est: 40 };
    add({ ...planHead, gap: 56, keep: true });
    items.forEach((item, i) => add({ type: "planRow", key: `plan-${i}`, item, next, gap: 0, est: 64, cont: planHead }));
    const notes = sanitizeNotesHtml(data.plan!.notes);
    if (!notesIsEmpty(notes))
      add({ type: "planNotes", key: "plan-notes", html: notes, gap: 72, est: 120 + notesLineCount(notes) * 32 });
  }

  // 07 Recommended works (own page, rendered outside the flow)
  const items: WorkItem[] = present.map((code) => ({
    chip: chip(code),
    name: T(`works.${code}.name`, CODE_MAP[code].work),
    why: T(`works.${code}.why`, CODE_MAP[code].why),
    zones: zonesOf(code).join(", "),
  }));
  // n: the card's place in the library, which keys its edited wording.
  const extras = lib.extras
    .map((x, n) => ({ ...x, n, t: T(`extra.${n}.t`, x.t), d: T(`extra.${n}.d`, x.d) }))
    .filter((x) => !x.whenAny || present.some((c) => x.whenAny!.includes(c)));
  const reportName = lib.label.toLowerCase() + " report";
  const body =
    `Hi RAS-VERTEX team,\n\nPlease quote the following works from ${reportName} ${job.ref} for ${job.site}, ${job.address}:\n\n` +
    items.map((w) => `- ${w.name}${w.zones ? ` (${w.zones})` : ""}`).join("\n") +
    "\n\nThanks,";
  const href =
    // Quote requests go to the team inbox; the contact is named on the page.
    "mailto:team@rasvertex.com.au" +
    "?subject=" +
    encodeURIComponent(`Quote request, ${reportName} ${job.ref}, ${job.site}`) +
    "&body=" +
    encodeURIComponent(body);

  // Until one is chosen, the cover is the standard photo (assets.defaultCover).
  const coverPhotoId = choiceId(data, data.cover, COVER_ID);

  return {
    parsed,
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
    chapters: chapList.filter((c) => c.title).map((c) => ({ key: c.key, title: c.title })),
    hasOther: other.length > 0,
    about: lib.about.map((a, i) => ({ ...a, t: T(`about.${i}.t`, a.t), d: T(`about.${i}.d`, a.d) })),
    works: { items, extras, href, fit: extras.length ? worksFit(items) : "none" },
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
  /** The section each flowed page belongs to (the one under way at its top). */
  pageSec: SectionKey[];
}

/** Table rows that lose their bottom rule as the last row on a page. */
const RULED: BlockType[] = ["kRow", "defect", "ixRow", "planRow"];

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
    if (b.whole && cur.length) {
      let all = b.gap + hOf(b);
      for (let j = i + 1; j < blocks.length && !blocks[j].secKey && !blocks[j].brk; j++) all += blocks[j].gap + hOf(blocks[j]);
      if (used + all > FLOW_H) newPage();
    }
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
  let sec: SectionKey = "about";
  const pageSec = pages.map((page) => (sec = page.find((b) => b.secKey)?.secKey ?? sec));
  const total = pages.length + FIRST_FLOW_PAGE;
  secPage.works = total;
  return { pages, total, secPage, chapPage, pageSec };
}

export { pad as padPage };
