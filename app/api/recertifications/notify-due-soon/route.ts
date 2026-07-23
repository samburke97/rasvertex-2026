// app/api/recertifications/notify-due-soon/route.ts
//
// Called daily by Vercel cron at 0 22 * * * (8am AEST) — see caveat below.
//
// Loops every recurring-job category (height-safety, window-cleaning,
// building-cleaning, ...) and for each:
//   1. Fetch that category's jobs live from SimPRO
//   2. For each job in the 0–28 day window, check SimPRO for an existing
//      matching quote (using the category's quote-match keywords)
//   3. If no quote exists, apply cadence rules:
//      - daysUntilDue > 7  → notify if last notified > 3 days ago (or never)
//      - daysUntilDue <= 7 → notify if last notified > 1 day ago (or never)
//   4. Send one email per qualifying job with a deep link that opens the
//      create-quote modal pre-filled for that site + category
//   5. Update last_notified_at in Neon (scoped by category)
//
// Natural stop: once a matching quote is created in SimPRO (by anyone),
// the job is skipped automatically on the next run.
//
// NOTE: as of 2026-07-23 there is no cron entry in vercel.json wiring this
// route to an actual schedule — confirm how/whether this currently fires
// before assuming it runs automatically.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getIgnoredJobIds,
  getNotifiedMap,
  upsertLastNotified,
  shouldNotify,
} from "@/lib/recertifications/store";
import {
  fetchCategoryJobIds,
  fetchJobDetails,
  siteHasMatchingQuote,
  hasSimproConfig,
  type SimproJobRow,
} from "@/lib/recertifications/simpro";
import {
  RECURRING_CATEGORY_LIST,
  type CategoryConfig,
} from "@/lib/recertifications/categories";

const APP_URL = "https://rasvertex-2026-lt5c.vercel.app";
const TO = ["admin@rasvertex.com.au", "sam@rasvertex.com.au"];

interface JobSummary {
  id: number;
  customerId: number;
  customer: string;
  site: string;
  siteId: number;
  nextDueDate: string;
  daysUntilDue: number;
  totalExTax: number;
  quoteYear: number;
}

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

// ── Email template ────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function urgencyLabel(days: number): {
  text: string;
  bg: string;
  color: string;
  border: string;
} {
  if (days <= 0)
    return {
      text: "Overdue",
      bg: "#fef2f2",
      color: "#b91c1c",
      border: "#fecaca",
    };
  if (days <= 7)
    return {
      text: `${days} days`,
      bg: "#fff7ed",
      color: "#9a3412",
      border: "#fed7aa",
    };
  return {
    text: `${days} days`,
    bg: "#fefce8",
    color: "#854d0e",
    border: "#fef08a",
  };
}

function buildDeepLink(job: JobSummary, config: CategoryConfig): string {
  const params = new URLSearchParams({
    action: "quote",
    category: config.id,
    jobId: String(job.id),
    customerId: String(job.customerId),
    siteId: String(job.siteId),
    site: job.site,
    customer: job.customer,
    nextDueDate: job.nextDueDate,
    lastExTax: String(job.totalExTax),
  });
  return `${APP_URL}/recurring-jobs?${params.toString()}`;
}

function buildJobEmail(job: JobSummary, config: CategoryConfig): string {
  const urgency = urgencyLabel(job.daysUntilDue);
  const createUrl = buildDeepLink(job, config);

  return `
    <div style="background:#f4f4f0;padding:2rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:0 auto;">

        <div style="background:#0f2d4a;border-radius:10px 10px 0 0;padding:24px 32px;">
          <p style="margin:0 0 2px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">RAS Vertex · ${config.pageHeading}</p>
          <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">Quote needed</p>
        </div>

        <div style="background:#fff;padding:28px 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
          <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">
            The following site is due for ${config.emailSubjectNoun} and needs a quote created.
          </p>

          <div style="background:#f9f9f7;border-radius:8px;padding:20px 24px;margin-bottom:8px;">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;">
              <div>
                <p style="margin:0 0 2px;font-size:16px;font-weight:600;color:#1a1a1a;">${job.customer}</p>
                <p style="margin:0;font-size:13px;color:#888;">${job.site}</p>
              </div>
              <span style="background:${urgency.bg};color:${urgency.color};border:1px solid ${urgency.border};font-size:11px;font-weight:600;padding:3px 10px;border-radius:4px;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;margin-left:12px;">${urgency.text}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <tr>
                <td style="color:#888;padding:4px 0;width:40%;">Due date</td>
                <td style="color:#1a1a1a;padding:4px 0;font-weight:500;">${formatDate(job.nextDueDate)}</td>
              </tr>
              <tr>
                <td style="color:#888;padding:4px 0;">Last job value</td>
                <td style="color:#1a1a1a;padding:4px 0;">$${job.totalExTax.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ex GST</td>
              </tr>
              <tr>
                <td style="color:#888;padding:4px 0;">Quote year</td>
                <td style="color:#1a1a1a;padding:4px 0;">${job.quoteYear}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="background:#fff;padding:20px 32px 28px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
          <a href="${createUrl}" style="display:inline-block;background:#0f2d4a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:500;">Create quote in RAS Vertex →</a>
        </div>

        <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:14px 32px;">
          <p style="margin:0;font-size:12px;color:#aaa;">Automated notification · RAS Vertex · This email will stop once a quote is created in SimPRO.</p>
        </div>

      </div>
    </div>`;
}

