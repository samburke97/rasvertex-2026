// app/api/simpro/quotes/[quoteId]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin wrapper — all logic lives in lib/simpro/client.ts
// Returns EnrichedQuote shape. Mirrors app/api/simpro/jobs/[jobId]/route.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { fetchEnrichedQuote } from "@/lib/simpro/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;

  const parsed = parseInt(quoteId, 10);
  if (!quoteId || isNaN(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid quote ID" }, { status: 400 });
  }

  try {
    const quote = await fetchEnrichedQuote(parsed);
    return NextResponse.json(quote);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SimPRO quote ${quoteId}]`, message);

    if (message.includes("configuration missing")) {
      return NextResponse.json(
        { error: "SimPRO configuration missing" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch quote details", details: message, quoteId },
      { status: 500 },
    );
  }
}
