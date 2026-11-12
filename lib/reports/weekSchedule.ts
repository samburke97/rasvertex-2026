// lib/reports/weekSchedule.ts
// Weekly schedule: who is on which site each day, read from the SimPRO
// schedule, cleaned to one clear answer per person per day, with the
// builder's edits laid over the top. Shared by the API route
// (app/api/simpro/schedules/week), the builder
// (components/reports/week-schedule) and the PDF route.

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
  /** Job or quote name, for the tooltip and the jobs overview. */
  name: string;
  /** The site's street address ("131 Coolum Terrace, Coolum Beach"). */
  address?: string;
  hours: number;
}

export interface WeekScheduleResponse {
  from: string;
  to: string;
  staff: { id: number; name: string }[];
  entries: WeekEntry[];
  /** Jobs or quotes that couldn't be read (shown by number, with a warning). */
  skipped: number;
}

/** "Platinum Residential CTS 33637 " → "Platinum Residential": the body
 *  corporate's scheme number, a trailing state and postcode, and stray
 *  spaces aren't part of the name. */
export const cleanSite = (s: string) =>
  s
    .replace(/\s*\bCTS\s*\d+\b/gi, "")
    .replace(/,?\s+(QLD|NSW|VIC|SA|WA|TAS|NT|ACT)\s+\d{4}\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

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

/** The API reads at most this many days at a time. */
export const MAX_RANGE_DAYS = 14;

/** Every day from `from` to `to`, inclusive. */
export function rangeDays(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = fromIso(from); iso(d) <= to && out.length < 62; d = addDays(d, 1)) out.push(iso(d));
  return out;
}

const isWeekend = (d: string) => [0, 6].includes(fromIso(d).getDay());

/** "16–20 November 2026", "30 November – 4 December 2026". */
export function rangeTitle(from: string, to: string): string {
  const a = fromIso(from);
  const b = fromIso(to);
  const day = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric" });
  const month = (d: Date) => d.toLocaleDateString("en-AU", { month: "long" });
  if (from === to) return `${day(a)} ${month(a)} ${a.getFullYear()}`;
  if (a.getFullYear() !== b.getFullYear()) return `${day(a)} ${month(a)} ${a.getFullYear()} – ${day(b)} ${month(b)} ${b.getFullYear()}`;
  return a.getMonth() === b.getMonth()
    ? `${day(a)}–${day(b)} ${month(b)} ${b.getFullYear()}`
    : `${day(a)} ${month(a)} – ${day(b)} ${month(b)} ${b.getFullYear()}`;
}

// ── Cleaning: one clear answer per person per day ──────────────────────────

/** A second site shows on a day only when it has at least this many hours
 *  (a genuine split day); shorter stops are left off. */
export const SPLIT_MIN_HOURS = 3;

/** Activities that mean the person isn't working (matched by name). Others
 *  (Yardwork, Training, Toolbox, Workshop…) show like a site. */
