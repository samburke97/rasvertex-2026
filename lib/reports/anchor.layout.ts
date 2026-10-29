// lib/reports/anchor.layout.ts
//
// Everything the Anchor Inspection Report document needs, derived once from
// the report data: the generated copy, per-zone type tables, the asset
// register, and which page each block lands on. Pure, so the builder
// preview and the PDF route paginate identically.
//
// Pages are 1280 × 1810 page units (A4 at 0.62 scale). Every flowed block
// has a fixed or computable height (map boxes size by aspect ratio, table
// rows are a fixed height), so pagination is arithmetic rather than measured.

import {
  ANCHOR_TYPE_IS_RATED,
  ANCHOR_TYPE_LABELS,
  DEFAULT_COVER_POS,
  DEFAULT_MAP_RATIO,
  anchorGroupKey,
  anchorGroupOrder,
  anchorIconName,
  anchorTypeSentence,
  buildLegendGroups,
  computeLineEdges,
  pastelFor,
  type AnchorReportData,
  type CoverPos,
  type Pastel,
  type ReportPhoto,
} from "./anchor.types";
import { filterPhotosByDateRange } from "./photos";
import { parseReportDate } from "./format-report-date";
import { notesIsEmpty, notesLineCount, sanitizeNotesHtml } from "./richText";

export const PAGE_W = 1280;
export const PAGE_H = 1810;
export const CONTENT_W = 1088;

// Content runs from the page's 80 top padding to just above the page number.
const TOP = 80;
const BOTTOM = 1700;
const SEC_LABEL = 58; // 18 label + 40 margin
const H2 = 53; // 48 / 1.1
const TABLE_HEAD = 32;
const TYPE_ROW = 53;
const REG_ROW = 48;
const MAX_MAP_H = 900;
const PHOTOS_PER_PAGE = 6;

// ── Dates ─────────────────────────────────────────────────────────────────────

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "26 October 2026", or "26 Oct 2026" with short. Unparseable passes through. */
export function fmtDate(raw: string | null | undefined, short = false): string {
  const d = raw ? parseReportDate(raw) : null;
  if (!d) return raw ?? "";
  const m = MONTHS[d.getMonth()];
  return `${d.getDate()} ${short ? m.slice(0, 3) : m} ${d.getFullYear()}`;
}

function andList(a: string[]): string {
  return a.length < 2
    ? (a[0] ?? "")
    : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}

export const pad = (n: number) => String(n).padStart(2, "0");

// ── Model ─────────────────────────────────────────────────────────────────────

export interface Pin {
  id: string;
  label: string;
  x: number;
  y: number;
  pastel: Pastel;
}

export interface TypeRow {
  key: string;
  name: string;
  icon: string;
  range: string;
  qty: number;
  passed: number;
  failed: number;
  pastel: Pastel;
}

/** Certification table line: every anchor of one type, across all zones. */
export interface CertRow {
  type: string;
  name: string;
  qty: number;
  rating: string;
  passed: number;
  failed: number;
}

export interface ZoneBlock {
  id: string;
  name: string;
  mapUrl: string | null;
  mapRatio: number;
  /** Map box width; narrower than the column only for tall images. */
  mapW: number;
  pins: Pin[];
  lines: { x1: number; y1: number; x2: number; y2: number; color: string }[];
  types: TypeRow[];
}

export interface RegRow {
  id: string;
  label: string;
  icon: string;
  type: string;
  inspected: string;
  next: string;
  result: "Passed" | "Failed" | "N/A";
}

export type SummaryItem =
  | { kind: "intro" }
  | { kind: "zone"; zone: ZoneBlock; first: boolean };

/** Register line: an anchor, or (multi-zone reports) a zone heading row. */
export type RegLine =
  | ({ kind: "row" } & RegRow)
  /** Starts a zone's own block: a "Zone 3" title and the column headings. */
  | { kind: "group"; id: string; title: string };

export type Page =
  | { kind: "summary"; first: boolean; items: SummaryItem[]; no: number }
  | {
      kind: "register";
      first: boolean;
      rows: RegLine[];
      notes?: string;
      no: number;
    }
  | { kind: "photos"; photos: ReportPhoto[]; no: number }
  | { kind: "cert"; no: number };

export interface AnchorModel {
  site: string;
  blurb: string;
  coverUrl: string | null;
  coverPos: CoverPos;
  facts: { k: string; v: string }[];
  summary: string;
  stats: { v: number; k: string }[];
  zones: ZoneBlock[];
  pages: Page[];
  /** Numbered pages: summary through certification. */
  total: number;
  toc: { title: string; items: { name: string; page: string }[] }[];
  certFacts: { k: string; v: string }[];
  certRows: CertRow[];
  certNumber: string;
  comments: string;
}

