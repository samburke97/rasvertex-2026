// lib/reports/anchor.types.ts

import type { ReportPhoto, PhotoLayout } from "./photos";
import { ANCHOR_PASTELS, colourOf, type AnchorTypeDef } from "./settings/types";
export type { ReportPhoto, PhotoFolder, PhotoLayout } from "./photos";

/** The anchor types a report was started with (Reports › Settings ›
 *  Anchor types). Undefined on reports from before settings: the built-in
 *  types below, as they always were. */
export type AnchorDefs = AnchorTypeDef[] | undefined;

/** A built-in type, or one an admin added in the settings. */
export type AnchorType = BuiltinAnchorType | (string & {});

export type BuiltinAnchorType =
  | "fall-arrest-anchor"
  | "ladder-bracket"
  | "access-hatch"
  | "wire-rope-sling"
  | "static-line"
  | "walkway-line"
  | "harness"
  | "rope-access-anchor";

// Anchor types whose pins connect to each other via a drawn line (see
// AnchorPoint.connectsTo / computeLineEdges) rather than standing alone.
export const LINE_TYPES: string[] = ["static-line", "walkway-line"];
export function isLineType(type: AnchorType): boolean {
  return LINE_TYPES.includes(type);
}

export type PassFail = "PASSED" | "FAILED" | "N/A";

// Mounting sub-option — only meaningful for anchor types listed in
// ANCHOR_TYPE_SUBTYPES. Shared across types (e.g. "eye-bolt" means the same
// thing whether it's a fall-arrest-anchor or a rope-access-anchor), so this
// is one flat enum rather than a per-type one.
export type AnchorSubtype =
  | "surface-mount"
  | "eye-bolt"
  | "through-bolt"
  | "screw-in"
  | "tensile"
  | "purlin"
  | "rafter";

export interface AnchorPoint {
  id: string;
  label: string; // "Asset #" in the UI
  type: AnchorType;
  // Only set (and only shown in the UI) for types in ANCHOR_TYPE_SUBTYPES.
  subtype?: AnchorSubtype;
  commissionDate?: string;
  inspectionDate: string;
  nextInspection: string;
  result: PassFail;
  x: number;
  y: number;
  // Line types only (LINE_TYPES) — ids of other same-type anchors this one
  // has a line segment to. For static-line, placing anchors back-to-back
  // auto-connects them into a chain; closing a loop (or any non-sequential
  // connection) adds an explicit edge on top of that. Walkway-line pairs
  // instead — each pin auto-connects to the previous one only if that
  // previous pin isn't already part of a pair, so placement alternates
  // start, end, start, end into independent 2-point segments rather than
  // one continuous run. Each edge is stored once, on one side only — see
  // computeLineEdges.
  connectsTo?: string[];
}

export interface Zone {
  id: string;
  name: string;
  mapImageUrl: string | null;
  // width/height of mapImageUrl's own native dimensions — captured aerials
  // are always exactly DEFAULT_MAP_RATIO (they're fetched at a fixed pixel
  // size), but an uploaded photo can be any shape, so the editor and PDF
  // both size their image box to this ratio instead of assuming 8:5 and
  // cropping whatever doesn't fit. Absent on zones saved before this field
  // existed — callers fall back to DEFAULT_MAP_RATIO.
  mapImageRatio?: number;
  mapLat?: number;
  mapLng?: number;
  mapZoom?: number;
  anchors: AnchorPoint[];
}

// Captured aerials are always fetched at this pixel size (8:5) — the
// fallback ratio for zones/images with no mapImageRatio recorded.
export const DEFAULT_MAP_RATIO = 8 / 5;

export interface AnchorReportJob {
  // Cover page
  preparedFor: string;
  preparedBy: string;
  address: string;
  reportType: string;
  date: string;
  description: string;
  // Certification page
  certNumber: string;
  buildingName: string;
  inspectionDate: string;
  nextInspectionDate: string;
  authorisedBy: string;
  certComments: string;
  /** Shown under the asset register. Optional (absent on older drafts). */
  technicianNotes?: string;
  /** SimPRO Site ID, used only for the Save-to-Site export path — not rendered. */
  siteId: string;
}

