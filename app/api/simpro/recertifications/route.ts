// app/api/simpro/recertifications/route.ts
//
// Live route — fetches jobs and quote state directly from SimPRO on every request.
// No Neon cache required.
//
// Quote deduplication strategy:
//   1. Fetch all recertification quotes in one bulk paginated call upfront
//      using If-Modified-Since to limit to last 2 years
//   2. Build a Map<siteId, mostRecentQuoteIssuedDate>
//   3. A site is considered "quoted" if a recertification quote exists with
//      DateIssued AFTER the site's most recent completed job date.
//      When quoted, nextDueDate shifts forward one year and status becomes "upcoming".
//   This avoids N per-site API calls entirely.

import { NextRequest, NextResponse } from "next/server";
import { getIgnoredJobIds } from "@/lib/recertifications/store";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;
const HEIGHT_SAFETY_COST_CENTRE_ID = 11;
const PAGE_SIZE = 250;

export interface RecertificationJob {
  id: number;
  name: string;
  customer: string;
  customerId: number;
  site: string;
  siteId: number;
  completedDate: string;
  nextDueDate: string;
  daysUntilDue: number;
  status: "overdue" | "due-soon" | "upcoming";
  totalExTax: number;
  totalIncTax: number;
  quoteYear: number;
}

async function simproGet<T>(
  url: string,
  headers?: Record<string, string>,
): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...headers,
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SimPRO ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Fetch Height Safety job IDs ───────────────────────────────────────────

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

// ── Fetch job details ─────────────────────────────────────────────────────

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

// ── Fetch all recertification quotes in one bulk call ─────────────────────
// Uses If-Modified-Since to limit to last 2 years.
// Returns Map<siteId, mostRecentQuoteDateIssued>

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
      if (!siteId || !q.DateIssued) continue;
      const issued = new Date(q.DateIssued);
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

// ── Build result set ──────────────────────────────────────────────────────

function buildResults(
  jobs: any[],
  ignoredIds: Set<number>,
  quotedSiteMap: Map<number, Date>,
): { active: RecertificationJob[]; ignored: RecertificationJob[] } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  // Deduplicate: most recent completed job per site
  const latestJobBySite = new Map<number, any>();
  for (const j of jobs) {
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

  const active: RecertificationJob[] = [];
  const ignored: RecertificationJob[] = [];

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

    const job: RecertificationJob = {
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
    };

    if (ignoredIds.has(j.ID)) {
      ignored.push(job);
    } else {
      active.push(job);
    }
  }

  active.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  ignored.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return { active, ignored };
}

// ── GET handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  try {
    const [heightSafetyJobIds, ignoredIds, quotedSiteMap] = await Promise.all([
      fetchHeightSafetyJobIds(),
      getIgnoredJobIds(),
      fetchQuotedSiteMap(),
    ]);

    const rawJobs = await fetchJobDetails(heightSafetyJobIds);
    const { active, ignored } = buildResults(
      rawJobs,
      ignoredIds,
      quotedSiteMap,
    );

    return NextResponse.json({
      jobs: active,
      ignoredJobs: ignored,
      total: active.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Recertifications]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
