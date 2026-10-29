// lib/reports/overview.layout.ts
//
// Everything the Job Overview document needs, derived once from the report
// data: cover facts, the summary stats, the hours schedule as table items,
// the photos grouped by day, and which page each block lands on. Pure, so
// the builder preview and the PDF route paginate identically.
//
// Pages are 1280 × 1810 page units, the same sheet as the Anchor and
// Inspection reports. Table rows and photo cells have fixed heights, so
// pagination is arithmetic rather than measured; rich-text blocks are
// estimated from their line count.
//
// Pages: 1 Cover · 2 Contents · Job summary · Hours schedule · Photos ·
// last: RAS-VERTEX (the closing page shared with the Anchor report).

import {
  DEFAULT_COVER_POS,
  filterPhotosByDateRange,
  filterScheduleByDateRange,
  type ConditionReportData,
  type CoverPos,
  type PhotoLayout,
  type ScheduleRow,
} from "./condition.types";
import { fmtDate, pad } from "./anchor.layout";
import { notesIsEmpty, notesLineCount, sanitizeNotesHtml } from "./richText";

export { pad };
export const PAGE_W = 1280;
export const PAGE_H = 1810;
export const CONTENT_W = 1088;

/** The cover photo used until one is uploaded. */
export const DEFAULT_OVERVIEW_COVER = "images/backgrounds/condition-bg.jpeg";

// Content runs from the page's 80 top padding to just above the page number.
const FLOW_H = 1620;
const SEC_LABEL = 58; // 18 label + 40 margin
const H2 = 53; // 48 / 1.1
const LEDE_LINE = 32; // 20 / 1.6
const LEDE_CHARS = 82; // per line at 820 wide
const NOTE_LINE = 28; // 17 / 1.6, rounded up
const NOTE_HEAD = 56 + 27; // margin + label and gap

// Hours table — every row a fixed height (see .jo-tr in the document CSS).
const T_HEAD = 32;
const T_ROW = 56;
const T_ROW_NOTES = 76;
const T_SEC = 72;
const T_SUB = 56;
const T_TOTAL = 72;
const T_INTRO = 20 + LEDE_LINE + 56; // a one-line lede and its margins

// Photos.
const COL_GAP = 24;
const ROW_GAP = 32;
const CAPTION = 32; // 8 margin + 17 × 1.4
const DAY_HEAD = 48; // 22 × 1.2 + 20 margin, rounded
const DAY_GAP = 24;
const GRIDS: Record<PhotoLayout, { cols: number; ratio: number }> = {
  large: { cols: 2, ratio: 3 / 4 },
  medium: { cols: 3, ratio: 3 / 4 },
  small: { cols: 4, ratio: 3 / 4 },
};

// ── Model ─────────────────────────────────────────────────────────────────────

export interface OverviewPhoto {
  id: string;
  name: string;
  url: string;
}

export type HourItem =
  | { kind: "section"; title: string }
  | { kind: "row"; id: string; date: string; name: string; hours: number; note: string }
  | { kind: "subtotal"; title: string; hours: number }
  | { kind: "total"; hours: number };

export type SummaryBlock = "intro" | "scope" | "items" | "comments" | "recommendations";

export interface PhotoDay {
  /** Null when dates aren't shown. */
  label: string | null;
  /** The day started on an earlier page. */
  continued: boolean;
  rows: OverviewPhoto[][];
}

export type Page =
  | { kind: "summary"; no: number; blocks: SummaryBlock[] }
  | { kind: "hours"; no: number; first: boolean; items: HourItem[] }
  | {
      kind: "photos";
      no: number;
      first: boolean;
      days: PhotoDay[];
    };

export type SectionKey = "summary" | "hours" | "photos";

