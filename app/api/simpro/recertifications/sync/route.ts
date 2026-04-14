// app/api/simpro/recertifications/sync/route.ts
//
// POST — full SimPRO sync, writes results to Neon cache.
// Called by:
//   - Vercel cron every 4 hours
//   - Manual refresh button in the UI

import { NextResponse } from "next/server";
import {
  getIgnoredJobIds,
  replaceCachedJobs,
  getCachedJobs,
} from "@/lib/recertifications/store";
import type { RecertificationJob } from "@/app/api/simpro/recertifications/route";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;
const HEIGHT_SAFETY_COST_CENTRE_ID = 11;
const PAGE_SIZE = 250;

async function simproGet<T>(
  url: string,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...extraHeaders,
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SimPRO ${res.status}: ${res.statusText}`);
  return res.json();
}

async function fetchHeightSafetyJobIds(): Promise<Set<number>> {
  const jobIds = new Set<number>();
  let page = 1;
  while (true) {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobCostCenters/` +
      `?CostCenter=${HEIGHT_SAFETY_COST_CENTRE_ID}` +
      `&pageSize=${PAGE_SIZE}&page=${page}&columns=ID,Job`;
    const batch = await simproGet<{ ID: number; Job: { ID: number } }[]>(url);
    for (const item of batch) {
      if (item.Job?.ID) jobIds.add(item.Job.ID);
    }
    if (batch.length < PAGE_SIZE) break;
    page++;
  }
  return jobIds;
}

async function fetchJobDetails(
  heightSafetyJobIds: Set<number>,
): Promise<any[]> {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const dateFilter = twoYearsAgo.toISOString().split("T")[0];

  const results: any[] = [];
  let page = 1;

  while (true) {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/` +
      `?pageSize=${PAGE_SIZE}&page=${page}` +
      `&columns=ID,Name,CompletedDate,Customer,Site,Tags,Total` +
      `&CompletedDate=gt(${dateFilter})`;

    const batch = await simproGet<any[]>(url);

    for (const job of batch) {
      if (!heightSafetyJobIds.has(job.ID)) continue;
      if (!job.CompletedDate) continue;
      const tags: string[] = (job.Tags || []).map((t: any) =>
        typeof t === "string" ? t : t?.Name || "",
      );
      if (tags.some((t) => t.toUpperCase() === "BLACKLIST")) continue;
      results.push(job);
    }

    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  return results;
}

function isRecertificationQuote(name: string): boolean {
  const n = name
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    n.includes("anchor recertification") ||
    n.includes("annual anchor recertification") ||
    n.includes("annual anchor test") ||
    n.includes("anchor test and recertification") ||
    n.includes("anchor rest and recertification") ||
    n.includes("anchor test") ||
    n.includes("recertification")
  );
}

async function fetchQuotedSiteMap(): Promise<Map<number, Date>> {
  const quotedSites = new Map<number, Date>();
  let page = 1;

  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const ifModifiedSince = twoYearsAgo.toUTCString();

  while (true) {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/quotes/` +
      `?pageSize=${PAGE_SIZE}&page=${page}` +
      `&columns=ID,Name,DateIssued,Site`;

    const batch = await simproGet<any[]>(url, {
      "If-Modified-Since": ifModifiedSince,
    });

    for (const q of batch) {
      if (!isRecertificationQuote(q.Name || "")) continue;
      const siteId: number = q.Site?.ID;
      if (!siteId) continue;
      const issued = q.DateIssued ? new Date(q.DateIssued) : new Date();
      const existing = quotedSites.get(siteId);
      if (!existing || issued > existing) {
        quotedSites.set(siteId, issued);
      }
    }

    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  return quotedSites;
}

function buildJobs(
  rawJobs: any[],
  quotedSiteMap: Map<number, Date>,
): RecertificationJob[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  // Deduplicate — most recent completed job per site
  const latestJobBySite = new Map<number, any>();
  for (const j of rawJobs) {
    const siteId: number = j.Site?.ID;
    if (!siteId || !j.CompletedDate) continue;
    const existing = latestJobBySite.get(siteId);
    if (
      !existing ||
      new Date(j.CompletedDate) > new Date(existing.CompletedDate)
    ) {
      latestJobBySite.set(siteId, j);
    }
  }

  const jobs: RecertificationJob[] = [];

  for (const [siteId, j] of latestJobBySite.entries()) {
    const latestCompleted = new Date(j.CompletedDate);

    // Base next due date: one year after last completed job
    const nextDue = new Date(latestCompleted);
    nextDue.setFullYear(nextDue.getFullYear() + 1);

    // If a recertification quote was issued after the last completed job,
    // this cycle is already covered — shift the effective due date forward
    // one more year so the site appears as upcoming rather than disappearing.
    const mostRecentQuote = quotedSiteMap.get(siteId);
    const isQuoted = !!(mostRecentQuote && mostRecentQuote > latestCompleted);

    const effectiveNextDue = isQuoted
      ? new Date(new Date(nextDue).setFullYear(nextDue.getFullYear() + 1))
      : nextDue;

    const daysUntilDue = Math.ceil(
      (effectiveNextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    let status: RecertificationJob["status"];
    if (daysUntilDue < 0) status = "overdue";
    else if (daysUntilDue <= 60) status = "due-soon";
    else status = "upcoming";

    const dueYear = effectiveNextDue.getFullYear();
    const quoteYear = Math.max(dueYear, currentYear);

    jobs.push({
      id: j.ID,
      name: j.Name,
      customer: j.Customer?.CompanyName || "Unknown",
      customerId: j.Customer?.ID,
      site: j.Site?.Name || "Unknown",
      siteId,
      completedDate: j.CompletedDate,
      nextDueDate: effectiveNextDue.toISOString().split("T")[0],
      daysUntilDue,
      status,
      totalExTax: j.Total?.ExTax ?? 0,
      totalIncTax: j.Total?.IncTax ?? 0,
      quoteYear,
    });
  }

  jobs.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  return jobs;
}

export async function POST() {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  try {
    console.log("[Sync] Starting SimPRO recertification sync…");

    const [heightSafetyJobIds, quotedSiteMap] = await Promise.all([
      fetchHeightSafetyJobIds(),
      fetchQuotedSiteMap(),
    ]);

    const rawJobs = await fetchJobDetails(heightSafetyJobIds);
    const jobs = buildJobs(rawJobs, quotedSiteMap);

    await replaceCachedJobs(jobs);
    console.log(`[Sync] Done — ${jobs.length} jobs written to cache`);

    // Return fresh data immediately so the UI can update without a second request
    const ignoredIds = await getIgnoredJobIds();
    const { active, ignored, syncedAt } = await getCachedJobs(ignoredIds);

    return NextResponse.json({
      jobs: active,
      ignoredJobs: ignored,
      total: active.length,
      syncedAt: syncedAt?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
