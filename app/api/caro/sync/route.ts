// app/api/caro/sync/route.ts
// POST — re-reads SimPRO for every recurring service line and refreshes the
// cache (same as the old Recurring jobs page's Sync, all lines at once).
// Client check-in data refreshes on its own daily cron (/api/checkin/sync).

import { NextResponse } from "next/server";
import { fetchCategoryJobs, hasSimproConfig } from "@/lib/recertifications/simpro";
import { replaceCachedJobs } from "@/lib/recertifications/store";
import { RECURRING_CATEGORIES } from "@/lib/recertifications/categories";
import { LINES } from "@/lib/caro/data";

export const maxDuration = 300;

export async function POST() {
  if (!hasSimproConfig()) {
    return NextResponse.json({ error: "SimPRO configuration missing" }, { status: 500 });
  }
  try {
    for (const L of LINES) {
      const cfg = RECURRING_CATEGORIES[L.category];
      const jobs = await fetchCategoryJobs(cfg.costCentreIds, cfg.quoteMatchKeywords, cfg.historySince);
      await replaceCachedJobs(L.category, jobs);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Caro] sync failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Sync failed." }, { status: 500 });
  }
}
