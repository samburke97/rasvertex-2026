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
  preparedFor: string;
  preparedBy: string;
  address: string;
  reportType: string;
  intro: string;
  project: string;
  date: string;
  coverPhoto: string | null;
  /** SimPRO Site ID, used only for the Save-to-Site export path — not rendered. */
  siteId: string;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export interface ReportSettings {
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
}

// ── Root data ─────────────────────────────────────────────────────────────────

export interface ConditionReportData {
  job: ReportJobDetails;
  photos: ReportPhoto[];
  schedule: ScheduleRow[];
  comments: string;
  recommendations: string;
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
    preparedFor: job.preparedFor,
    preparedBy: "Phil Clark",
    address: job.siteAddress,
    reportType: "Building Condition Report",
    intro:
      "This report outlines the repairs and maintenance works completed, including any updates, adjustments, and variations from the original scope.",
    project: job.name,
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
