// app/api/webhooks/simpro/route.ts
// SimPRO sends a lightweight reference payload — we then fetch full job details.

import { NextRequest, NextResponse } from "next/server";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";

const THRESHOLD = 20000;
const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

// ── Fetch full job details from SimPRO API ────────────────────────────────
async function fetchJob(companyId: number, jobId: number) {
  const res = await fetch(
    `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${jobId}`,
    {
      headers: {
        Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    },
  );
  if (!res.ok) throw new Error(`SimPRO job fetch failed: ${res.status}`);
  return res.json();
}

// ── Fetch site address ────────────────────────────────────────────────────
async function fetchSiteAddress(
  companyId: number,
  siteId: number,
): Promise<string> {
  try {
    const res = await fetch(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/sites/${siteId}`,
      {
        headers: {
          Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );
    if (!res.ok) return "";
    const site = await res.json();
    return [site.Address, site.City, site.State, site.PostCode]
      .filter(Boolean)
      .join(", ");
  } catch {
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Webhook] Received:", JSON.stringify(body));

    // ── SimPRO payload shape ──────────────────────────────────────────────
    // { ID: "job.updated", name: "Job", action: "updated",
    //   reference: { companyID: 0, jobID: 10862 }, date_triggered: "..." }

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

    console.log(`[Webhook] Job ${jobId} — ${action}. Fetching full details...`);

    // ── Fetch full job from SimPRO ────────────────────────────────────────
    const job = await fetchJob(companyId, jobId);
    console.log("[Webhook] Job fetched:", JSON.stringify(job));

    const totalIncGst: number = job.Total?.IncTax ?? 0;
    console.log(`[Webhook] Total Inc GST: $${totalIncGst}`);

    if (totalIncGst < THRESHOLD) {
      console.log(`[Webhook] $${totalIncGst} below threshold — skipping`);
      return NextResponse.json({
        received: true,
        skipped: `$${totalIncGst} below $${THRESHOLD} threshold`,
      });
    }

    const jobIdStr = String(jobId);

    // Don't duplicate on create
    if (action === "created") {
      const existing = await getAgreement(jobIdStr);
      if (existing) {
        console.log(`[Webhook] Agreement already exists for job ${jobIdStr}`);
        return NextResponse.json({ received: true, skipped: "already exists" });
      }
    }

    // ── Build agreement data ──────────────────────────────────────────────
    const customer = job.Customer ?? null;
    const clientName =
      customer?.CompanyName?.trim() ||
      [customer?.GivenName, customer?.FamilyName].filter(Boolean).join(" ") ||
      "Client";

    const siteAddress = job.Site?.ID
      ? await fetchSiteAddress(companyId, job.Site.ID)
      : "";

    const date = new Date(job.DateIssued || Date.now()).toLocaleDateString(
      "en-AU",
    );

    const agreement = {
      jobId: jobIdStr,
      jobNo: job.No ? `#${job.No}` : `#${jobId}`,
      jobName: job.Name?.trim() || `Job ${jobId}`,
      clientName,
      siteAddress,
      siteName: job.Site?.Name?.trim() || clientName,
      initialWorks: job.Name?.trim() || "",
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
      `[Webhook] ✅ Saved — Job ${jobIdStr} $${totalIncGst.toLocaleString()}`,
    );

    return NextResponse.json({
      received: true,
      created: true,
      jobId: jobIdStr,
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
