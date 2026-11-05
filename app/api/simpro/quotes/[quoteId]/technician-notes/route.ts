// app/api/simpro/quotes/[quoteId]/technician-notes/route.ts
// The technician notes on a quote's timeline, as for a job. A quote with no
// timeline (or none of these notes) gives an empty list.

import { NextRequest, NextResponse } from "next/server";
import { fetchTechnicianNotes } from "@/lib/simpro/client";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ quoteId: string }> }) {
  const { quoteId } = await params;
  const parsed = parseInt(quoteId, 10);
  if (!(parsed > 0)) return NextResponse.json({ error: "Invalid quote ID" }, { status: 400 });
  try {
    return NextResponse.json({ notes: await fetchTechnicianNotes(parsed, 0, "quotes") });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.warn(`[SimPRO quote ${quoteId} technician notes]`, message);
    return NextResponse.json({ notes: [] });
  }
}