const LEAVE =
  /\b(leave|sick|personal|rdo|public holiday|holiday|unpaid|carer'?s?|work ?cover|bereavement|compassionate|parental|long service|rain day)\b/i;
export const isLeave = (label: string) => LEAVE.test(label);

export interface CellItem {
  label: string;
  kind: WeekEntryKind;
  /** Leave, RDO, sick…: drawn as an outline, never next to a site. */
  leave: boolean;
  /** A flag put in here: "tbc" (pencilled in, site to come) or "off".
   *  Both are plain grey bars, never a site; "off" counts as time off. */
  flag?: "tbc" | "off";
  refs: string[];
  names: string[];
  hours: number;
}

const byHours = (a: CellItem, b: CellItem) => b.hours - a.hours || a.label.localeCompare(b.label);

/** What one person is doing one day, from their SimPRO schedules:
 *  - the same job (or site) split across cost centres or blocks is one item;
 *  - leave wins the day when it has no hours (a full day) or at least as
 *    many hours as the work; otherwise the work shows and the leave doesn't;
 *  - zero-hour schedules drop out unless they're all there is;
 *  - the site with the most hours shows, and a second only when it has
 *    SPLIT_MIN_HOURS or more. */
export function dayItems(entries: WeekEntry[]): CellItem[] {
  const by = new Map<string, CellItem>();
  for (const e of entries) {
    const leave = e.kind === "activity" && isLeave(e.label);
    const key = `${leave ? "l" : "w"}:${e.label.toLowerCase()}`;
    const it = by.get(key) ?? { label: e.label, kind: e.kind, leave, refs: [], names: [], hours: 0 };
    if (it.kind === "activity" && e.kind !== "activity") it.kind = e.kind;
    if (e.ref && !it.refs.includes(e.ref)) it.refs.push(e.ref);
    if (e.name && !it.names.includes(e.name)) it.names.push(e.name);
    it.hours += e.hours || 0;
    by.set(key, it);
  }
  const items = [...by.values()];
  const leave = items.filter((i) => i.leave).sort(byHours);
  let work = items.filter((i) => !i.leave).sort(byHours);

  const leaveHours = leave.reduce((t, i) => t + i.hours, 0);
  const workHours = work.reduce((t, i) => t + i.hours, 0);
  const fullDayLeave = leave.some((i) => i.hours <= 0);
  if (leave.length && (fullDayLeave || !work.length || leaveHours >= workHours)) return [leave[0]];

  const timed = work.filter((i) => i.hours > 0);
  if (timed.length) work = timed;
  if (!work.length) return [];
  return work[1] && work[1].hours >= SPLIT_MIN_HOURS ? [work[0], work[1]] : [work[0]];
}

/** "#11357" or "#11195, #11295". */
export const refText = (refs: string[]) => refs.map((r) => `#${r}`).join(", ");

// ── Edits: the builder's layer over SimPRO (never written back) ────────────

/** job: from a SimPRO search; leave; tbc: someone pencilled in, site to
 *  come; off: not working (a plain flag, not a type of leave); other: free
 *  text. */
export type EditKind = "job" | "leave" | "tbc" | "off" | "other";

export interface EditItem {
  label: string;
  kind: EditKind;
  /** SimPRO job number, when filled from a search. */
  ref?: string | null;
  /** The job's name, from the search (for the jobs overview). */
  name?: string;
}

/** A schedule's edits, saved as a draft per date range. */
export interface WeekDraft {
  version: 1;
  /** "staffId|YYYY-MM-DD" → that day's items, replacing SimPRO's ([] = none). */
  days: Record<string, EditItem[]>;
  /** People added in the builder, not in SimPRO's schedule (negative ids). */
  people: { id: number; name: string }[];
}

export const emptyDraft = (): WeekDraft => ({ version: 1, days: {}, people: [] });

export const isWeekDraft = (x: unknown): x is WeekDraft =>
  !!x && typeof x === "object" && (x as WeekDraft).version === 1 && typeof (x as WeekDraft).days === "object" && Array.isArray((x as WeekDraft).people);

export const dayKey = (staffId: number, date: string) => `${staffId}|${date}`;

/** Site name → what to call it (e.g. "Cosmopolitan" → "Cosmo"), every week. */
export type SiteAliases = Record<string, string>;

const editCell = (e: EditItem): CellItem => ({
  label: e.label,
  kind: e.kind === "job" ? "job" : "activity",
  leave: e.kind === "leave" || e.kind === "off",
  flag: e.kind === "tbc" || e.kind === "off" ? e.kind : undefined,
  refs: e.ref ? [e.ref] : [],
  names: e.name ? [e.name] : [],
  hours: 0,
});

/** A cell's item as an edit (to change one item of a day, the rest kept). */
export const toEdit = (it: CellItem): EditItem => ({
  label: it.label,
  kind: it.flag ?? (it.leave ? "leave" : it.kind === "activity" ? "other" : "job"),
  ref: it.refs[0] ?? null,
  name: it.names[0],
});

// ── Document model (builder preview, PDF and Copy for Excel) ───────────────

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
  /** Jobs overview pages after the schedule: each job as it starts. */
  overview: boolean;
}

export const DEFAULT_WEEK_OPTIONS: WeekOptions = { refs: false, colour: true, weekend: false, overview: false };

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

export interface WeekCell extends CellItem {
  tone: string | null;
}

export interface WeekDay {
  iso: string;
  day: string;
  date: string;
}

/** A run of days in a row: consecutive days on the same single site (or
 *  the same leave) become one bar. A day with two sites is its own run. */
export interface WeekRun {
  /** Index of the first day (in the page's columns). */
  start: number;
  span: number;
  items: WeekCell[];
  /** Any of its days edited in the builder. */
  edited: boolean;
}

