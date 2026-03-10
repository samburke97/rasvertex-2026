// lib/reports/hours.types.ts

import type { ScheduleRow } from "./condition.types";

export interface HoursBreakdownJob {
  jobNo: string;
  siteAddress: string;
  customerName: string;
  date: string;
}

export interface HoursBreakdownSettings {
  filterByDate: boolean;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface HoursBreakdownData {
  job: HoursBreakdownJob;
  schedule: ScheduleRow[];
  settings: HoursBreakdownSettings;
}

export type HoursImportStatus =
  | { phase: "idle" }
  | { phase: "fetching-job" }
  | { phase: "fetching-schedule" }
  | { phase: "done" }
  | { phase: "error"; message: string };
