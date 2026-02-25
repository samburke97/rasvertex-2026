// app/api/simpro/jobs/[jobId]/route.ts
import { NextRequest, NextResponse } from "next/server";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

async function simproGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`,
    );
  }
  return res.json() as Promise<T>;
}

interface SimproJob {
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
  [key: string]: unknown;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const parsed = parseInt(jobId, 10);
  if (!jobId || isNaN(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  try {
    // ── 1. Fetch job (no trailing slash) ──────────────────────────────────
    const job = await simproGet<SimproJob>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/${parsed}`,
    );

    // ── 2. Fetch site — log full response to find address field shape ──────
    let siteAddress = "";
    if (job.Site?.ID) {
      try {
        // Try with no trailing slash first
        const rawSite = await simproGet<Record<string, unknown>>(
          `${SIMPRO_BASE_URL}/api/v1.0/companies/0/sites/${job.Site.ID}`,
        );

        // Log EVERYTHING so we can see the real field names
        console.log(`[SimPRO site ${job.Site.ID}] Full response:`);
        console.log(JSON.stringify(rawSite, null, 2));
        console.log(
          `[SimPRO site ${job.Site.ID}] Top-level keys:`,
          Object.keys(rawSite),
        );

        // Try every possible address field combination SimPRO might use
        const addr = (rawSite.Address ??
          rawSite.Street ??
          rawSite.StreetAddress ??
          "") as string;
        const city = (rawSite.City ?? rawSite.Suburb ?? "") as string;
        const state = (rawSite.State ?? "") as string;
        const postcode = (rawSite.PostCode ??
          rawSite.PostalCode ??
          rawSite.Postcode ??
          "") as string;

        const parts = [addr, city, state, postcode]
          .map((s) => String(s).trim())
          .filter(Boolean);

        siteAddress = parts.length ? parts.join(", ") : (job.Site.Name ?? "");
      } catch (err) {
        console.warn(`[SimPRO] Site ${job.Site.ID} fetch failed:`, err);
        siteAddress = job.Site.Name ?? "";
      }
    }

    return NextResponse.json({ ...job, _siteAddress: siteAddress });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SimPRO job ${jobId}]`, message);
    return NextResponse.json(
      { error: "Failed to fetch job details", details: message, jobId },
      { status: 500 },
    );
  }
}