export interface WeekRow {
  n: number;
  staffId: number;
  name: string;
  /** Per day of the whole range. */
  cells: WeekCell[][];
  edited: boolean[];
}

/** One sheet: a run of day columns (at most a week) and the rows that fit. */
export interface WeekPage {
  days: WeekDay[];
  /** Index of its first day in the model's days. */
  offset: number;
  rows: { row: WeekRow; runs: WeekRun[] }[];
  first: boolean;
}

export interface WeekModel {
  title: string;
  lede: string;
  days: WeekDay[];
  rows: WeekRow[];
  pages: WeekPage[];
  /** Tighter rows, so everyone fits on one sheet per week. */
  compact: boolean;
  /** Jobs overview sheets (opts.overview): three columns each. */
  overview: OverviewSheet[];
  opts: WeekOptions;
  staffCount: number;
  siteCount: number;
}

const sameDay = (a: WeekCell[], b: WeekCell[]) =>
  a.length === 1 && b.length === 1 && a[0].leave === b[0].leave && a[0].flag === b[0].flag && a[0].label === b[0].label;

function runsOf(cells: WeekCell[][], edited: boolean[]): WeekRun[] {
  const runs: WeekRun[] = [];
  cells.forEach((items, i) => {
    if (!items.length) return;
    const last = runs[runs.length - 1];
    if (last && last.start + last.span === i && sameDay(last.items, items)) {
      last.span++;
      last.edited ||= edited[i];
      // Job numbers across the run.
      for (const r of items[0].refs) if (!last.items[0].refs.includes(r)) last.items[0].refs.push(r);
    } else {
      runs.push({ start: i, span: 1, items: items.map((it) => ({ ...it, refs: [...it.refs] })), edited: edited[i] });
    }
  });
  return runs;
}

// Heights in page units, for splitting rows across pages: a row (38 + its
// rule), each extra item of a split day (28 bar + 4 gap), and the room under
// the title on the first sheet and on the rest. Compact rows (24px bars) are
// used when they keep everyone on one sheet and normal rows don't.
const ROW_H = 39;
const ITEM_H = 32;
const ROW_H_COMPACT = 32;
const ITEM_H_COMPACT = 26;
const FIRST_BODY = 900;
const NEXT_BODY = 990;
/** Day columns on one sheet. */
export const MAX_PAGE_DAYS = 7;

/** A day's items, after the edits: the builder's, else SimPRO's cleaned. */
export function cellOf(
  byDay: Map<string, WeekEntry[]>,
  draft: WeekDraft,
  aliases: SiteAliases,
  staffId: number,
  date: string,
): { items: CellItem[]; edited: boolean } {
  const k = dayKey(staffId, date);
  const own = draft.days[k];
  if (own) return { items: own.map(editCell), edited: true };
  const entries = (byDay.get(k) ?? []).map((e) => (e.kind === "activity" ? e : { ...e, label: aliases[e.label] ?? e.label }));
  return { items: dayItems(entries), edited: false };
}

export function indexEntries(entries: WeekEntry[]): Map<string, WeekEntry[]> {
  const by = new Map<string, WeekEntry[]>();
  for (const e of entries) {
    const k = dayKey(e.staffId, e.date);
    by.set(k, [...(by.get(k) ?? []), e]);
  }
  return by;
}

