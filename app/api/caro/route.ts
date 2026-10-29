// app/api/caro/route.ts
// Everything the Caro page needs in one load: every recurring site (SimPRO
// cache + client check-in + Caro state), the timing, templates and rules.

import { NextResponse } from "next/server";
import { hasSimproConfig } from "@/lib/recertifications/simpro";
import { isOutreachLive, OUTREACH_TEST_TO } from "@/lib/outreach/email";
import { getRules, getTemplates, getTiming, loadSites } from "@/lib/caro/store";

export const maxDuration = 300;

export async function GET() {
  if (!hasSimproConfig()) {
    return NextResponse.json({ error: "SimPRO configuration missing" }, { status: 500 });
  }
  try {
    const [{ sites, syncedAt }, timing, templates, rules] = await Promise.all([loadSites(), getTiming(), getTemplates(), getRules()]);
    return NextResponse.json({ sites, syncedAt, timing, templates, rules, live: isOutreachLive(), testTo: OUTREACH_TEST_TO });
  } catch (err) {
    console.error("[Caro] load failed:", err);
    return NextResponse.json({ error: "Could not load recurring jobs." }, { status: 500 });
  }
}
