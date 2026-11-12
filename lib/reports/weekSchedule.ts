// lib/reports/weekSchedule.ts
// Weekly schedule: who is on which site each day, read from the SimPRO
// schedule. Shared by the API route (app/api/simpro/schedules/week) and the
// report page (components/reports/week-schedule).

export type WeekEntryKind = "job" | "quote" | "activity";

/** One staff member's schedule on one day for one job, quote or activity,
 *  with the hours of all its blocks that day added together. */
export interface WeekEntry {
  staffId: number;
  date: string; // "YYYY-MM-DD"
  kind: WeekEntryKind;
  /** What the cell shows: the site name, or the activity ("Annual Leave"). */
  label: string;
  /** SimPRO job or quote number, if any. */
  ref: string | null;
  /** Job or quote name, for the tooltip. */
  name: string;
  hours: number;
}

export interface WeekScheduleResponse {
  from: string;
  to: string;
  staff: { id: number; name: string }[];
  entries: WeekEntry[];
  /** Schedules that couldn't be read (shown as a warning, not an error). */
  skipped: number;
}

// ── Dates (local time, the office's week) ──────────────────────────────────

export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromIso = (s: string) => new Date(s + "T00:00:00");

/** The Monday of the week a date falls in. */
export function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday to Sunday of the week starting at monday. */
export const weekDays = (monday: Date) => Array.from({ length: 7 }, (_, i) => iso(addDays(monday, i)));

export function weekTitle(monday: Date): string {
  const fri = addDays(monday, 4);
  const day = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric" });
  const month = (d: Date) => d.toLocaleDateString("en-AU", { month: "long" });
  return monday.getMonth() === fri.getMonth()
    ? `${day(monday)}–${day(fri)} ${month(fri)} ${fri.getFullYear()}`
    : `${day(monday)} ${month(monday)} – ${day(fri)} ${month(fri)} ${fri.getFullYear()}`;
}

// ── Cells ──────────────────────────────────────────────────────────────────

export interface CellItem {
  label: string;
  kind: WeekEntryKind;
  refs: string[];
  names: string[];
  hours: number;
}

/** What one staff member is doing one day: each site once, the longest
 *  first; activities (leave, RDO) after the work. */
export function cellItems(entries: WeekEntry[]): CellItem[] {
  const by = new Map<string, CellItem>();
  for (const e of entries) {
    const key = `${e.kind === "activity" ? "a" : "w"}:${e.label.toLowerCase()}`;
    const it = by.get(key) ?? { label: e.label, kind: e.kind, refs: [], names: [], hours: 0 };
    if (e.ref && !it.refs.includes(e.ref)) it.refs.push(e.ref);
    if (e.name && !it.names.includes(e.name)) it.names.push(e.name);
    it.hours += e.hours;
    by.set(key, it);
  }
  return [...by.values()].sort(
    (a, b) => Number(a.kind === "activity") - Number(b.kind === "activity") || b.hours - a.hours,
  );
}

/** "#11357" or "#11195, #11295". */
export const refText = (refs: string[]) => refs.map((r) => `#${r}`).join(", ");

/** Pastels for the sites, in order of how many people are on each. */
const SITE_TONES = [
  "#dcebfb", // blue
  "#d8f1e4", // mint
  "#fde4d3", // peach
  "#e8e0fa", // lavender
  "#fadce5", // rose
  "#fbf0c6", // butter
  "#d3f0f4", // aqua
  "#e5f0d4", // sage
  "#f6e2f3", // orchid
  "#f3e6d8", // sand
  "#e2e8ee", // slate
];

/** A colour for each site this week: the busiest sites get distinct
 *  colours first; past the palette's length they repeat. */
