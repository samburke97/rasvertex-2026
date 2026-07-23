// app/api/simpro/recertifications/sync/route.ts
//
// POST ?category=<category> — full SimPRO sync for one category, writes
// results to the Neon cache scoped to that category (other categories'
// cached rows are untouched). Called by the manual refresh button in the UI.

import { NextRequest, NextResponse } from "next/server";
import {
  getIgnoredJobIds,
  replaceCachedJobs,
  getCachedJobs,
} from "@/lib/recertifications/store";
import { fetchCategoryJobs, hasSimproConfig } from "@/lib/recertifications/simpro";
import { RECURRING_CATEGORIES, isRecurringCategory } from "@/lib/recertifications/categories";

export async function POST(request: NextRequest) {
  if (!hasSimproConfig()) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const categoryParam = request.nextUrl.searchParams.get("category");
  if (!isRecurringCategory(categoryParam)) {
    return NextResponse.json(
      { error: "Missing or invalid category" },
      { status: 400 },
    );
  }
  const config = RECURRING_CATEGORIES[categoryParam];

  try {
    console.log(`[Sync] Starting SimPRO sync for ${categoryParam}…`);

    const jobs = await fetchCategoryJobs(
      config.costCentreIds,
      config.quoteMatchKeywords,
    );

    await replaceCachedJobs(categoryParam, jobs);
    console.log(`[Sync] Done — ${jobs.length} jobs written to cache (${categoryParam})`);

    // Return fresh data immediately so the UI can update without a second request
    const ignoredIds = await getIgnoredJobIds(categoryParam);
    const { active, ignored, syncedAt } = await getCachedJobs(
      categoryParam,
      ignoredIds,
    );

    return NextResponse.json({
      jobs: active,
      ignoredJobs: ignored,
      total: active.length,
      syncedAt: syncedAt?.toISOString() ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Sync]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
