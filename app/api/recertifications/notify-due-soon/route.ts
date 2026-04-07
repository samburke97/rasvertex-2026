// app/api/recertifications/notify-due-soon/route.ts
//
// Called daily by Vercel cron (see vercel.json).
// Only fires for jobs newly entering the 0-28 day window.
// Excludes overdue. Excludes already-quoted. Excludes already-notified.
// No email sent if nothing new.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getCachedJobs,
  getRecertQuoteMap,
  getIgnoredJobIds,
  getNotifiedKeys,
  markAsNotified,
} from "@/lib/recertifications/store";
import type { RecertificationJob } from "@/app/api/simpro/recertifications/route";

const APP_URL = "https://rasvertex-2026-lt5c.vercel.app";
const TO = ["admin@rasvertex.com.au", "sam@rasvertex.com.au"];
const DIGEST_LIMIT = 3;

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function jobBlock(job: RecertificationJob): string {
  return `
    <div style="border-top:1px solid #f0f0f0;padding:16px 0 12px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <p style="margin:0;font-size:14px;font-weight:500;color:#1a1a1a;">${job.customer}</p>
        <span style="background:#fff7ed;color:#9a3412;font-size:11px;font-weight:600;padding:2px 8px;border-radius:4px;border:1px solid #fed7aa;letter-spacing:0.04em;text-transform:uppercase;">Due soon</span>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="color:#888;padding:3px 0;width:36%;">Site</td>
          <td style="color:#1a1a1a;padding:3px 0;">${job.site}</td>
        </tr>
        <tr>
          <td style="color:#888;padding:3px 0;">Due date</td>
          <td style="color:#1a1a1a;padding:3px 0;">${formatDate(job.nextDueDate)} <span style="color:#888;">(${job.daysUntilDue} days)</span></td>
        </tr>
        <tr>
          <td style="color:#888;padding:3px 0;">Last job value</td>
          <td style="color:#1a1a1a;padding:3px 0;">$${job.totalExTax.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ex GST</td>
        </tr>
      </table>
    </div>`;
}

function buildHtml(displayed: RecertificationJob[], remainder: number): string {
  const jobBlocks = displayed.map(jobBlock).join("");
  const moreRow =
    remainder > 0
      ? `<div style="border-top:1px solid #f0f0f0;padding:16px 0 20px;">
           <p style="margin:0;font-size:14px;color:#888;">+ ${remainder} more — <a href="${APP_URL}/recertifications" style="color:#0f2d4a;text-decoration:underline;">view all in RAS Admin</a></p>
         </div>`
      : "";

  return `
    <div style="background:#f4f4f0;padding:2rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px;margin:0 auto;">

        <div style="background:#0f2d4a;border-radius:10px 10px 0 0;padding:24px 32px;">
          <p style="margin:0 0 2px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">RAS Vertex</p>
          <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">Anchor Recertifications</p>
        </div>

        <div style="background:#fff;padding:28px 32px 20px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
          <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Caro,</p>
          <p style="margin:0;font-size:15px;color:#444;line-height:1.6;">The following anchor recertifications are due within 28 days and need your attention.</p>
        </div>

        <div style="background:#fff;padding:0 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
          ${jobBlocks}
          ${moreRow}
        </div>

        <div style="background:#fff;padding:8px 32px 28px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
          <a href="${APP_URL}/recertifications" style="display:inline-block;background:#0f2d4a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:500;">View all in RAS Admin →</a>
        </div>

        <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
          <p style="margin:0;font-size:12px;color:#aaa;">This is an automated notification from Sammy B</p>
        </div>

      </div>
    </div>`;
}

function buildResults(
  rawJobs: any[],
  quoteMap: Map<string, any>,
  ignoredIds: Set<number>,
): RecertificationJob[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  return rawJobs
    .filter((j) => !ignoredIds.has(j.ID))
    .map((j) => {
      const completed = new Date(j.CompletedDate);
      const nextDue = new Date(completed);
      nextDue.setFullYear(nextDue.getFullYear() + 1);

      const diffMs = nextDue.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      let status: RecertificationJob["status"];
      if (daysUntilDue < 0) status = "overdue";
      else if (daysUntilDue <= 60) status = "due-soon";
      else status = "upcoming";

      const dueYear = nextDue.getFullYear();
      const quoteYear = Math.max(dueYear, currentYear);
      const siteId: number = j.Site?.ID;
      const existing = quoteMap.get(`${siteId}:${quoteYear}`) ?? null;

      return {
        id: j.ID,
        name: j.Name,
        customer: j.Customer?.CompanyName || "Unknown",
        customerId: j.Customer?.ID,
        site: j.Site?.Name || "Unknown",
        siteId,
        completedDate: j.CompletedDate,
        nextDueDate: nextDue.toISOString().split("T")[0],
        daysUntilDue,
        status,
        totalExTax: j.Total?.ExTax ?? 0,
        totalIncTax: j.Total?.IncTax ?? 0,
        quoteYear,
        existingQuote: existing
          ? {
              quoteId: existing.quoteId,
              quoteName: existing.quoteName,
              quoteStatus: existing.quoteStatus,
              simproQuoteNo: existing.simproQuoteNo,
            }
          : null,
      } as RecertificationJob;
    });
}

export async function POST() {
  try {
    const cached = await getCachedJobs<any>();
    if (!cached) {
      console.log("[NotifyDueSoon] No cached jobs — skipping");
      return NextResponse.json({ skipped: "no cached jobs" });
    }

    const rawJobs = cached.jobs;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    const pairs = rawJobs.map((j: any) => {
      const completed = new Date(j.CompletedDate);
      const nextDue = new Date(completed);
      nextDue.setFullYear(nextDue.getFullYear() + 1);
      const dueYear = nextDue.getFullYear();
      return {
        siteId: j.Site?.ID as number,
        year: Math.max(dueYear, currentYear),
      };
    });

    const [quoteMap, ignoredIds, notifiedKeys] = await Promise.all([
      getRecertQuoteMap(pairs),
      getIgnoredJobIds(),
      getNotifiedKeys(),
    ]);

    const allJobs = buildResults(rawJobs, quoteMap, ignoredIds);

    // ── Only jobs within 0–28 days, not overdue, not quoted, not already notified
    const newJobs = allJobs.filter(
      (j) =>
        j.daysUntilDue >= 0 &&
        j.daysUntilDue <= 28 &&
        !j.existingQuote &&
        !notifiedKeys.has(`${j.id}:${j.quoteYear}`),
    );

    if (!newJobs.length) {
      console.log("[NotifyDueSoon] No new jobs in 0–28 day window — skipping");
      return NextResponse.json({ skipped: "no new jobs", total: 0 });
    }

    // Sort ascending — most urgent first
    newJobs.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

    const displayed = newJobs.slice(0, DIGEST_LIMIT);
    const remainder = newJobs.length - displayed.length;

    const resend = getResend();
    await resend.emails.send({
      from: "RAS Admin <team@rasvertex.com.au>",
      to: TO,
      subject: `Anchor Recertifications — ${newJobs.length} job${newJobs.length === 1 ? "" : "s"} due within 28 days`,
      html: buildHtml(displayed, remainder),
    });

    console.log(
      `[NotifyDueSoon] ✅ Email sent — ${newJobs.length} jobs in 0–28 day window`,
    );

    await markAsNotified(
      newJobs.map((j) => ({ jobId: j.id, year: j.quoteYear })),
    );

    return NextResponse.json({
      sent: true,
      total: newJobs.length,
      displayed: displayed.length,
      remainder,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[NotifyDueSoon] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
