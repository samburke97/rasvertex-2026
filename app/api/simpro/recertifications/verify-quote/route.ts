// app/api/simpro/recertifications/verify-quote/route.ts
// GET ?quoteId=123&siteId=456&year=2026
// Checks SimPRO to confirm the quote still exists.
// If it has been deleted in SimPRO, removes the Neon record and returns { exists: false }.

import { NextRequest, NextResponse } from "next/server";
import { deleteRecertQuote } from "@/lib/recertifications/store";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const quoteId = Number(searchParams.get("quoteId"));
  const siteId = Number(searchParams.get("siteId"));
  const year = Number(searchParams.get("year"));

  if (!quoteId || !siteId || !year) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  try {
    const res = await fetch(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/quotes/${quoteId}/`,
      {
        headers: {
          Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        next: { revalidate: 0 },
      },
    );

    if (res.status === 404 || res.status === 400) {
      // Quote is gone in SimPRO — clean up Neon record
      await deleteRecertQuote(siteId, year);
      console.log(
        `[VerifyQuote] Quote ${quoteId} not found in SimPRO — removed from Neon (siteId=${siteId}, year=${year})`,
      );
      return NextResponse.json({ exists: false });
    }

    if (!res.ok) {
      // SimPRO error we can't interpret — don't delete, just treat as still existing
      console.warn(
        `[VerifyQuote] SimPRO returned ${res.status} for quote ${quoteId}`,
      );
      return NextResponse.json({ exists: true, error: "SimPRO check failed" });
    }

    return NextResponse.json({ exists: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[VerifyQuote] Error:", message);
    // On network error, don't delete — assume it still exists
    return NextResponse.json({ exists: true, error: message });
  }
}
