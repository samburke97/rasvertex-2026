// lib/reports/maintenancePlan.ts
// The maintenance plan section shared by the building / roof inspection
// reports and the Job overview (project report): services, how often, and
// whether each is required, plus the technician's comments.

export type PlanPriority = "required" | "recommended";

export interface PlanItem {
  service: string;
  interval: string;
  priority: PlanPriority;
  /** "March 2027", "With the next repaint" … optional. */
  next?: string;
  /** A line under the service, e.g. what's included. Optional. */
  note?: string;
}

export interface MaintenancePlan {
  items: PlanItem[];
  notes?: string;
}

/** A service offered in the editor; whenAny: ticked to start with when one
 *  of these defect codes is in the report. */
export interface PlanPreset {
  service: string;
  interval: string;
  priority: PlanPriority;
  whenAny?: string[];
}

/** Frequencies offered (any text works too). */
export const PLAN_INTERVALS = [
  "Every 3 months",
  "Every 6 months",
  "Annually",
  "Every 2 years",
  "Every 3 years",
  "Every 5 years",
  "Every 7 years",
  "Every 8–10 years",
  "Every 15–20 years",
  "As needed",
];

export const PLAN_INTRO =
  "Future maintenance considerations and lifecycle planning to assist with ongoing asset management and budgeting.";

/** Required first, as printed. */
export const planRows = (items: PlanItem[]) =>
  [...items].sort((a, b) => (a.priority === b.priority ? 0 : a.priority === "required" ? -1 : 1));

/** Services offered in the Job overview (any building's completed works). */
export const PROJECT_PLAN: PlanPreset[] = [
  { service: "Roof and membrane inspection, with a photographic report", interval: "Annually", priority: "required" },
  { service: "Gutter, outlet and drainage clean", interval: "Every 6 months", priority: "required" },
  { service: "Height safety anchor inspection and recertification", interval: "Annually", priority: "required" },
  { service: "Sealant and joint inspection, with resealing as needed", interval: "Every 2 years", priority: "recommended" },
  { service: "Building wash", interval: "Annually", priority: "recommended" },
  { service: "Coating inspection and touch-ups", interval: "Every 2 years", priority: "recommended" },
  { service: "UV-stable top coat", interval: "Every 5 years", priority: "recommended" },
  { service: "Full external repaint", interval: "Every 8–10 years", priority: "recommended" },
];
