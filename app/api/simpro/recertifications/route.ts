// app/api/simpro/recertifications/route.ts
//
// Cache-first read — normally just reads the Neon cache (fast, no live
// SimPRO calls), which the Sync button (see sync/route.ts) keeps fresh.
// The one exception: if a category has never been synced yet (empty
// cache), this falls back to a live SimPRO fetch and populates the cache
// itself, so a brand-new category tab isn't just a permanent blank state
// waiting on someone to remember to hit Sync first.

import { NextRequest, NextResponse } from "next/server";
import {
  getIgnoredJobIds,
  getCachedJobs,
  replaceCachedJobs,
} from "@/lib/recertifications/store";
import { fetchCategoryJobs, hasSimproConfig } from "@/lib/recertifications/simpro";
import { RECURRING_CATEGORIES, isRecurringCategory } from "@/lib/recertifications/categories";

export type { RecertificationJob } from "@/lib/recertifications/types";

export async function GET(request: NextRequest) {
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
    const ignoredIds = await getIgnoredJobIds(categoryParam);
    let { active, ignored, syncedAt } = await getCachedJobs(
      categoryParam,
      ignoredIds,
    );

    if (syncedAt === null) {
      // Never synced for this category — populate the cache now so this
      // (and every subsequent) load is fast.
      const jobs = await fetchCategoryJobs(
        config.costCentreIds,
        config.quoteMatchKeywords,
      );
      await replaceCachedJobs(categoryParam, jobs);
      active = jobs.filter((j) => !ignoredIds.has(j.id));
      ignored = jobs.filter((j) => ignoredIds.has(j.id));
      syncedAt = new Date();
    }

    return NextResponse.json({
      jobs: active,
      ignoredJobs: ignored,
      total: active.length,
      syncedAt: syncedAt.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Recertifications]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
