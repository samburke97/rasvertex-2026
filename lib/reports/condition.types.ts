export interface ReportPhoto {
  id: string;
  name: string;
  url: string;
  size: number;
}

export interface ReportJobDetails {
  preparedFor: string;
  preparedBy: string;
  address: string;
  reportType: string; // Fixed label e.g. "Building Condition Report"
  project: string; // Job Name e.g. "Baywatch Repaint"
  date: string;
}

export interface ConditionReportData {
  job: ReportJobDetails;
  photos: ReportPhoto[];
  comments: string;
  recommendations: string;
}

export type ImportStatus =
  | { phase: "idle" }
  | { phase: "fetching-job" }
  | { phase: "fetching-photos"; loaded: number; total: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

// ── SimPRO API response ───────────────────────────────────────────────────────
export interface SimproJobResponse {
  ID: number;
  Type?: string;
  Name?: string;
  Stage?: string;
  CompletedDate?: string | null;
  DateModified?: string;
  DateIssued?: string;
  DueDate?: string | null;
  Customer?: {
    ID: number;
    CompanyName?: string;
    GivenName?: string;
    FamilyName?: string;
  };
  CustomerContact?: {
    ID: number;
    GivenName?: string;
    FamilyName?: string;
  } | null;
  Site?: { ID: number; Name?: string };
  SiteContact?: { ID: number; GivenName?: string; FamilyName?: string } | null;
  _siteAddress?: string; // Resolved by route via /sites/{id}
  [key: string]: unknown;
}

// ── Field mapping ─────────────────────────────────────────────────────────────
/**
 * reportType   → always "Building Condition Report" (the fixed label shown on cover)
 * project      → Job Name (e.g. "Baywatch Repaint") — shown under PROJECT on cover
 * preparedFor  → SiteContact → CustomerContact → Customer.CompanyName → ""
 * address      → _siteAddress (resolved) → Site.Name → ""
 * date         → CompletedDate → DateIssued → DateModified → today
 * preparedBy   → "Phil Clark" (editable)
 */
export function mapJobToReportDetails(
  data: SimproJobResponse,
): ReportJobDetails {
  const preparedFor =
    joinName(data.SiteContact?.GivenName, data.SiteContact?.FamilyName) ||
    joinName(
      data.CustomerContact?.GivenName,
      data.CustomerContact?.FamilyName,
    ) ||
    data.Customer?.CompanyName?.trim() ||
    joinName(data.Customer?.GivenName, data.Customer?.FamilyName) ||
    "";

  const address =
    data._siteAddress &&
    data._siteAddress.trim() &&
    data._siteAddress !== data.Site?.Name
      ? data._siteAddress.trim()
      : data._siteAddress?.trim() || "";

  const project = data.Name?.trim() || "";

  const rawDate = data.CompletedDate || data.DateIssued || data.DateModified;

  return {
    preparedFor,
    preparedBy: "Phil Clark",
    address,
    reportType: "Building Condition Report",
    project,
    date: formatAuDate(rawDate),
  };
}

function joinName(given?: string, family?: string): string {
  return [given, family].filter(Boolean).join(" ").trim();
}

function formatAuDate(raw?: string | null): string {
  if (!raw) return new Date().toLocaleDateString("en-AU");
  try {
    return new Date(raw).toLocaleDateString("en-AU");
  } catch {
    return raw;
  }
}