function buildSubject(job: JobSummary, config: CategoryConfig): string {
  if (job.daysUntilDue <= 0)
    return `⚠️ Overdue — ${job.customer} ${config.emailSubjectNoun}`;
  if (job.daysUntilDue <= 7)
    return `🔴 ${job.daysUntilDue}d — ${job.customer} ${config.emailSubjectNoun}`;
  return `🟡 ${job.daysUntilDue}d — ${job.customer} ${config.emailSubjectNoun}`;
}

// ── Per-category run ───────────────────────────────────────────────────────

async function notifyForCategory(
  config: CategoryConfig,
  resend: Resend,
): Promise<{ sent: number; skippedCadence: number; skippedQuoted: number; total: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  const [categoryJobIds, ignoredIds] = await Promise.all([
    fetchCategoryJobIds(config.costCentreIds),
    getIgnoredJobIds(config.id),
  ]);
  const rawJobs: SimproJobRow[] = await fetchJobDetails(categoryJobIds);

  // Deduplicate to most recent job per site
  const latestJobBySite = new Map<number, SimproJobRow>();
  for (const j of rawJobs) {
    const siteId = j.Site?.ID;
    if (!siteId || !j.CompletedDate) continue;
    const existing = latestJobBySite.get(siteId);
    if (
      !existing ||
      new Date(j.CompletedDate) > new Date(existing.CompletedDate!)
    ) {
      latestJobBySite.set(siteId, j);
    }
  }

  // Build candidate list — 0–28 day window, not ignored
  const candidates: JobSummary[] = [];
  for (const [siteId, j] of latestJobBySite) {
    if (ignoredIds.has(j.ID)) continue;

    const completed = new Date(j.CompletedDate!);
    const nextDue = new Date(completed);
    nextDue.setFullYear(nextDue.getFullYear() + 1);

    const diffMs = nextDue.getTime() - today.getTime();
    const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysUntilDue > 28) continue;

    const dueYear = nextDue.getFullYear();
    const quoteYear = Math.max(dueYear, currentYear);

    candidates.push({
      id: j.ID,
      customerId: j.Customer?.ID ?? 0,
      customer: j.Customer?.CompanyName || "Unknown",
      site: j.Site?.Name || "Unknown",
      siteId,
      nextDueDate: nextDue.toISOString().split("T")[0],
      daysUntilDue,
      totalExTax: j.Total?.ExTax ?? 0,
      quoteYear,
    });
  }

  if (!candidates.length) {
    console.log(`[NotifyDueSoon] ${config.id}: no jobs in 0–28 day window`);
    return { sent: 0, skippedCadence: 0, skippedQuoted: 0, total: 0 };
  }

  const notifiedMap = await getNotifiedMap(
    config.id,
    candidates.map((c) => ({ jobId: c.id, year: c.quoteYear })),
  );

  let sent = 0;
  let skippedCadence = 0;
  let skippedQuoted = 0;

  for (const job of candidates) {
    const lastNotified = notifiedMap.get(`${job.id}:${job.quoteYear}`) ?? null;

    if (!shouldNotify(job.daysUntilDue, lastNotified)) {
      skippedCadence++;
      continue;
    }

    const quoted = await siteHasMatchingQuote(
      job.siteId,
      config.quoteMatchKeywords,
    );
    if (quoted) {
      skippedQuoted++;
      continue;
    }

    try {
      await resend.emails.send({
        from: "RAS Admin <team@rasvertex.com.au>",
        to: TO,
        subject: buildSubject(job, config),
        html: buildJobEmail(job, config),
      });
      await upsertLastNotified(job.id, job.quoteYear, config.id);
      sent++;
      console.log(
        `[NotifyDueSoon] ✅ Sent (${config.id}) — ${job.customer} / ${job.site} (${job.daysUntilDue}d)`,
      );
    } catch (emailErr) {
      console.error(
        `[NotifyDueSoon] Email failed (${config.id}) for job ${job.id}:`,
        emailErr,
      );
    }
  }

  return { sent, skippedCadence, skippedQuoted, total: candidates.length };
}

// ── POST handler (called by Vercel cron) ──────────────────────────────────

export async function POST() {
  if (!hasSimproConfig()) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const resend = getResend();
  const results: Record<string, Awaited<ReturnType<typeof notifyForCategory>>> = {};

  try {
    for (const config of RECURRING_CATEGORY_LIST) {
      results[config.id] = await notifyForCategory(config, resend);
    }

    const totals = Object.values(results).reduce(
      (acc, r) => ({
        sent: acc.sent + r.sent,
        skippedCadence: acc.skippedCadence + r.skippedCadence,
        skippedQuoted: acc.skippedQuoted + r.skippedQuoted,
        total: acc.total + r.total,
      }),
      { sent: 0, skippedCadence: 0, skippedQuoted: 0, total: 0 },
    );

    console.log(
      `[NotifyDueSoon] Done — sent: ${totals.sent}, skipped cadence: ${totals.skippedCadence}, skipped quoted: ${totals.skippedQuoted}`,
    );

    return NextResponse.json({ ...totals, byCategory: results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[NotifyDueSoon] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
