// app/api/recertifications/notify-due-soon/route.ts
//
// Called daily by Vercel cron at 0 22 * * * (8am AEST).
//
// Flow:
//   1. Fetch all Height Safety jobs live from SimPRO
//   2. For each job in the 0–28 day window, check SimPRO for an existing quote
//   3. If no quote exists, apply cadence rules:
//      - daysUntilDue > 7  → notify if last notified > 3 days ago (or never)
//      - daysUntilDue <= 7 → notify if last notified > 1 day ago (or never)
//   4. Send one email per qualifying job with a deep link that opens the
//      create-quote modal pre-filled for that site
//   5. Update last_notified_at in Neon
//
// Natural stop: once a quote is created in SimPRO (by anyone),
// hasExistingQuote returns true and the job is skipped automatically.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import {
  getIgnoredJobIds,
  getNotifiedMap,
  upsertLastNotified,
  shouldNotify,
} from "@/lib/recertifications/store";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;
const HEIGHT_SAFETY_COST_CENTRE_ID = 11;
const PAGE_SIZE = 250;
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

async function simproGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`SimPRO ${res.status}: ${res.statusText}`);
  return res.json();
}

// ── Fetch Height Safety job IDs ───────────────────────────────────────────

async function fetchHeightSafetyJobIds(): Promise<Set<number>> {
  const jobIds = new Set<number>();
  let page = 1;
  while (true) {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobCostCenters/` +
      `?CostCenter=${HEIGHT_SAFETY_COST_CENTRE_ID}` +
      `&pageSize=${PAGE_SIZE}&page=${page}&columns=ID,Job`;
    const batch = await simproGet<{ ID: number; Job: { ID: number } }[]>(url);
    for (const item of batch) {
      if (item.Job?.ID) jobIds.add(item.Job.ID);
    }
    if (batch.length < PAGE_SIZE) break;
    page++;
  }
  return jobIds;
}

// ── Fetch job details ─────────────────────────────────────────────────────

async function fetchJobDetails(
  heightSafetyJobIds: Set<number>,
): Promise<any[]> {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const dateFilter = twoYearsAgo.toISOString().split("T")[0];

  const results: any[] = [];
  let page = 1;

  while (true) {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/` +
      `?pageSize=${PAGE_SIZE}&page=${page}` +
      `&columns=ID,Name,CompletedDate,Customer,Site,Tags,Total` +
      `&CompletedDate=gt(${dateFilter})`;

    const batch = await simproGet<any[]>(url);

    for (const job of batch) {
      if (!heightSafetyJobIds.has(job.ID)) continue;
      if (!job.CompletedDate) continue;
      const tags: string[] = (job.Tags || []).map((t: any) =>
        typeof t === "string" ? t : t?.Name || "",
      );
      if (tags.some((t) => t.toUpperCase() === "BLACKLIST")) continue;
      results.push(job);
    }

    if (batch.length < PAGE_SIZE) break;
    page++;
  }

  return results;
}

// ── Check for existing quote in SimPRO ────────────────────────────────────

function isRecertificationQuote(name: string): boolean {
  const n = name
    .toLowerCase()
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
  return (
    n.includes("anchor recertification") ||
    n.includes("annual anchor recertification") ||
    n.includes("annual anchor test") ||
    n.includes("anchor test and recertification") ||
    n.includes("anchor rest and recertification") ||
    n.includes("anchor test") ||
    n.includes("recertification")
  );
}