export function siteTones(entries: WeekEntry[]): Map<string, string> {
  const days = new Map<string, number>();
  for (const e of entries) if (e.kind !== "activity") days.set(e.label, (days.get(e.label) ?? 0) + 1);
  const order = [...days.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return new Map(order.map(([label], i) => [label, SITE_TONES[i % SITE_TONES.length]]));
}

// ── Document model (builder preview and PDF) ───────────────────────────────

/** Landscape A4 in the reports' page units. */
export const WEEK_PAGE_W = 1810;
export const WEEK_PAGE_H = 1280;

export interface WeekOptions {
  /** Job numbers beside each site. */
  refs: boolean;
  /** Each site its own pastel. */
  colour: boolean;
  /** Saturday and Sunday columns (always shown when anyone is booked). */
  weekend: boolean;
}

export const DEFAULT_WEEK_OPTIONS: WeekOptions = { refs: false, colour: true, weekend: false };

export interface WeekCell extends CellItem {
  tone: string | null;
}

/** A run of days in a row: consecutive days on the same single site (or
 *  the same leave) become one bar. A day with two sites is its own run. */
export interface WeekRun {
  /** Index of the first day. */
  start: number;
  span: number;
  items: WeekCell[];
}

export interface WeekRow {
  n: number;
  name: string;
  cells: WeekCell[][];
  runs: WeekRun[];
}

const sameDay = (a: WeekCell[], b: WeekCell[]) =>
  a.length === 1 && b.length === 1 && a[0].kind === b[0].kind && a[0].label === b[0].label;

function runsOf(cells: WeekCell[][]): WeekRun[] {
  const runs: WeekRun[] = [];
  cells.forEach((items, i) => {
    if (!items.length) return;
    const last = runs[runs.length - 1];
    if (last && last.start + last.span === i && sameDay(last.items, items)) {
      last.span++;
      // Job numbers across the run.
      for (const r of items[0].refs) if (!last.items[0].refs.includes(r)) last.items[0].refs.push(r);
    } else {
      runs.push({ start: i, span: 1, items: items.map((it) => ({ ...it, refs: [...it.refs] })) });
    }
  });
  return runs;
}

export interface WeekModel {
  title: string;
  lede: string;
  days: { iso: string; day: string; date: string }[];
  pages: WeekRow[][];
  opts: WeekOptions;
  staffCount: number;
  siteCount: number;
}

// Heights in page units, for splitting rows across pages.
const ROW_H = 38;
const ITEM_H = 32;
const FIRST_BODY = 890;
const NEXT_BODY = 1010;

export function buildWeekModel(
  data: WeekScheduleResponse,
  monday: Date,
  opts: WeekOptions,
  hidden: number[] = [],
): WeekModel {
  const all = weekDays(monday);
  const weekendBooked = data.entries.some((e) => e.date === all[5] || e.date === all[6]);
  const isos = opts.weekend || weekendBooked ? all : all.slice(0, 5);
  const tones = siteTones(data.entries);

  const by = new Map<string, WeekEntry[]>();
  for (const e of data.entries) {
    const k = `${e.staffId}|${e.date}`;
    by.set(k, [...(by.get(k) ?? []), e]);
  }

  const staff = data.staff.filter((s) => !hidden.includes(s.id));
  const rows: WeekRow[] = staff.map((s, i) => {
    const cells = isos.map((d) =>
      cellItems(by.get(`${s.id}|${d}`) ?? []).map((it) => ({
        ...it,
        tone: it.kind !== "activity" && opts.colour ? (tones.get(it.label) ?? null) : null,
      })),
    );
    return { n: i + 1, name: s.name, cells, runs: runsOf(cells) };
  });

  const pages: WeekRow[][] = [[]];
  let room = FIRST_BODY;
  for (const r of rows) {
    const h = ROW_H + ITEM_H * Math.max(0, Math.max(...r.cells.map((c) => c.length)) - 1);
    if (h > room && pages[pages.length - 1].length) {
      pages.push([]);
      room = NEXT_BODY;
    }
    pages[pages.length - 1].push(r);
    room -= h;
  }

  const sites = new Set(
    data.entries.filter((e) => e.kind !== "activity" && !hidden.includes(e.staffId)).map((e) => e.label),
  ).size;
  return {
    title: weekTitle(monday),
    lede: `${staff.length} team member${staff.length === 1 ? "" : "s"} · ${sites} site${sites === 1 ? "" : "s"}`,
    days: isos.map((d) => {
      const dt = fromIso(d);
      return {
        iso: d,
        day: dt.toLocaleDateString("en-AU", { weekday: "long" }),
        date: dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
      };
    }),
    pages,
    opts,
    staffCount: staff.length,
    siteCount: sites,
  };
}
