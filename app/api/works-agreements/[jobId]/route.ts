// app/api/works-agreements/[jobId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  getAgreement,
  updateAgreement,
  deleteAgreement,
} from "@/lib/reports/works-agreement/store";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";

type Params = { params: Promise<{ jobId: string }> };

// ── GET: fetch single agreement ───────────────────────────────────────────
export async function GET(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const agreement = getAgreement(jobId);
  if (!agreement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ agreement });
}

// ── PATCH: update agreement fields (also recalculates schedule if total changes) ─
export async function PATCH(request: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const updates = await request.json();

  // If total is being updated, recalculate schedule
  if (updates.totalIncGst !== undefined) {
    updates.paymentSchedule = buildPaymentSchedule(Number(updates.totalIncGst));
  }

  const updated = updateAgreement(jobId, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ agreement: updated });
}

// ── DELETE: remove agreement ──────────────────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { jobId } = await params;
  const deleted = deleteAgreement(jobId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