/** Street and suburb: "7 Venning Street, Mooloolaba". */
function shortAddress(address: string): string {
  return address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(", ");
}

// The pre-redesign default blurb; drafts saved with it get the new one.
const OLD_BLURB_START = "This report relates to existing Height Safety";

function linesOf(text: string, charsPerLine: number): number {
  return Math.max(1, Math.ceil(text.length / charsPerLine));
}

export function buildAnchorModel(
  report: AnchorReportData,
  coverFallback: string | null,
): AnchorModel {
  const { job } = report;
  const site =
    job.buildingName || shortAddress(job.address) || "Anchor inspection";
  const desc = job.description?.trim();
  const blurb =
    desc && !desc.startsWith(OLD_BLURB_START)
      ? desc
      : `This report records the inspection, load testing and certification of the roof access and fall prevention systems${
          job.address ? ` at ${shortAddress(job.address)}` : ""
        }.`;

  // ── Zones: map pins and type table ──
  const order = anchorGroupOrder(report.zones);
  const zones: ZoneBlock[] = report.zones.map((z) => {
    const types = [...new Set(z.anchors.map((a) => a.type))];
    const firstIdx = (key: string) =>
      z.anchors.findIndex((a) => anchorGroupKey(a) === key);
    const groups = buildLegendGroups(types, z.anchors).sort(
      (x, y) => firstIdx(x.key) - firstIdx(y.key),
    );
    const rows: TypeRow[] = groups.map((g) => {
      const xs = z.anchors.filter((a) => anchorGroupKey(a) === g.key);
      const failed = xs.filter((a) => a.result === "FAILED").length;
      const passed = xs.filter((a) => a.result === "PASSED").length;
      const first = xs[0];
      return {
        key: g.key,
        name: anchorTypeSentence(first),
        icon: anchorIconName(first),
        range:
          xs.length > 1
            ? `${xs[0].label}–${xs[xs.length - 1].label}`
            : first.label,
        qty: xs.length,
        passed,
        failed,
        pastel: pastelFor(order, g.key),
      };
    });
    const ratio = z.mapImageRatio ?? DEFAULT_MAP_RATIO;
    return {
      id: z.id,
      name: z.name,
      mapUrl: z.mapImageUrl,
      mapRatio: ratio,
      mapW: Math.min(CONTENT_W, Math.round(MAX_MAP_H * ratio)),
      pins: z.anchors
        .filter((a) => typeof a.x === "number" && typeof a.y === "number")
        .map((a) => ({
          id: a.id,
          label: a.label,
          x: a.x,
          y: a.y,
          pastel: pastelFor(order, anchorGroupKey(a)),
        })),
      lines: computeLineEdges(z.anchors).map((e) => ({
        x1: e.from.x,
        y1: e.from.y,
        x2: e.to.x,
        y2: e.to.y,
        color: pastelFor(order, anchorGroupKey(e.from)).fg,
      })),
      types: rows,
    };
  });

  // ── Totals and summary copy ──
  const all = report.zones.flatMap((z) => z.anchors);
  const n = all.length;
  const failedIds = all
    .filter((a) => a.result === "FAILED")
    .map((a) => a.label);
  const nFail = failedIds.length;
  const nPass = all.filter((a) => a.result === "PASSED").length;
  const allAnchors = n > 0 && all.every((a) => ANCHOR_TYPE_IS_RATED[a.type]);
  const allRope = n > 0 && all.every((a) => a.type === "rope-access-anchor");
  const noun = allRope
    ? "rope access anchors"
    : allAnchors
      ? "anchors"
      : "height safety assets";
  const inspected = fmtDate(job.inspectionDate);
  const next = fmtDate(job.nextInspectionDate);
  const summary =
    `RAS-VERTEX inspected and load tested ${n} ${noun} at ${site}${inspected ? ` on ${inspected}` : ""}. ` +
    (nFail
      ? `${nPass} passed and ${nFail} failed (${andList(failedIds)}). Failed ${allAnchors ? "anchors" : "items"} must not be used until repaired and retested. `
      : n
        ? `All ${n} passed. `
        : "") +
    (next ? `The next inspection is due by ${next}.` : "");

  const certRows: CertRow[] = [];
  for (const a of all) {
    let row = certRows.find((r) => r.type === a.type);
    if (!row) {
      row = {
        type: a.type,
        name: ANCHOR_TYPE_LABELS[a.type],
        qty: 0,
        rating: ANCHOR_TYPE_IS_RATED[a.type] ? "15 kN" : "–",
        passed: 0,
        failed: 0,
      };
      certRows.push(row);
    }
    row.qty += 1;
    if (a.result === "PASSED") row.passed += 1;
    else if (a.result === "FAILED") row.failed += 1;
  }

  const toRow = (
    a: AnchorReportData["zones"][number]["anchors"][number],
  ): RegRow => ({
    id: a.id,
    label: a.label,
    icon: anchorIconName(a),
    type: anchorTypeSentence(a),
    inspected: fmtDate(a.inspectionDate, true),
    next: fmtDate(a.nextInspection, true),
    result:
      a.result === "PASSED"
        ? "Passed"
        : a.result === "FAILED"
          ? "Failed"
          : "N/A",
  });
  const notesHtml = sanitizeNotesHtml(job.technicianNotes);
  const notes = notesIsEmpty(notesHtml) ? "" : notesHtml;
  const notesBody =
    17 +
    10 +
    notesLineCount(notes) * 28 +
    (notes.match(/<(?:p|h2|h3|li|blockquote|hr)\b/g) ?? []).length * 10;

  // ── Summary pages: intro, then one block per zone ──
  const pages: Page[] = [];
  const introH = H2 + 20 + linesOf(summary, 70) * 32 + 237;
  const zoneH = (z: ZoneBlock, first: boolean) =>
    (first ? 0 : 72) +
    27 +
    (z.mapUrl ? 24 + Math.round(z.mapW / z.mapRatio) : 0) +
    (z.types.length ? 56 + TABLE_HEAD + z.types.length * TYPE_ROW : 0);

  let cur: {
    kind: "summary";
    first: boolean;
    items: SummaryItem[];
    no: number;
  } = {
    kind: "summary",
    first: true,
    items: [{ kind: "intro" }],
    no: 0,
  };
  let y = TOP + SEC_LABEL + introH;
  const newPage = () => {
    pages.push(cur);
    cur = { kind: "summary", first: false, items: [], no: 0 };
    y = TOP + SEC_LABEL;
  };
  // A zone that won't fit moves to the next page, including off the intro
  // page; only a page with nothing on it yet keeps an oversized zone.
  for (const z of zones) {
    if (y + zoneH(z, false) > BOTTOM && cur.items.length > 0) newPage();
    const first = !cur.first && cur.items.length === 0;
    cur.items.push({ kind: "zone", zone: z, first });
    y += zoneH(z, first);
  }
  pages.push(cur);

  // ── Asset register: one table; with several zones, split by zone ──
  // Each zone gets a "Zone 3" title and its own column headings, with extra
  // space above. A page that starts partway through a zone carries on with
  // just the column headings, and a title never sits at the bottom of a page
  // without at least two of its rows under it.
  const grouped = report.zones.length > 1;
  const lines: RegLine[] = report.zones.flatMap((z, zi) =>
    z.anchors.length
      ? [
          ...(grouped
            ? [
                {
                  kind: "group" as const,
                  id: `g-${z.id}`,
                  title: `Zone ${zi + 1}`,
                },
              ]
            : []),
          ...z.anchors.map((a) => ({ kind: "row" as const, ...toRow(a) })),
        ]
      : [],
  );
  const ZONE_TITLE = 27 + 16 + TABLE_HEAD; // title, gap, column headings
  const ZONE_GAP = 72;
  const regPages: Extract<Page, { kind: "register" }>[] = [];
  const used = new Map<Extract<Page, { kind: "register" }>, number>();
  let i = 0;
  do {
    const first = regPages.length === 0;
    const start = TOP + SEC_LABEL + (first ? H2 + 20 + 32 + 56 : 0);
    let yy = start;
    const rows: RegLine[] = [];
    // A zone carried over from the last page just continues its table.
    if (lines[i]?.kind !== "group") yy += TABLE_HEAD;
    while (i < lines.length) {
      const line = lines[i];
      if (line.kind === "group") {
        const h = (rows.length ? ZONE_GAP : 0) + ZONE_TITLE;
        if (rows.length && yy + h + 2 * REG_ROW > BOTTOM) break;
        yy += h;
      } else {
        if (yy + REG_ROW > BOTTOM) break;
        yy += REG_ROW;
      }
      rows.push(line);
      i++;
    }
    const page = { kind: "register" as const, first, rows, no: 0 };
    used.set(page, yy);
    regPages.push(page);
  } while (i < lines.length);

  // Technician notes follow the last register row, or start a new page
  // when they won't fit under it.
  if (notes) {
    const last = regPages[regPages.length - 1];
    if ((used.get(last) ?? BOTTOM) + 56 + notesBody <= BOTTOM)
      last.notes = notes;
    else
      regPages.push({ kind: "register", first: false, rows: [], notes, no: 0 });
  }
  pages.push(...regPages);

  // ── Optional photos ──
  const ps = report.photoSettings;
  if (ps?.enabled && report.photos?.length) {
    const photos = ps.filterByDate
      ? filterPhotosByDateRange(report.photos, ps.dateFrom, ps.dateTo)
      : report.photos;
    for (let k = 0; k < photos.length; k += PHOTOS_PER_PAGE) {
      pages.push({
        kind: "photos",
        photos: photos.slice(k, k + PHOTOS_PER_PAGE),
        no: 0,
      });
    }
  }

  pages.push({ kind: "cert", no: 0 });
  pages.forEach((p, k) => (p.no = k + 1));
  const total = pages.length;

  const firstOf = (kind: Page["kind"]) =>
    pages.find((p) => p.kind === kind)?.no;
  const inspectionItems = [
    { name: "Summary", page: String(firstOf("summary")) },
    { name: "Asset register", page: String(firstOf("register")) },
  ];
  if (firstOf("photos"))
    inspectionItems.push({ name: "Photos", page: String(firstOf("photos")) });

  return {
    site,
    blurb,
    coverUrl: report.coverUrl || coverFallback,
    coverPos: report.coverPos ?? DEFAULT_COVER_POS,
    facts: [
      { k: "Prepared for", v: job.preparedFor },
      { k: "Prepared by", v: job.preparedBy },
      { k: "Report", v: `#${job.certNumber}` },
      { k: "Date", v: fmtDate(job.date) },
    ],
    summary,
    stats: [
      { v: n, k: `${allAnchors ? "Anchors" : "Assets"} inspected` },
      { v: nPass, k: "Passed" },
      { v: nFail, k: "Failed" },
    ],
    zones,
    pages,
    total,
    toc: [
      { title: "Inspection", items: inspectionItems },
      {
        title: "Certification",
        items: [
          { name: `Certification #${job.certNumber}`, page: String(total) },
        ],
      },
      {
        title: "RAS-VERTEX",
        items: [{ name: "One partner", page: String(total + 1) }],
      },
    ],
    certFacts: [
      { k: "Attention", v: job.preparedFor },
      { k: "Building name", v: job.buildingName },
      { k: "Building address", v: job.address },
      { k: "Authorised by", v: job.authorisedBy },
      { k: "Inspection date", v: inspected },
      { k: "Next inspection date", v: next },
    ],
    certRows,
    certNumber: job.certNumber,
    comments: job.certComments?.trim() ?? "",
  };
}

