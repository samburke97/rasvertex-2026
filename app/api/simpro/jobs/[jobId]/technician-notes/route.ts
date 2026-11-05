// app/api/simpro/jobs/[jobId]/technician-notes/route.ts
// The technician notes on a job (see fetchTechnicianNotes), oldest first.

import { NextRequest, NextResponse } from "next/server";
import { fetchTechnicianNotes } from "@/lib/simpro/client";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const parsed = parseInt(jobId, 10);
  if (!(parsed > 0)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  try {
    return NextResponse.json({ notes: await fetchTechnicianNotes(parsed) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[SimPRO job ${jobId} technician notes]`, message);
    return NextResponse.json({ error: "Failed to fetch the job's technician notes", details: message }, { status: 500 });
  }
}