// Supporting photos are entirely optional on the anchor report (unlike the
// condition report, where the photo grid is the point of the report) — off
// by default, switched on from the options panel.
export interface AnchorPhotoSettings {
  enabled: boolean;
  showDates: boolean;
  photoLayout: PhotoLayout;
  filterByDate: boolean;
  dateFrom: string | null; // "YYYY-MM-DD"
  dateTo: string | null; // "YYYY-MM-DD"
}

/** Cover photo framing: focal point (%) and zoom. */
export interface CoverPos {
  x: number;
  y: number;
  zoom: number;
}
export const DEFAULT_COVER_POS: CoverPos = { x: 50, y: 50, zoom: 1 };
/** Used on the cover until a photo is uploaded. */
export const DEFAULT_COVER_IMAGE = "images/height-safety.png";

export interface AnchorReportData {
  job: AnchorReportJob;
  zones: Zone[];
  photos: ReportPhoto[];
  photoSettings: AnchorPhotoSettings;
  /** Uploaded cover photo. Absent or null means DEFAULT_COVER_IMAGE. */
  coverUrl?: string | null;
  coverPos?: CoverPos;
  /** Anchor types as set in Reports › Settings when this report started. */
  anchorTypes?: AnchorTypeDef[];
}

export const ANCHOR_TYPE_COLOURS: Record<string, string> = {
  "fall-arrest-anchor": "#10b981",
  "ladder-bracket": "#3b82f6",
  "access-hatch": "#ec4899",
  "wire-rope-sling": "#f97316",
  "static-line": "#6366f1",
  "walkway-line": "#eab308",
  harness: "#14b8a6",
  "rope-access-anchor": "#8b5cf6",
};

// Pastel pill colours (pale background, darker same-hue text) used for
// pins, tags and the type table. Assigned per legend group, cycling in this
// order, so subtypes of one type still get told apart.
export interface Pastel {
  bg: string;
  fg: string;
}
export const PASTEL_CYCLE: Pastel[] = [
  { bg: "#e3f5ea", fg: "#3f9a68" }, // green
  { bg: "#eeeafb", fg: "#7a66c7" }, // violet
  { bg: "#e5f0fd", fg: "#4a82c9" }, // blue
  { bg: "#fbe8f1", fg: "#c2557f" }, // pink
  { bg: "#fdeee2", fg: "#c46f2e" }, // orange
  { bg: "#e9ebfb", fg: "#5b63c4" }, // indigo
  { bg: "#fbf4d9", fg: "#9a7a12" }, // yellow
  { bg: "#e0f4f2", fg: "#2f8f86" }, // teal
];

/** buildLegendGroups key for one anchor. */
export function anchorGroupKey(a: Pick<AnchorPoint, "type" | "subtype">): string {
  if (a.subtype) return `${a.type}:${a.subtype}`;
  return ANCHOR_TYPE_SUBTYPES[a.type] ? `${a.type}:none` : a.type;
}

/** Legend group keys across every zone, in the order anchors were placed. */
export function anchorGroupOrder(zones: { anchors: AnchorPoint[] }[]): string[] {
  const order: string[] = [];
  for (const z of zones) {
    for (const a of z.anchors) {
      const k = anchorGroupKey(a);
      if (!order.includes(k)) order.push(k);
    }
  }
  return order;
}

export function pastelFor(order: string[], key: string, defs?: AnchorDefs): Pastel {
  // With settings, each type has its own colour; before, groups took the
  // next colour in placement order.
  const def = defs?.find((d) => d.key === key.split(":")[0]);
  if (def) return colourOf(def.colour, ANCHOR_PASTELS);
  const i = order.indexOf(key);
  return PASTEL_CYCLE[(i < 0 ? order.length : i) % PASTEL_CYCLE.length];
}

