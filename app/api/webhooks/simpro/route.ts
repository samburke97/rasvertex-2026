// app/api/webhooks/simpro/route.ts
// SimPRO: System Setup → API → Webhook Subscriptions
// Callback URL: https://rasvertex-2026-lt5c.vercel.app/api/webhooks/simpro
// Events: Projects → Job → Created ON, Updated ON

import { NextRequest, NextResponse } from "next/server";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";

const THRESHOLD = 20000;

export async function POST(request: NextRequest) {
  try {
    // ── Log everything raw first ──────────────────────────────────────────
    const rawBody = await request.text();
    console.log("[Webhook] RAW BODY:", rawBody);

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });
    console.log("[Webhook] ALL HEADERS:", JSON.stringify(headers));

    // ── Parse ─────────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = JSON.parse(rawBody);
    console.log("[Webhook] TOP-LEVEL KEYS:", Object.keys(body));

    // ── Figure out event name (SimPRO may use different field names) ──────
    const eventRaw: string =
      body.event ?? body.Event ?? body.eventType ?? body.EventType ?? "";
    const eventLower = eventRaw.toLowerCase();

    console.log("[Webhook] Event:", eventRaw);

    const isJobEvent =
      eventLower.includes("job") &&
      (eventLower.includes("created") || eventLower.includes("updated"));

    if (!isJobEvent) {
      console.log(
        "[Webhook] Skipped — not a job event. Full body:",
        JSON.stringify(body, null, 2),
      );
      return NextResponse.json({
        received: true,
        skipped: "not a job event",
        event: eventRaw,
      });
    }

    // ── Extract job data (SimPRO may nest differently) ────────────────────
    const jobData =
      body.data ?? body.Data ?? body.payload ?? body.Payload ?? body;
    const jobId = String(
      jobData.ID ?? jobData.Id ?? jobData.JobID ?? "unknown",
    );

    console.log("[Webhook] Job data keys:", Object.keys(jobData));
    console.log("[Webhook] Job ID:", jobId);
    console.log("[Webhook] Full job data:", JSON.stringify(jobData, null, 2));

    const totalIncGst =
      jobData.Total?.IncTax ??
      jobData.TotalIncTax ??
      jobData.TotalInc ??
      jobData.Total?.IncludingTax ??
      0;

    console.log(`[Webhook] Total Inc GST: $${totalIncGst}`);

    if (totalIncGst < THRESHOLD) {
      return NextResponse.json({
        received: true,
        skipped: `$${totalIncGst} below $${THRESHOLD} threshold`,
      });
    }

    const isUpdate = eventLower.includes("updated");

    if (!isUpdate) {
      const existing = await getAgreement(jobId);
      if (existing) {
        console.log(`[Webhook] Already exists for job ${jobId}`);
        return NextResponse.json({ received: true, skipped: "already exists" });
      }
    }

    const site = jobData.Site ?? jobData.site ?? null;
    const siteAddress = site
      ? [site.Address, site.City, site.State, site.PostCode]
          .filter(Boolean)
          .join(", ")
      : "";

    const customer = jobData.Customer ?? jobData.customer ?? null;
    const clientName =
      customer?.CompanyName?.trim() ||
      [customer?.GivenName, customer?.FamilyName].filter(Boolean).join(" ") ||
      "Client";

    const date = new Date(jobData.DateIssued || Date.now()).toLocaleDateString(
      "en-AU",
    );

    const agreement = {
      jobId,
      jobNo: jobData.No ? `#${jobData.No}` : `#${jobId}`,
      jobName: jobData.Name?.trim() || `Job ${jobId}`,
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
      `[Webhook] Saved — Job ${jobId} $${totalIncGst.toLocaleString()}`,
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

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "SimPRO Works Agreement Webhook",
    threshold: `$${THRESHOLD}`,
  });
}
