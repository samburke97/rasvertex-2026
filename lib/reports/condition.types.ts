// lib/reports/condition.types.ts

import type { EnrichedJob } from "@/lib/simpro/types";
import type { ReportPhoto, PhotoLayout } from "./photos";
import type { Methodology } from "./methodology";
import type { MaintenancePlan } from "./maintenancePlan";
import type { Warranties } from "./warranty";

// Photo data model + date-range filter now live in lib/reports/photos.ts
// (shared with the Anchor Inspection report's photo section) — re-exported
// here so existing imports from condition.types.ts keep working.
export type { ReportPhoto, PhotoFolder, PhotoLayout } from "./photos";
export { filterPhotosByDateRange } from "./photos";

// ── Schedule ──────────────────────────────────────────────────────────────────

export interface ScheduleRow {
  id: string; // composite key: "employeeId_YYYY-MM-DD"
  employeeId: number;
  employeeName: string;
  date: string; // "YYYY-MM-DD"
  scheduledHours: number;
  actualHours: number;
  note: string;
  /** "07:00" / "15:30" from SimPRO (24-hour). Absent on older drafts. */
  start?: string;
  finish?: string;
  /** When set, this row begins a new named section (see ReportSettings.scheduleSections). */
  sectionTitle?: string;
}

export interface ScheduleCostCenter {
  id: number;
  sectionId: number;
  name: string;
}

export type ScheduleImportStatus =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "done" };

// ── Job details ───────────────────────────────────────────────────────────────

