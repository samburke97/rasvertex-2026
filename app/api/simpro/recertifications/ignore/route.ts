// app/api/simpro/recertifications/ignore/route.ts
// POST { jobId } — hide a job from the recertifications list
// DELETE { jobId } — restore a hidden job

import { NextRequest, NextResponse } from "next/server";
import { ignoreJob, restoreJob } from "@/lib/recertifications/store";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const jobId = Number(body.jobId);
  if (!jobId)
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  await ignoreJob(jobId, body.reason);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const jobId = Number(body.jobId);
  if (!jobId)
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  await restoreJob(jobId);
  return NextResponse.json({ ok: true });
}
