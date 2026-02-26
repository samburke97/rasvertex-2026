// lib/reports/condition.types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Condition report-specific types and field mapping.
// Job data arrives as EnrichedJob (from lib/simpro/client) — no raw SimPRO
// parsing happens here anymore.
// ─────────────────────────────────────────────────────────────────────────────

import type { EnrichedJob } from "@/lib/simpro/types";

export interface ReportPhoto {
  id: string;
  name: string;
  url: string;
  size: number;
}

export interface ReportJobDetails {
  preparedFor: string;
  preparedBy: string;
  address: string;
  reportType: string; // e.g. "Building Condition Report"
  project: string; // Job Name e.g. "Baywatch Repaint"
  date: string;
}

export interface ConditionReportData {
  job: ReportJobDetails;
  photos: ReportPhoto[];
  comments: string;
  recommendations: string;
}

export type ImportStatus =
  | { phase: "idle" }
  | { phase: "fetching-job" }
  | { phase: "fetching-photos"; loaded: number; total: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

// ── Field mapping ─────────────────────────────────────────────────────────────

/**
 * Maps an EnrichedJob to the fields shown on the condition report cover page.
 *
 *   preparedFor  → job.preparedFor (SiteContact → CustomerContact → clientName)
 *   address      → job.siteAddress (fully resolved, never [object Object])
 *   project      → job.name
 *   date         → job.date
 *   preparedBy   → "Phil Clark" (always editable)
 *   reportType   → "Building Condition Report" (always editable)
 */
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

// Re-export EnrichedJob so existing imports from condition.types still work
export type { EnrichedJob as SimproJobResponse };