// ── Static images (paths under public/) ───────────────────────────────────────

export const ANCHOR_IMAGES = {
  logo: "reports/proposal/assets/logo-full.png",
  signature: "reports/anchor/sig-phil-clark.png",
  caroline: "reports/proposal/assets/people-caro.jpg",
  height: "reports/proposal/assets/nav-height.png",
  cleaning: "reports/anchor/high-rise-window-cleaning.webp",
  painting: "reports/proposal/assets/nav-painting.png",
  maintenance: "reports/proposal/assets/nav-maintenance.png",
  inspections: "reports/anchor/web-nav-inspections.jpg",
  waterproofing: "reports/proposal/assets/nav-waterproofing.png",
  qbcc: "reports/proposal/assets/qbcc.png",
  smartstrata: "reports/anchor/smartstrata.png",
  workcover: "reports/anchor/workcover.png",
  mosaic: "reports/anchor/clients/mosaic-clean.svg",
  coolum: "reports/anchor/clients/coolum.png",
  maroochy: "reports/anchor/clients/maroochy.png",
  trafalgar: "reports/anchor/clients/trafalgar-clean.svg",
  mcnab: "reports/anchor/clients/mcnab.png",
  accor: "reports/anchor/clients/accor-clean.svg",
  novotel: "reports/anchor/clients/novotel.png",
  racv: "reports/anchor/clients/racv.png",
} as const;
export type AnchorImageKey = keyof typeof ANCHOR_IMAGES;

export const ANCHOR_ICON_NAMES = [
  "fall-arrest-anchor",
  "ladder-bracket",
  "access-hatch",
  "wire-rope-sling",
  "static-line",
  "walkway-line",
  "harness",
  "rope-access-anchor",
  "surface-mount",
  "eye-bolt",
  "through-bolt",
  "screw-in",
  "tensile",
  "purlin",
] as const;
export const anchorIconPath = (name: string) =>
  `reports/anchor/icons/${name}.svg`;
