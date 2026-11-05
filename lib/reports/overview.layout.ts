// lib/reports/overview.layout.ts
//
// Everything the Job Overview document needs, derived once from the report
// data: cover facts, the hours schedule as table items,
// the photos grouped by day, and which page each block lands on. Pure, so
// the builder preview and the PDF route paginate identically.
//
// Pages are 1280 × 1810 page units, the same sheet as the Anchor and
// Inspection reports. Table rows and photo cells have fixed heights, so
// pagination is arithmetic rather than measured; rich-text blocks are
// estimated from their line count.
//
// Pages: 1 Cover · 2 Contents · Hours schedule · Methodology · Photos ·
// Maintenance plan · Warranties · last: RAS-VERTEX (the closing page shared
// with the Anchor report).

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
import type { PhotoPos } from "./photos";
import { htmlItems } from "./richText";
import { planRows, PLAN_INTRO, type PlanItem } from "./maintenancePlan";
import { KIND, normWarranties, shortDate, supplierName, WARRANTY_KINDS, type WarrantyInfo, type WarrantyKind, type WarrantyScheduleRow } from "./warranty";

export { pad };
export const PAGE_W = 1280;
export const PAGE_H = 1810;
export const CONTENT_W = 1088;

/** The cover photo used until one is uploaded. */
export const DEFAULT_OVERVIEW_COVER = "reports/proposal/assets/rope-access.png";

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
  pos?: PhotoPos;
}

export type HourItem =
  | { kind: "section"; title: string }
  | { kind: "row"; id: string; date: string; name: string; hours: number; note: string; start: string; finish: string }
  | { kind: "subtotal"; title: string; hours: number }
  | { kind: "total"; hours: number };

export interface PhotoDay {
  /** Null when dates aren't shown. */
  label: string | null;
  /** The day started on an earlier page. */
  continued: boolean;
  rows: OverviewPhoto[][];
}

export type MethodBlock =
  | { t: "group"; stage: number; title: string; from: number; to: number; cont: boolean }
  | { t: "step"; n: number; html: string }
  | { t: "photo" };

export type Page =
  | { kind: "method"; no: number; first: boolean; blocks: MethodBlock[] }
  | { kind: "plan"; no: number; first: boolean; rows: PlanItem[]; notes: boolean }
  | { kind: "warranty"; no: number; w: WarrantyKind; first: boolean }
  | { kind: "care"; no: number; w: WarrantyKind }
  | { kind: "hours"; no: number; first: boolean; items: HourItem[] }
  | {
      kind: "photos";
      no: number;
      first: boolean;
      days: PhotoDay[];
    };

export type SectionKey = "hours" | "method" | "photos" | "plan" | "warranty";

export interface OverviewModel {
  reportType: string;
  site: string;
  blurb: string;
  coverUrl: string;
  coverPos: CoverPos;
  facts: { k: string; v: string }[];
  /** Under "Hours schedule": who logged the hours, when, on which job. */
  hoursLede: string;
  showNotes: boolean;
  /** Start and finish columns. */
  showTimes: boolean;
  grid: { cols: number; ratio: number };
  pages: Page[];
  total: number;
  /** "Section 01 / 04" label for each section present, plus the closing page. */
  secText: Record<SectionKey | "about", string>;
  toc: { title: string; items: { name: string; page: string }[] }[];
  photoCount: number;
  totalHours: number;
  method: { intro: string; photoUrl: string | null; photoPos?: PhotoPos; caption: string } | null;
  plan: { intro: string; next: boolean; notes: string } | null;
  warranties: Partial<Record<WarrantyKind, WarrantyModel>>;
}

export interface WarrantyModel {
  title: string;
  intro: string;
  facts: { k: string; v: string }[];
  details: { k: string; v: string }[];
  statement: string;
  signed: string;
  careIntro: string;
  requirements: string[];
  schedule: WarrantyScheduleRow[];
  obligations: string;
  scheduleTitle: string;
  scheduleIntro: string;
  contact: { name: string; phone: string; email: string };
  href: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
    items.push({ kind: "row", id: r.id, date: r.date, name: r.employeeName, hours: r.actualHours || 0, note: r.note, start: r.start ?? "", finish: r.finish ?? "" });
    sub += r.actualHours || 0;
  });
  flush();
  if (rows.length) items.push({ kind: "total", hours: total });
  return items;
}

const longDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
};

