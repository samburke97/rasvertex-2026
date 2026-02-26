// lib/simpro/types.ts
// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for all SimPRO-related types used across the app.
// Raw API shapes live here alongside the normalised EnrichedJob that every
// report consumes — no report should ever parse raw SimPRO responses directly.
// ─────────────────────────────────────────────────────────────────────────────

// ── Raw SimPRO API shapes ─────────────────────────────────────────────────────

export interface SimproCustomer {
  ID: number;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
}

export interface SimproContact {
  ID: number;
  GivenName?: string;
  FamilyName?: string;
}

export interface SimproSiteRef {
  ID: number;
  Name?: string;
}

export interface SimproTotal {
  ExTax?: number;
  Tax?: number;
  IncTax?: number;
}

/** Raw job object returned directly from SimPRO /jobs/{id} */
export interface SimproRawJob {
  ID: number;
  No?: string | number;
  Name?: string;
  Type?: string;
  Stage?: string;
  CompletedDate?: string | null;
  DateIssued?: string;
  DateModified?: string;
  DueDate?: string | null;
  Customer?: SimproCustomer;
  CustomerContact?: SimproContact | null;
  Site?: SimproSiteRef;
  SiteContact?: SimproContact | null;
  Total?: SimproTotal;
  [key: string]: unknown;
}

/** Raw site object returned from SimPRO /sites/{id} */
export interface SimproRawSite {
  ID: number;
  Name?: string;
  Address?: unknown; // May be string OR nested object — use extractString()
  Street?: unknown;
  StreetAddress?: unknown;
  City?: unknown;
  Suburb?: unknown;
  State?: unknown;
  PostCode?: unknown;
  PostalCode?: unknown;
  Postcode?: unknown;
  [key: string]: unknown;
}

// ── Normalised shape ──────────────────────────────────────────────────────────

/**
 * EnrichedJob — the single normalised job shape shared across every report.
 *
 * All field resolution (nested objects, fallback chains, date formatting) is
 * done once in fetchEnrichedJob(). Reports just read from this.
 *
 * Field sources:
 *   id           → job.ID
 *   jobNo        → job.No (formatted as "#10737")
 *   name         → job.Name  (project / job name)
 *   clientName   → Customer.CompanyName → Customer GivenName+FamilyName
 *   siteName     → Site.Name
 *   siteAddress  → resolved from /sites/{id} (never [object Object])
 *   preparedFor  → SiteContact → CustomerContact → clientName
 *   date         → CompletedDate → DateIssued → DateModified → today
 *   totalIncGst  → Total.IncTax
 */
export interface EnrichedJob {
  id: string;
  jobNo: string;
  name: string;
  clientName: string;
  siteName: string;
  siteAddress: string;
  preparedFor: string;
  date: string;
  totalIncGst: number;
}
