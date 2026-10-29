// app/api/simpro/jobs/[jobId]/scope/route.ts
// The job's scope of works for the Job Overview report: the description and
// line items of the quote it came from (see fetchJobScope).

import { NextRequest, NextResponse } from "next/server";
import { fetchJobScope } from "@/lib/simpro/client";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = parseInt(jobId, 10);
  if (!(parsed > 0)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  try {
    return NextResponse.json(await fetchJobScope(parsed));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SimPRO job ${jobId} scope]`, message);
    return NextResponse.json({ error: "Failed to fetch the job's scope", details: message }, { status: 500 });
  }
}
