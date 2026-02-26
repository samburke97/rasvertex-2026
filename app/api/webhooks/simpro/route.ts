// app/api/webhooks/simpro/route.ts
// SimPRO: System Setup → API → Webhook Subscriptions
// Callback URL: https://rasvertex-2026-lt5c.vercel.app/api/webhooks/simpro
// Events: Projects → Job → Created ON, Updated ON

import { NextRequest, NextResponse } from "next/server";
import type { SimproWebhookPayload } from "@/lib/reports/works-agreement/types";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";

const THRESHOLD = 20000;
const WEBHOOK_SECRET = process.env.SIMPRO_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  try {
    // ── Optional signature check ──────────────────────────────────────────
    if (WEBHOOK_SECRET) {
      const sig = request.headers.get("x-simpro-signature");
      if (!sig || sig !== WEBHOOK_SECRET) {
        console.warn("[Webhook] Invalid signature");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const body: SimproWebhookPayload = await request.json();
    console.log("[Webhook] Event:", body.event, "| Job:", body.data?.ID);

    // ── Only handle job events ────────────────────────────────────────────
    const eventLower = body.event?.toLowerCase() ?? "";
    const isJobEvent =
      eventLower.includes("job") &&
      (eventLower.includes("created") || eventLower.includes("updated"));

    if (!isJobEvent || !body.data?.ID) {
      return NextResponse.json({ received: true, skipped: "not a job event" });
    }

    const jobData = body.data;
    const totalIncGst = jobData.Total?.IncTax ?? 0;

    // ── Below threshold — skip ────────────────────────────────────────────
    if (totalIncGst < THRESHOLD) {
      console.log(
        `[Webhook] Job ${jobData.ID} — $${totalIncGst} below threshold`,
      );
      return NextResponse.json({
        received: true,
        skipped: `$${totalIncGst} below $${THRESHOLD} threshold`,
      });
    }

    const jobId = String(jobData.ID);
    const isUpdate = eventLower.includes("updated");

    // ── Don't duplicate on create ─────────────────────────────────────────
    if (!isUpdate) {
      const existing = await getAgreement(jobId);
      if (existing) {
        console.log(`[Webhook] Agreement already exists for job ${jobId}`);
        return NextResponse.json({ received: true, skipped: "already exists" });
      }
    }

    // ── Build data ────────────────────────────────────────────────────────
    const site = jobData.Site;
    const siteAddress = site
      ? [site.Address, site.City, site.State, site.PostCode]
          .filter(Boolean)
          .join(", ")
      : "";

    const customer = jobData.Customer;
    const clientName =
      customer?.CompanyName?.trim() ||
      [customer?.GivenName, customer?.FamilyName].filter(Boolean).join(" ") ||
      "Client";

    const date = new Date(jobData.DateIssued || Date.now()).toLocaleDateString(
      "en-AU",
    );

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

    await saveAgreement(agreement);

    console.log(
      `[Webhook] ✅ Agreement saved — Job ${jobId} $${totalIncGst.toLocaleString()}`,
    );

    return NextResponse.json({
      received: true,
      created: true,
      jobId,
      totalIncGst,
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

// SimPRO sends a GET to verify the endpoint is alive
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "SimPRO Works Agreement Webhook",
    threshold: `$${20000}`,
  });
}
