// lib/reports/anchor.types.ts

import type { ReportPhoto, PhotoLayout } from "./photos";
export type { ReportPhoto, PhotoFolder, PhotoLayout } from "./photos";

export type AnchorType =
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
export const LINE_TYPES: AnchorType[] = ["static-line", "walkway-line"];
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
  | "tensile";

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

export interface AnchorReportData {
  job: AnchorReportJob;
  zones: Zone[];
  photos: ReportPhoto[];
  photoSettings: AnchorPhotoSettings;
}

export const ANCHOR_TYPE_COLOURS: Record<AnchorType, string> = {
  "fall-arrest-anchor": "#10b981",
  "ladder-bracket": "#3b82f6",
  "access-hatch": "#ec4899",
  "wire-rope-sling": "#f97316",
  "static-line": "#6366f1",
  "walkway-line": "#eab308",
  harness: "#14b8a6",
  "rope-access-anchor": "#8b5cf6",
};

export const ANCHOR_TYPE_LABELS: Record<AnchorType, string> = {
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
export const ANCHOR_TYPE_IS_RATED: Record<AnchorType, boolean> = {
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
};

// Only these anchor types offer a mounting sub-choice; anything absent
// here places directly, no sub-picker shown.
export const ANCHOR_TYPE_SUBTYPES: Partial<Record<AnchorType, AnchorSubtype[]>> = {
  "fall-arrest-anchor": ["surface-mount", "eye-bolt"],
  "rope-access-anchor": [
    "surface-mount",
    "eye-bolt",
    "through-bolt",
    "screw-in",
    "tensile",
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
  | "diamond";

export const ANCHOR_SUBTYPE_ICONS: Record<AnchorSubtype, LegendIconShape> = {
  "surface-mount": "circle",
  "eye-bolt": "ring",
  "through-bolt": "square",
  "screw-in": "triangle",
  tensile: "diamond",
};

export function anchorTypeDisplayLabel(anchor: AnchorPoint): string {
  const base = ANCHOR_TYPE_LABELS[anchor.type];
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
): LegendGroup[] {
  const groups: LegendGroup[] = [];
  for (const type of types) {
    const subtypes = ANCHOR_TYPE_SUBTYPES[type];
    const colour = ANCHOR_TYPE_COLOURS[type];
    const anchorsOfType = anchors.filter((a) => a.type === type);
    if (!subtypes) {
      groups.push({
        key: type,
        label: ANCHOR_TYPE_LABELS[type],
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
        key: `${type}:none`,
        label: ANCHOR_TYPE_LABELS[type],
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
        label: `${ANCHOR_TYPE_LABELS[type]} – ${ANCHOR_SUBTYPE_LABELS[subtype]}`,
        count,
        colour,
        icon: ANCHOR_SUBTYPE_ICONS[subtype],
      });
    }
  }
  return groups;
}

export const DEFAULT_ANCHOR_REPORT: AnchorReportData = {
  job: {
    preparedFor: "",
    preparedBy: "Archer Dutch",
    address: "",
    reportType: "Roof Access & Fall Prevention Systems Inspection Report",
    date: new Date().toLocaleDateString("en-AU"),
    description:
      "This report relates to existing Height Safety and Roof Access Systems. All systems were visually inspected in accordance with AS/NZS 1891.4:2009, AS/NZS 1891.2 and AS 1657:2018.",
    certNumber: "",
    buildingName: "",
    inspectionDate: "",
    nextInspectionDate: "",
    authorisedBy: "",
    certComments: "",
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