/** Icon file (public/reports/anchor/icons) for an anchor: subtype first.
 *  Rafter anchors have one icon per type, fall arrest and rope access. */
export function anchorIconName(a: Pick<AnchorPoint, "type" | "subtype">, defs?: AnchorDefs): string {
  if (a.subtype === "rafter") return a.type === "rope-access-anchor" ? "rafter-rope-access" : "rafter-fall-arrest";
  return a.subtype ?? defs?.find((d) => d.key === a.type)?.icon ?? a.type;
}

/** An icon name as an image URL in the app (uploaded SVGs are data URLs). */
export const anchorIconSrc = (name: string) => (name.startsWith("data:") ? name : `/reports/anchor/icons/${name}.svg`);

/** "Fall Arrest Anchor" */
export const anchorTypeLabel = (type: AnchorType, defs?: AnchorDefs): string =>
  defs?.find((d) => d.key === type)?.name ?? ANCHOR_TYPE_LABELS[type] ?? type;

/** The types a technician can place, in order. */
export const anchorTypeOptions = (defs?: AnchorDefs): { value: AnchorType; label: string }[] =>
  defs ? defs.map((d) => ({ value: d.key, label: d.name })) : ANCHOR_TYPE_OPTIONS;

/** A type's mounting options, if it has any. */
export const anchorSubtypes = (type: AnchorType, defs?: AnchorDefs): AnchorSubtype[] | undefined => {
  if (!defs) return ANCHOR_TYPE_SUBTYPES[type];
  const subs = defs.find((d) => d.key === type)?.subs;
  return subs?.length ? subs : undefined;
};

/** Load-rated: counted as an anchor and given a rating on the certificate. */
export const anchorRated = (type: AnchorType, defs?: AnchorDefs): boolean => {
  if (!defs) return !!ANCHOR_TYPE_IS_RATED[type];
  return !!defs.find((d) => d.key === type)?.kn.trim();
};

/** "15 kN", or a dash when not rated. */
export const anchorRating = (type: AnchorType, defs?: AnchorDefs): string => {
  if (!defs) return ANCHOR_TYPE_IS_RATED[type] ? "15 kN" : "–";
  const kn = defs.find((d) => d.key === type)?.kn.trim();
  return kn ? `${kn} kN` : "–";
};

/** "Rope access anchor, eye bolt" */
export function anchorTypeSentence(a: Pick<AnchorPoint, "type" | "subtype">, defs?: AnchorDefs): string {
  const base = anchorTypeLabel(a.type, defs);
  const t = base.charAt(0) + base.slice(1).toLowerCase();
  return a.subtype ? `${t}, ${ANCHOR_SUBTYPE_LABELS[a.subtype].toLowerCase()}` : t;
}

export const ANCHOR_TYPE_LABELS: Record<string, string> = {
  "fall-arrest-anchor": "Fall Arrest Anchor",
  "ladder-bracket": "Ladder Bracket",
  "access-hatch": "Access Hatch",
  "wire-rope-sling": "Wire Rope Sling",
  "static-line": "Static Line",
  "walkway-line": "Walkway Line",
  harness: "Harness",
  "rope-access-anchor": "Rope Access Anchor",
};

export const ANCHOR_TYPE_OPTIONS: { value: AnchorType; label: string }[] =
  Object.entries(ANCHOR_TYPE_LABELS).map(([value, label]) => ({
    value: value as AnchorType,
    label,
  }));

// Only fall-arrest and rope-access anchors are load-rated fall-arrest
// points (certified to a kN rating under AS/NZS 1891.4) — everything else
// (ladder brackets, access hatches, wire rope slings, static lines,
// walkway lines, harnesses) is access/connector hardware, not a rated
// anchor itself, and shows "-" instead of a rating on the certification
// summary table.
export const ANCHOR_TYPE_IS_RATED: Record<string, boolean> = {
  "fall-arrest-anchor": true,
  "ladder-bracket": false,
  "access-hatch": false,
  "wire-rope-sling": false,
  "static-line": false,
  "walkway-line": false,
  harness: false,
  "rope-access-anchor": true,
};

