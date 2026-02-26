// lib/reports/condition.types.ts

import type { EnrichedJob } from "@/lib/simpro/types";

export interface ReportPhoto {
  id: string;
  name: string;
  url: string;
  size: number;
  dateAdded?: string | null; // ISO string from SimPRO DateAdded
}

export interface ReportJobDetails {
  preparedFor: string;
  preparedBy: string;
  address: string;
  reportType: string;
  project: string;
  date: string;
}

/** Per-report toggle settings — shown in the options panel */
export interface ReportSettings {
  showDates: boolean;
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

// ── Field mapping ─────────────────────────────────────────────────────────────

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

export type { EnrichedJob as SimproJobResponse };
