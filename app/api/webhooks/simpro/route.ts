// app/api/webhooks/simpro/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// SimPRO webhook — fires when a Job Schedule is created.
//
// Expected payload:
//   { name: "Job schedule", action: "created", reference: { companyID: 0, scheduleID: 1234 } }
//
// Flow:
//   1. Receive Job schedule → created
//   2. Fetch schedule → parse jobID from Reference field ("jobID-costCenterID")
//   3. Fetch job → confirm ConvertedFrom.Type === "Quote"
//   4. Duplicate guard — only fire once per job
//   5. Check thresholds (ex GST):
//      < $5,000    → skip
//      $5k–$19,999 → 20% deposit notification
//      $20,000+    → works agreement + email
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { fetchEnrichedJob, simproGet } from "@/lib/simpro/client";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";
import { Resend } from "resend";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const THRESHOLD_DEPOSIT = 5000; // ex GST
const THRESHOLD_WORKS_AGREEMENT = 20000; // ex GST
const APP_URL = "https://rasvertex-2026.vercel.app";

const DEPOSIT_RECIPIENTS: string[] = [
  "team@rasvertex.com.au",
  "amanda@rasvertex.com.au",
  "admin@rasvertex.com.au",
];

const WORKS_AGREEMENT_RECIPIENTS: string[] = [
  "team@rasvertex.com.au",
  "amanda@rasvertex.com.au",
];