/** "The hours below were logged by our team between … and … on job #11360." */
export function hoursLedeText(rows: ScheduleRow[], jobNo: string): string {
  const dates = rows.map((r) => r.date).filter(Boolean).sort();
  const onJob = jobNo ? ` on job ${jobNo}` : "";
  if (!dates.length) return "";
  return dates[0] === dates[dates.length - 1]
    ? `The hours below were logged by our team on ${longDate(dates[0])}${onJob}.`
    : `The hours below were logged by our team between ${longDate(dates[0])} and ${longDate(dates[dates.length - 1])}${onJob}.`;
}

/** Height of a page title and its lede (Heading in the documents). */
export const headingHeight = (lede: string) => H2 + T_INTRO - LEDE_LINE + ledeH(lede);

/** The hours table split into pages: the header repeats on each, and a
 *  section header never sits alone at a page foot. `firstTop` / `nextTop`:
 *  height used above the table on the first and later pages. */
export function paginateHours(items: HourItem[], notes: boolean, firstTop: number, nextTop: number): HourItem[][] {
  const rowH = notes ? T_ROW_NOTES : T_ROW;
  const hOf = (it: HourItem) => (it.kind === "section" ? T_SEC : it.kind === "row" ? rowH : it.kind === "subtotal" ? T_SUB : T_TOTAL);
  const pages: HourItem[][] = [];
  let page: HourItem[] = [];
  let used = firstTop + T_HEAD;
  items.forEach((it, i) => {
    const next = items[i + 1];
    const need = hOf(it) + (it.kind === "section" && next ? hOf(next) : 0);
    if (page.length && used + need > FLOW_H) {
      pages.push(page);
      page = [];
      used = nextTop + T_HEAD;
    }
    page.push(it);
    used += hOf(it);
  });
  pages.push(page);
  return pages;
}

const ledeH = (text: string) => Math.max(1, Math.ceil(text.length / LEDE_CHARS)) * LEDE_LINE;
const noteH = (html: string) => {
  const blocks = (html.match(/<\/(p|h2|h3|li|blockquote)>/g) ?? []).length;
  return NOTE_HEAD + notesLineCount(html) * NOTE_LINE + blocks * 10;
};

// ── Build ─────────────────────────────────────────────────────────────────────