export const ANCHOR_SUBTYPE_LABELS: Record<AnchorSubtype, string> = {
  "surface-mount": "Surface Mount",
  "eye-bolt": "Eye Bolt",
  "through-bolt": "Through Bolt",
  "screw-in": "Screw In",
  tensile: "Tensile",
  purlin: "Purlin",
  rafter: "Rafter",
};

// Only these anchor types offer a mounting sub-choice; anything absent
// here places directly, no sub-picker shown.
export const ANCHOR_TYPE_SUBTYPES: Partial<Record<string, AnchorSubtype[]>> = {
  "fall-arrest-anchor": ["surface-mount", "eye-bolt", "purlin", "rafter"],
  "rope-access-anchor": [
    "surface-mount",
    "eye-bolt",
    "through-bolt",
    "screw-in",
    "tensile",
    "purlin",
    "rafter",
  ],
};

// Simple geometric shape used to tell subtypes apart in the legend — colour
// alone can't do it since a subtype shares its parent type's colour.
export type LegendIconShape =
  | "dot"
  | "static-line"
  | "circle"
  | "ring"
  | "square"
  | "triangle"
  | "diamond"
  | "bar"
  | "hexagon";

export const ANCHOR_SUBTYPE_ICONS: Record<AnchorSubtype, LegendIconShape> = {
  "surface-mount": "circle",
  "eye-bolt": "ring",
  "through-bolt": "square",
  "screw-in": "triangle",
  tensile: "diamond",
  purlin: "bar",
  rafter: "hexagon",
};

