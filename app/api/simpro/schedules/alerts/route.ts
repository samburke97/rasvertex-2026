// app/api/simpro/schedules/alerts/route.ts
// The Weekly schedule's alerts: for each job cost centre booked in the
// week, its estimated and actual labour hours and resources cost, and the
// hours still booked after today (from the cost centre's schedules). The
// check itself is lib/reports/jobAlerts.ts.
//
// GET ?refs=11195-13747,11344-13917   (job-cost centre, at most 60)

import { NextRequest, NextResponse } from "next/server";
import { simproGetRetry as get } from "@/lib/simpro/client";
import { cleanSite, iso } from "@/lib/reports/weekSchedule";
import { checkCostCentre, sortAlerts, type CostCentreCheck, type JobAlert } from "@/lib/reports/jobAlerts";

const API = `${process.env.NEXT_PUBLIC_SIMPRO_BASE_URL}/api/v1.0/companies/0`;

interface Amount {
  Actual?: number;
  Estimate?: number;
}
interface CostCentre {
  ID: number;
  Name?: string;
  Totals?: { ResourcesCost?: { Total?: Amount; LaborHours?: Amount } };
}
interface Schedule {
  Date: string;
  TotalHours?: number;
  Staff?: { Name?: string };
}

/** Runs fn over items, at most `limit` at a time. */
async function pool<T>(items: T[], limit: number, fn: (t: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

export async function GET(request: NextRequest) {
  const refs = [...new Set((request.nextUrl.searchParams.get("refs") ?? "").split(","))]
    .filter((r) => /^\d{1,8}-\d{1,8}$/.test(r))
    .slice(0, 60);
  if (!refs.length) return NextResponse.json({ alerts: [], checked: 0 });

  const byJob = new Map<string, string[]>();
  for (const r of refs) {
    const [job, cc] = r.split("-");
    byJob.set(job, [...(byJob.get(job) ?? []), cc]);
  }
  const today = iso(new Date());
  const alerts: JobAlert[] = [];
  let checked = 0;

  await pool([...byJob.entries()], 3, async ([jobId, ccIds]) => {
    try {
      const job = await get<{ Site?: { Name?: string }; Name?: string }>(`${API}/jobs/${jobId}?columns=ID,Name,Site`);
      const site = cleanSite(job.Site?.Name ?? "") || job.Name?.trim() || `Job ${jobId}`;
      // Which section each cost centre sits in.
      const sections = await get<{ ID: number }[]>(`${API}/jobs/${jobId}/sections/?columns=ID`);
      const want = new Set(ccIds);
      for (const s of sections) {
        if (!want.size) break;
        const ccs = await get<{ ID: number }[]>(`${API}/jobs/${jobId}/sections/${s.ID}/costCenters/?columns=ID`);
        for (const { ID } of ccs) {
          if (!want.delete(String(ID))) continue;
          const path = `${API}/jobs/${jobId}/sections/${s.ID}/costCenters/${ID}`;
          const cc = await get<CostCentre>(`${path}?columns=ID,Name,Totals`);
          const schedules = await get<Schedule[]>(`${path}/schedules/?pageSize=250`);
          const team = new Map<string, number>();
          let future = 0;
          for (const b of schedules) {
            const hrs = b.TotalHours ?? 0;
            if (b.Date.slice(0, 10) > today) future += hrs;
            const who = b.Staff?.Name?.replace(/\s*-\s*Sub Contractor$/i, "").trim() || "Unassigned";
            team.set(who, (team.get(who) ?? 0) + hrs);
          }
          const r = cc.Totals?.ResourcesCost;
          const check: CostCentreCheck = {
            key: `${jobId}-${ID}`,
            jobId,
            ccId: String(ID),
            site,
            name: (cc.Name ?? "").trim(),
            estHours: r?.LaborHours?.Estimate ?? 0,
            actualHours: r?.LaborHours?.Actual ?? 0,
            futureHours: Math.round(future * 100) / 100,
            estCost: r?.Total?.Estimate ?? 0,
            actualCost: r?.Total?.Actual ?? 0,
            team: [...team.entries()].map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 })).sort((a, b) => b.hours - a.hours),
          };
          checked++;
          const alert = checkCostCentre(check);
          if (alert) alerts.push(alert);
        }
      }
    } catch (err) {
      console.warn(`[WeekAlerts] job ${jobId} failed:`, err instanceof Error ? err.message : err);
    }
  });

  return NextResponse.json({ alerts: sortAlerts(alerts), checked });
}
