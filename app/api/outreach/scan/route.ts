// app/api/outreach/scan/route.ts
//
// Runs the outreach scan (lib/outreach/scan.ts): finds new opportunities in
// SimPRO and resolves open ones that have since been quoted. Called daily
// by Vercel cron (GET, see vercel.json) and by the "Scan SimPRO" button
// (POST). Never sends email; that only happens from the review queue.

import { NextResponse } from "next/server";
import { hasSimproConfig } from "@/lib/recertifications/simpro";
import { runOutreachScan } from "@/lib/outreach/scan";

// A full scan pages through ~18 months of SimPRO jobs and quotes.
export const maxDuration = 300;

async function scan() {
  if (!hasSimproConfig()) {
    return NextResponse.json({ error: "SimPRO configuration missing" }, { status: 500 });
  }
  try {
    const result = await runOutreachScan();
    console.log("[Outreach] scan", result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[Outreach] scan failed:", err);
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}

export const GET = scan;
export const POST = scan;