export interface OverviewModel {
  reportType: string;
  site: string;
  blurb: string;
  coverUrl: string;
  coverPos: CoverPos;
  facts: { k: string; v: string }[];
  summaryLede: string;
  /** Under "Hours schedule": who logged the hours, when, on which job. */
  hoursLede: string;
  /** The quote's description, sanitised; empty when hidden or missing. */
  scope: string;
  /** "Quote #10970" when the scope came from a quote. */
  scopeSource: string;
  /** Line items grouped by cost centre; empty when hidden or missing. */
  items: { group: string; labels: string[] }[];
  comments: string;
  recommendations: string;
  showNotes: boolean;
  grid: { cols: number; ratio: number };
  pages: Page[];
  total: number;
  /** "Section 01 / 04" label for each section present, plus the closing page. */
  secText: Record<SectionKey | "about", string>;
  toc: { title: string; items: { name: string; page: string }[] }[];
  photoCount: number;
  totalHours: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Rich text from the editor (or older plain text) → one line of plain text. */
export function plainText(html: string | null | undefined): string {
  return (html ?? "")
    .replace(/<\/(p|h2|h3|li)>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

const hrs = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
export { hrs as formatHours };

function dayKey(iso: string | null | undefined): string {
  if (!iso) return "undated";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "undated" : d.toISOString().slice(0, 10);
}

function dayLabel(key: string): string {
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export function scheduleDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Natural sort, so "2 Roof.jpg" comes before "10 Roof.jpg".
function naturalSort(a: string, b: string): number {
  const ca = a.split(/(\d+)/).filter(Boolean);
  const cb = b.split(/(\d+)/).filter(Boolean);
  for (let i = 0; i < Math.max(ca.length, cb.length); i++) {
    const x = ca[i] ?? "";
    const y = cb[i] ?? "";
    const r = /^\d+$/.test(x) && /^\d+$/.test(y) ? parseInt(x, 10) - parseInt(y, 10) : x.localeCompare(y);
    if (r !== 0) return r;
  }
  return 0;
}

/** Schedule rows as table items. Sectioned: once any row starts a named
 *  section, the rows before it get an auto-named first section, and every
 *  section ends with a subtotal. A grand total closes the table. */
export function hourItems(rows: ScheduleRow[], sectioned: boolean): HourItem[] {
  const items: HourItem[] = [];
  const total = rows.reduce((t, r) => t + (r.actualHours || 0), 0);
  const hasBreak = sectioned && rows.some((r) => r.sectionTitle);
  let title: string | null = null;
  let sub = 0;
  const flush = () => {
    if (title !== null) items.push({ kind: "subtotal", title, hours: sub });
  };
  rows.forEach((r, i) => {
    if (hasBreak && (r.sectionTitle || i === 0)) {
      flush();
      title = r.sectionTitle || "Section 1";
      sub = 0;
      items.push({ kind: "section", title });
    }
    items.push({ kind: "row", id: r.id, date: r.date, name: r.employeeName, hours: r.actualHours || 0, note: r.note });
    sub += r.actualHours || 0;
  });
  flush();
  if (rows.length) items.push({ kind: "total", hours: total });
  return items;
}

const ledeH = (text: string) => Math.max(1, Math.ceil(text.length / LEDE_CHARS)) * LEDE_LINE;
const ITEM_LINE = 30; // 17 × 1.6 + 2 list gap, rounded up
const ITEM_GROUP = 50; // group name, its margin and the gap above
const itemsH = (groups: { labels: string[] }[]) =>
  NOTE_HEAD + groups.reduce((t, g) => t + ITEM_GROUP + g.labels.length * ITEM_LINE, 0);
const noteH = (html: string) => {
  const blocks = (html.match(/<\/(p|h2|h3|li|blockquote)>/g) ?? []).length;
  return NOTE_HEAD + notesLineCount(html) * NOTE_LINE + blocks * 10;
};

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildOverviewModel(report: ConditionReportData, coverFallback: string): OverviewModel {
  const { job, settings } = report;
  const street = job.address.split(",")[0]?.trim() || "";
  const site = (job.site || street || job.project || "Job overview").trim();
  const blurb =
    plainText(job.intro) ||
    "This report outlines the works completed, including any updates, adjustments and variations from the original scope.";

  // What the report shows — the same date filter applies to photos and hours.
  const range = (from: string | null, to: string | null) => (settings.filterByDate ? [from, to] : [null, null]) as [string | null, string | null];
  const [from, to] = range(settings.dateFrom, settings.dateTo);
  const photos = settings.showPhotos ? filterPhotosByDateRange(report.photos, from, to) : [];
  const schedule = settings.showSchedule ? filterScheduleByDateRange(report.schedule, from, to) : [];
  const comments = sanitizeNotesHtml(report.comments);
  const recommendations = sanitizeNotesHtml(report.recommendations);
  const hasNotes = settings.showSummary && (!notesIsEmpty(comments) || !notesIsEmpty(recommendations));

  const totalHours = schedule.reduce((t, r) => t + (r.actualHours || 0), 0);
  const days = new Set(schedule.map((r) => r.date)).size;
  const photoDays = new Set(photos.map((p) => dayKey(p.dateAdded)).filter((k) => k !== "undated")).size;

  // Scope of works, from the quote the job came from.
  const scope = settings.showSummary && settings.showScope !== false ? sanitizeNotesHtml(report.scope?.description) : "";
  const items: OverviewModel["items"] = [];
  if (settings.showSummary && settings.showScopeItems !== false) {
    for (const it of report.scope?.items ?? []) {
      const last = items[items.length - 1];
      if (last && last.group === it.group) last.labels.push(it.label);
      else items.push({ group: it.group, labels: [it.label] });
    }
  }
  const longDate = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
  };
  const dates = schedule.map((r) => r.date).filter(Boolean).sort();
  const onJob = job.jobNo ? ` on job ${job.jobNo}` : "";
  const hoursLede = !dates.length
    ? ""
    : dates[0] === dates[dates.length - 1]
      ? `The hours below were logged by our team on ${longDate(dates[0])}${onJob}.`
      : `The hours below were logged by our team between ${longDate(dates[0])} and ${longDate(dates[dates.length - 1])}${onJob}.`;
  const summaryLede = schedule.length
    ? `${hrs(totalHours).replace(/\.00$/, "")} hours across ${days} day${days === 1 ? "" : "s"} on site${photos.length ? `, with ${photos.length} photo${photos.length === 1 ? "" : "s"} of the work` : ""}.`
    : photos.length
      ? `${photos.length} photo${photos.length === 1 ? "" : "s"} of the work, taken across ${photoDays || 1} day${photoDays === 1 ? "" : "s"}.`
      : "An overview of the works completed.";

  const sections: SectionKey[] = [];
  if (settings.showSummary) sections.push("summary");
  if (schedule.length) sections.push("hours");
  if (photos.length) sections.push("photos");
  const nSec = sections.length + 1;
  const secText = {} as OverviewModel["secText"];
  sections.forEach((k, i) => (secText[k] = `Section ${pad(i + 1)} / ${pad(nSec)}`));
  secText.about = `Section ${pad(nSec)} / ${pad(nSec)}`;

  const pages: Page[] = [];
  const no = () => pages.length + 3;

  // Summary: the intro (lede + stats), then comments and recommendations,
  // moving to a new page when the next block won't fit.
  if (settings.showSummary) {
    const blocks: { b: SummaryBlock; h: number }[] = [{ b: "intro", h: H2 + 20 + ledeH(summaryLede) }];
    if (!notesIsEmpty(scope)) blocks.push({ b: "scope", h: noteH(scope) });
    if (items.length) blocks.push({ b: "items", h: itemsH(items) });
    if (hasNotes && !notesIsEmpty(comments)) blocks.push({ b: "comments", h: noteH(comments) });
    if (hasNotes && !notesIsEmpty(recommendations)) blocks.push({ b: "recommendations", h: noteH(recommendations) });
    let page: Extract<Page, { kind: "summary" }> = { kind: "summary", no: no(), blocks: [] };
    let used = SEC_LABEL;
    for (const { b, h } of blocks) {
      if (page.blocks.length && used + h > FLOW_H) {
        pages.push(page);
        page = { kind: "summary", no: no(), blocks: [] };
        used = SEC_LABEL;
      }
      page.blocks.push(b);
      used += h;
    }
    pages.push(page);
  }

  // Hours: the table, its header repeated on every page. A section header
  // never sits alone at a page foot.
  if (schedule.length) {
    const items = hourItems(schedule, settings.scheduleSections);
    const rowH = settings.showScheduleNotes ? T_ROW_NOTES : T_ROW;
    const hOf = (it: HourItem) => (it.kind === "section" ? T_SEC : it.kind === "row" ? rowH : it.kind === "subtotal" ? T_SUB : T_TOTAL);
    let page: Extract<Page, { kind: "hours" }> = { kind: "hours", no: no(), first: true, items: [] };
    let used = SEC_LABEL + H2 + T_INTRO - LEDE_LINE + ledeH(hoursLede) + T_HEAD;
    items.forEach((it, i) => {
      const next = items[i + 1];
      const need = hOf(it) + (it.kind === "section" && next ? hOf(next) : 0);
      if (page.items.length && used + need > FLOW_H) {
        pages.push(page);
        page = { kind: "hours", no: no(), first: false, items: [] };
        used = SEC_LABEL + T_HEAD;
      }
      page.items.push(it);
      used += hOf(it);
    });
    pages.push(page);
  }

  // Photos: grouped by day when dates are shown, in rows of the grid's
  // column count.
  const grid = GRIDS[settings.photoLayout] ?? GRIDS.medium;
  if (photos.length) {
    const colW = (CONTENT_W - COL_GAP * (grid.cols - 1)) / grid.cols;
    const rowH = Math.ceil(colW * grid.ratio) + CAPTION;
    const groups = new Map<string, typeof photos>();
    for (const p of photos) {
      const k = settings.showDates ? dayKey(p.dateAdded) : "all";
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    const ordered = [...groups.entries()].sort(([a], [b]) => (a === "undated" ? 1 : b === "undated" ? -1 : a.localeCompare(b)));
    let page: Extract<Page, { kind: "photos" }> = { kind: "photos", no: no(), first: true, days: [] };
    let used = SEC_LABEL + H2 + T_INTRO;
    const newPage = () => {
      pages.push(page);
      page = { kind: "photos", no: no(), first: false, days: [] };
      used = SEC_LABEL;
    };
    for (const [k, list] of ordered) {
      const sorted = [...list].sort((a, b) => naturalSort(a.name, b.name));
      const rows: OverviewPhoto[][] = [];
      for (let i = 0; i < sorted.length; i += grid.cols) {
        rows.push(sorted.slice(i, i + grid.cols).map((p) => ({ id: p.id, name: p.name, url: p.url })));
      }
      const label = !settings.showDates ? null : k === "undated" ? "Undated" : dayLabel(k);
      let day: PhotoDay | null = null;
      for (const row of rows) {
        // A day's first row brings its heading; a day split across pages
        // starts the next page with "{day}, continued".
        const opening: boolean = day === null;
        const head = opening ? (page.days.length ? DAY_GAP : 0) + (label ? DAY_HEAD : 0) : 0;
        const gap = day !== null && day.rows.length ? ROW_GAP : 0;
        let continued = false;
        if ((page.days.length > 0 || !opening) && used + head + gap + rowH > FLOW_H) {
          continued = !opening;
          newPage();
          day = null;
        }
        if (!day) {
          day = { label, continued, rows: [] };
          used += (page.days.length ? DAY_GAP : 0) + (label ? DAY_HEAD : 0);
          page.days.push(day);
        }
        used += (day.rows.length ? ROW_GAP : 0) + rowH;
        day.rows.push(row);
      }
    }
    pages.push(page);
  }

  const total = pages.length + 3;
  const firstOf = (k: Page["kind"]) => pages.find((p) => p.kind === k)?.no;
  const jobItems: { name: string; page: string }[] = [];
  if (firstOf("summary")) jobItems.push({ name: "Job summary", page: String(firstOf("summary")) });
  if (firstOf("hours")) jobItems.push({ name: "Hours schedule", page: String(firstOf("hours")) });
  const photoItems: { name: string; page: string }[] = [];
  if (settings.showDates) {
    const seen = new Set<string>();
    for (const p of pages) {
      if (p.kind !== "photos") continue;
      for (const d of p.days) {
        if (d.label && !seen.has(d.label)) {
          seen.add(d.label);
          photoItems.push({ name: d.label, page: String(p.no) });
        }
      }
    }
  }
  if (!photoItems.length && firstOf("photos")) photoItems.push({ name: "Photos", page: String(firstOf("photos")) });
  // Long shoots list a lot of days; keep the contents to one page.
  const shownPhotos = photoItems.length > 14 ? [...photoItems.slice(0, 13), { name: `And ${photoItems.length - 13} more days`, page: "" }] : photoItems;

  const toc: OverviewModel["toc"] = [];
  if (jobItems.length) toc.push({ title: "The job", items: jobItems });
  if (shownPhotos.length) toc.push({ title: "Photos", items: shownPhotos });
  toc.push({ title: "RAS-VERTEX", items: [{ name: "One partner", page: String(total) }] });

  return {
    reportType: job.reportType || "Job Overview",
    site,
    blurb,
    coverUrl: job.coverPhoto || coverFallback,
    coverPos: report.coverPos ?? DEFAULT_COVER_POS,
    facts: [
      { k: "Prepared for", v: job.preparedFor },
      { k: "Project", v: job.project },
      { k: "Date", v: fmtDate(job.date) },
      { k: "Prepared by", v: job.preparedBy },
    ],
    summaryLede,
    hoursLede,
    scope: notesIsEmpty(scope) ? "" : scope,
    scopeSource: report.scope?.quoteId ? `Quote #${report.scope.quoteId}` : "",
    items,
    comments,
    recommendations,
    showNotes: settings.showScheduleNotes,
    grid,
    pages,
    total,
    secText,
    toc,
    photoCount: photos.length,
    totalHours,
  };
}
