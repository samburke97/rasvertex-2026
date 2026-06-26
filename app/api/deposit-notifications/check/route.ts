// app/api/deposit-notifications/check/route.ts
//
// Called daily by Vercel cron at 30 22 * * * (8:30am AEST).
//
// Finds $5k–$20k jobs whose scheduled date is within 1 month and sends a
// deposit notification to amanda@rasvertex.com.au and sam@rasvertex.com.au.
// If the job date changes in SimPRO, the webhook re-upserts with the new date
// and clears notified_at, so this cron picks it up again automatically.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getPendingNotifications,
  markNotified,
  type DepositRecord,
} from "@/lib/deposit-notifications/store";

const RECIPIENTS = ["amanda@rasvertex.com.au", "sam@rasvertex.com.au"];

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function fmtAUD(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Australia/Sydney",
  });
}

function buildEmail(job: DepositRecord): string {
  const scheduledFormatted = fmtDate(job.scheduledDate);

  const rows = [
    { label: "Job Number", value: job.jobNo },
    { label: "Customer", value: job.clientName },
    { label: "Site", value: job.siteName },
    { label: "Site Address", value: job.siteAddress },
    { label: "Scheduled Date", value: scheduledFormatted },
    { label: "Total Ex GST", value: `$${fmtAUD(job.totalExTax)}` },
    { label: "Total Inc GST", value: `$${fmtAUD(job.totalIncGst)}` },
    {
      label: "20% Deposit Due",
      value: `$${fmtAUD(job.depositAmount)} ex GST`,
      highlight: true,
    },
  ];

  const rowsHtml = rows
    .map(
      ({ label, value, highlight = false }) => `
      <tr style="border-top:1px solid #f0f0f0;">
        <td style="padding:12px 0;color:${highlight ? "#0f2d4a" : "#888"};width:44%;font-weight:${highlight ? "700" : "400"};">${label}</td>
        <td style="padding:12px 0;color:${highlight ? "#0f2d4a" : "#1a1a1a"};font-weight:${highlight ? "700" : "500"};font-size:${highlight ? "16px" : "14px"};">${value}</td>
      </tr>`,
    )
    .join("");

  return `
    <div style="background:#f4f4f0;padding:2rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:540px;margin:0 auto;">

        <div style="background:#0f2d4a;border-radius:10px 10px 0 0;padding:24px 32px;">
          <p style="margin:0 0 2px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">RAS Vertex</p>
          <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">20% Deposit Required</p>
        </div>

        <div style="background:#fff;padding:28px 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
          <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
          <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">
            A job over $5,000 is scheduled for ${scheduledFormatted}. A 20% deposit must be collected before works commence.
          </p>
          <table style="width:100%;border-collapse:collapse;font-size:14px;">${rowsHtml}</table>
        </div>

        <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
          <p style="margin:0;font-size:12px;color:#aaa;">Automated notification · RAS Vertex · Job scheduled over $5,000 ex GST</p>
        </div>

      </div>
    </div>
  `;
}

export async function POST() {
  try {
    const pending = await getPendingNotifications();

    if (!pending.length) {
      console.log("[DepositCheck] No pending notifications — done");
      return NextResponse.json({ sent: 0 });
    }

    const resend = getResend();
    let sent = 0;

    for (const job of pending) {
      try {
        await resend.emails.send({
          from: "RAS Admin <sam@rasvertex.com.au>",
          to: RECIPIENTS,
          subject: `Deposit Required — ${job.jobNo} · ${job.clientName} · $${fmtAUD(job.depositAmount)} ex GST`,
          html: buildEmail(job),
        });
        await markNotified(job.jobId);
        sent++;
        console.log(
          `[DepositCheck] ✅ Sent — ${job.jobNo} ${job.clientName} (scheduled ${job.scheduledDate})`,
        );
      } catch (emailErr) {
        console.error(`[DepositCheck] Email failed for job ${job.jobId}:`, emailErr);
      }
    }

    console.log(`[DepositCheck] Done — sent: ${sent}`);
    return NextResponse.json({ sent, total: pending.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[DepositCheck] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
