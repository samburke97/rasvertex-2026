// app/api/simpro/quotes/[quoteId]/pricing/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin wrapper — all logic lives in lib/simpro/client.ts
// Returns QuotePricingItem[] — one row per cost center across all of the
// quote's sections, each carrying its own $ total (see fetchQuotePricingItems).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { fetchQuotePricingItems } from "@/lib/simpro/client";

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
    const items = await fetchQuotePricingItems(parsed);
    return NextResponse.json(items);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SimPRO quote ${quoteId} pricing]`, message);

    if (message.includes("configuration missing")) {
      return NextResponse.json(
        { error: "SimPRO configuration missing" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        error: "Failed to fetch quote pricing",
        details: message,
        quoteId,
      },
      { status: 500 },
    );
  }
}
