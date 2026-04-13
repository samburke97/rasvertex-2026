// app/api/simpro/recertifications/route.ts
//
// Live route — fetches jobs and checks quotes directly from SimPRO on every
// request. No Neon cache, no quote sync required.
//
// Quote existence is determined by querying SimPRO quotes for the site,
// filtered to the current year and matching recertification name patterns.
// This means quotes created directly in SimPRO are reflected immediately.

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

// ── Fetch all Height Safety job IDs via cost centre ───────────────────────

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

// ── Fetch job details, filtered to last 2 years ───────────────────────────

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

// ── Check SimPRO quotes for a site — live, no Neon ───────────────────────
// Returns the most recent matching recertification quote for the site,
// regardless of year. A quote from 2024, 2025, 2026 or 2027 all count —
// if any exists the site does not need action.

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

async function fetchExistingQuote(
  siteId: number,
): Promise<RecertificationJob["existingQuote"]> {
  try {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/quotes/` +
      `?pageSize=50&page=1` +
      `&columns=ID,Name,JobNo,Status,DateCreated,Site` +
      `&Site=${siteId}`;

    const quotes = await simproGet<any[]>(url);

    // Filter to recertification quotes then sort most recent first
    const recertQuotes = quotes
      .filter((q) => isRecertificationQuote(q.Name || ""))
      .sort(
        (a, b) =>
          new Date(b.DateCreated).getTime() - new Date(a.DateCreated).getTime(),
      );

    if (!recertQuotes.length) return null;

    const q = recertQuotes[0];
    const statusRaw = (q.Status || "").toLowerCase();
    const quoteStatus =
      statusRaw === "sent"
        ? "sent"
        : statusRaw === "approved" || statusRaw === "accepted"
          ? "approved"
          : statusRaw.includes("won")
            ? "approved"
            : "created";

    return {
      quoteId: q.ID,
      quoteName: q.Name,
      quoteStatus,
      simproQuoteNo: q.JobNo || null,
    };
  } catch {
    // If the quote lookup fails, assume no quote rather than blocking the page
    return null;
  }
}

// ── Build result set ──────────────────────────────────────────────────────

async function buildResults(
  jobs: any[],
  ignoredIds: Set<number>,
  includeIgnored: boolean,
): Promise<{ active: RecertificationJob[]; ignored: RecertificationJob[] }> {
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

  // Fetch quotes in parallel for all sites in the window (0–90 days)
  // to avoid N+1 on full dataset. Only fetch for jobs that need it.
  const siteEntries = Array.from(latestJobBySite.entries());

  const results = await Promise.all(
    siteEntries.map(async ([siteId, j]) => {
      const latestCompleted = new Date(j.CompletedDate);
      const nextDue = new Date(latestCompleted);
      nextDue.setFullYear(nextDue.getFullYear() + 1);

      const diffMs = nextDue.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let status: RecertificationJob["status"];
      if (daysUntilDue < 0) status = "overdue";
      else if (daysUntilDue <= 60) status = "due-soon";
      else status = "upcoming";

      const dueYear = nextDue.getFullYear();
      const quoteYear = Math.max(dueYear, currentYear);

      // Only hit SimPRO quotes API for jobs within 90 days (overdue or due-soon)
      // Upcoming jobs don't need quote checks — they're far out enough
      const existingQuote =
        daysUntilDue <= 90 ? await fetchExistingQuote(siteId) : null;

      const job: RecertificationJob = {
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
        existingQuote,
      };

      return { job, isIgnored: ignoredIds.has(j.ID) };
    }),
  );

  const active: RecertificationJob[] = [];
  const ignored: RecertificationJob[] = [];

  for (const { job, isIgnored } of results) {
    if (isIgnored) {
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

  const showIgnored =
    request.nextUrl.searchParams.get("showIgnored") === "true";

  try {
    const [heightSafetyJobIds, ignoredIds] = await Promise.all([
      fetchHeightSafetyJobIds(),
      getIgnoredJobIds(),
    ]);

    const rawJobs = await fetchJobDetails(heightSafetyJobIds);
    const { active, ignored } = await buildResults(
      rawJobs,
      ignoredIds,
      showIgnored,
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