export function buildOverviewModel(report: ConditionReportData, coverFallback: string): OverviewModel {
  const { job, settings } = report;
  const street = job.address.split(",")[0]?.trim() || "";
  const site = (job.site || street || job.project || "Job overview").trim();
  const intro = sanitizeNotesHtml(job.intro);
  const blurb = notesIsEmpty(intro)
    ? "<p>This report outlines the works completed, including any updates, adjustments and variations from the original scope.</p>"
    : intro;

  // What the report shows — the same date filter applies to photos and hours.
  const range = (from: string | null, to: string | null) => (settings.filterByDate ? [from, to] : [null, null]) as [string | null, string | null];
  const [from, to] = range(settings.dateFrom, settings.dateTo);
  const photos = settings.showPhotos ? filterPhotosByDateRange(report.photos, from, to) : [];
  const schedule = settings.showSchedule ? filterScheduleByDateRange(report.schedule, from, to) : [];
  const totalHours = schedule.reduce((t, r) => t + (r.actualHours || 0), 0);
  const hoursLede = hoursLedeText(schedule, job.jobNo ?? "");
  const method = report.method?.on ? report.method : null;
  const plan = report.plan?.on && report.plan.items.length ? report.plan : null;
  const ws = normWarranties(report.warranty, report.job.date);
  const kinds = ws?.on ? WARRANTY_KINDS.filter((k) => ws[k]?.on) : [];
  const sections: SectionKey[] = [];
  if (schedule.length) sections.push("hours");
  if (method) sections.push("method");
  if (photos.length) sections.push("photos");
  if (plan) sections.push("plan");
  if (kinds.length) sections.push("warranty");
  const nSec = sections.length + 1;
  const secText = {} as OverviewModel["secText"];
  sections.forEach((k, i) => (secText[k] = `Section ${pad(i + 1)} / ${pad(nSec)}`));
  secText.about = `Section ${pad(nSec)} / ${pad(nSec)}`;

  const pages: Page[] = [];
  const no = () => pages.length + 3;

  // Hours: the table, its header repeated on every page. A section header
  // never sits alone at a page foot.
  if (schedule.length) {
    const items = hourItems(schedule, settings.scheduleSections);
    const split = paginateHours(items, settings.showScheduleNotes, SEC_LABEL + H2 + T_INTRO - LEDE_LINE + ledeH(hoursLede), SEC_LABEL);
    split.forEach((items, i) => pages.push({ kind: "hours", no: no(), first: i === 0, items }));
  }

  // Methodology: each stage's head, then its numbered steps; a stage split
  // across pages repeats its head. The photo, if any, closes the section.
  if (method) {
    const stepH = (html: string) => 32 + Math.max(1, Math.ceil(html.replace(/<[^>]*>/g, "").length / METHOD_CHARS)) * 28;
    let page: Extract<Page, { kind: "method" }> = { kind: "method", no: no(), first: true, blocks: [] };
    let used = SEC_LABEL + H2 + 20 + ledeH(method.intro) + 56;
    const newPage = () => {
      pages.push(page);
      page = { kind: "method", no: no(), first: false, blocks: [] };
      used = SEC_LABEL;
    };
    let n = 0;
    let stage = 0;
    for (const g of method.groups) {
      const steps = htmlItems(g.steps);
      if (!steps.length) continue;
      stage++;
      const head = (cont: boolean): MethodBlock => ({ t: "group", stage, title: g.title, from: n + 1, to: n + steps.length, cont });
      const headH = (page.blocks.length ? GROUP_GAP : 0) + GROUP_HEAD;
      if (page.blocks.length && used + headH + stepH(steps[0]) > FLOW_H) newPage();
      used += (page.blocks.length ? GROUP_GAP : 0) + GROUP_HEAD;
      page.blocks.push(head(false));
      for (const html of steps) {
        if (used + stepH(html) > FLOW_H) {
          newPage();
          page.blocks.push(head(true));
          used += GROUP_HEAD;
        }
        page.blocks.push({ t: "step", n: ++n, html });
        used += stepH(html);
      }
    }
    if (method.photoId && report.photos.some((p) => p.id === method.photoId)) {
      if (used + METHOD_PHOTO > FLOW_H) newPage();
      page.blocks.push({ t: "photo" });
    }
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
        rows.push(sorted.slice(i, i + grid.cols).map((p) => ({ id: p.id, name: p.name, url: p.url, pos: p.pos })));
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

  // Maintenance plan: the table (header repeated), then the comments.
  const planNotes = plan ? sanitizeNotesHtml(plan.notes) : "";
  if (plan) {
    const rows = planRows(plan.items);
    const rowH = (x: PlanItem) => 32 + Math.max(1, Math.ceil(x.service.length / 52)) * 28;
    let page: Extract<Page, { kind: "plan" }> = { kind: "plan", no: no(), first: true, rows: [], notes: false };
    let used = SEC_LABEL + H2 + 20 + ledeH(PLAN_INTRO) + 56 + T_HEAD;
    for (const x of rows) {
      if (page.rows.length && used + rowH(x) > FLOW_H) {
        pages.push(page);
        page = { kind: "plan", no: no(), first: false, rows: [], notes: false };
        used = SEC_LABEL + T_HEAD;
      }
      page.rows.push(x);
      used += rowH(x);
    }
    if (!notesIsEmpty(planNotes)) {
      if (used + noteH(planNotes) > FLOW_H) {
        pages.push(page);
        page = { kind: "plan", no: no(), first: false, rows: [], notes: false };
      }
      page.notes = true;
    }
    pages.push(page);
  }

  // Warranties: each the warranty itself, then what keeps it valid.
  kinds.forEach((w, i) => {
    pages.push({ kind: "warranty", no: no(), w, first: i === 0 });
    pages.push({ kind: "care", no: no(), w });
  });

  const total = pages.length + 3;
  const firstOf = (k: Page["kind"]) => pages.find((p) => p.kind === k)?.no;
  const jobItems: { name: string; page: string }[] = [];
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
  if (firstOf("method")) toc.push({ title: "The works", items: [{ name: "Methodology", page: String(firstOf("method")) }] });
  if (shownPhotos.length) toc.push({ title: "Photos", items: shownPhotos });
  if (firstOf("plan")) toc.push({ title: "Maintenance", items: [{ name: "Maintenance plan", page: String(firstOf("plan")) }] });
  if (kinds.length)
    toc.push({
      title: "Warranty",
      items: pages.flatMap((p) =>
        p.kind === "warranty"
          ? [{ name: KIND[p.w].title, page: String(p.no) }]
          : p.kind === "care"
            ? [{ name: "Keeping your warranty", page: String(p.no) }]
            : [],
      ),
    });
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
    hoursLede,
    showNotes: settings.showScheduleNotes,
    showTimes: !!settings.showScheduleTimes,
    grid,
    pages,
    total,
    secText,
    toc,
    photoCount: photos.length,
    totalHours,
    method: method
      ? (() => {
          const p = report.photos.find((x) => x.id === method.photoId);
          return { intro: method.intro, photoUrl: p?.url ?? null, photoPos: p?.pos, caption: method.caption ?? "" };
        })()
      : null,
    plan: plan ? { intro: PLAN_INTRO, next: plan.items.some((x) => x.next?.trim()), notes: planNotes } : null,
    warranties: Object.fromEntries(kinds.map((k) => [k, warrantyModel(k, ws![k]!, site, job)])),
  };
}

