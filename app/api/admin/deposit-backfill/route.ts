// app/api/admin/deposit-backfill/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// ONE-OFF — fetches all quotes created on or after 27/05/2026 that were won
// (have a LinkedJobID), filters to those over $5k ex GST but under $20k,
// and sends a single summary email listing all deposits required.
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
const THRESHOLD_DEPOSIT = 5000; // ex GST — below this, skip
const THRESHOLD_WA = 20000; // ex GST — above this, works agreement (not deposit)

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

interface QuoteRow {
  quoteNo: string;
  jobNo: string;
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
    // ── 1. Fetch all quotes from cutoff date onwards ───────────────────────
    const allQuotes: any[] = [];
    let page = 1;

    while (true) {
      const url =
        `${SIMPRO_BASE_URL}/api/v1.0/companies/0/quotes/` +
        `?pageSize=${PAGE_SIZE}&page=${page}` +
        `&columns=ID,JobNo,Name,DateIssued,Customer,Site,Total,LinkedJobID` +
        `&DateIssued=gt(${CUTOFF_DATE})`;

      const batch = await simproGet<any[]>(url);
      allQuotes.push(...batch);
      if (batch.length < PAGE_SIZE) break;
      page++;
    }

    console.log(
      `[Backfill] Fetched ${allQuotes.length} quotes from ${CUTOFF_DATE} onwards`,
    );

    // ── 2. Filter: won (has LinkedJobID) + in deposit range ───────────────
    const qualifying: QuoteRow[] = [];

    for (const q of allQuotes) {
      // Must have been won (converted to a job)
      if (!q.LinkedJobID) continue;

      const totalExTax: number = q.Total?.ExTax ?? 0;

      // Only $5k–$19,999 ex GST (deposit range, not works agreement range)
      if (totalExTax < THRESHOLD_DEPOSIT) continue;
      if (totalExTax >= THRESHOLD_WA) continue;

      const clientName =
        q.Customer?.CompanyName?.trim() ||
        [q.Customer?.GivenName, q.Customer?.FamilyName]
          .filter(Boolean)
          .join(" ") ||
        "Unknown";

      qualifying.push({
        quoteNo: q.JobNo ? `#${q.JobNo}` : `#${q.ID}`,
        jobNo: `#${q.LinkedJobID}`,
        clientName,
        siteName: q.Site?.Name?.trim() || "—",
        dateIssued: fmtDate(q.DateIssued),
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

    // ── 3. Build email ────────────────────────────────────────────────────
    const tableRows = qualifying
      .map(
        (q) => `
        <tr style="border-top:1px solid #f0f0f0;">
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${q.quoteNo}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${q.jobNo}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${q.clientName}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${q.siteName}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;">${q.dateIssued}</td>
          <td style="padding:10px 12px;font-size:13px;color:#1a1a1a;text-align:right;">$${fmtAUD(q.totalExTax)}</td>
          <td style="padding:10px 12px;font-size:13px;color:#0f2d4a;font-weight:700;text-align:right;">$${fmtAUD(q.depositAmount)}</td>
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

          <div style="background:#fff;padding:28px 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
            <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
            <p style="margin:0 0 24px;font-size:15px;color:#444;line-height:1.6;">
              The following quotes were accepted from 27 May 2026 onwards and require a 20% deposit before works commence.
              These were not captured by the automated system at the time.
            </p>

            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#f0f4f8;">
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Quote #</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Job #</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Customer</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Site</th>
                  <th style="padding:10px 12px;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Quote Date</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">Total Ex GST</th>
                  <th style="padding:10px 12px;text-align:right;font-size:11px;text-transform:uppercase;letter-spacing:0.06em;color:#0f2d4a;">20% Deposit</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows}
              </tbody>
            </table>
          </div>

          <div style="background:#f9f9f7;border:1px solid #ebebeb;border-top:none;border-radius:0 0 10px 10px;padding:16px 32px;">
            <p style="margin:0;font-size:12px;color:#aaa;">One-off backfill · RAS Vertex · Quotes accepted from 27 May 2026</p>
          </div>

        </div>
      </div>
    `;

    // ── 4. Send ───────────────────────────────────────────────────────────
    const resend = getResend();
    await resend.emails.send({
      from: "RAS Admin <sam@rasvertex.com.au>",
      to: RECIPIENTS,
      subject: `Deposits Required — ${qualifying.length} quotes from 27 May 2026 onwards`,
      html,
    });

    return NextResponse.json({
      sent: true,
      total: qualifying.length,
      jobs: qualifying.map((q) => ({
        quoteNo: q.quoteNo,
        jobNo: q.jobNo,
        client: q.clientName,
        exTax: q.totalExTax,
        deposit: q.depositAmount,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Backfill]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
