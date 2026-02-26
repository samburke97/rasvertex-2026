// lib/reports/condition.types.ts

import type { EnrichedJob } from "@/lib/simpro/types";

export interface ReportPhoto {
  id: string;
  name: string;
  url: string;
  size: number;
  dateAdded?: string | null;
}

export interface ReportJobDetails {
  preparedFor: string;
  preparedBy: string;
  address: string;
  reportType: string;
  project: string;
  date: string;
}

export interface ReportSettings {
  showDates: boolean;
  filterByDate: boolean;
  dateFrom: string | null; // "YYYY-MM-DD"
  dateTo: string | null; // "YYYY-MM-DD"
}

export interface ConditionReportData {
  job: ReportJobDetails;
  photos: ReportPhoto[];
  comments: string;
  recommendations: string;
  settings: ReportSettings;
}

export type ImportStatus =
  | { phase: "idle" }
  | { phase: "fetching-job" }
  | { phase: "fetching-photos"; loaded: number; total: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

export function mapJobToReportDetails(job: EnrichedJob): ReportJobDetails {
  return {
    preparedFor: job.preparedFor,
    preparedBy: "Phil Clark",
    address: job.siteAddress,
    reportType: "Building Condition Report",
    project: job.name,
    date: job.date,
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

export type { EnrichedJob as SimproJobResponse };
