// app/api/admin/deposit-backfill/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// ONE-OFF — fetches all jobs created from 27/05/2026 onwards that were
// converted from a quote, filters to $5k–$20k ex GST, sends one summary email.
//
// Hit once via GET: https://rasvertex-2026.vercel.app/api/admin/deposit-backfill
// Delete this file after use.
// ─────────────────────────────────────────────────────────────────────────────

import { NextResponse } from "next/server";
import { simproGet } from "@/lib/simpro/client";
import { Resend } from "resend";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;
const PAGE_SIZE = 250;
const CUTOFF_DATE = "2026-05-27";
const THRESHOLD_DEPOSIT = 5000; // ex GST
const THRESHOLD_WA = 20000; // ex GST — above this is works agreement, not deposit

const RECIPIENTS = [
  "team@rasvertex.com.au",
  "amanda@rasvertex.com.au",
  "admin@rasvertex.com.au",
];

function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY not set");
  return new Resend(key);
}

function fmtAUD(n: number): string {
  return n.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface JobRow {
  jobNo: string;
  quoteNo: string;
  clientName: string;
  siteName: string;
  dateIssued: string;
  totalExTax: number;
  depositAmount: number;
}

export async function GET() {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO config missing" },
      { status: 500 },
    );
  }

  try {
    // ── 1. Fetch all jobs from cutoff date onwards ─────────────────────────
    const allJobs: any[] = [];
    let page = 1;

    while (true) {
      const url =
        `${SIMPRO_BASE_URL}/api/v1.0/companies/0/jobs/` +
        `?pageSize=${PAGE_SIZE}&page=${page}` +
        `&columns=ID,Name,DateIssued,Customer,Site,Total,ConvertedFrom` +
        `&DateIssued=gt(${CUTOFF_DATE})`;

      const batch = await simproGet<any[]>(url);
      allJobs.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    console.log(
      `[Backfill] Fetched ${allJobs.length} jobs from ${CUTOFF_DATE} onwards`,
    );

    // ── 2. Filter: converted from quote + in deposit range ─────────────────
    const qualifying: JobRow[] = [];

    for (const j of allJobs) {
      // Must have been converted from a quote
      if (j.ConvertedFrom?.Type !== "Quote") continue;

      const totalExTax: number = j.Total?.ExTax ?? 0;

      // Only $5k–$19,999 ex GST
      if (totalExTax < THRESHOLD_DEPOSIT) continue;
      if (totalExTax >= THRESHOLD_WA) continue;

      const clientName =
        j.Customer?.CompanyName?.trim() ||
        [j.Customer?.GivenName, j.Customer?.FamilyName]
          .filter(Boolean)
          .join(" ") ||
        "Unknown";

      qualifying.push({
        jobNo: j.Name ? `${j.Name}` : `#${j.ID}`,
        quoteNo: `#${j.ConvertedFrom.ID}`,
        clientName,
        siteName: j.Site?.Name?.trim() || "—",
        dateIssued: fmtDate(j.DateIssued),
        totalExTax,
        depositAmount: Math.round(totalExTax * 0.2 * 100) / 100,
      });
    }

    console.log(
      `[Backfill] ${qualifying.length} qualifying jobs for deposit notification`,
    );

    if (qualifying.length === 0) {
      return NextResponse.json({
        message: "No qualifying jobs found",
        total: 0,
      });
    }

    // ── 3. Build email ─────────────────────────────────────────────────────
    const tableRows = qualifying
      .map(
        (j) => `
        <tr style="border-top:1px solid #f0f0f0;">
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${j.jobNo}</td>
          <td style="padding:10px 12px;font-size:13px;color:#888;">${j.quoteNo}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${j.clientName}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${j.siteName}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${j.dateIssued}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;text-align:right;">$${fmtAUD(j.totalExTax)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#0f2d4a;font-weight:700;text-align:right;">$${fmtAUD(j.depositAmount)}</td>
        </tr>
      `,
      )
      .join("");

    const html = `
      <div style="background:#f4f4f0;padding:2rem;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        <div style="max-width:860px;margin:0 auto;">

          <div style="background:#0f2d4a;border-radius:10px 10px 0 0;padding:24px 32px;">
            <p style="margin:0 0 2px;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:0.08em;text-transform:uppercase;">RAS Vertex</p>
            <p style="margin:0;color:#fff;font-size:18px;font-weight:500;">20% Deposits Required — Backfill</p>
          </div>

          <div style="background:#fff;padding:28px 32px 24px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
            <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              The following jobs were converted from quotes from 27 May 2026 onwards
              and require a 20% deposit before works commence.
              These were not captured by the automated system at the time.
            </p>

            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr style="background:#f0f4f8;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;white-space:nowrap;">Job</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;white-space:nowrap;">From Quote</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;white-space:nowrap;">Customer</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;white-space:nowrap;">Site</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;white-space:nowrap;">Date</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;white-space:nowrap;">Total Ex GST</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;white-space:nowrap;">20% Deposit</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>

          <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
            <p style="margin:0;font-size:12px;color:#aaa;">
              One-off backfill · RAS Vertex · Jobs converted from quotes after 27 May 2026
            </p>
          </div>

        </div>
      </div>
    `;

    // ── 4. Send ────────────────────────────────────────────────────────────
    const resend = getResend();
    await resend.emails.send({
      from: "RAS Admin <sam@rasvertex.com.au>",
      to: RECIPIENTS,
      subject: `Deposits Required — ${qualifying.length} job${qualifying.length === 1 ? "" : "s"} from 27 May 2026 onwards`,
      html,
    });

    return NextResponse.json({
      sent: true,
      total: qualifying.length,
      jobs: qualifying.map((j) => ({
        jobNo: j.jobNo,
        quoteNo: j.quoteNo,
        client: j.clientName,
        exTax: j.totalExTax,
        deposit: j.depositAmount,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Backfill]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
