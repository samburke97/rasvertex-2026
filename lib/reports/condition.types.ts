// lib/reports/condition.types.ts

import type { EnrichedJob } from "@/lib/simpro/types";

export interface ReportPhoto {
  id: string;
  name: string;
  url: string;
  size: number;
  dateAdded?: string | null;
}

// ── Attachment folders ────────────────────────────────────────────────────────

export interface PhotoFolder {
  id: number;
  name: string;
}

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
  /** Job has more than one cost centre — paused, waiting for the user to pick one (or "all") and confirm. */
  | { phase: "choosing-cost-center"; costCenters: ScheduleCostCenter[] }
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
}

// ── Settings ──────────────────────────────────────────────────────────────────

/** Photo grid density: large = 4/page, medium = 6/page, small = 9/page. */
export type PhotoLayout = "large" | "medium" | "small";

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
  /** Job has attachment folders — paused, waiting for the user to pick one (or "all") and confirm. */
  | { phase: "choosing-folder"; folders: PhotoFolder[] }
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
  };
}

export function filterPhotosByDateRange(
  photos: ReportPhoto[],
  dateFrom: string | null,
  dateTo: string | null,
): ReportPhoto[] {
  if (!dateFrom && !dateTo) return photos;
  return photos.filter((p) => {
    if (!p.dateAdded) return true;
    const day = p.dateAdded.slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });
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
