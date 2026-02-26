// app/api/simpro/jobs/[jobId]/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Thin wrapper — all logic lives in lib/simpro/client.ts
// Returns EnrichedJob shape (includes resolved _siteAddress compatible field).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { fetchEnrichedJob } from "@/lib/simpro/client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const parsed = parseInt(jobId, 10);
  if (!jobId || isNaN(parsed) || parsed <= 0) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  try {
    const job = await fetchEnrichedJob(parsed);
    return NextResponse.json(job);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SimPRO job ${jobId}]`, message);

    if (message.includes("configuration missing")) {
      return NextResponse.json(
        { error: "SimPRO configuration missing" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch job details", details: message, jobId },
      { status: 500 },
    );
  }
}
