// lib/caro/data.ts
//
// Caro — recurring jobs and client check-in in one place. This file is the
// shared model: site shape, service lines, the reminder timing, the email
// templates and derive(), the status logic. It's pure (no DB, no fetch), so
// the page, the API routes and the 6:00 run all use the same rules.
//
// A site is one recurring job: the latest job at a SimPRO site in one of the
// recurring cost centres (lib/recertifications), matched by customer ID to
// that client's check-in record (lib/checkin) for contact, history and
// blockers, with Caro's own state on top (reminders, bookings, snoozes).

import type { RecurringCategory } from "@/lib/recertifications/categories";

/* ---------- dates + formatting ---------- */
export const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");
/** Local date as YYYY-MM-DD, never UTC. */
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
export const addMonths = (d: Date, n: number) => {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
};
export const diffDays = (a: Date, b: Date) => Math.round((a.getTime() - b.getTime()) / DAY);
export const fmt = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
export const fmtS = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
export const money = (n: number) => "$" + Math.round(n).toLocaleString("en-AU");
export const money2 = (n: number) =>
  "$" + Number(n).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Today at local midnight. */
export function today(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/* ---------- service lines ---------- */
export type LineKey = "hs" | "wc" | "bc";
export interface Line {
  key: LineKey;
  name: string;
  service: string;
  dot: string;
  category: RecurringCategory;
}
export const LINES: Line[] = [
  { key: "hs", name: "Height safety", service: "anchor recertification", dot: "var(--cc-3)", category: "height-safety" },
  { key: "wc", name: "Window cleaning", service: "window clean", dot: "var(--cc-1)", category: "window-cleaning" },
  { key: "bc", name: "Building cleaning", service: "building clean", dot: "var(--cc-4)", category: "building-cleaning" },
];
export const LINE = Object.fromEntries(LINES.map((l) => [l.key, l])) as Record<LineKey, Line>;
export const LINE_OF_CATEGORY = Object.fromEntries(LINES.map((l) => [l.category, l.key])) as Record<RecurringCategory, LineKey>;
export const isLineKey = (v: unknown): v is LineKey => v === "hs" || v === "wc" || v === "bc";

/* ---------- reminder timing (per service line) ----------
   interval   default repeat for new sites (months)
   lead       send the reminder this many days before the due date
   follow     send one follow-up this many days after the reminder if there's no reply
   flag       move it to Needs you this many days after the reminder with no reply
   priceCheck/priceYears  flag a price review 30 days before the reminder when the price is this old */
export interface Timing {
  interval: number;
  lead: number;
  follow: number;
  flag: number;
  priceCheck: boolean;
  priceYears: number;
}
export type TimingMap = Record<LineKey, Timing>;
// SimPRO's recurring categories are all annual today (lib/recertifications
// sets next due = last completed + 1 year), so every line starts at 12.
export const DEFAULT_TIMING: TimingMap = {
  hs: { interval: 12, lead: 60, follow: 7, flag: 14, priceCheck: true, priceYears: 3 },
  wc: { interval: 12, lead: 45, follow: 5, flag: 14, priceCheck: true, priceYears: 3 },
  bc: { interval: 12, lead: 60, follow: 7, flag: 14, priceCheck: false, priceYears: 3 },
};
export const TIMING_OPTIONS = {
  interval: [3, 6, 12, 24],
  lead: [30, 45, 60, 90],
  follow: [3, 5, 7, 10, 14],
  flag: [7, 14, 21, 30],
  priceYears: [2, 3, 4, 5],
} as const;
export type TimingKey = keyof typeof TIMING_OPTIONS;
export const TIMING_UNIT: Record<TimingKey, string> = {
  interval: "months",
  lead: "days",
  follow: "days",
  flag: "days",
  priceYears: "years",
};

/* ---------- people ----------
   Account owners and the "you" that signs reminders. Add staff here. */
export const OWNERS = [{ id: "SB", name: "Sam Burke" }];
export const ME = { name: "Sam Burke", first: "Sam", initials: "SB", email: "sam@rasvertex.com.au" };

/* ---------- email templates ----------
   system: 'reminder' | 'follow' — used by the built-in sequence, can't be deleted. */
export interface Template {
  id: string;
  name: string;
  system?: "reminder" | "follow";
  edited?: string;
  subject: string;
  body: string;
}
export const DEFAULT_TEMPLATES: Template[] = [
  {
    id: "t1",
    name: "Service due reminder",
    system: "reminder",
    subject: "Your [Service] at [Site] is due in [Due month]",
    body: "Hi [First name],\n\nThe [Service] at [Site] is due on [Due date]. Last time it was [Last price] + GST.\n\nJust reply with a week that suits and we’ll lock it in.\n\nThanks,\n[Your name]\nRAS-VERTEX",
  },
  {
    id: "t2",
    name: "Friendly follow-up",
    system: "follow",
    subject: "Re: Your [Service] at [Site]",
    body: "Hi [First name],\n\nJust bumping this up in case it got buried. The [Service] at [Site] is due on [Due date].\n\nWant me to pencil in a week?\n\n[Your name]",
  },
  {
    id: "t3",
    name: "Final nudge",
    subject: "Last call for the [Service] at [Site]",
    body: "Hi [First name],\n\nI haven’t heard back, so I’ll hold off unless you’d like it booked. If someone else looks after [Site] now, could you point me their way?\n\nCheers,\n[Your name]",
  },
  {
    id: "t4",
    name: "Price update notice",
    subject: "Pricing for the [Service] at [Site]",
    body: "Hi [First name],\n\nAhead of the next [Service] at [Site] on [Due date], a quick heads-up that our pricing is changing. Your current price is [Last price] + GST — I’ll send the new figure with the booking.\n\nHappy to talk it through.\n\n[Your name]",
  },
];
export const MERGE_FIELDS = ["First name", "Site", "Service", "Due date", "Due month", "Last price", "Address", "Your name"];

/* ---------- site ---------- */
export type Chase = "follow" | "flag" | "none";
export interface Reminded {
  at: string;
  opened: number;
  followups: number;
  replied: boolean;
}
export interface LogEntry {
  kind: "email" | "reply" | "call" | "booked" | "done" | "price" | "snooze" | "note";
  title: string;
  detail: string;
  date: string;
  t: number;
}
/** Edits made in Caro's Details tab. They win over SimPRO until changed again. */
export interface Overrides {
  price?: number;
  priceSince?: number;
  interval?: number;
  owner?: string;
}
/** What Caro stores per site (caro_site_state). Everything else comes from SimPRO. */
export interface SiteState {
  booked: string | null;
  reminded: Reminded | null;
  chase: Chase;
  snoozedUntil: string | null;
  flagged?: boolean;
  log: LogEntry[];
  ov?: Overrides;
}
export const EMPTY_STATE: SiteState = { booked: null, reminded: null, chase: "follow", snoozedUntil: null, log: [] };

export interface HistoryItem {
  id: number;
  date: string;
  desc: string;
  value: number;
}

export interface Site extends SiteState {
  /** "hs:123" (line + SimPRO site ID) or "m:<id>" for sites added in Caro. */
  key: string;
  source: "simpro" | "manual";
  line: LineKey;
  jobId: number;
  siteId: number;
  customerId: number;
  /** SimPRO customer (account). */
  customer: string;
  /** SimPRO site name. */
  name: string;
  first: string;
  contact: string;
  email: string;
  phone: string;
  address: string;
  suburb: string;
  interval: number;
  lastDone: string;
  /** SimPRO's next due date (it skips a year when the site's already re-quoted).
   *  Null once the repeat interval is changed here, or for manual sites. */
  nextDue: string | null;
  price: number;
  priceSince: number;
  since: number;
  owner: string;
  stopped: boolean;
  ltv: number;
  history: HistoryItem[];
  /** From client check-in: unpaid invoices, do-not-send, etc. */
  blockers: string[];
  doNotSend: boolean;
  checkinId: number | null;
}

/* ---------- status ----------
   need:   opened · quiet · overdue · unsent · price · null   (what puts a site in Needs you)
   status: needs · booked · snoozed · reminded · due · scheduled */
export type Need = "opened" | "quiet" | "overdue" | "unsent" | "price" | null;
export type Status = "needs" | "booked" | "snoozed" | "reminded" | "due" | "scheduled";
export interface Derived {
  next: Date;
  days: number;
  remindOn: Date;
  sentAgo: number | null;
  snoozed: boolean;
  need: Need;
  status: Status;
  annual: number;
}

export function nextDueOf(s: Pick<Site, "nextDue" | "lastDone" | "interval">): Date {
  return s.nextDue ? parse(s.nextDue) : addMonths(parse(s.lastDone), s.interval);
}

export function derive(s: Site, t: Timing, now: Date = today()): Derived {
  const next = nextDueOf(s);
  const days = diffDays(next, now);
  const remindOn = addDays(next, -t.lead);
  const sentAgo = s.reminded ? diffDays(now, parse(s.reminded.at)) : null;
  const snoozed = !!s.snoozedUntil && parse(s.snoozedUntil) > now;
  let need: Need = null;
  if (!s.booked && !snoozed) {
    const r = s.reminded;
    if (r) {
      if (!r.replied && s.chase !== "none") {
        if (r.opened >= 2 && (sentAgo ?? 0) >= 5) need = "opened";
        else if ((sentAgo ?? 0) >= t.flag || s.flagged) need = "quiet";
      }
    } else if (s.flagged) need = "quiet";
    else if (days < 0) need = "overdue";
    else if (days <= t.lead) need = "unsent";
    else if (t.priceCheck && days <= t.lead + 30 && now.getFullYear() - s.priceSince >= t.priceYears) need = "price";
  }
  const status: Status = s.booked
    ? "booked"
    : need
      ? "needs"
      : snoozed
        ? "snoozed"
        : s.reminded
          ? "reminded"
          : days <= t.lead
            ? "due"
            : "scheduled";
  return { next, days, remindOn, sentAgo, snoozed, need, status, annual: (s.price * 12) / s.interval };
}

export function mergeVals(s: Site, d: Pick<Derived, "next">, me = ME): Record<string, string> {
  return {
    "First name": s.first || "there",
    Site: s.name,
    Service: LINE[s.line].service,
    "Due date": fmt(d.next),
    "Due month": d.next.toLocaleDateString("en-AU", { month: "long" }),
    "Last price": money2(s.price),
    Address: [s.address, s.suburb].filter(Boolean).join(", ") || s.name,
    "Your name": me.first,
  };
}
export const merge = (text: string, vals: Record<string, string>) =>
  text.replace(/\[([^\]]+)\]/g, (m, k: string) => (k in vals ? vals[k] : m));

/** The state slice of a site — what gets saved to caro_site_state. */
export function stateOf(s: Site): SiteState {
  const st: SiteState = { booked: s.booked, reminded: s.reminded, chase: s.chase, snoozedUntil: s.snoozedUntil, log: s.log };
  if (s.flagged) st.flagged = true;
  if (s.ov && Object.keys(s.ov).length) st.ov = s.ov;
  return st;
}