export function anchorTypeDisplayLabel(anchor: AnchorPoint, defs?: AnchorDefs): string {
  const base = anchorTypeLabel(anchor.type, defs);
  return anchor.subtype
    ? `${base} – ${ANCHOR_SUBTYPE_LABELS[anchor.subtype]}`
    : base;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// A static line is a fixed safety cable run between anchor points — usually
// a straight chain, but sometimes it loops back on itself, and there's no
// way to know that from placement order alone. A walkway line is simpler —
// always a single start-to-end segment, never a chain or loop. Both store
// connections explicitly (AnchorPoint.connectsTo), not inferred: placing
// anchors back-to-back auto-connects them (see ZoneMapEditor's placePin),
// and for static-line, closing a loop or making any other non-sequential
// connection adds one more explicit edge. This just resolves those ids to
// actual points for rendering, dropping any edge whose target no longer
// exists (deleted) or doesn't match the source's type.
export interface LineEdge {
  from: AnchorPoint;
  to: AnchorPoint;
}

function computeLineEdgesForType(
  anchors: AnchorPoint[],
  type: AnchorType,
): LineEdge[] {
  const byId = new Map(anchors.map((a) => [a.id, a]));
  const edges: LineEdge[] = [];
  for (const a of anchors) {
    if (a.type !== type || !a.connectsTo) continue;
    for (const targetId of a.connectsTo) {
      const target = byId.get(targetId);
      if (target && target.type === type) {
        edges.push({ from: a, to: target });
      }
    }
  }
  if (edges.length > 0 || type !== "static-line") return edges;

  // Legacy static-line data placed before connectsTo existed has no edges
  // stored at all — fall back to chaining static-line anchors in placement
  // order so zones built before this feature don't end up with invisible
  // lines. Walkway-line has no such legacy data (it never existed without
  // connectsTo), so it skips this fallback rather than risk chaining pins
  // that were only ever meant to stand as independent pairs.
  const lineAnchors = anchors.filter((a) => a.type === type);
  for (let i = 0; i < lineAnchors.length - 1; i++) {
    edges.push({ from: lineAnchors[i], to: lineAnchors[i + 1] });
  }
  return edges;
}

export function computeLineEdges(anchors: AnchorPoint[]): LineEdge[] {
  return LINE_TYPES.flatMap((type) => computeLineEdgesForType(anchors, type));
}

export interface LegendGroup {
  key: string;
  label: string;
  count: number;
  colour: string;
  icon: LegendIconShape;
}

// Shared by the live editor, the in-app report preview, and the exported
// PDF so all three always render the exact same legend from the exact same
// data — the static-line connecting-line bug earlier came from this kind
// of grouping logic being reimplemented three times and drifting apart.
export function buildLegendGroups(
  types: AnchorType[],
  anchors: AnchorPoint[],
  defs?: AnchorDefs,
): LegendGroup[] {
  const groups: LegendGroup[] = [];
  for (const type of types) {
    // Anchors keep a mount the settings no longer offer, so list the
    // built-in ones too.
    const subtypes = [...new Set([...(anchorSubtypes(type, defs) ?? []), ...(ANCHOR_TYPE_SUBTYPES[type] ?? [])])];
    const label = anchorTypeLabel(type, defs);
    const colour = ANCHOR_TYPE_COLOURS[type] ?? "#64748b";
    const anchorsOfType = anchors.filter((a) => a.type === type);
    if (!subtypes.length) {
      groups.push({
        key: type,
        label,
        count: anchorsOfType.length,
        colour,
        icon: isLineType(type) ? "static-line" : "dot",
      });
      continue;
    }
    // Anchors placed before subtypes existed (or left unset) fall back to
    // one plain row for the parent type, same idea as the static-line
    // legacy-data fallback in computeLineEdges.
    const noSubtypeCount = anchorsOfType.filter((a) => !a.subtype).length;
    if (noSubtypeCount > 0) {
      groups.push({
        key: anchorGroupKey({ type }),
        label,
        count: noSubtypeCount,
        colour,
        icon: "dot",
      });
    }
    for (const subtype of subtypes) {
      const count = anchorsOfType.filter((a) => a.subtype === subtype).length;
      if (count === 0) continue;
      groups.push({
        key: `${type}:${subtype}`,
        label: `${label} – ${ANCHOR_SUBTYPE_LABELS[subtype]}`,
        count,
        colour,
        icon: ANCHOR_SUBTYPE_ICONS[subtype],
      });
    }
  }
  return groups;
}

/** The report with one Report details field changed. Pins copy the report's
 *  dates when placed, so anchors still on the old report date (or blank)
 *  follow a date change; ones edited by hand keep theirs. */
export function withJobField(
  r: AnchorReportData,
  field: keyof AnchorReportJob,
  value: string | null,
): AnchorReportData {
  const job = { ...r.job, [field]: value };
  const key =
    field === "inspectionDate" ? "inspectionDate" : field === "nextInspectionDate" ? "nextInspection" : null;
  if (!key) return { ...r, job };
  const old = r.job[field] ?? "";
  const zones = r.zones.map((z) => ({
    ...z,
    anchors: z.anchors.map((a) => (!a[key] || a[key] === old ? { ...a, [key]: value ?? "" } : a)),
  }));
  return { ...r, job, zones };
}

export const DEFAULT_ANCHOR_REPORT: AnchorReportData = {
  job: {
    preparedFor: "",
    preparedBy: "Archer Dutch",
    address: "",
    reportType: "Roof Access & Fall Prevention Systems Inspection Report",
    date: new Date().toLocaleDateString("en-AU"),
    // Empty means the cover generates its own blurb from the address.
    description: "",
    certNumber: "",
    buildingName: "",
    inspectionDate: "",
    nextInspectionDate: "",
    authorisedBy: "",
    certComments: "",
    technicianNotes: "",
    siteId: "",
  },
  zones: [],
  photos: [],
  photoSettings: {
    enabled: false,
    showDates: false,
    photoLayout: "small",
    filterByDate: false,
    dateFrom: null,
    dateTo: null,
  },
};
