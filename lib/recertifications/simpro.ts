// lib/recertifications/simpro.ts
//
// Shared SimPRO fetch/dedupe/match logic for the recurring-jobs feature —
// used by the live GET route, the cache-sync route, and the due-soon
// notifier. Previously this whole file was copy-pasted three times with
// only the cost-centre ID swapped out; now every caller passes in the
// category's cost-centre IDs and quote-match keywords instead.

import { computeDueStatus, type RecertificationJob } from "./types";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;
const PAGE_SIZE = 250;

export async function simproGet<T>(
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

export function hasSimproConfig(): boolean {
  return !!SIMPRO_BASE_URL && !!SIMPRO_ACCESS_TOKEN;
}

// ── Job IDs in a set of cost centres ────────────────────────────────────────
// A category can span multiple cost centre IDs (e.g. Window Cleaning +
// Bluewater - Window Cleaning) — every job appearing under any of them
// counts toward the category, deduplicated by job ID.

export async function fetchCategoryJobIds(
  costCentreIds: number[],
): Promise<Set<number>> {
  const jobIds = new Set<number>();

  for (const costCentreId of costCentreIds) {
    let page = 1;
    while (true) {
      const url =
        `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobCostCenters/` +
        `?CostCenter=${costCentreId}` +
        `&pageSize=${PAGE_SIZE}&page=${page}&columns=ID,Job`;
      const batch = await simproGet<{ ID: number; Job: { ID: number } }[]>(
        url,
      );
      for (const item of batch) {
        if (item.Job?.ID) jobIds.add(item.Job.ID);
      }
      if (batch.length < PAGE_SIZE) break;
      page++;
    }
  }

  return jobIds;
}

// ── Job details ──────────────────────────────────────────────────────────

export interface SimproJobRow {
  ID: number;
  Name: string;
  CompletedDate: string | null;
  Customer?: { ID: number; CompanyName?: string };
  Site?: { ID: number; Name?: string };
  Tags?: (string | { Name?: string })[];
  Total?: { ExTax?: number; IncTax?: number };
}

export async function fetchJobDetails(
  categoryJobIds: Set<number>,
): Promise<SimproJobRow[]> {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const dateFilter = twoYearsAgo.toISOString().split("T")[0];

  const results: SimproJobRow[] = [];
  let page = 1;

  while (true) {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/` +
      `?pageSize=${PAGE_SIZE}&page=${page}` +
      `&columns=ID,Name,CompletedDate,Customer,Site,Tags,Total` +
      `&CompletedDate=gt(${dateFilter})`;

    const batch = await simproGet<SimproJobRow[]>(url);

    for (const job of batch) {
      if (!categoryJobIds.has(job.ID)) continue;
      if (!job.CompletedDate) continue;
      const tags: string[] = (job.Tags || []).map((t) =>
        typeof t === "string" ? t : (t?.Name ?? ""),
      );
      if (tags.some((t) => t.toUpperCase() === "BLACKLIST")) continue;
      results.push(job);
    }

    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  return results;
}

// ── Existing-quote matching ─────────────────────────────────────────────

export function isMatchingQuote(name: string, keywords: string[]): boolean {
  const n = name
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
  return keywords.some((k) => n.includes(k));
}

interface SimproQuoteRow {
  ID: number;
  Name?: string;
  DateIssued?: string;
  Site?: { ID: number };
}

/** Bulk-fetches quotes from the last 2 years and returns Map<siteId, mostRecentQuoteDateIssued> for quotes matching the given keywords. */
export async function fetchQuotedSiteMap(
  keywords: string[],
): Promise<Map<number, Date>> {
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

    const batch = await simproGet<SimproQuoteRow[]>(url, {
      "If-Modified-Since": ifModifiedSince,
    });

    for (const q of batch) {
      if (!isMatchingQuote(q.Name || "", keywords)) continue;
      const siteId = q.Site?.ID;
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

/** Checks a single site for an existing matching quote — used by the due-soon notifier, which only needs a yes/no per candidate rather than a bulk map. */
export async function siteHasMatchingQuote(
  siteId: number,
  keywords: string[],
): Promise<boolean> {
  try {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/quotes/` +
      `?pageSize=50&page=1` +
      `&columns=ID,Name,DateIssued,Site` +
      `&Site=${siteId}`;
    const quotes = await simproGet<SimproQuoteRow[]>(url);
    return quotes.some((q) => isMatchingQuote(q.Name || "", keywords));
  } catch {
    return false;
  }
}

// ── Build result rows ────────────────────────────────────────────────────
// Deduplicates to the most recently completed job per site, computes the
// next-due date (one year after completion, pushed another year out if
// already re-quoted), and buckets into overdue/due-soon/upcoming.

export function buildJobs(
  rawJobs: SimproJobRow[],
  quotedSiteMap: Map<number, Date>,
): RecertificationJob[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  const latestJobBySite = new Map<number, SimproJobRow>();
  for (const j of rawJobs) {
    const siteId = j.Site?.ID;
    if (!siteId || !j.CompletedDate) continue;
    const existing = latestJobBySite.get(siteId);
    if (
      !existing ||
      new Date(j.CompletedDate) > new Date(existing.CompletedDate!)
    ) {
      latestJobBySite.set(siteId, j);
    }
  }

  const jobs: RecertificationJob[] = [];

  for (const [siteId, j] of latestJobBySite.entries()) {
    const latestCompleted = new Date(j.CompletedDate!);

    const nextDue = new Date(latestCompleted);
    nextDue.setFullYear(nextDue.getFullYear() + 1);

    const mostRecentQuote = quotedSiteMap.get(siteId);
    const isQuoted = !!(mostRecentQuote && mostRecentQuote > latestCompleted);

    const effectiveNextDue = isQuoted
      ? new Date(new Date(nextDue).setFullYear(nextDue.getFullYear() + 1))
      : nextDue;

    const nextDueDateISO = effectiveNextDue.toISOString().split("T")[0];
    const { daysUntilDue, status } = computeDueStatus(nextDueDateISO);

    const dueYear = effectiveNextDue.getFullYear();
    const quoteYear = Math.max(dueYear, currentYear);

    jobs.push({
      id: j.ID,
      name: j.Name,
      customer: j.Customer?.CompanyName || "Unknown",
      customerId: j.Customer?.ID ?? 0,
      site: j.Site?.Name || "Unknown",
      siteId,
      completedDate: j.CompletedDate!,
      nextDueDate: nextDueDateISO,
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

/** Convenience wrapper: cost-centre IDs -> fully built, sorted job rows. */
export async function fetchCategoryJobs(
  costCentreIds: number[],
  quoteMatchKeywords: string[],
): Promise<RecertificationJob[]> {
  const [jobIds, quotedSiteMap] = await Promise.all([
    fetchCategoryJobIds(costCentreIds),
    fetchQuotedSiteMap(quoteMatchKeywords),
  ]);
  const rawJobs = await fetchJobDetails(jobIds);
  return buildJobs(rawJobs, quotedSiteMap);
}
