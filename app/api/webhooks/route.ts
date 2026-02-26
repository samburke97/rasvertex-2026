// app/api/webhooks/simpro/route.ts
// Registered in SimPRO: System Setup → API → Webhook Subscriptions
// Event: Projects → Job → Created (ON)
// Callback URL: https://your-domain.com/api/webhooks/simpro

import { NextRequest, NextResponse } from "next/server";
import type { SimproWebhookPayload } from "@/lib/reports/works-agreement/types";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";

const WORKS_AGREEMENT_THRESHOLD = 20000; // Jobs >= this value trigger auto-creation
const WEBHOOK_SECRET = process.env.SIMPRO_WEBHOOK_SECRET; // Optional signature verification

export async function POST(request: NextRequest) {
  try {
    // ── 1. Optional: verify SimPRO webhook signature ──────────────────────
    if (WEBHOOK_SECRET) {
      const signature = request.headers.get("x-simpro-signature");
      if (!signature || signature !== WEBHOOK_SECRET) {
        console.warn("[Webhook] Invalid signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body: SimproWebhookPayload = await request.json();
    console.log(
      "[Webhook] Received SimPRO event:",
      body.event,
      "Job ID:",
      body.data?.ID,
    );

    // ── 2. Only process job events ────────────────────────────────────────
    const isJobEvent =
      body.event === "job.created" ||
      body.event === "job.updated" ||
      // SimPRO sometimes sends just the event name without prefix
      body.event === "Job Created" ||
      body.event === "Job Updated";

    if (!isJobEvent || !body.data?.ID) {
      return NextResponse.json({ received: true, skipped: "not a job event" });
    }

    const jobData = body.data;
    const totalIncGst = jobData.Total?.IncTax ?? 0;

    // ── 3. Only proceed if job is >= threshold ────────────────────────────
    if (totalIncGst < WORKS_AGREEMENT_THRESHOLD) {
      console.log(
        `[Webhook] Job ${jobData.ID} total $${totalIncGst} — below threshold, skipping`,
      );
      return NextResponse.json({
        received: true,
        skipped: `Total $${totalIncGst} is below $${WORKS_AGREEMENT_THRESHOLD} threshold`,
      });
    }

    const jobId = String(jobData.ID);

    // ── 4. Don't duplicate — if one already exists for this job, skip ─────
    const existing = getAgreement(jobId);
    if (existing && body.event !== "job.updated") {
      console.log(`[Webhook] Agreement already exists for job ${jobId}`);
      return NextResponse.json({
        received: true,
        skipped: "agreement already exists",
      });
    }

    // ── 5. Build the site address ─────────────────────────────────────────
    const site = jobData.Site;
    const siteAddress = site
      ? [site.Address, site.City, site.State, site.PostCode]
          .filter(Boolean)
          .join(", ")
      : "";

    // ── 6. Build client name ──────────────────────────────────────────────
    const customer = jobData.Customer;
    const clientName =
      customer?.CompanyName?.trim() ||
      [customer?.GivenName, customer?.FamilyName].filter(Boolean).join(" ") ||
      "Client";

    // ── 7. Format date ────────────────────────────────────────────────────
    const rawDate = jobData.DateIssued || new Date().toISOString();
    const date = new Date(rawDate).toLocaleDateString("en-AU");

    // ── 8. Create the works agreement ─────────────────────────────────────
    const agreement = {
      jobId,
      jobNo: jobData.No ? `#${jobData.No}` : `#${jobData.ID}`,
      jobName: jobData.Name?.trim() || `Job ${jobData.ID}`,
      clientName,
      siteAddress,
      siteName: site?.Name?.trim() || clientName,
      initialWorks: jobData.Name?.trim() || "",
      colourScheme: "To be advised",
      totalIncGst,
      paymentSchedule: buildPaymentSchedule(totalIncGst),
      date,
      createdAt: new Date().toISOString(),
      status: "draft" as const,
      triggeredBy: "webhook" as const,
    };

    saveAgreement(agreement);

    console.log(
      `[Webhook] ✅ Works agreement created for Job ${jobId} — $${totalIncGst.toLocaleString()}`,
    );

    return NextResponse.json({
      received: true,
      created: true,
      jobId,
      totalIncGst,
      paymentCount: agreement.paymentSchedule.length,
    });
  } catch (error) {
    console.error("[Webhook] Error processing SimPRO webhook:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// SimPRO may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "SimPRO Works Agreement Webhook",
  });
}
