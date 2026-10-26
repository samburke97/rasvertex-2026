// app/api/inspection-reports/[jobId]/route.ts
// Draft persistence for Inspection reports — loading the same job number
// resumes the draft (photos, label fixes, map pins, settings).
// Mirrors app/api/condition-reports/[jobId]/route.ts.

import { NextRequest, NextResponse } from "next/server";
import {
  getReport,
  saveReport,
  deleteReport,
} from "@/lib/reports/inspection/store";
import { isInspectionData } from "@/lib/reports/inspection/types";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const report = await getReport(jobId);
  if (!report)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ report });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const report = await request.json();
  if (!isInspectionData(report))
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  await saveReport(jobId, report);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const deleted = await deleteReport(jobId);
  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
