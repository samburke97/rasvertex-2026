// app/api/webhooks/simpro/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// SimPRO webhook — fires only when a Quote is moved to "Won"
//
// Expected payload:
//   { name: "Quote", action: "won", reference: { companyID: 0, quoteID: 1234 } }
//
// Threshold logic (ex GST):
//   < $5,000    → skip
//   $5k–$19,999 → 20% deposit notification email
//   $20,000+    → save works agreement + works agreement email
//
// NOTE: Update your SimPRO webhook config to trigger on Quote → Won,
//       NOT Job → Created/Updated.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { fetchEnrichedQuote } from "@/lib/simpro/client";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";
import { Resend } from "resend";

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

// ── Formatting helpers ────────────────────────────────────────────────────────

function fmtAUD(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Email builders ────────────────────────────────────────────────────────────

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

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Webhook] Received:", JSON.stringify(body));

    const action: string = body.action ?? "";
    const name: string = body.name ?? "";
    const reference = body.reference ?? {};
    const quoteId: number = reference.quoteID;
    const companyId: number = reference.companyID ?? 0;

    // ── Only process Quote → Won ──────────────────────────────────────────────
    const isQuoteWon =
      name.toLowerCase() === "quote" && action.toLowerCase() === "won";

    if (!isQuoteWon || !quoteId) {
      console.log(`[Webhook] Skipped — name: "${name}", action: "${action}"`);
      return NextResponse.json({
        received: true,
        skipped: "not a quote won event",
      });
    }

    // ── Duplicate guard ───────────────────────────────────────────────────────
    const existing = await getAgreement(String(quoteId));
    if (existing) {
      console.log(`[Webhook] Quote ${quoteId} already processed — skipping`);
      return NextResponse.json({
        received: true,
        skipped: "already processed",
      });
    }

    // ── Fetch quote from SimPRO ───────────────────────────────────────────────
    console.log(`[Webhook] Fetching quote ${quoteId}...`);
    const quote = await fetchEnrichedQuote(quoteId, companyId);
    console.log(
      `[Webhook] Quote fetched — exTax: $${quote.totalExTax}, client: "${quote.clientName}"`,
    );

    const { totalExTax, totalIncGst } = quote;

    // ── Below deposit threshold → skip ────────────────────────────────────────
    if (totalExTax < THRESHOLD_DEPOSIT) {
      console.log(
        `[Webhook] $${totalExTax} ex GST below $${THRESHOLD_DEPOSIT} — skipping`,
      );
      return NextResponse.json({
        received: true,
        skipped: `$${totalExTax} ex GST below threshold`,
      });
    }

    const resend = getResend();

    // ── $20,000+ ex GST → Works Agreement ────────────────────────────────────
    if (totalExTax >= THRESHOLD_WORKS_AGREEMENT) {
      const agreement = {
        jobId: String(quoteId),
        jobNo: quote.jobNo,
        jobName: quote.name,
        clientName: quote.clientName,
        siteAddress: quote.siteAddress,
        siteName: quote.siteName,
        initialWorks: quote.name,
        colourScheme: "To be advised",
        totalIncGst,
        paymentSchedule: buildPaymentSchedule(totalIncGst),
        date: quote.date,
        createdAt: new Date().toISOString(),
        status: "draft" as const,
        triggeredBy: "webhook" as const,
      };

      await saveAgreement(agreement);
      console.log(`[Webhook] ✅ Works agreement saved — Quote ${quoteId}`);

      try {
        await resend.emails.send({
          from: "RAS Admin <sam@rasvertex.com.au>",
          to: WORKS_AGREEMENT_RECIPIENTS,
          subject: `New Works Agreement — ${quote.jobNo} · ${quote.clientName}`,
          html: emailShell(
            "New Works Agreement",
            `
              <div style="background:#fff;padding:28px 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
                <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
                <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">
                  A quote has been accepted over $20,000. Please create a works agreement for the following job.
                </p>
                ${jobTable([
                  { label: "Quote Number", value: quote.jobNo },
                  { label: "Customer", value: quote.clientName },
                  { label: "Site", value: quote.siteName },
                  { label: "Site Address", value: quote.siteAddress },
                  { label: "Total Ex GST", value: `$${fmtAUD(totalExTax)}` },
                  { label: "Total Inc GST", value: `$${fmtAUD(totalIncGst)}` },
                ])}
              </div>
              <div style="background:#fff;padding:20px 32px 32px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
                <a href="${APP_URL}/works-agreements" style="display:inline-block;background:#0f2d4a;color:#fff;text-decoration:none;padding:11px 22px;border-radius:7px;font-size:14px;font-weight:500;">Review in RAS Vertex →</a>
              </div>
            `,
            "Automated notification · RAS Vertex · Quote won over $20,000 ex GST",
          ),
        });
        console.log(
          `[Webhook] 📧 Works agreement email sent — Quote ${quoteId}`,
        );
      } catch (emailErr) {
        console.error("[Webhook] Works agreement email failed:", emailErr);
      }

      return NextResponse.json({
        received: true,
        type: "works-agreement",
        quoteNo: quote.jobNo,
        totalExTax,
      });
    }

    // ── $5,000–$19,999 ex GST → 20% Deposit Notification ────────────────────
    const depositAmount = Math.round(totalExTax * 0.2 * 100) / 100;

    try {
      await resend.emails.send({
        from: "RAS Admin <sam@rasvertex.com.au>",
        to: DEPOSIT_RECIPIENTS,
        subject: `Deposit Required — ${quote.jobNo} · ${quote.clientName} · $${fmtAUD(depositAmount)} ex GST`,
        html: emailShell(
          "20% Deposit Required",
          `
            <div style="background:#fff;padding:28px 32px 8px;border-left:1px solid #ebebeb;border-right:1px solid #ebebeb;">
              <p style="margin:0 0 6px;font-size:15px;color:#1a1a1a;">Hi Amanda,</p>
              <p style="margin:0 0 20px;font-size:15px;color:#444;line-height:1.6;">
                A quote has been accepted over $5,000. A 20% deposit must be collected before works commence.
              </p>
              ${jobTable([
                { label: "Quote Number", value: quote.jobNo },
                { label: "Customer", value: quote.clientName },
                { label: "Site", value: quote.siteName },
                { label: "Site Address", value: quote.siteAddress },
                { label: "Total Ex GST", value: `$${fmtAUD(totalExTax)}` },
                { label: "Total Inc GST", value: `$${fmtAUD(totalIncGst)}` },
                {
                  label: "20% Deposit Due",
                  value: `$${fmtAUD(depositAmount)} ex GST`,
                  highlight: true,
                },
              ])}
            </div>
          `,
          "Automated notification · RAS Vertex · Quote won over $5,000 ex GST",
        ),
      });
      console.log(`[Webhook] 📧 Deposit notification sent — Quote ${quoteId}`);
    } catch (emailErr) {
      console.error("[Webhook] Deposit email failed:", emailErr);
    }

    return NextResponse.json({
      received: true,
      type: "deposit-notification",
      quoteNo: quote.jobNo,
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
    endpoint: "SimPRO Quote Won Webhook",
    thresholdDeposit: `$${THRESHOLD_DEPOSIT} ex GST`,
    thresholdWorksAgreement: `$${THRESHOLD_WORKS_AGREEMENT} ex GST`,
  });
}
