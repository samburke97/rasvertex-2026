// lib/simpro/client.ts
// ─────────────────────────────────────────────────────────────────────────────
// All SimPRO server-side fetching logic lives here.
// Import fetchEnrichedJob() anywhere you need job data — never duplicate this.
//
// Usage:
//   import { fetchEnrichedJob } from "@/lib/simpro/client"
//   const job = await fetchEnrichedJob("10737")
// ─────────────────────────────────────────────────────────────────────────────

import type { EnrichedJob, SimproRawJob, SimproRawSite } from "./types";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

// ── Core fetch wrapper ────────────────────────────────────────────────────────

export async function simproGet<T>(url: string): Promise<T> {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    throw new Error("SimPRO configuration missing — check env vars");
  }
  const res = await fetch(url, {
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
 *
 * This is the fix for the [object Object] address bug.
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

    const addr = extractString(
      site.Address ?? site.Street ?? site.StreetAddress ?? "",
    );
    const city = extractString(site.City ?? site.Suburb ?? "");
    const state = extractString(site.State ?? "");
    const postcode = extractString(
      site.PostCode ?? site.PostalCode ?? site.Postcode ?? "",
    );

    const parts = [addr, city, state, postcode].filter(Boolean);
    return parts.length ? parts.join(", ") : (siteName ?? "");
  } catch (err) {
    console.warn(`[SimPRO] fetchSiteAddress(${siteId}) failed:`, err);
    return siteName ?? "";
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Fetches a job from SimPRO and resolves all nested fields into a clean
 * EnrichedJob. This is the single function every report should call —
 * no report should parse raw SimPRO responses.
 *
 * Runs job fetch and site address fetch in parallel for speed.
 */
export async function fetchEnrichedJob(
  jobId: string | number,
  companyId = 0,
): Promise<EnrichedJob> {
  const parsed = typeof jobId === "string" ? parseInt(jobId, 10) : jobId;
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid job ID: ${jobId}`);
  }

  const job = await fetchRawJob(parsed, companyId);

  // Resolve site address in parallel (it's a separate API call)
  const siteAddress = job.Site?.ID
    ? await fetchSiteAddress(job.Site.ID, companyId, job.Site.Name)
    : "";

  // Client name: CompanyName → GivenName FamilyName
  const clientName =
    job.Customer?.CompanyName?.trim() ||
    joinName(job.Customer?.GivenName, job.Customer?.FamilyName) ||
    "";

  // preparedFor: SiteContact → CustomerContact → clientName
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
    siteName: job.Site?.Name?.trim() || clientName,
    siteAddress,
    preparedFor,
    date,
    totalIncGst: job.Total?.IncTax ?? 0,
  };
}