const METHOD_CHARS = 88; // 20px text across the 960 step column
const GROUP_HEAD = 62; // title row, its rule and padding
const GROUP_GAP = 56;
const METHOD_PHOTO = 56 + 760 + 44; // gap, photo, caption

function warrantyModel(kind: WarrantyKind, w: WarrantyInfo, site: string, job: ConditionReportData["job"]): WarrantyModel {
  const k = KIND[kind];
  const name = supplierName(w);
  const area = w.area.trim() || k.area;
  const from = w.completed ? shortDate(w.completed) : "completion";
  const intro =
    w.intro?.trim() ||
    (kind === "waterproofing"
      ? `RAS-VERTEX warrants the workmanship of the waterproofing at ${site} for ${w.years} years from ${from}. The works were carried out in accordance with the manufacturer's Technical Data Sheets and installation instructions for the products applied.`
      : `RAS-VERTEX warrants the coating system at ${site} was applied in a proper and workmanlike manner, to the manufacturer's data sheets, AS/NZS 2311 and our quoted scope. For ${w.years} years from ${from}, it will not peel, flake, blister or delaminate due to faulty surface preparation (cleaning and priming) or application by us.`);
  const statement =
    w.statement?.trim() ||
    (kind === "waterproofing"
      ? `The undersigned, on behalf of RAS-VERTEX, confirms that the installation of the ${name ? `${name} ` : ""}products listed above was carried out in accordance with the manufacturer's Technical Data Sheets and installation instructions.`
      : "The undersigned, on behalf of RAS-VERTEX, certifies that the coating system listed above was applied in accordance with the manufacturer's Product Data Sheets and project specification and AS/NZS 2311, and that RAS-VERTEX provides the workmanship warranty set out in this document.");
  const reference = job.jobNo ? `#${job.jobNo}` : job.project;
  return {
    title: k.title,
    intro,
    facts: [
      { k: "Warranty", v: `${w.years} years` },
      { k: "Manufacturer", v: name || "—" },
      { k: "Area", v: area },
      { k: "Commences", v: w.completed ? shortDate(w.completed) : "—" },
    ],
    details: [
      { k: "Project", v: site },
      { k: "Project address", v: job.address },
      { k: "Project reference", v: reference },
      { k: "Installer", v: "Rope Access Services Pty Ltd, trading as RAS-VERTEX" },
      { k: "Area of works", v: area },
      { k: "Products applied", v: w.products.trim() || "—" },
      { k: "Warranty period", v: w.completed ? `${w.years} years from ${shortDate(w.completed)}` : `${w.years} years` },
    ],
    statement,
    signed: shortDate(w.signed || job.date),
    careIntro:
      kind === "waterproofing"
        ? "To keep this warranty valid, the following obligations apply."
        : "To keep this warranty valid, the owner must look after the painted surfaces as set out below.",
    requirements: w.requirements.filter((x) => x.trim()),
    schedule: w.schedule,
    obligations: k.obligations,
    scheduleTitle: k.scheduleTitle,
    scheduleIntro: k.scheduleIntro,
    contact: { name: "Phil Clark, Director", phone: "07 5371 0201", email: "phil@rasvertex.com.au" },
    href:
      "mailto:team@rasvertex.com.au?subject=" +
      encodeURIComponent(`${kind === "painting" ? "Building wash and inspection" : "Annual inspection"}, ${site}${reference ? ` (${reference})` : ""}`) +
      "&body=" + encodeURIComponent(`Hi RAS-VERTEX team,\n\nPlease book our ${kind === "painting" ? "annual building wash and inspection" : "annual inspection"}.\n\nThanks,`),
  };
}
