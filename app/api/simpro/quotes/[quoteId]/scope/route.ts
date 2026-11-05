// app/api/simpro/quotes/[quoteId]/scope/route.ts
// A quote's scope of works (description and line items), for a Job overview
// made from a quote. Mirrors ../../jobs/[jobId]/scope.

import { NextRequest, NextResponse } from "next/server";
import { fetchQuoteScope } from "@/lib/simpro/client";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const parsed = parseInt(quoteId, 10);
  if (!(parsed > 0)) return NextResponse.json({ error: "Invalid quote ID" }, { status: 400 });
  try {
    return NextResponse.json(await fetchQuoteScope(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SimPRO quote ${quoteId} scope]`, message);
    return NextResponse.json({ error: "Failed to fetch the quote's scope", details: message }, { status: 500 });
  }
}