// ── Resend ────────────────────────────────────────────────────────────────────

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is not set");
  return new Resend(key);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAUD(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function emailShell(
  headerText: string,
  bodyHtml: string,
  footerText: string,
): string {
  return `
    <div style="background:#f4f4f0;padding:2rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:540px;margin:0 auto;">

        <div style="background:#0f2d4a;border-radius:10px 10px 0 0;padding:24px 32px;">
          <p style="margin:0 0 2px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">RAS Vertex</p>
          <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">${headerText}</p>
        </div>

        ${bodyHtml}

        <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
          <p style="margin:0;font-size:12px;color:#aaa;">${footerText}</p>
        </div>

      </div>
    </div>
  `;
}

interface TableRow {
  label: string;
  value: string;
  highlight?: boolean;
}

function jobTable(rows: TableRow[]): string {
  const rowsHtml = rows
    .map(
      ({ label, value, highlight = false }) => `
      <tr style="border-top:1px solid #f0f0f0;">
        <td style="padding:12px 0;color:${highlight ? "#0f2d4a" : "#888"};width:44%;font-weight:${highlight ? "700" : "400"};">${label}</td>
        <td style="padding:12px 0;color:${highlight ? "#0f2d4a" : "#1a1a1a"};font-weight:${highlight ? "700" : "500"};font-size:${highlight ? "16px" : "14px"};">${value}</td>
      </tr>
    `,
    )
    .join("");

  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">${rowsHtml}</table>`;
}

// ── Schedule fetcher ──────────────────────────────────────────────────────────

interface SimproSchedule {
  ID: number;
  Type: string;
  Reference: string; // "jobID-costCenterID" for job schedules
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

// Parse jobID from Reference field ("jobID-costCenterID")
function parseJobIdFromReference(reference: string): number | null {
  const parts = reference.split("-");
  const parsed = parseInt(parts[0], 10);
  return isNaN(parsed) ? null : parsed;
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Webhook] Received:", JSON.stringify(body));

    const action: string = body.action ?? "";
    const name: string = body.name ?? "";
    const reference = body.reference ?? {};
    const scheduleId: number = reference.scheduleID;
    const companyId: number = reference.companyID ?? 0;

    // ── Only process Job schedule → created ───────────────────────────────────
    const isJobScheduleCreated =
      name.toLowerCase() === "job schedule" && action === "created";

    if (!isJobScheduleCreated || !scheduleId) {
      console.log(`[Webhook] Skipped — name: "${name}", action: "${action}"`);
      return NextResponse.json({
        received: true,
        skipped: "not a job schedule created event",
      });
    }

    // ── Fetch schedule → extract jobID ────────────────────────────────────────
    console.log(`[Webhook] Fetching schedule ${scheduleId}...`);
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
        skipped: "could not parse jobID from schedule reference",
      });
    }

    console.log(`[Webhook] Schedule ${scheduleId} → Job ${jobId}`);

    // ── Duplicate guard — only fire once per job ──────────────────────────────
    const existing = await getAgreement(String(jobId));
    if (existing) {
      console.log(`[Webhook] Job ${jobId} already processed — skipping`);
      return NextResponse.json({
        received: true,
        skipped: "already processed",
      });
    }

    // ── Fetch job ─────────────────────────────────────────────────────────────
    console.log(`[Webhook] Fetching job ${jobId}...`);
    const job = await fetchEnrichedJob(jobId, companyId);
    const totalExTax = job.totalIncGst / 1.1;

    console.log(
      `[Webhook] Job ${jobId} — exTax: $${totalExTax.toFixed(2)}, client: "${job.clientName}"`,
    );

    // ── Must be converted from a quote ────────────────────────────────────────
    const rawJob = await simproGet<any>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${jobId}`,
    );

    if (rawJob.ConvertedFrom?.Type !== "Quote") {
      console.log(
        `[Webhook] Job ${jobId} not converted from a quote — skipping`,
      );
      return NextResponse.json({
        received: true,
        skipped: "job not converted from a quote",
      });
    }

    // ── Below deposit threshold → skip ────────────────────────────────────────
    if (totalExTax < THRESHOLD_DEPOSIT) {
      console.log(
        `[Webhook] $${totalExTax.toFixed(2)} ex GST below $${THRESHOLD_DEPOSIT} — skipping`,
      );
      return NextResponse.json({
        received: true,
        skipped: `$${totalExTax.toFixed(2)} ex GST below threshold`,
      });
    }

    const resend = getResend();

    // ── $20,000+ ex GST → Works Agreement ────────────────────────────────────
    if (totalExTax >= THRESHOLD_WORKS_AGREEMENT) {
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
      console.log(`[Webhook] ✅ Works agreement saved — Job ${jobId}`);

      try {
        await resend.emails.send({
          from: "RAS Admin <sam@rasvertex.com.au>",
          to: WORKS_AGREEMENT_RECIPIENTS,
          subject: `New Works Agreement — ${job.jobNo} · ${job.clientName}`,
          html: emailShell(
            "New Works Agreement",
            `
              <div style="background:#fff;padding:28px 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
                <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
                <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">
                  A job over $20,000 has been scheduled. Please create a works agreement.
                </p>
                ${jobTable([
                  { label: "Job Number", value: job.jobNo },
                  { label: "Customer", value: job.clientName },
                  { label: "Site", value: job.siteName },
                  { label: "Site Address", value: job.siteAddress },
                  { label: "Scheduled", value: schedule.Date ?? "—" },
                  { label: "Total Ex GST", value: `$${fmtAUD(totalExTax)}` },
                  {
                    label: "Total Inc GST",
                    value: `$${fmtAUD(job.totalIncGst)}`,
                  },
                ])}
              </div>
              <div style="background:#fff;padding:20px 32px 32px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
                <a href="${APP_URL}/works-agreements" style="display:inline-block;background:#0f2d4a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:500;">Review in RAS Vertex →</a>
              </div>
            `,
            "Automated notification · RAS Vertex · Job scheduled over $20,000 ex GST",
          ),
        });
        console.log(`[Webhook] 📧 Works agreement email sent — Job ${jobId}`);
      } catch (emailErr) {
        console.error("[Webhook] Works agreement email failed:", emailErr);
      }

      return NextResponse.json({
        received: true,
        type: "works-agreement",
        jobId: job.jobNo,
        totalExTax,
      });
    }

    // ── $5,000–$19,999 ex GST → Deposit Notification ─────────────────────────
    const depositAmount = Math.round(totalExTax * 0.2 * 100) / 100;

    // Store a record so subsequent schedule entries don't re-trigger
    await saveAgreement({
      jobId: job.id,
      jobNo: job.jobNo,
      jobName: job.name,
      clientName: job.clientName,
      siteAddress: job.siteAddress,
      siteName: job.siteName,
      initialWorks: job.name,
      colourScheme: "",
      totalIncGst: job.totalIncGst,
      paymentSchedule: [],
      date: job.date,
      createdAt: new Date().toISOString(),
      status: "draft" as const,
      triggeredBy: "webhook" as const,
    });

    try {
      await resend.emails.send({
        from: "RAS Admin <sam@rasvertex.com.au>",
        to: DEPOSIT_RECIPIENTS,
        subject: `Deposit Required — ${job.jobNo} · ${job.clientName} · $${fmtAUD(depositAmount)} ex GST`,
        html: emailShell(
          "20% Deposit Required",
          `
            <div style="background:#fff;padding:28px 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
              <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
              <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">
                A job over $5,000 has been scheduled. A 20% deposit must be collected before works commence.
              </p>
              ${jobTable([
                { label: "Job Number", value: job.jobNo },
                { label: "Customer", value: job.clientName },
                { label: "Site", value: job.siteName },
                { label: "Site Address", value: job.siteAddress },
                { label: "Scheduled", value: schedule.Date ?? "—" },
                { label: "Total Ex GST", value: `$${fmtAUD(totalExTax)}` },
                {
                  label: "Total Inc GST",
                  value: `$${fmtAUD(job.totalIncGst)}`,
                },
                {
                  label: "20% Deposit Due",
                  value: `$${fmtAUD(depositAmount)} ex GST`,
                  highlight: true,
                },
              ])}
            </div>
          `,
          "Automated notification · RAS Vertex · Job scheduled over $5,000 ex GST",
        ),
      });
      console.log(`[Webhook] 📧 Deposit notification sent — Job ${jobId}`);
    } catch (emailErr) {
      console.error("[Webhook] Deposit email failed:", emailErr);
    }

    return NextResponse.json({
      received: true,
      type: "deposit-notification",
      jobId: job.jobNo,
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
    endpoint: "SimPRO Job Schedule Created Webhook",
    thresholdDeposit: `$${THRESHOLD_DEPOSIT} ex GST`,
    thresholdWorksAgreement: `$${THRESHOLD_WORKS_AGREEMENT} ex GST`,
  });
}
