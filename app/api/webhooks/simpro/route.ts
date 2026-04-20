// app/api/webhooks/simpro/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// SimPRO sends: { name: "Job", action: "updated", reference: { companyID: 0, jobID: 10862 } }
// All job fetching / address resolution delegates to lib/simpro/client.ts
//
// Guard logic:
//  - "created" events → always process (new job)
//  - "updated" events → only process if job was created within the last 10 min
//    (covers quote→job conversions which fire "updated", not "created")
//  - Either way: skip if an agreement already exists for this jobId
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { fetchEnrichedJob } from "@/lib/simpro/client";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";
import { Resend } from "resend";

const THRESHOLD = 20000;
const APP_URL = "https://rasvertex-2026.vercel.app";

// How recently a job must have been created to process an "updated" event.
// This filters out old jobs that get touched/visited in SimPRO.
const NEW_JOB_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY environment variable is not set");
  return new Resend(key);
}

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

    // ── Check if agreement already exists ────────────────────────────────────
    const existing = await getAgreement(String(jobId));
    if (existing) {
      console.log(`[Webhook] Job ${jobId} already has an agreement — skipping`);
      return NextResponse.json({ received: true, skipped: "already exists" });
    }

    // ── Fetch job details ─────────────────────────────────────────────────────
    console.log(`[Webhook] Fetching enriched job ${jobId}...`);
    const job = await fetchEnrichedJob(jobId, companyId);
    console.log(
      `[Webhook] Job fetched — total: $${job.totalIncGst}, address: "${job.siteAddress}", dateCreated: "${job.dateCreated}"`,
    );

    // ── Age guard for "updated" events ────────────────────────────────────────
    // "created" events are always new jobs — let them through.
    // "updated" events fire any time someone opens a job in SimPRO, including
    // old ones. Only proceed if the job itself was created within the last
    // NEW_JOB_WINDOW_MS (10 minutes), which covers quote→job conversions.
    if (action === "updated") {
      const jobCreatedAt = job.dateCreated
        ? new Date(job.dateCreated).getTime()
        : null;
      const ageMs = jobCreatedAt ? Date.now() - jobCreatedAt : Infinity;

      if (ageMs > NEW_JOB_WINDOW_MS) {
        console.log(
          `[Webhook] Skipped — "updated" event but job is ${Math.round(ageMs / 60000)}min old (limit: ${NEW_JOB_WINDOW_MS / 60000}min)`,
        );
        return NextResponse.json({
          received: true,
          skipped: "updated event on existing job",
        });
      }

      console.log(
        `[Webhook] "updated" event — job is ${Math.round(ageMs / 60000)}min old, within window — proceeding`,
      );
    }

    // ── Threshold check ───────────────────────────────────────────────────────
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

    // ── Notify via Resend ─────────────────────────────────────────────────────
    const totalExTax = job.totalIncGst / 1.1;

    try {
      const resend = getResend();
      await resend.emails.send({
        from: "RAS Admin <sam@rasvertex.com.au>",
        to: ["team@rasvertex.com.au", "amanda@rasvertex.com.au"],
        subject: `New Works Agreement — Job ${job.jobNo}`,
        html: `
          <div style="background:#f4f4f0;padding:2rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
            <div style="max-width:540px;margin:0 auto;">

              <div style="background:#0f2d4a;border-radius:10px 10px 0 0;padding:24px 32px;">
                <p style="margin:0 0 2px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">RAS Vertex</p>
                <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">New Works Agreement</p>
              </div>

              <div style="background:#fff;padding:28px 32px 24px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
                <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
                <p style="margin:0 0 0;font-size:15px;color:#444;line-height:1.6;">Please create a work order for the following job.</p>
              </div>

              <div style="background:#fff;padding:0 32px 24px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
                <table style="width:100%;border-collapse:collapse;font-size:14px;">
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:12px 0;color:#888;width:44%;">Job Number</td>
                    <td style="padding:12px 0;color:#1a1a1a;font-weight:500;">${job.jobNo}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:12px 0;color:#888;">Customer Name</td>
                    <td style="padding:12px 0;color:#1a1a1a;font-weight:500;">${job.clientName}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:12px 0;color:#888;">Site Name</td>
                    <td style="padding:12px 0;color:#1a1a1a;font-weight:500;">${job.siteName}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:12px 0;color:#888;">Site Address</td>
                    <td style="padding:12px 0;color:#1a1a1a;font-weight:500;">${job.siteAddress}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:12px 0;color:#888;">Total Value Ex Tax</td>
                    <td style="padding:12px 0;color:#1a1a1a;font-weight:500;">$${totalExTax.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                  <tr style="border-top:1px solid #f0f0f0;">
                    <td style="padding:12px 0;color:#888;">Total Inc GST</td>
                    <td style="padding:12px 0;color:#1a1a1a;font-weight:600;">$${job.totalIncGst.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  </tr>
                </table>
              </div>

              <div style="background:#fff;padding:24px 32px 32px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
                <a href="${APP_URL}/works-agreements" style="display:inline-block;background:#0f2d4a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:500;">Review in RAS Admin →</a>
              </div>

              <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
                <p style="margin:0;font-size:12px;color:#aaa;">This is an automated notification from Sammy B</p>
              </div>

            </div>
          </div>
        `,
      });
      console.log(`[Webhook] 📧 Email sent for Job ${job.id}`);
    } catch (emailErr) {
      console.error("[Webhook] Email send failed:", emailErr);
    }

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
