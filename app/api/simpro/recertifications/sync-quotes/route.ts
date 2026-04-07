// app/api/simpro/recertifications/sync-quotes/route.ts
//
// Scans SimPRO quotes created this calendar year, matches by Site ID,
// and saves recertification quotes to Neon — regardless of name variation.
//
// Name matching: lowercase + normalise & → and, then check known variants.
// This catches all historical naming inconsistencies while excluding
// non-recertification Height Safety quotes (installs, safety audits etc).
//
// Going forward all new quotes use: "Annual Anchor Recertification - YEAR"
//
// Usage:
//   POST /api/simpro/recertifications/sync-quotes
//   Body: { siteIds: number[] }

import { NextRequest, NextResponse } from "next/server";
import { saveRecertQuote } from "@/lib/recertifications/store";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

// Normalise name then check against all known recertification name variants.
// Handles & vs and, extra spaces, case differences.
function isRecertificationQuote(name: string): boolean {
  const n = name
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ") // & → and
    .replace(/\s+/g, " ") // collapse spaces
    .trim();

  return (
    n.includes("anchor recertification") || // "Anchor Recertification - 2026"
    n.includes("annual anchor recertification") || // "Annual Anchor Recertification - 2026"
    n.includes("annual anchor test") || // "Annual Anchor Test 2026"
    n.includes("anchor test and recertification") || // "Anchor Test & Recertification"
    n.includes("anchor rest and recertification") || // typo variant
    n.includes("anchor test") // "Anchor Test - 2026"
  );
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

interface SimproQuote {
  ID: number;
  Name: string;
  JobNo: string;
  Status: string;
  DateCreated: string;
  Customer?: { ID: number; CompanyName?: string };
  Site?: { ID: number; Name?: string };
}

export async function POST(request: NextRequest) {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const body = await request.json();
  const siteIds: number[] = body.siteIds ?? [];

  if (!siteIds.length) {
    return NextResponse.json({ synced: 0 });
  }

  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  const siteIdSet = new Set(siteIds);

  let synced = 0;
  let skipped = 0;
  const errors: string[] = [];
  let page = 1;
  const PAGE_SIZE = 250;

  while (true) {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/quotes/` +
      `?pageSize=${PAGE_SIZE}&page=${page}` +
      `&columns=ID,Name,JobNo,Status,DateCreated,Customer,Site` +
      `&DateCreated=gt(${yearStart})`;

    let batch: SimproQuote[];
    try {
      batch = await simproGet<SimproQuote[]>(url);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Page ${page}: ${msg}`);
      break;
    }

    for (const quote of batch) {
      const siteId = quote.Site?.ID;

      // Must be one of our tracked sites
      if (!siteId || !siteIdSet.has(siteId)) continue;

      // Must match a known recertification name pattern
      if (!isRecertificationQuote(quote.Name || "")) {
        skipped++;
        continue;
      }

      const quoteYear = new Date(quote.DateCreated).getFullYear();

      const statusRaw = (quote.Status || "").toLowerCase();
      const quoteStatus =
        statusRaw === "sent"
          ? "sent"
          : statusRaw === "approved" || statusRaw === "accepted"
            ? "approved"
            : "created";

      try {
        await saveRecertQuote({
          siteId,
          year: quoteYear,
          quoteType: "recertification",
          quoteId: quote.ID,
          quoteName: quote.Name || `Quote ${quote.ID}`,
          quoteStatus,
          simproQuoteNo: quote.JobNo || null,
          customer: quote.Customer?.CompanyName || "",
          siteName: quote.Site?.Name || "",
        });
        synced++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Quote ${quote.ID}: ${msg}`);
      }
    }

    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  console.log(
    `[SyncQuotes] Synced ${synced}, skipped ${skipped} non-recertification quotes`,
  );

  return NextResponse.json({
    synced,
    skipped,
    errors: errors.length ? errors : undefined,
  });
}
