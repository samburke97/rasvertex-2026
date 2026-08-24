// app/api/proposal-reports/[quoteId]/route.ts
// Draft persistence for Proposal reports — lets a rep resume an in-progress
// proposal on the same SimPRO quote number, and autosaves as they work.

import { NextRequest, NextResponse } from "next/server";
import {
  getReport,
  saveReport,
  deleteReport,
} from "@/lib/reports/proposal/store";
import type { ProposalData } from "@/lib/reports/proposal.types";

type Params = { params: Promise<{ quoteId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { quoteId } = await params;
  const report = await getReport(quoteId);
  if (!report)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ report });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { quoteId } = await params;
  const report = (await request.json()) as ProposalData;
  await saveReport(quoteId, report);
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { quoteId } = await params;
  const deleted = await deleteReport(quoteId);
  if (!deleted)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