export function buildWeekModel(
  data: WeekScheduleResponse,
  range: { from: string; to: string },
  opts: WeekOptions,
  hidden: number[] = [],
  draft: WeekDraft = emptyDraft(),
  aliases: SiteAliases = {},
): WeekModel {
  const all = rangeDays(range.from, range.to);
  const byDay = indexEntries(data.entries);
  const people = [...data.staff, ...draft.people.filter((p) => !data.staff.some((s) => s.id === p.id))];
  const staff = people.filter((s) => !hidden.includes(s.id));

  // Every cell for every day, then the weekend kept only when wanted or booked.
  const raw = staff.map((s) => all.map((d) => cellOf(byDay, draft, aliases, s.id, d)));
  const booked = (i: number) => raw.some((r) => r[i].items.length > 0);
  const keep = all.map((d, i) => !isWeekend(d) || opts.weekend || booked(i));
  const isos = all.filter((_, i) => keep[i]);

  // Colours: the busiest sites first (leave has none).
  const count = new Map<string, number>();
  for (const r of raw) r.forEach((c, i) => keep[i] && c.items.forEach((it) => !it.leave && !it.flag && count.set(it.label, (count.get(it.label) ?? 0) + 1)));
  const order = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const tones = new Map(order.map(([label], i) => [label, SITE_TONES[i % SITE_TONES.length]]));

  const rows: WeekRow[] = staff.map((s, si) => {
    const cells = raw[si].filter((_, i) => keep[i]);
    return {
      n: si + 1,
      staffId: s.id,
      name: s.name,
      cells: cells.map((c) => c.items.map((it) => ({ ...it, tone: !it.leave && !it.flag && opts.colour ? (tones.get(it.label) ?? null) : null }))),
      edited: cells.map((c) => c.edited),
    };
  });

  const days: WeekDay[] = isos.map((d) => {
    const dt = fromIso(d);
    return {
      iso: d,
      day: dt.toLocaleDateString("en-AU", { weekday: "long" }),
      date: dt.toLocaleDateString("en-AU", { day: "numeric", month: "short" }),
    };
  });

  // Columns: a sheet per week (Monday to Sunday), at most seven days.
  const chunks: number[][] = [];
  days.forEach((d, i) => {
    const last = chunks[chunks.length - 1];
    const newWeek = !last || fromIso(d.iso).getDay() === 1 || last.length >= MAX_PAGE_DAYS;
    if (newWeek) chunks.push([i]);
    else last.push(i);
  });
  if (!chunks.length) chunks.push([]);

  // Rows: as many as fit on each sheet; compact when that makes them fit.
  const extra = (r: WeekRow, cols: number[]) => Math.max(0, Math.max(0, ...cols.map((i) => r.cells[i].length)) - 1);
  const height = (cols: number[], row: number, item: number) => rows.reduce((t, r) => t + row + item * extra(r, cols), 0);
  const compact = chunks.some((cols, k) => {
    const room = k ? NEXT_BODY : FIRST_BODY;
    return height(cols, ROW_H, ITEM_H) > room && height(cols, ROW_H_COMPACT, ITEM_H_COMPACT) <= room;
  });
  const [rowH, itemH] = compact ? [ROW_H_COMPACT, ITEM_H_COMPACT] : [ROW_H, ITEM_H];
  const pages: WeekPage[] = [];
  chunks.forEach((cols) => {
    const offset = cols[0] ?? 0;
    const pageDays = cols.map((i) => days[i]);
    let cur: WeekPage = { days: pageDays, offset, rows: [], first: !pages.length };
    pages.push(cur);
    let room = cur.first ? FIRST_BODY : NEXT_BODY;
    for (const r of rows) {
      const cells = cols.map((i) => r.cells[i]);
      const h = rowH + itemH * extra(r, cols);
      if (h > room && cur.rows.length) {
        cur = { days: pageDays, offset, rows: [], first: false };
        pages.push(cur);
        room = NEXT_BODY;
      }
      cur.rows.push({ row: r, runs: runsOf(cells, cols.map((i) => r.edited[i])) });
      room -= h;
    }
  });

  const sites = new Set(rows.flatMap((r) => r.cells.flat().filter((it) => !it.leave && !it.flag).map((it) => it.label))).size;
  return {
    title: isos.length ? rangeTitle(isos[0], isos[isos.length - 1]) : rangeTitle(range.from, range.to),
    lede: `${staff.length} team member${staff.length === 1 ? "" : "s"} · ${sites} site${sites === 1 ? "" : "s"}`,
    days,
    rows,
    pages,
    compact,
    overview: opts.overview ? overviewSheets(jobsOverview(data, rows, days)) : [],
    opts,
    staffCount: staff.length,
    siteCount: sites,
  };
}

// ── Edit operations (pure: each returns the next draft) ─────────────────────

/** Where an edit applies: a person, the days of a bar (or one empty day),
 *  and which item of those days (-1: none, an empty cell). */
export interface EditTarget {
  staffId: number;
  days: string[];
  item: number;
}

export interface EditContext {
  byDay: Map<string, WeekEntry[]>;
  aliases: SiteAliases;
}

const itemsOn = (ctx: EditContext, draft: WeekDraft, staffId: number, date: string) =>
  cellOf(ctx.byDay, draft, ctx.aliases, staffId, date).items;

