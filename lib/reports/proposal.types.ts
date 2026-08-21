// lib/reports/proposal.types.ts
//
// Data model for the Proposal report. Built from a SimPRO Quote (not a Job —
// a proposal is what wins the job, so a job often doesn't exist yet). Most of
// the uploaded 16-section design is fixed company content (team, recent
// projects, warranty, support plans, insurance stats, appendix T&Cs) baked
// directly into proposal.print.ts — this type only covers what's genuinely
// different proposal-to-proposal. See the approved plan for the full
// fixed-vs-editable breakdown.

import type { ReportPhoto } from "./photos";
export type { ReportPhoto };

export interface ProposalJobDetails {
  buildingName: string;
  siteAddress: string;
  clientName: string;
  contactName: string;
  // The quote's salesperson — different jobs can have different ones.
  // Phone is always the company number (baked into proposal.print.ts, not
  // per-job); email auto-derives from this name as firstname@rasvertex.com.au.
  preparedByName: string;
  preparedByEmail: string;
  date: string; // "DD Month YYYY", proposal issue date
  inspectionDate: string;
  distanceFromCoast: string;
  conditionSummary: string;
  accessConstraint: string;
  buildingType: string;
  storeys: string;
  targetStart: string;
  // The SimPRO quote this was built from — also the proposal reference
  // number shown on the cover, and the save-to-job target (SimPRO quotes
  // carry a JobNo off the same underlying record).
  quoteId: string;
  // References a photo in ProposalData.photos by id — the cover's hero
  // image. Id-based (not photos[0]) so it doesn't shift around as photos
  // are imported/removed from the shared pool.
  sitePhotoId: string | null;
}

export interface ProposalFinding {
  id: string;
  photoId: string | null;
  title: string; // e.g. "Coastal chalking, north stair core"
  description: string; // what it means for the scope of works
}

export interface ProposalScope {
  included: string[];
  excluded: string[];
}

export interface ProposalAccessStage {
  id: string;
  label: string; // "Weeks 1 to 2"
  description: string; // "Wash & prep"
}

// A rope-access drop point marked on the site's aerial photo — same idea as
// Anchor Inspection's map-marking process, but marking where the crew will
// work from rather than fixed anchor hardware. Tying each one to a stage
// gives the client a concrete "here's how we'll move across the building"
// narrative instead of just a date range.
export interface AccessDropPoint {
  id: string;
  x: number; // 0-100, position on the captured/uploaded aerial image
  y: number; // 0-100
  note: string; // e.g. "North face — wash & prep"
  stageId: string | null; // references ProposalAccessStage.id
}

// Pins are coloured by the stage they're tied to (first colour — the same
// green as the "Ready to proceed" pill — for the first stage or any
// unassigned point) so it's visually obvious which week a drop point
// belongs to, both in the editor and the printed plan.
export const STAGE_PIN_COLORS = ["#1f7a4d", "#2563a8", "#c7242e", "#b8860b", "#7c3aed"];

export function colorForStage(
  stageId: string | null,
  stages: ProposalAccessStage[],
): string {
  if (!stageId) return STAGE_PIN_COLORS[0];
  const idx = stages.findIndex((s) => s.id === stageId);
  return idx === -1 ? STAGE_PIN_COLORS[0] : STAGE_PIN_COLORS[idx % STAGE_PIN_COLORS.length];
}

export interface ProposalAccessMap {
  imageUrl: string | null; // captured aerial (data URL) or uploaded image
  imageRatio?: number; // native aspect ratio — see anchor.types.ts's mapImageRatio
  lat: number | null;
  lng: number | null;
  zoom: number;
  points: AccessDropPoint[];
}

// A site can be more than one physical building — same idea as Anchor
// Inspection's zones, just named for buildings/areas instead of anchor
// groupings. Each zone carries its own aerial capture and its own drop
// points; stages (the project timeline) stay project-wide, shared across
// every zone.
export interface ProposalAccessZone {
  id: string;
  name: string;
  map: ProposalAccessMap;
}

export function newAccessZone(name: string): ProposalAccessZone {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name,
    map: { imageUrl: null, lat: null, lng: null, zoom: 20, points: [] },
  };
}

export type PricingItemSource = "simpro" | "manual";

export interface ProposalPricingItem {
  id: string;
  // The cost centre this row belongs to (SimPRO imports only) — rows with
  // the same groupLabel render together as one table with its own subtotal.
  // Manually-added rows leave this empty and render ungrouped.
  groupLabel: string;
  label: string;
  amountExTax: number;
  source: PricingItemSource;
}

export interface ProposalPricing {
  items: ProposalPricingItem[];
  depositPct: number;
  progressTerms: string;
  // Off by default — the printed pricing table shows one row per cost
  // centre (its own total only). Switching this on expands every cost
  // centre back out into its individual SimPRO line items.
  showLineItems: boolean;
}

// Not every proposal needs every job-specific section (e.g. a job with no
// staged access plan) — these control whether each one is included in the
// exported PDF. Fixed company sections (Warranty, Team, etc.) aren't
// toggleable; they're always included.
export interface ProposalSectionToggles {
  findings: boolean;
  scope: boolean;
  accessPlan: boolean;
  pricing: boolean;
}

export interface ProposalData {
  job: ProposalJobDetails;
  sections: ProposalSectionToggles;
  findings: ProposalFinding[]; // up to 6
  scope: ProposalScope;
  accessPlan: { stages: ProposalAccessStage[]; zones: ProposalAccessZone[] }; // stages default to 3 rows
  pricing: ProposalPricing;
  photos: ReportPhoto[]; // imported from the quote/job's SimPRO attachments
}

export const DEFAULT_ACCESS_STAGES: ProposalAccessStage[] = [
  { id: "stage-1", label: "Weeks 1 to 2", description: "Wash & prep" },
  { id: "stage-2", label: "Weeks 3 to 5", description: "Remedial repairs" },
  { id: "stage-3", label: "Weeks 6 to 9", description: "Coating & sign-off" },
];

export const DEFAULT_PROPOSAL: ProposalData = {
  sections: { findings: true, scope: true, accessPlan: true, pricing: true },
  job: {
    buildingName: "",
    siteAddress: "",
    clientName: "",
    contactName: "",
    preparedByName: "",
    preparedByEmail: "",
    date: new Date().toLocaleDateString("en-AU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    inspectionDate: "",
    distanceFromCoast: "",
    conditionSummary: "",
    accessConstraint: "",
    buildingType: "",
    storeys: "",
    targetStart: "",
    quoteId: "",
    sitePhotoId: null,
  },
  findings: [],
  scope: { included: [], excluded: [] },
  accessPlan: {
    stages: DEFAULT_ACCESS_STAGES,
    zones: [newAccessZone("Building 1")],
  },
  pricing: { items: [], depositPct: 20, progressTerms: "Fortnightly against works completed.", showLineItems: false },
  photos: [],
};

export function pricingSubtotal(items: ProposalPricingItem[]): number {
  return items.reduce((sum, item) => sum + item.amountExTax, 0);
}

export function pricingGst(items: ProposalPricingItem[]): number {
  return Math.round(pricingSubtotal(items) * 0.1 * 100) / 100;
}

export function pricingTotal(items: ProposalPricingItem[]): number {
  return Math.round((pricingSubtotal(items) + pricingGst(items)) * 100) / 100;
}