async function hasExistingQuote(siteId: number): Promise<boolean> {
  try {
    const url =
      `${SIMPRO_BASE_URL}/api/v1.0/companies/0/quotes/` +
      `?pageSize=50&page=1` +
      `&columns=ID,Name,DateIssued,Site` +
      `&Site=${siteId}`;
    const quotes = await simproGet<any[]>(url);
    return quotes.some((q) => isRecertificationQuote(q.Name || ""));
  } catch {
    return false;
  }
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

function buildDeepLink(job: JobSummary): string {
  const params = new URLSearchParams({
    action: "quote",
    jobId: String(job.id),
    customerId: String(job.customerId),
    siteId: String(job.siteId),
    site: job.site,
    customer: job.customer,
    nextDueDate: job.nextDueDate,
    lastExTax: String(job.totalExTax),
  });
  return `${APP_URL}/recertifications?${params.toString()}`;
}

function buildJobEmail(job: JobSummary): string {
  const urgency = urgencyLabel(job.daysUntilDue);
  const createUrl = buildDeepLink(job);

  return `
    <div style="background:#f4f4f0;padding:2rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:520px;margin:0 auto;">

        <div style="background:#0f2d4a;border-radius:10px 10px 0 0;padding:24px 32px;">
          <p style="margin:0 0 2px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">RAS Vertex · Anchor Recertifications</p>
          <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">Quote needed</p>
        </div>

        <div style="background:#fff;padding:28px 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
          <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">
            Hi Caro, the following site is due for recertification and needs a quote created.
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

function buildSubject(job: JobSummary): string {
  if (job.daysUntilDue <= 0)
    return `⚠️ Overdue — ${job.customer} anchor recertification`;
  if (job.daysUntilDue <= 7)
    return `🔴 ${job.daysUntilDue}d — ${job.customer} anchor recertification`;
  return `🟡 ${job.daysUntilDue}d — ${job.customer} anchor recertification`;
}

// ── POST handler (called by Vercel cron) ──────────────────────────────────

export async function POST() {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();

    // 1. Fetch all jobs live
    const [heightSafetyJobIds, ignoredIds] = await Promise.all([
      fetchHeightSafetyJobIds(),
      getIgnoredJobIds(),
    ]);
    const rawJobs = await fetchJobDetails(heightSafetyJobIds);

    // 2. Deduplicate to most recent job per site
    const latestJobBySite = new Map<number, any>();
    for (const j of rawJobs) {
      const siteId: number = j.Site?.ID;
      if (!siteId || !j.CompletedDate) continue;
      const existing = latestJobBySite.get(siteId);
      if (
        !existing ||
        new Date(j.CompletedDate) > new Date(existing.CompletedDate)
      ) {
        latestJobBySite.set(siteId, j);
      }
    }

    // 3. Build candidate list — 0–28 day window, not ignored
    const candidates: JobSummary[] = [];
    for (const [siteId, j] of latestJobBySite) {
      if (ignoredIds.has(j.ID)) continue;

      const completed = new Date(j.CompletedDate);
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
      console.log("[NotifyDueSoon] No jobs in 0–28 day window — done");
      return NextResponse.json({ sent: 0, skipped: "no candidates" });
    }

    // 4. Load notification history for all candidates in one query
    const notifiedMap = await getNotifiedMap(
      candidates.map((c) => ({ jobId: c.id, year: c.quoteYear })),
    );

    // 5. For each candidate: check cadence, then check SimPRO for existing quote
    const resend = getResend();
    let sent = 0;
    let skippedCadence = 0;
    let skippedQuoted = 0;

    for (const job of candidates) {
      const lastNotified =
        notifiedMap.get(`${job.id}:${job.quoteYear}`) ?? null;

      // Cadence check first — cheap, no API call
      if (!shouldNotify(job.daysUntilDue, lastNotified)) {
        skippedCadence++;
        continue;
      }

      // Quote check — live SimPRO call, any year
      const quoted = await hasExistingQuote(job.siteId);
      if (quoted) {
        skippedQuoted++;
        continue;
      }

      // Send individual email
      try {
        await resend.emails.send({
          from: "RAS Admin <team@rasvertex.com.au>",
          to: TO,
          subject: buildSubject(job),
          html: buildJobEmail(job),
        });
        await upsertLastNotified(job.id, job.quoteYear);
        sent++;
        console.log(
          `[NotifyDueSoon] ✅ Sent — ${job.customer} / ${job.site} (${job.daysUntilDue}d)`,
        );
      } catch (emailErr) {
        console.error(
          `[NotifyDueSoon] Email failed for job ${job.id}:`,
          emailErr,
        );
      }
    }

    console.log(
      `[NotifyDueSoon] Done — sent: ${sent}, skipped cadence: ${skippedCadence}, skipped quoted: ${skippedQuoted}`,
    );

    return NextResponse.json({
      sent,
      skippedCadence,
      skippedQuoted,
      total: candidates.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[NotifyDueSoon] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
