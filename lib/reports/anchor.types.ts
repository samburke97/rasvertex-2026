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

export interface AnchorPoint {
  id: string;
  label: string; // "Asset #" in the UI
  type: AnchorType;
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
