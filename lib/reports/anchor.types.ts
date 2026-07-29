// lib/reports/anchor.types.ts

export type AnchorType =
  | "fall-arrest-anchor"
  | "ladder-bracket"
  | "access-hatch"
  | "wire-rope-sling"
  | "static-line"
  | "harness"
  | "rope-access-anchor";

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
  // Static-line only — ids of other static-line anchors this one has a
  // cable segment to. Placing anchors back-to-back auto-connects them into
  // a chain; closing a loop (or any non-sequential connection) adds an
  // explicit edge on top of that. Each edge is stored once, on one side
  // only — see computeStaticLineEdges.
  connectsTo?: string[];
}

export interface Zone {
  id: string;
  name: string;
  mapImageUrl: string | null;
  mapLat?: number;
  mapLng?: number;
  mapZoom?: number;
  anchors: AnchorPoint[];
}

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
}

export interface AnchorReportData {
  job: AnchorReportJob;
  zones: Zone[];
}

export const ANCHOR_TYPE_COLOURS: Record<AnchorType, string> = {
  "fall-arrest-anchor": "#10b981",
  "ladder-bracket": "#3b82f6",
  "access-hatch": "#ec4899",
  "wire-rope-sling": "#f97316",
  "static-line": "#6366f1",
  harness: "#14b8a6",
  "rope-access-anchor": "#8b5cf6",
};

export const ANCHOR_TYPE_LABELS: Record<AnchorType, string> = {
  "fall-arrest-anchor": "Fall Arrest Anchor",
  "ladder-bracket": "Ladder Bracket",
  "access-hatch": "Access Hatch",
  "wire-rope-sling": "Wire Rope Sling",
  "static-line": "Static Line",
  harness: "Harness",
  "rope-access-anchor": "Rope Access Anchor",
};

export const ANCHOR_TYPE_OPTIONS: { value: AnchorType; label: string }[] =
  Object.entries(ANCHOR_TYPE_LABELS).map(([value, label]) => ({
    value: value as AnchorType,
    label,
  }));

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
// way to know that from placement order alone. So connections are explicit
// (AnchorPoint.connectsTo), not inferred: placing anchors back-to-back
// auto-connects them (see ZoneMapEditor's placePin), and closing a loop or
// making any other non-sequential connection adds one more explicit edge.
// This just resolves those ids to actual points for rendering, dropping any
// edge whose target no longer exists (deleted) or isn't static-line.
export interface StaticLineEdge {
  from: AnchorPoint;
  to: AnchorPoint;
}

export function computeStaticLineEdges(anchors: AnchorPoint[]): StaticLineEdge[] {
  const byId = new Map(anchors.map((a) => [a.id, a]));
  const edges: StaticLineEdge[] = [];
  for (const a of anchors) {
    if (a.type !== "static-line" || !a.connectsTo) continue;
    for (const targetId of a.connectsTo) {
      const target = byId.get(targetId);
      if (target && target.type === "static-line") {
        edges.push({ from: a, to: target });
      }
    }
  }
  if (edges.length > 0) return edges;

  // Legacy data placed before connectsTo existed has no edges stored at
  // all — fall back to chaining static-line anchors in placement order so
  // zones built before this feature don't end up with invisible lines.
  const lineAnchors = anchors.filter((a) => a.type === "static-line");
  for (let i = 0; i < lineAnchors.length - 1; i++) {
    edges.push({ from: lineAnchors[i], to: lineAnchors[i + 1] });
  }
  return edges;
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
        icon: type === "static-line" ? "static-line" : "dot",
      });
      continue;
    }
    // Anchors placed before subtypes existed (or left unset) fall back to
    // one plain row for the parent type, same idea as the static-line
    // legacy-data fallback in computeStaticLineEdges.
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
  },
  zones: [],
};
