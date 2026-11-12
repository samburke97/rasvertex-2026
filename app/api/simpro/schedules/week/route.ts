// app/api/simpro/schedules/week/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Everyone's SimPRO schedule for a run of days, for the Weekly schedule
// report: who is on which site each day.
//
// GET ?from=YYYY-MM-DD&to=YYYY-MM-DD   (at most 14 days)
//
// Flow:
//   1. GET /schedules/?Date=<day> for each day (in parallel), as the
//      unlocked-schedules cron does.
//   2. Job and quote schedules: the Reference is "<job or quote>-<cost
//      centre>" ("11357-13930"); each job/quote is fetched once for its
//      Site.Name (cleaned of the CTS scheme number).
//   3. Activity schedules (leave, RDO, Yardwork…): the Reference is the
//      activity's ID ("17"), named from /setup/activities/ (one call).
// The Type is "job", "quote" or "activity" (checked against live data,
// November 2026). Cleaning to one answer per person per day happens in
// lib/reports/weekSchedule.ts (dayItems), not here.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";
import { cleanSite, MAX_RANGE_DAYS, type WeekEntry, type WeekEntryKind, type WeekScheduleResponse } from "@/lib/reports/weekSchedule";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const API = `${SIMPRO_BASE_URL}/api/v1.0/companies/0`;
const PAGE_SIZE = 1000;
const MAX_DAYS = MAX_RANGE_DAYS;

interface ScheduleListItem {
  ID: number;
  Type: string;
  Reference: string;
  TotalHours?: number;
  Date: string;
  Staff?: { ID: number; Name: string };
}

interface JobOrQuote {
  ID: number;
  Name?: string;
  Site?: { ID?: number; Name?: string };
  Customer?: { CompanyName?: string; GivenName?: string; FamilyName?: string };
}

/** SimPRO's rate limit answers 429: wait a moment and ask again. */
async function get<T>(url: string, tries = 5): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await simproGet<T>(url);
    } catch (err) {
      if (i >= tries || !/HTTP 429/.test(String(err))) throw err;
      await new Promise((r) => setTimeout(r, 400 * 2 ** (i - 1) + Math.random() * 200));
    }
  }
}

/** Runs fn over items, at most `limit` at a time. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}

async function schedulesOn(date: string): Promise<ScheduleListItem[]> {
  const all: ScheduleListItem[] = [];
  for (let page = 1; ; page++) {
    const batch = await get<ScheduleListItem[]>(
      `${API}/schedules/?pageSize=${PAGE_SIZE}&page=${page}&columns=ID,Type,Reference,TotalHours,Date,Staff&Date=${date}`,
    );
    all.push(...batch);
    if (batch.length < PAGE_SIZE) return all;
  }
}

const refNo = (reference: string) => {
  const n = parseInt(String(reference).split("-")[0], 10);
  return Number.isNaN(n) ? null : n;
};

function siteOf(r: JobOrQuote | null, fallback: string): string {
  const site = cleanSite(r?.Site?.Name ?? "");
  if (site) return site;
  const c = r?.Customer;
  const customer = c?.CompanyName?.trim() || [c?.GivenName, c?.FamilyName].filter(Boolean).join(" ").trim();
  return customer || r?.Name?.trim() || fallback;
}

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export async function GET(request: NextRequest) {
  if (!SIMPRO_BASE_URL) {
    return NextResponse.json({ error: "SimPRO config missing" }, { status: 500 });
  }
  const from = request.nextUrl.searchParams.get("from");
  const to = request.nextUrl.searchParams.get("to");
  if (!isDate(from) || !isDate(to) || to < from) {
    return NextResponse.json({ error: "from and to must be dates (YYYY-MM-DD), from first" }, { status: 400 });
  }

  const days: string[] = [];
  for (let d = new Date(from + "T00:00:00Z"); d.toISOString().slice(0, 10) <= to; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
    if (days.length > MAX_DAYS) {
      return NextResponse.json({ error: `At most ${MAX_DAYS} days at a time` }, { status: 400 });
    }
  }

  try {
    // 1. Every schedule on each day.
    const list = (await Promise.all(days.map(schedulesOn))).flat().filter((s) => s.Staff?.ID);

    // 2. Each job and quote once.
    const kindOf = (t: string): WeekEntryKind => (/quote/i.test(t) ? "quote" : /job/i.test(t) ? "job" : "activity");
    const wanted = new Map<string, { kind: "job" | "quote"; no: number }>();
    for (const s of list) {
      const kind = kindOf(s.Type);
      const no = refNo(s.Reference);
      if (kind !== "activity" && no != null) wanted.set(`${kind}:${no}`, { kind, no });
    }
    const records = new Map<string, JobOrQuote | null>();
    await pool([...wanted.entries()], 4, async ([key, { kind, no }]) => {
      try {
        records.set(
          key,
          await get<JobOrQuote>(`${API}/${kind === "job" ? "jobs" : "quotes"}/${no}?columns=ID,Name,Site,Customer`),
        );
      } catch (err) {
        console.warn(`[WeekSchedule] ${kind} ${no} failed:`, err);
        records.set(key, null);
      }
    });

    // 3. Activity names, by ID.
    const activityName = new Map<string, string>();
    try {
      const acts = await get<{ ID: number; Name: string }[]>(`${API}/setup/activities/?pageSize=250&columns=ID,Name`);
      for (const a of acts) activityName.set(String(a.ID), a.Name.trim());
    } catch (err) {
      console.warn("[WeekSchedule] activities failed:", err);
    }
    const skipped = [...records.values()].filter((r) => r === null).length;

    const entries: WeekEntry[] = list.map((s) => {
      const kind = kindOf(s.Type);
      const no = refNo(s.Reference);
      if (kind === "activity") {
        const label = activityName.get(String(s.Reference).trim()) || "Activity";
        return { staffId: s.Staff!.ID, date: s.Date.slice(0, 10), kind, label, ref: null, name: label, hours: s.TotalHours ?? 0 };
      }
      const rec = no != null ? (records.get(`${kind}:${no}`) ?? null) : null;
      const fallback = no != null ? `${kind === "job" ? "Job" : "Quote"} #${no}` : String(s.Reference);
      return {
        staffId: s.Staff!.ID,
        date: s.Date.slice(0, 10),
        kind,
        label: siteOf(rec, fallback),
        ref: no != null ? String(no) : null,
        name: rec?.Name?.trim() ?? "",
        hours: s.TotalHours ?? 0,
      };
    });

    const staff = new Map<number, string>();
    for (const s of list) staff.set(s.Staff!.ID, s.Staff!.Name?.trim() || `Staff ${s.Staff!.ID}`);

    const body: WeekScheduleResponse = {
      from,
      to,
      staff: [...staff.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
      entries,
      skipped,
    };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[WeekSchedule] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't read the SimPRO schedule" },
      { status: 502 },
    );
  }
}
