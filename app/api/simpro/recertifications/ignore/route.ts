// app/api/simpro/recertifications/ignore/route.ts
// POST { jobId, category } — hide a job from the recurring-jobs list
// DELETE { jobId, category } — restore a hidden job

import { NextRequest, NextResponse } from "next/server";
import { ignoreJob, restoreJob } from "@/lib/recertifications/store";
import { isRecurringCategory } from "@/lib/recertifications/categories";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const jobId = Number(body.jobId);
  if (!jobId)
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  if (!isRecurringCategory(body.category))
    return NextResponse.json({ error: "Missing or invalid category" }, { status: 400 });
  await ignoreJob(jobId, body.category, body.reason);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const jobId = Number(body.jobId);
  if (!jobId)
    return NextResponse.json({ error: "Missing jobId" }, { status: 400 });
  if (!isRecurringCategory(body.category))
    return NextResponse.json({ error: "Missing or invalid category" }, { status: 400 });
  await restoreJob(jobId, body.category);
  return NextResponse.json({ ok: true });
}
