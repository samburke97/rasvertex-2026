// app/api/webhooks/simpro/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Trigger: Job schedule → created → deposit notification ($5k–$19,999 ex GST)
//          Email is scheduled 1 month before the job's scheduled date
//          (sent immediately if within 1 month)
//
// Requires ConvertedFrom.Type === "Quote"
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { fetchEnrichedJob, simproGet } from "@/lib/simpro/client";
import { upsertDepositNotification } from "@/lib/deposit-notifications/store";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const THRESHOLD_DEPOSIT = 5000; // ex GST
const THRESHOLD_DEPOSIT_MAX = 20000; // ex GST — jobs at or above this are out of range

// ── Schedule fetcher ──────────────────────────────────────────────────────────

interface SimproSchedule {
  ID: number;
  Type: string;
  Reference: string;
  Staff?: { ID: number; Name: string };
  Date?: string;
  TotalHours?: number;
}

async function fetchSchedule(
  scheduleId: number,
  companyId = 0,
): Promise<SimproSchedule> {
  return simproGet<SimproSchedule>(
    `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/schedules/${scheduleId}`,
  );
}

function parseJobIdFromReference(reference: string): number | null {
  const parts = reference.split("-");
  const parsed = parseInt(parts[0], 10);
  return isNaN(parsed) ? null : parsed;
}

// ── Shared: fetch job + check quote conversion ────────────────────────────────

async function fetchJobAndValidate(
  jobId: number,
  companyId: number,
): Promise<{
  job: Awaited<ReturnType<typeof fetchEnrichedJob>>;
  totalExTax: number;
  rawJob: any;
} | null> {
  const job = await fetchEnrichedJob(jobId, companyId);
  const totalExTax = job.totalIncGst / 1.1;

  const rawJob = await simproGet<any>(
    `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${jobId}`,
  );

  if (rawJob.ConvertedFrom?.Type !== "Quote") {
    console.log(`[Webhook] Job ${jobId} not converted from a quote — skipping`);
    return null;
  }

  return { job, totalExTax, rawJob };
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Webhook] Received:", JSON.stringify(body));

    const action: string = body.action ?? "";
    const name: string = body.name ?? "";
    const reference = body.reference ?? {};
    const companyId: number = reference.companyID ?? 0;

    const isJobScheduleCreated =
      name.toLowerCase() === "job schedule" && action === "created";

    if (!isJobScheduleCreated) {
      console.log(`[Webhook] Skipped — name: "${name}", action: "${action}"`);
      return NextResponse.json({
        received: true,
        skipped: "not a handled event",
      });
    }

    // ── Job schedule → created: Deposit Notification ($5k–$19,999) ───────────
    // Email fires 1 month before the scheduled date (immediately if within 1 month).
    // The cron at /api/deposit-notifications/check handles the actual send.
    const scheduleId: number = reference.scheduleID;
    if (!scheduleId)
      return NextResponse.json({ received: true, skipped: "no scheduleID" });

    console.log(
      `[Webhook] Job schedule created — fetching schedule ${scheduleId}...`,
    );
    const schedule = await fetchSchedule(scheduleId, companyId);

    if (schedule.Type !== "job") {
      console.log(`[Webhook] Schedule type is "${schedule.Type}" — skipping`);
      return NextResponse.json({
        received: true,
        skipped: `schedule type is ${schedule.Type}`,
      });
    }

    const jobId = parseJobIdFromReference(schedule.Reference);
    if (!jobId) {
      console.log(
        `[Webhook] Could not parse jobID from reference: "${schedule.Reference}"`,
      );
      return NextResponse.json({
        received: true,
        skipped: "could not parse jobID",
      });
    }

    console.log(`[Webhook] Schedule ${scheduleId} → Job ${jobId}`);

    if (!schedule.Date) {
      console.log(`[Webhook] Schedule ${scheduleId} has no date — skipping`);
      return NextResponse.json({ received: true, skipped: "no schedule date" });
    }

    const result = await fetchJobAndValidate(jobId, companyId);
    if (!result)
      return NextResponse.json({
        received: true,
        skipped: "not converted from quote",
      });

    const { job, totalExTax } = result;

    if (totalExTax < THRESHOLD_DEPOSIT || totalExTax >= THRESHOLD_DEPOSIT_MAX) {
      console.log(
        `[Webhook] $${totalExTax.toFixed(2)} ex GST outside deposit range — skipping`,
      );
      return NextResponse.json({
        received: true,
        skipped: "outside deposit range",
      });
    }

    const depositAmount = Math.round(totalExTax * 0.2 * 100) / 100;
    const scheduledDate = schedule.Date.split("T")[0]; // normalise to YYYY-MM-DD

    await upsertDepositNotification({
      jobId: Number(job.id),
      jobNo: job.jobNo,
      jobName: job.name,
      clientName: job.clientName,
      siteName: job.siteName,
      siteAddress: job.siteAddress,
      scheduledDate,
      totalExTax,
      totalIncGst: job.totalIncGst,
      depositAmount,
    });

    console.log(
      `[Webhook] ✅ Deposit notification queued — Job ${job.jobNo} scheduled ${scheduledDate}`,
    );

    return NextResponse.json({
      received: true,
      type: "deposit-notification-queued",
      jobId: job.jobNo,
      scheduledDate,
      totalExTax,
      depositAmount,
    });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// ── GET — health check ────────────────────────────────────────────────────────

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "SimPRO Webhook — Job Schedule Created",
    thresholdDeposit: `$${THRESHOLD_DEPOSIT} ex GST`,
    thresholdDepositMax: `$${THRESHOLD_DEPOSIT_MAX} ex GST`,
  });
}
