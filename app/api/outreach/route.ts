// app/api/outreach/route.ts
// The outreach queue: every open opportunity plus recently resolved ones.

import { NextResponse } from "next/server";
import { OUTREACH_TEST_TO, isOutreachLive } from "@/lib/outreach/email";
import { listOpportunities } from "@/lib/outreach/store";

export async function GET() {
  try {
    return NextResponse.json({
      opportunities: await listOpportunities(),
      live: isOutreachLive(),
      testTo: OUTREACH_TEST_TO,
    });
  } catch (err) {
    console.error("[Outreach] list failed:", err);
    return NextResponse.json({ error: "Could not load outreach." }, { status: 500 });
  }
}
