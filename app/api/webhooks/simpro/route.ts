// app/api/webhooks/simpro/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// SimPRO sends: { name: "Job", action: "updated", reference: { companyID: 0, jobID: 10862 } }
// All job fetching / address resolution delegates to lib/simpro/client.ts
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { fetchEnrichedJob } from "@/lib/simpro/client";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";

const THRESHOLD = 20000;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Webhook] Received:", JSON.stringify(body));

    const action: string = body.action ?? "";
    const name: string = body.name ?? "";
    const reference = body.reference ?? {};
    const jobId: number = reference.jobID;
    const companyId: number = reference.companyID ?? 0;

    const isJobEvent =
      name.toLowerCase() === "job" &&
      (action === "created" || action === "updated");

    if (!isJobEvent || !jobId) {
      console.log(`[Webhook] Skipped — name: ${name}, action: ${action}`);
      return NextResponse.json({ received: true, skipped: "not a job event" });
    }

    if (action === "created") {
      const existing = await getAgreement(String(jobId));
      if (existing) {
        return NextResponse.json({ received: true, skipped: "already exists" });
      }
    }

    console.log(`[Webhook] Fetching enriched job ${jobId}...`);
    const job = await fetchEnrichedJob(jobId, companyId);
    console.log(
      `[Webhook] Job fetched — total: $${job.totalIncGst}, address: "${job.siteAddress}"`,
    );

    if (job.totalIncGst < THRESHOLD) {
      console.log(`[Webhook] $${job.totalIncGst} below threshold — skipping`);
      return NextResponse.json({
        received: true,
        skipped: `$${job.totalIncGst} below $${THRESHOLD} threshold`,
      });
    }

    const agreement = {
      jobId: job.id,
      jobNo: job.jobNo,
      jobName: job.name,
      clientName: job.clientName,
      siteAddress: job.siteAddress,
      siteName: job.siteName,
      initialWorks: job.name,
      colourScheme: "To be advised",
      totalIncGst: job.totalIncGst,
      paymentSchedule: buildPaymentSchedule(job.totalIncGst),
      date: job.date,
      createdAt: new Date().toISOString(),
      status: "draft" as const,
      triggeredBy: "webhook" as const,
    };

    await saveAgreement(agreement);
    console.log(
      `[Webhook] ✅ Saved — Job ${job.id} $${job.totalIncGst.toLocaleString()} | Address: "${job.siteAddress}"`,
    );

    return NextResponse.json({
      received: true,
      created: true,
      jobId: job.id,
      totalIncGst: job.totalIncGst,
      siteAddress: job.siteAddress,
      schedulePayments: agreement.paymentSchedule.length,
    });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "SimPRO Works Agreement Webhook",
    threshold: `$${THRESHOLD}`,
  });
}
