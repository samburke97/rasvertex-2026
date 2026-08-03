// lib/simpro/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// All SimPRO server-side fetching logic lives here.
// Import fetchEnrichedJob() or fetchEnrichedQuote() — never duplicate fetch logic.
// ─────────────────────────────────────────────────────────────────────────────

import type { EnrichedJob, SimproRawJob, SimproRawSite } from "./types";
import { fetchWithTimeout } from "./timeout";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function simproGet<T>(url: string): Promise<T> {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    throw new Error("SimPRO configuration missing — check env vars");
  }
  const res = await fetchWithTimeout(url, {
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SimPRO HTTP ${res.status}${body ? `: ${body}` : ""}`);
  }
  return res.json() as Promise<T>;
}

// ── Field extraction helpers ──────────────────────────────────────────────────

/**
 * Safely extracts a plain string from a SimPRO field that might be:
 *   - a string              → returned as-is (trimmed)
 *   - a number              → converted to string
 *   - a nested object       → drills into common address sub-fields
 *   - null / undefined      → returns ""
 */
export function extractString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const nested =
      obj.Address ??
      obj.Street ??
      obj.StreetAddress ??
      obj.Name ??
      obj.Value ??
      obj.Text ??
      "";
    return extractString(nested);
  }
  return "";
}

function joinName(given?: string, family?: string): string {
  return [given, family].filter(Boolean).join(" ").trim();
}

export function formatAuDate(raw?: string | null): string {
  if (!raw) return new Date().toLocaleDateString("en-AU");
  try {
    return new Date(raw).toLocaleDateString("en-AU");
  } catch {
    return raw;
  }
}

// ── Individual fetchers ───────────────────────────────────────────────────────

export async function fetchRawJob(
  jobId: number,
  companyId = 0,
): Promise<SimproRawJob> {
  return simproGet<SimproRawJob>(
    `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${jobId}`,
  );
}

export async function fetchSiteAddress(
  siteId: number,
  companyId = 0,
  siteName?: string,
): Promise<string> {
  try {
    const site = await simproGet<SimproRawSite>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/sites/${siteId}`,
    );

    // SimPRO nests the actual address fields under `site.Address` as an
    // object ({ Address, City, State, PostalCode, Country }) — city/state/
    // postcode are NOT top-level fields on the site record itself. Fall
    // back to the top-level fields too in case another SimPRO instance
    // shapes this differently.
    const addressObj =
      site.Address && typeof site.Address === "object"
        ? (site.Address as Record<string, unknown>)
        : {};

    const addr = extractString(
      addressObj.Address ??
        site.Address ??
        site.Street ??
        site.StreetAddress ??
        "",
    );
    const city = extractString(
      addressObj.City ?? addressObj.Suburb ?? site.City ?? site.Suburb ?? "",
    );
    const state = extractString(addressObj.State ?? site.State ?? "");
    const postcode = extractString(
      addressObj.PostalCode ??
        addressObj.PostCode ??
        addressObj.Postcode ??
        site.PostCode ??
        site.PostalCode ??
        site.Postcode ??
        "",
    );

    const parts = [addr, city, state, postcode].filter(Boolean);
    return parts.length ? parts.join(", ") : (siteName ?? "");
  } catch (err) {
    console.warn(`[SimPRO] fetchSiteAddress(${siteId}) failed:`, err);
    return siteName ?? "";
  }
}

// ── EnrichedJob — used by all job-based reports ───────────────────────────────

export async function fetchEnrichedJob(
  jobId: string | number,
  companyId = 0,
): Promise<EnrichedJob> {
  const parsed = typeof jobId === "string" ? parseInt(jobId, 10) : jobId;
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid job ID: ${jobId}`);
  }

  const job = await fetchRawJob(parsed, companyId);

  const siteAddress = job.Site?.ID
    ? await fetchSiteAddress(job.Site.ID, companyId, job.Site.Name)
    : "";

  const clientName =
    job.Customer?.CompanyName?.trim() ||
    joinName(job.Customer?.GivenName, job.Customer?.FamilyName) ||
    "";

  const preparedFor =
    joinName(job.SiteContact?.GivenName, job.SiteContact?.FamilyName) ||
    joinName(job.CustomerContact?.GivenName, job.CustomerContact?.FamilyName) ||
    clientName;

  const jobNo = job.No ? `#${job.No}` : `#${parsed}`;
  const date = formatAuDate(
    job.CompletedDate || job.DateIssued || job.DateModified,
  );

  return {
    id: String(parsed),
    jobNo,
    name: job.Name?.trim() || `Job ${parsed}`,
    clientName,
    siteId: job.Site?.ID ? String(job.Site.ID) : "",
    siteName: job.Site?.Name?.trim() || clientName,
    siteAddress,
    preparedFor,
    date,
    totalIncGst: job.Total?.IncTax ?? 0,
  };
}

// ── EnrichedQuote — used by the quote-won webhook ─────────────────────────────

export interface EnrichedQuote {
  id: string;
  jobNo: string;
  name: string;
  clientName: string;
  siteName: string;
  siteAddress: string;
  date: string;
  totalExTax: number;
  totalIncGst: number;
}

interface SimproRawQuote {
  ID: number;
  JobNo?: string | number;
  Name?: string;
  DateApproved?: string | null;
  DateIssued?: string | null;
  DateModified?: string | null;
  Customer?: {
    ID?: number;
    CompanyName?: string;
    GivenName?: string;
    FamilyName?: string;
  };
  Site?: {
    ID?: number;
    Name?: string;
  };
  Total?: {
    ExTax?: number;
    Tax?: number;
    IncTax?: number;
  };
  [key: string]: unknown;
}

export async function fetchRawQuote(
  quoteId: number,
  companyId = 0,
): Promise<SimproRawQuote> {
  return simproGet<SimproRawQuote>(
    `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/quotes/${quoteId}`,
  );
}

export async function fetchEnrichedQuote(
  quoteId: number,
  companyId = 0,
): Promise<EnrichedQuote> {
  if (isNaN(quoteId) || quoteId <= 0) {
    throw new Error(`Invalid quote ID: ${quoteId}`);
  }

  const quote = await fetchRawQuote(quoteId, companyId);

  const clientName =
    quote.Customer?.CompanyName?.trim() ||
    joinName(quote.Customer?.GivenName, quote.Customer?.FamilyName) ||
    "";

  const siteName = quote.Site?.Name?.trim() || clientName;
  const siteAddress = quote.Site?.ID
    ? await fetchSiteAddress(quote.Site.ID, companyId, siteName)
    : "";

  const totalExTax = quote.Total?.ExTax ?? 0;
  const totalIncGst =
    quote.Total?.IncTax ?? Math.round(totalExTax * 1.1 * 100) / 100;

  const jobNo = quote.JobNo ? `#${quote.JobNo}` : `#${quoteId}`;
  const date = formatAuDate(
    quote.DateApproved || quote.DateIssued || quote.DateModified,
  );

  return {
    id: String(quoteId),
    jobNo,
    name: quote.Name?.trim() || `Quote ${quoteId}`,
    clientName,
    siteName,
    siteAddress,
    date,
    totalExTax,
    totalIncGst,
  };
}
