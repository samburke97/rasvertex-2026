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
//   2. Job and quote schedules: the job/quote number is the start of the
//      Reference ("11357-…"); each job/quote is fetched once for its site.
//   3. Activity schedules (leave, RDO, yard…): the activity's name, read from
//      the schedule's own record (_href).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";
import type { WeekEntry, WeekEntryKind, WeekScheduleResponse } from "@/lib/reports/weekSchedule";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const API = `${SIMPRO_BASE_URL}/api/v1.0/companies/0`;
const PAGE_SIZE = 1000;
const MAX_DAYS = 14;

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
    const batch = await simproGet<ScheduleListItem[]>(
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
  const site = r?.Site?.Name?.trim();
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
    await pool([...wanted.entries()], 8, async ([key, { kind, no }]) => {
      try {
        records.set(
          key,
          await simproGet<JobOrQuote>(`${API}/${kind === "job" ? "jobs" : "quotes"}/${no}?columns=ID,Name,Site,Customer`),
        );
      } catch (err) {
        console.warn(`[WeekSchedule] ${kind} ${no} failed:`, err);
        records.set(key, null);
      }
    });

    // 3. Activity names.
    const activities = list.filter((s) => kindOf(s.Type) === "activity");
    const activityName = new Map<number, string>();
    let skipped = 0;
    await pool(activities, 8, async (s) => {
      try {
        const unified = await simproGet<{ _href?: string }>(`${API}/schedules/${s.ID}`);
        const detail = unified._href
          ? await simproGet<{ Activity?: { Name?: string }; Name?: string }>(`${SIMPRO_BASE_URL}${unified._href}`)
          : null;
        activityName.set(s.ID, detail?.Activity?.Name?.trim() || detail?.Name?.trim() || "");
      } catch (err) {
        console.warn(`[WeekSchedule] activity schedule ${s.ID} failed:`, err);
        skipped++;
      }
    });

    const entries: WeekEntry[] = list.map((s) => {
      const kind = kindOf(s.Type);
      const no = refNo(s.Reference);
      if (kind === "activity") {
        const label = activityName.get(s.ID) || String(s.Reference || "").trim() || "Activity";
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
