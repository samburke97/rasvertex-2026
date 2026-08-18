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
  contactName: string;
  salespersonName: string;
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
  Salesperson?: { ID?: number; Name?: string } | null;
  Customer?: {
    ID?: number;
    CompanyName?: string;
    GivenName?: string;
    FamilyName?: string;
  };
  CustomerContact?: {
    ID?: number;
    GivenName?: string;
    FamilyName?: string;
    Email?: string;
  } | null;
  Site?: {
    ID?: number;
    Name?: string;
  };
  SiteContact?: {
    ID?: number;
    GivenName?: string;
    FamilyName?: string;
    Email?: string;
  } | null;
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

  const contactName =
    joinName(quote.SiteContact?.GivenName, quote.SiteContact?.FamilyName) ||
    joinName(
      quote.CustomerContact?.GivenName,
      quote.CustomerContact?.FamilyName,
    ) ||
    clientName;

  const salespersonName = quote.Salesperson?.Name?.trim() || "";

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
    contactName,
    salespersonName,
    siteName,
    siteAddress,
    date,
    totalExTax,
    totalIncGst,
  };
}

// ── Quote sections — the $ totals live one level down, on each section's
// cost centers (GET .../sections/{sectionID}/costCenters/), not on the
// section itself — see fetchQuotePricingItems below.

export interface QuoteSection {
  id: string;
  name: string;
  description: string;
  displayOrder: number;
}

interface SimproRawQuoteSection {
  ID: number;
  Name?: string;
  Description?: string;
  DisplayOrder?: number;
}

