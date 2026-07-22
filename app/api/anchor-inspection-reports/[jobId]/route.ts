// app/api/anchor-inspection-reports/[jobId]/route.ts
// Draft persistence for Anchor Inspection reports — lets a tech resume an
// in-progress report on the same job number, and autosaves as they work.

import { NextRequest, NextResponse } from "next/server";
import {
  getReport,
  saveReport,
  deleteReport,
} from "@/lib/reports/anchor-inspection/store";
import type { AnchorReportData } from "@/lib/reports/anchor.types";

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
  const report = (await request.json()) as AnchorReportData;
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
