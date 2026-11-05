// lib/reports/hours.layout.ts
//
// The Hours breakdown as pages: a title and one-line description, then the
// hours table in the Job overview's design (same rows, same page artboard),
// with the company and job number in the footer, as the proposal has.
// Shared by the builder preview and the PDF.

import { filterScheduleByDateRange } from "./condition.types";
import { headingHeight, hourItems, hoursLedeText, paginateHours, type HourItem } from "./overview.layout";
import type { HoursBreakdownData } from "./hours.types";

export interface HoursModel {
  lede: string;
  /** Footer, left: "Ocean Breeze Body Corporate · Job 11360". */
  foot: string;
  pages: HourItem[][];
  times: boolean;
  totalHours: number;
  rowCount: number;
}

export function buildHoursModel(report: HoursBreakdownData): HoursModel {
  const s = report.settings;
  const rows = s.filterByDate ? filterScheduleByDateRange(report.schedule, s.dateFrom, s.dateTo) : report.schedule;
  const lede = hoursLedeText(rows, report.job.jobNo) || "The hours logged by our team on this job.";
  const no = report.job.jobNo.replace(/^#/, "");
  const items = hourItems(rows, false);
  return {
    lede,
    foot: [report.job.customerName, no && `Job ${no}`].filter(Boolean).join(" · "),
    pages: items.length ? paginateHours(items, false, headingHeight(lede), 0) : [[]],
    times: !!s.showTimes,
    totalHours: rows.reduce((t, r) => t + (r.actualHours || 0), 0),
    rowCount: rows.length,
  };
}

/** Typed times as 24-hour "HH:MM": "7", "7am", "3:30pm", "15:30". Anything
 *  unreadable is kept as typed. */
export function normTime(v: string): string {
  const m = /^(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm|a|p)?$/i.exec(v.trim());
  if (!m) return v.trim();
  let h = +m[1];
  const ap = m[3]?.[0]?.toLowerCase();
  if (ap === "p" && h < 12) h += 12;
  if (ap === "a" && h === 12) h = 0;
  return h > 23 ? v.trim() : `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}