export async function fetchQuoteSections(
  quoteId: number,
  companyId = 0,
): Promise<QuoteSection[]> {
  if (isNaN(quoteId) || quoteId <= 0) {
    throw new Error(`Invalid quote ID: ${quoteId}`);
  }

  const sections = await simproGet<SimproRawQuoteSection[]>(
    `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/quotes/${quoteId}/sections/`,
  );

  return sections
    .map((s) => ({
      id: String(s.ID),
      name: s.Name?.trim() || "",
      description: s.Description?.trim() || "",
      displayOrder: s.DisplayOrder ?? 0,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

// ── Quote cost centers — the actual priced line items within a section ───────

export interface QuoteCostCenter {
  id: string;
  name: string;
  displayOrder: number;
  amountExTax: number;
}

interface SimproRawQuoteCostCenter {
  ID: number;
  Name?: string;
  DisplayOrder?: number;
  Total?: { ExTax?: number; IncTax?: number };
}

export async function fetchQuoteCostCenters(
  quoteId: number,
  sectionId: number,
  companyId = 0,
): Promise<QuoteCostCenter[]> {
  const centers = await simproGet<SimproRawQuoteCostCenter[]>(
    `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/quotes/${quoteId}/sections/${sectionId}/costCenters/`,
  );

  return centers
    .map((c) => ({
      id: String(c.ID),
      name: c.Name?.trim() || "",
      displayOrder: c.DisplayOrder ?? 0,
      amountExTax: c.Total?.ExTax ?? 0,
    }))
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

// ── Combined: every priced line in a quote, ready to drop straight into the
// Proposal's pricing table (this is what "list what's in the quote" means
// in SimPRO's data model — sections group cost centers, cost centers carry
// the $ totals).

export interface QuotePricingItem {
  id: string;
  groupLabel: string; // the cost centre this line item belongs to
  label: string; // the item's own description (e.g. "Maintenance")
  amountExTax: number;
}

// Catalog, Labor, OneOff and Prebuild items all share the same Total shape
// ({ Qty, Amount: { ExTax, IncTax } }) — the four billable line-item types
// that can live under a cost centre. ServiceFees/Assets aren't fetched (no
// documented schema, and not used on RAS-VERTEX's Project-type quotes).

interface SimproRawLineItemTotal {
  Qty?: number;
  Amount?: { ExTax?: number; IncTax?: number };
}

interface SimproRawCatalogItem {
  ID: number;
  Catalog?: { ID?: number; PartNo?: string; Name?: string };
  Total?: SimproRawLineItemTotal;
}

interface SimproRawLaborItem {
  ID: number;
  LaborType?: { ID?: number; Name?: string };
  Total?: SimproRawLineItemTotal;
}

interface SimproRawOneOffItem {
  ID: number;
  Description?: string;
  Total?: SimproRawLineItemTotal;
}

interface SimproRawPrebuildItem {
  ID: number;
  Prebuild?: { ID?: number; PartNo?: string; Name?: string };
  Total?: SimproRawLineItemTotal;
}

async function fetchCostCenterLineItems(
  quoteId: number,
  sectionId: number,
  costCenterId: number,
  companyId: number,
): Promise<{ id: string; label: string; amountExTax: number }[]> {
  const base = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/quotes/${quoteId}/sections/${sectionId}/costCenters/${costCenterId}`;

  const [catalogs, labor, oneOffs, prebuilds] = await Promise.all([
    simproGet<SimproRawCatalogItem[]>(`${base}/catalogs/?pageSize=250`).catch(
      () => [] as SimproRawCatalogItem[],
    ),
    simproGet<SimproRawLaborItem[]>(`${base}/labor/?pageSize=250`).catch(
      () => [] as SimproRawLaborItem[],
    ),
    simproGet<SimproRawOneOffItem[]>(`${base}/oneOffs/?pageSize=250`).catch(
      () => [] as SimproRawOneOffItem[],
    ),
    simproGet<SimproRawPrebuildItem[]>(`${base}/prebuilds/?pageSize=250`).catch(
      () => [] as SimproRawPrebuildItem[],
    ),
  ]);

  return [
    ...catalogs.map((c) => ({
      id: `catalog-${c.ID}`,
      label: c.Catalog?.Name?.trim() || c.Catalog?.PartNo?.trim() || "Catalog item",
      amountExTax: c.Total?.Amount?.ExTax ?? 0,
    })),
    ...labor.map((l) => ({
      id: `labor-${l.ID}`,
      label: l.LaborType?.Name?.trim() || "Labor",
      amountExTax: l.Total?.Amount?.ExTax ?? 0,
    })),
    ...oneOffs.map((o) => ({
      id: `oneoff-${o.ID}`,
      label: o.Description?.trim() || "One-off item",
      amountExTax: o.Total?.Amount?.ExTax ?? 0,
    })),
    ...prebuilds.map((p) => ({
      id: `prebuild-${p.ID}`,
      label: p.Prebuild?.Name?.trim() || p.Prebuild?.PartNo?.trim() || "Prebuild",
      amountExTax: p.Total?.Amount?.ExTax ?? 0,
    })),
  ];
}

export async function fetchQuotePricingItems(
  quoteId: number,
  companyId = 0,
): Promise<QuotePricingItem[]> {
  const sections = await fetchQuoteSections(quoteId, companyId);
  const costCenterLists = await Promise.all(
    sections.map((s) =>
      fetchQuoteCostCenters(quoteId, parseInt(s.id, 10), companyId).catch(
        () => [] as QuoteCostCenter[],
      ),
    ),
  );

  const multiSection = sections.length > 1;
  const items: QuotePricingItem[] = [];

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    for (const center of costCenterLists[i]) {
      const centerBase =
        center.name || section.name || section.description || "Line item";
      const groupLabel =
        multiSection && section.name && section.name !== centerBase
          ? `${section.name} — ${centerBase}`
          : centerBase;

      const lineItems = await fetchCostCenterLineItems(
        quoteId,
        parseInt(section.id, 10),
        parseInt(center.id, 10),
        companyId,
      ).catch(() => [] as { id: string; label: string; amountExTax: number }[]);

      if (lineItems.length === 0) {
        // No Catalog/Labor/OneOff/Prebuild items found — fall back to the
        // cost centre's own collapsed total so the $ amount is never lost.
        items.push({
          id: `${section.id}-${center.id}`,
          groupLabel,
          label: centerBase,
          amountExTax: center.amountExTax,
        });
        continue;
      }

      for (const item of lineItems) {
        items.push({
          id: `${section.id}-${center.id}-${item.id}`,
          groupLabel,
          label: item.label,
          amountExTax: item.amountExTax,
        });
      }
    }
  }

  return items;
}
