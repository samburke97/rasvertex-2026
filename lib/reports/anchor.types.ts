// lib/reports/anchor.types.ts

export type AnchorType =
  | "fall-arrest-anchor"
  | "ladder-bracket"
  | "rung-ladder"
  | "walkway"
  | "guardrail"
  | "access-hatch"
  | "wire-rope-sling"
  | "static-line"
  | "harness";

export type PassFail = "PASSED" | "FAILED" | "N/A";

export interface AnchorPoint {
  id: string;
  label: string; // e.g. "A.26"
  type: AnchorType;
  description: string;
  model?: string;
  serialNumber?: string;
  manufacturer?: string;
  commissionDate?: string;
  majorServiceDate?: string;
  inspectionDate: string;
  nextInspection: string;
  result: PassFail;
  notes?: string;
  // Map pin position as % of container dimensions
  x: number; // 0–100
  y: number; // 0–100
}

export interface Zone {
  id: string;
  name: string;
  mapImageUrl: string | null; // Mapbox satellite screenshot or user upload
  mapLat?: number;
  mapLng?: number;
  mapZoom?: number;
  anchors: AnchorPoint[];
}

export interface AnchorReportJob {
  preparedFor: string;
  preparedBy: string;
  address: string;
  reportType: string;
  date: string;
  coverPhoto: string | null;
  description: string;
}

export interface AnchorReportData {
  job: AnchorReportJob;
  zones: Zone[];
}

// ── Colour map for anchor types ────────────────────────────────────────────
export const ANCHOR_TYPE_COLOURS: Record<AnchorType, string> = {
  "fall-arrest-anchor": "#10b981",
  "ladder-bracket": "#3b82f6",
  "rung-ladder": "#f59e0b",
  walkway: "#8b5cf6",
  guardrail: "#06b6d4",
  "access-hatch": "#ec4899",
  "wire-rope-sling": "#f97316",
  "static-line": "#6366f1",
  harness: "#14b8a6",
};

export const ANCHOR_TYPE_LABELS: Record<AnchorType, string> = {
  "fall-arrest-anchor": "Fall Arrest Anchor",
  "ladder-bracket": "Ladder Bracket",
  "rung-ladder": "Rung Ladder",
  walkway: "Walkway",
  guardrail: "Guardrail",
  "access-hatch": "Access Hatch",
  "wire-rope-sling": "Wire Rope Sling",
  "static-line": "Static Line",
  harness: "Harness",
};

export const ANCHOR_TYPE_OPTIONS: { value: AnchorType; label: string }[] =
  Object.entries(ANCHOR_TYPE_LABELS).map(([value, label]) => ({
    value: value as AnchorType,
    label,
  }));

export function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export const DEFAULT_ANCHOR_REPORT: AnchorReportData = {
  job: {
    preparedFor: "",
    preparedBy: "",
    address: "",
    reportType: "Roof Access & Fall Prevention Systems Inspection Report",
    date: new Date().toLocaleDateString("en-AU"),
    coverPhoto: null,
    description:
      "This report relates to existing Height Safety and Roof Access Systems. All systems were visually inspected in accordance with AS/NZS 1891.4:2009, AS/NZS 1891.2 and AS 1657:2018.",
  },
  zones: [],
};
