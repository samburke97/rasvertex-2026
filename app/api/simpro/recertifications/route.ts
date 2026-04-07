// app/api/simpro/recertifications/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  getCachedJobs,
  setCachedJobs,
  getRecertQuoteMap,
  getIgnoredJobIds,
  type RecertQuoteRecord,
} from "@/lib/recertifications/store";

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
  existingQuote: {
    quoteId: number;
    quoteName: string;
    quoteStatus: string;
    simproQuoteNo: string | null;
  } | null;
}

async function simproGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
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

function buildResults(
  jobs: any[],
  quoteMap: Map<string, RecertQuoteRecord>,
  ignoredIds: Set<number>,
): RecertificationJob[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  return jobs
    .filter((j) => !ignoredIds.has(j.ID))
    .map((j) => {
      const completed = new Date(j.CompletedDate);
      const nextDue = new Date(completed);
      nextDue.setFullYear(nextDue.getFullYear() + 1);

      const diffMs = nextDue.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let status: RecertificationJob["status"];
      if (daysUntilDue < 0) status = "overdue";
      else if (daysUntilDue <= 60) status = "due-soon";
      else status = "upcoming";

      const dueYear = nextDue.getFullYear();
      const quoteYear = Math.max(dueYear, currentYear);
      const siteId: number = j.Site?.ID;
      const existing = quoteMap.get(`${siteId}:${quoteYear}`) ?? null;

      return {
        id: j.ID,
        name: j.Name,
        customer: j.Customer?.CompanyName || "Unknown",
        customerId: j.Customer?.ID,
        site: j.Site?.Name || "Unknown",
        siteId,
        completedDate: j.CompletedDate,
        nextDueDate: nextDue.toISOString().split("T")[0],
        daysUntilDue,
        status,
        totalExTax: j.Total?.ExTax ?? 0,
        totalIncTax: j.Total?.IncTax ?? 0,
        quoteYear,
        existingQuote: existing
          ? {
              quoteId: existing.quoteId,
              quoteName: existing.quoteName,
              quoteStatus: existing.quoteStatus,
              simproQuoteNo: existing.simproQuoteNo,
            }
          : null,
      };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

export async function GET(request: NextRequest) {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true";
  // Pass showIgnored=true to include hidden jobs (for the hidden view)
  const showIgnored =
    request.nextUrl.searchParams.get("showIgnored") === "true";

  try {
    let rawJobs: any[];
    let fromCache = false;
    let cacheAge: string | null = null;

    if (!forceRefresh) {
      const cached = await getCachedJobs<any>();
      if (cached) {
        rawJobs = cached.jobs;
        fromCache = true;
        const ageMs = Date.now() - cached.fetchedAt.getTime();
        cacheAge = `${Math.floor(ageMs / 60000)}m ago`;
      }
    }

    if (!fromCache) {
      const heightSafetyJobIds = await fetchHeightSafetyJobIds();
      rawJobs = await fetchJobDetails(heightSafetyJobIds);
      await setCachedJobs(rawJobs);
    }

    // Both quote map and ignored set fetched fresh from Neon (fast)
    const today = new Date();
    const currentYear = today.getFullYear();
    const pairs = rawJobs!.map((j: any) => {
      const completed = new Date(j.CompletedDate);
      const nextDue = new Date(completed);
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      const dueYear = nextDue.getFullYear();
      return {
        siteId: j.Site?.ID as number,
        year: Math.max(dueYear, currentYear),
      };
    });

    const [quoteMap, ignoredIds] = await Promise.all([
      getRecertQuoteMap(pairs),
      getIgnoredJobIds(),
    ]);

    const effectiveIgnored = showIgnored ? new Set<number>() : ignoredIds;
    const results = buildResults(rawJobs!, quoteMap, effectiveIgnored);

    // Also return ignored jobs separately so the page can show them
    const ignoredJobs = showIgnored
      ? []
      : buildResults(rawJobs!, quoteMap, new Set<number>()).filter((j) =>
          ignoredIds.has(j.id),
        );

    return NextResponse.json({
      jobs: results,
      ignoredJobs,
      total: results.length,
      fromCache,
      cacheAge,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Recertifications]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
