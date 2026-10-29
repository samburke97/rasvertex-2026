// lib/reports/condition.types.ts

import type { EnrichedJob } from "@/lib/simpro/types";
import type { ReportPhoto, PhotoLayout } from "./photos";

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
    date: job.date,
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
