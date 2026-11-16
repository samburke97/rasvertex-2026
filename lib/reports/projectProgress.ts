// lib/reports/projectProgress.ts
//
// Project progress report: the jobs that make up a project (a main job and
// its variations, or any job numbers entered), each with the hours used and
// its price, and what's been completed. Shared by the builder
// (components/reports/project-progress), the PDF route and the SimPRO save.
//
// SimPRO is read for each job (app/api/reports/project-progress/job); the
// rep's changes (work wording, status, price, which jobs show) sit beside
// SimPRO's values, so a refresh updates SimPRO's side and keeps theirs.

/** A job as SimPRO has it. */
export interface ProgressJob {
  id: string;
  name: string;
  site: string;
  siteId: string;
  customer: string;
  /** SimPRO stage: Pending, Progress, Complete, Invoiced, Archived. */
  stage: string;
  status: string;
  isVariation: boolean;
  /** Variation job numbers linked to this job in SimPRO. */
  linked: string[];
  priceExTax: number;
  hoursUsed: number;
  hoursEstimate: number;
  completedDate: string | null;
}

export type JobState = "complete" | "progress" | "pending";

export const STATE_LABEL: Record<JobState, string> = {
  complete: "Completed",
  progress: "In progress",
  pending: "Not started",
};

/** Completed once SimPRO says so (a completed date, or the job has moved
 *  past Progress); in progress while it's Progress with hours on it;
 *  otherwise not started (SimPRO puts scheduled jobs in Progress too). */
export function stateOf(j: ProgressJob): JobState {
  if (j.completedDate || /^(complete|invoiced|archived)$/i.test(j.stage)) return "complete";
  if (/progress/i.test(j.stage) && j.hoursUsed > 0) return "progress";
  return "pending";
}

/** "defect report work - visit 3" → "Defect report work – visit 3". */
export const tidyName = (s: string) => {
  const t = s.trim().replace(/\s+-\s+/g, " – ").replace(/\s+/g, " ");
  return t ? t[0].toUpperCase() + t.slice(1) : "";
};

export interface ProgressRow {
  id: string;
  simpro: ProgressJob;
  /** The rep's changes; unset = SimPRO's. */
  work?: string;
  state?: JobState;
  price?: number;
  /** Left off the report. */
  hidden?: boolean;
}

export interface ProgressReport {
  version: 1;
  /** The project, e.g. "Cosmopolitan". Unset = the first job's site. */
  title?: string;
  /** Short text under the title. */
  intro: string;
  /** "As at" date, YYYY-MM-DD. */
  asAt: string;
  rows: ProgressRow[];
  /** "136 of 240" rather than just the hours used. */
  showEstimate: boolean;
}

export const DEFAULT_INTRO =
  "Variation works on your project, with the hours used and the price of each. Completed works are totalled below; works in progress are priced on completion.";

export const newReport = (asAt: string): ProgressReport => ({ version: 1, intro: DEFAULT_INTRO, asAt, rows: [], showEstimate: false });

export const isProgressReport = (x: unknown): x is ProgressReport =>
  !!x && typeof x === "object" && (x as ProgressReport).version === 1 && Array.isArray((x as ProgressReport).rows);

/** A row as the report shows it, the rep's changes applied. */
export interface ShownRow {
  id: string;
  work: string;
  state: JobState;
  price: number;
  hours: number;
  hoursEstimate: number;
  variation: boolean;
}

export const shownRow = (r: ProgressRow): ShownRow => ({
  id: r.id,
  work: r.work ?? (tidyName(r.simpro.name) || `Job #${r.id}`),
  state: r.state ?? stateOf(r.simpro),
  price: r.price ?? r.simpro.priceExTax,
  hours: r.simpro.hoursUsed,
  hoursEstimate: r.simpro.hoursEstimate,
  variation: r.simpro.isVariation,
});

// ── Document model ──────────────────────────────────────────────────────────

export interface ProgressModel {
  title: string;
  customer: string;
  asAt: string;
  intro: string;
  showEstimate: boolean;
  /** Each sheet's rows; totals go on the last. */
  pages: ShownRow[][];
  jobs: number;
  hours: number;
  completed: number;
  completedGst: number;
  inProgress: number;
  /** Footer: "Cosmopolitan · Project progress". */
  foot: string;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** "16 November 2026". */
export const longDate = (iso: string) =>
  iso ? new Date(iso + "T00:00:00").toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "";

// Rows per sheet: under the title, figures and table head on the first, and
// leaving room for the totals on the last.
const FIRST_ROWS = 14;
const NEXT_ROWS = 22;
const TOTALS_ROWS = 5;

export function buildProgressModel(rep: ProgressReport): ProgressModel {
  const rows = rep.rows.filter((r) => !r.hidden).map(shownRow);
  const first = rep.rows.find((r) => !r.hidden)?.simpro;
  const title = rep.title?.trim() || first?.site || "Project progress";
  const done = rows.filter((r) => r.state === "complete");
  const completed = r2(done.reduce((t, r) => t + r.price, 0));
  const inProgress = r2(rows.filter((r) => r.state !== "complete").reduce((t, r) => t + r.price, 0));

  const pages: ShownRow[][] = [];
  for (let i = 0; i < rows.length || !pages.length; ) {
    const room = pages.length ? NEXT_ROWS : FIRST_ROWS;
    pages.push(rows.slice(i, i + room));
    i += room;
    if (i >= rows.length) break;
  }
  // The totals need room on the last sheet.
  const last = pages[pages.length - 1];
  if (last.length > (pages.length === 1 ? FIRST_ROWS : NEXT_ROWS) - TOTALS_ROWS) pages.push([]);

  return {
    title,
    customer: first?.customer ?? "",
    asAt: longDate(rep.asAt),
    intro: rep.intro,
    showEstimate: rep.showEstimate,
    pages,
    jobs: rows.length,
    hours: r2(rows.reduce((t, r) => t + r.hours, 0)),
    completed,
    completedGst: r2(completed * 0.1),
    inProgress,
    foot: `${title} · Project progress`,
  };
}

export const money = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const hoursText = (n: number) => (Math.round(n * 10) / 10).toLocaleString("en-AU", { maximumFractionDigits: 1 });