function setDay(draft: WeekDraft, staffId: number, date: string, items: EditItem[]): WeekDraft {
  return { ...draft, days: { ...draft.days, [dayKey(staffId, date)]: items } };
}

/** The item the target points at, on its first day. */
export function targetItem(ctx: EditContext, draft: WeekDraft, t: EditTarget): CellItem | null {
  if (t.item < 0 || !t.days.length) return null;
  return itemsOn(ctx, draft, t.staffId, t.days[0])[t.item] ?? null;
}

/** Takes the item off each of its days. */
export function removeItem(ctx: EditContext, draft: WeekDraft, t: EditTarget): WeekDraft {
  const it = targetItem(ctx, draft, t);
  if (!it) return draft;
  return t.days.reduce(
    (d, date) =>
      setDay(
        d,
        t.staffId,
        date,
        itemsOn(ctx, d, t.staffId, date)
          .filter((x) => x.label !== it.label)
          .map(toEdit),
      ),
    draft,
  );
}

/** Puts an item on the target's days: in place of the picked item, or as
 *  the day's only entry for an empty cell. */
export function fillItem(ctx: EditContext, draft: WeekDraft, t: EditTarget, item: EditItem): WeekDraft {
  const old = targetItem(ctx, draft, t);
  return t.days.reduce((d, date) => {
    const now = itemsOn(ctx, d, t.staffId, date).map(toEdit);
    const i = old ? now.findIndex((x) => x.label === old.label) : -1;
    return setDay(d, t.staffId, date, i >= 0 ? now.map((x, k) => (k === i ? item : x)) : [item]);
  }, draft);
}

/** Moves a bar's start and end: days it leaves lose the item, new days get
 *  it (in place of what was there). */
export function setItemDays(ctx: EditContext, draft: WeekDraft, t: EditTarget, days: string[]): WeekDraft {
  const it = targetItem(ctx, draft, t);
  if (!it || !days.length) return draft;
  const edit = toEdit(it);
  let d = draft;
  for (const date of t.days)
    if (!days.includes(date))
      d = setDay(
        d,
        t.staffId,
        date,
        itemsOn(ctx, d, t.staffId, date)
          .filter((x) => x.label !== it.label)
          .map(toEdit),
      );
  for (const date of days) if (!t.days.includes(date)) d = setDay(d, t.staffId, date, [edit]);
  return d;
}

/** Back to SimPRO on the target's days. */
export function resetDays(draft: WeekDraft, t: EditTarget): WeekDraft {
  const days = { ...draft.days };
  for (const date of t.days) delete days[dayKey(t.staffId, date)];
  return { ...draft, days };
}

/** Renames an item. Days still on SimPRO's data rename through the site
 *  alias (so every week uses the new name); edited days rename in place. */
export function renameItem(
  ctx: EditContext,
  draft: WeekDraft,
  t: EditTarget,
  label: string,
): { draft: WeekDraft; aliases: SiteAliases | null } {
  const it = targetItem(ctx, draft, t);
  const name = label.trim();
  if (!it || !name || name === it.label) return { draft, aliases: null };
  let d = draft;
  let aliases: SiteAliases | null = null;
  for (const date of t.days) {
    const k = dayKey(t.staffId, date);
    if (d.days[k]) d = setDay(d, t.staffId, date, d.days[k].map((x) => (x.label === it.label ? { ...x, label: name } : x)));
    else if (!it.leave && it.kind !== "activity") {
      // The SimPRO name behind what's shown (it may already be an alias).
      const source = Object.keys(ctx.aliases).find((s) => ctx.aliases[s] === it.label) ?? it.label;
      aliases = { ...(aliases ?? ctx.aliases), [source]: name };
    } else d = setDay(d, t.staffId, date, itemsOn(ctx, d, t.staffId, date).map((x) => (x.label === it.label ? { ...toEdit(x), label: name } : toEdit(x))));
  }
  return { draft: d, aliases };
}

// ── Jobs overview: each job under the day it starts ─────────────────────────

export interface OverviewJob {
  ref: string;
  quote: boolean;
  name: string;
}

export interface OverviewSite {
  label: string;
  address: string;
  jobs: OverviewJob[];
}

export interface OverviewDay {
  iso: string;
  /** "Monday 16 November" */
  heading: string;
  sites: OverviewSite[];
}