export interface ReportJobDetails {
  /** SimPRO site name — the cover headline. Older drafts have none and fall
   *  back to the street address. */
  site?: string;
  /** SimPRO job number, e.g. "#10970". Refreshed on every load. */
  jobNo?: string;
  preparedFor: string;
  preparedBy: string;
  address: string;
  reportType: string;
  intro: string;
  project: string;
  date: string;
  /** Custom cover hero background — falls back to the default app background
   *  (conditionBg) when null. */
  coverPhoto: string | null;
  /** SimPRO Site ID, used only for the Save-to-Site export path — not rendered. */
  siteId: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface ReportSettings {
  /** Photo grid pages — on by default, optional per report. */
  showPhotos: boolean;
  showDates: boolean;
  filterByDate: boolean;
  dateFrom: string | null; // "YYYY-MM-DD"
  dateTo: string | null; // "YYYY-MM-DD"
  photoLayout: PhotoLayout;
  showSchedule: boolean;
  scheduleLoaded: boolean;
  showScheduleNotes: boolean;
  /** Start and finish time columns in the hours schedule. Older drafts: off. */
  showScheduleTimes?: boolean;
  /** Hours up to today only: days scheduled ahead (future work) are left
   *  out. Unset (older drafts) counts as on. */
  hoursToToday?: boolean;
  /** Break the schedule table into named sections with per-section subtotals. */
  scheduleSections: boolean;
  /** Comments/Recommendations summary page — on by default, optional per report. */
  showSummary: boolean;
  /** In the summary: the quote's description, and its line items. Older
   *  drafts have neither and show both. */
  showScope?: boolean;
  showScopeItems?: boolean;
}

/** The job's scope of works, from the quote it came from in SimPRO. */
export interface ReportScope {
  /** The quote read, or null when the job's own description was used. */
  quoteId: string | null;
  /** HTML from SimPRO. */
  description: string;
  items: { group: string; label: string }[];
}

// ── Root data ─────────────────────────────────────────────────────────────────

/** Cover photo focal point (0–100 %) and zoom (1 = fills the frame). */
export interface CoverPos {
  x: number;
  y: number;
  zoom: number;
}
export const DEFAULT_COVER_POS: CoverPos = { x: 50, y: 50, zoom: 1 };

export interface ConditionReportData {
  job: ReportJobDetails;
  /** How the cover photo sits in its frame (dragged in the preview). */
  coverPos?: CoverPos;
  photos: ReportPhoto[];
  schedule: ScheduleRow[];
  comments: string;
  recommendations: string;
  /** Loaded from SimPRO on every import; null until then. */
  scope?: ReportScope | null;
  settings: ReportSettings;
  /** Optional sections, each off until switched on. */
  method?: Methodology & { on: boolean };
  plan?: MaintenancePlan & { on: boolean };
  /** Waterproofing and/or painting. */
  warranty?: Warranties;
  /** Things found on site, each with photos and a description, suggesting
   *  additional works. Off until switched on. */
  findings?: Findings & { on: boolean };
  /** Variation works: each variation cost centre on the job in SimPRO,
   *  with its description, photos and hours. On when the job has any. */
  variations?: Variations & { on: boolean };
  /** Photos grouped under a title ("Level 3 balcony – crack repairs"),
   *  shown first, each in the order picked. A photo is in one at most. */
  photoSections?: PhotoSection[];
}

export interface Finding {
  id: string;
  title: string;
  /** Rich text: what we found and the work we'd recommend. */
  desc: string;
  photoIds: string[];
  /** How big its photos print: per row, small 4, medium 3 (the default),
   *  large 2, full 1. */
  size?: FindingSize;
}

export type FindingSize = "small" | "medium" | "large" | "full";
export const FINDING_SIZES: { key: FindingSize; label: string; cols: number }[] = [
  { key: "small", label: "Small", cols: 4 },
  { key: "medium", label: "Medium", cols: 3 },
  { key: "large", label: "Large", cols: 2 },
  { key: "full", label: "Full width", cols: 1 },
];
export const findingCols = (size?: FindingSize) => FINDING_SIZES.find((x) => x.key === size)?.cols ?? 3;

export interface Findings {
  intro: string;
  items: Finding[];
}

export const FINDINGS_INTRO =
  "While on site our team noted the items below. They weren't part of this job; we recommend them as additional works and can quote on request.";

/** A variation cost centre as SimPRO has it. */
export interface SimproVariation {
  ccId: string;
  name: string;
  /** HTML from SimPRO. */
  description: string;
  /** Labour hours logged to it. */
  hours: number;
  approved: string | null;
}

/** A variation in the report: a finding's shape (title, description,
 *  photos, photo size), tied to its cost centre. The title, description and
 *  photos are the rep's; the hours are SimPRO's, refreshed on each load. */
export interface Variation extends Finding {
  ccId: string;
  hours: number;
  /** Left off the report (it comes back from SimPRO on reload otherwise). */
  off?: boolean;
}

export interface Variations {
  intro: string;
  items: Variation[];
  /** Print each variation's hours. */
  showHours?: boolean;
}

export const VARIATIONS_INTRO = "Works added to the original scope during the project, as approved, with the hours our team spent on each.";

/** SimPRO's variations into the report's: new ones added from SimPRO, known
 *  ones keep what was written here and take SimPRO's hours. On when the job
 *  has variations and the section hasn't been switched off. */
export function mergeVariations(
  cur: (Variations & { on: boolean }) | undefined,
  fresh: SimproVariation[],
  fromSimpro: (v: SimproVariation) => Pick<Variation, "title" | "desc">,
): (Variations & { on: boolean }) | undefined {
  if (!fresh.length) return cur;
  const items: Variation[] = fresh.map((v) => {
    const had = cur?.items.find((x) => x.ccId === v.ccId);
    return had ? { ...had, hours: v.hours } : { id: `v${v.ccId}`, ccId: v.ccId, ...fromSimpro(v), photoIds: [], hours: v.hours };
  });
  return { intro: cur?.intro ?? VARIATIONS_INTRO, showHours: cur?.showHours ?? true, on: cur?.on ?? true, items };
}

export interface PhotoSection {
  id: string;
  title: string;
  /** A line under the title: what was done here. */
  note: string;
  photoIds: string[];
}

// ── Import status ─────────────────────────────────────────────────────────────

export type ImportStatus =
  | { phase: "idle" }
  | { phase: "fetching-job" }
  | { phase: "fetching-photos"; loaded: number; total: number }
  | { phase: "fetching-schedule" }
  | { phase: "done" }
  | { phase: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Today as "YYYY-MM-DD", in local time. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function mapJobToReportDetails(job: EnrichedJob): ReportJobDetails {
  return {
    site: job.siteName || job.name,
    jobNo: job.jobNo,
    preparedFor: job.preparedFor,
    preparedBy: "Phil Clark",
    address: job.siteAddress,
    reportType: "Job Overview",
    intro:
      "This report outlines the repairs and maintenance works completed, including any updates, adjustments, and variations from the original scope.",
    // The job number is what the client and the office refer to.
    project: `Job ${job.jobNo}`,
    // The report's date is the day it's made, not the job's issue date
    // (when the quote was accepted). Set on every load, a resumed draft too.
    date: todayIso(),
    coverPhoto: null,
    siteId: job.siteId,
  };
}

export function filterScheduleByDateRange(
  rows: ScheduleRow[],
  dateFrom: string | null,
  dateTo: string | null,
): ScheduleRow[] {
  if (!dateFrom && !dateTo) return rows;
  return rows.filter((r) => {
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo && r.date > dateTo) return false;
    return true;
  });
}

export function formatScheduleDate(iso: string): string {
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export type { EnrichedJob as SimproJobResponse };

/** The hours the report shows: the date filter when it's on, and nothing
 *  after today unless "Hours up to today" is switched off. */
export function shownSchedule(rows: ScheduleRow[], s: ReportSettings): ScheduleRow[] {
  const ranged = s.filterByDate ? filterScheduleByDateRange(rows, s.dateFrom, s.dateTo) : rows;
  if (s.hoursToToday === false) return ranged;
  const today = todayIso();
  return ranged.filter((r) => !r.date || r.date <= today);
}