/** Every job or quote on the schedule (after edits), listed under the first
 *  day it appears, grouped by site: the site's name and address, then each
 *  job's number and name. Leave, flags and free text aren't jobs. */
export function jobsOverview(data: WeekScheduleResponse, rows: WeekRow[], days: WeekDay[]): OverviewDay[] {
  const info = new Map<string, { name: string; address: string; quote: boolean }>();
  for (const e of data.entries)
    if (e.ref && e.kind !== "activity" && !info.has(e.ref)) info.set(e.ref, { name: e.name, address: e.address ?? "", quote: e.kind === "quote" });
  const addressOf = new Map<string, string>();
  for (const e of data.entries) if (e.address && e.kind !== "activity") addressOf.set(e.label, e.address);

  const seen = new Set<string>();
  const out: OverviewDay[] = [];
  days.forEach((d, i) => {
    const sites = new Map<string, OverviewSite>();
    for (const r of rows)
      for (const it of r.cells[i] ?? []) {
        if (it.leave || it.flag || it.kind === "activity") continue;
        for (const ref of it.refs) {
          if (seen.has(ref)) continue;
          seen.add(ref);
          const known = info.get(ref);
          const addr = known?.address || addressOf.get(it.label) || "";
          // A site named by its address ("22 Undara Ave, Buddina") needn't repeat it.
          const key = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
          const site = sites.get(it.label) ?? { label: it.label, address: key(addr) === key(it.label) ? "" : addr, jobs: [] };
          site.jobs.push({ ref, quote: !!known?.quote || it.kind === "quote", name: known?.name || it.names[0] || "" });
          sites.set(it.label, site);
        }
      }
    if (sites.size) {
      const dt = fromIso(d.iso);
      out.push({
        iso: d.iso,
        heading: dt.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" }),
        sites: [...sites.values()].map((s) => ({ ...s, jobs: s.jobs.sort((a, b) => a.ref.localeCompare(b.ref)) })),
      });
    }
  });
  return out;
}

/** A block in an overview column: a day's heading, or a site and its jobs. */
export type OverviewBlock = { t: "day"; day: OverviewDay; cont: boolean } | { t: "site"; site: OverviewSite };
export type OverviewSheet = OverviewBlock[][];

export const OVERVIEW_COLS = 3;
// Page units: column width, and the room under the title (first sheet) or
// the logo line (the rest).
const OV_COL_W = (WEEK_PAGE_W - 192 - 48 * (OVERVIEW_COLS - 1)) / OVERVIEW_COLS;
const OV_FIRST = 900;
const OV_NEXT = 1000;
const lines = (text: string, px: number, w = OV_COL_W) => Math.max(1, Math.ceil((text.length * px * 0.52) / w));
const blockH = (b: OverviewBlock) =>
  b.t === "day"
    ? 22 + 40
    : lines(`${b.site.label}: ${b.site.address}`, 18) * 25 + b.site.jobs.reduce((t, j) => t + lines(`#${j.ref} – ${j.name}`, 17, OV_COL_W - 28) * 25, 0) + 18;

/** Lays the days into columns, three to a sheet. A day's heading never
 *  ends a column, and repeats (continued) at the top of the next. */
export function overviewSheets(days: OverviewDay[]): OverviewSheet[] {
  if (!days.length) return [];
  const sheets: OverviewSheet[] = [[[]]];
  let room = OV_FIRST;
  const col = () => sheets[sheets.length - 1][sheets[sheets.length - 1].length - 1];
  const nextCol = () => {
    const sheet = sheets[sheets.length - 1];
    if (sheet.length < OVERVIEW_COLS) sheet.push([]);
    else sheets.push([[]]);
    room = sheets.length === 1 ? OV_FIRST : OV_NEXT;
  };
  for (const day of days) {
    const head: OverviewBlock = { t: "day", day, cont: false };
    day.sites.forEach((site, k) => {
      const b: OverviewBlock = { t: "site", site };
      const need = blockH(b) + (k === 0 ? blockH(head) : 0);
      if (need > room && col().length) {
        nextCol();
        if (k > 0) {
          const cont: OverviewBlock = { t: "day", day, cont: true };
          col().push(cont);
          room -= blockH(cont);
        }
      }
      if (k === 0) {
        col().push(head);
        room -= blockH(head);
      }
      col().push(b);
      room -= blockH(b);
    });
  }
  return sheets;
}
