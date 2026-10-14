// lib/outreach/email.ts
//
// Sending side of customer outreach: who it's from, the HTML wrapper, and
// the unsubscribe link every email carries. Outreach emails are commercial
// messages under the Spam Act 2003 (Cth), so each one identifies the
// sender and includes a working unsubscribe, both as a footer link and as
// List-Unsubscribe headers for one-click unsubscribe in Gmail/Outlook.

import crypto from "crypto";

export const OUTREACH_SIGNER = { name: "Sam Burke", title: "Commercial Manager" };
export const OUTREACH_FROM = "Sam Burke <sam@rasvertex.com.au>";
export const OUTREACH_REPLY_TO = "sam@rasvertex.com.au";

// Test mode is the default: every email goes to OUTREACH_TEST_TO instead of
// the customer, and isn't recorded against the opportunity, so testing never
// uses up a customer's emails. Customers are only emailed when OUTREACH_LIVE
// is explicitly "true".
export const OUTREACH_TEST_TO = "sam@rasvertex.com.au";

export function isOutreachLive(): boolean {
  return process.env.OUTREACH_LIVE === "true";
}

const APP_URL = process.env.OUTREACH_APP_URL ?? "https://rasvertex-2026-lt5c.vercel.app";

function secret(): string {
  const s = process.env.OUTREACH_SECRET;
  if (!s) throw new Error("OUTREACH_SECRET is not set");
  return s;
}

export function unsubscribeToken(email: string): string {
  return crypto.createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("base64url");
}

export function verifyUnsubscribe(email: string, token: string): boolean {
  const expected = Buffer.from(unsubscribeToken(email));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

export function unsubscribeUrl(email: string): string {
  const e = Buffer.from(email.trim().toLowerCase()).toString("base64url");
  return `${APP_URL}/api/outreach/unsubscribe?e=${e}&t=${unsubscribeToken(email)}`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildOutreachEmail(bodyText: string, toEmail: string, testFor?: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 1em;">${escapeHtml(para).replace(/\n/g, "<br />")}</p>`)
    .join("");
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#141414;max-width:560px;">
      ${
        testFor
          ? `<p style="margin:0 0 1.5em;padding:10px 14px;border-radius:6px;background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;font-size:12px;">TEST: not sent to the customer. Live, this would go to ${escapeHtml(testFor)}.</p>`
          : ""
      }
      ${paragraphs}
      <p style="margin:2.5em 0 0;color:#9a9c9b;font-size:11px;line-height:1.5;">
        RAS-VERTEX Maintenance Solutions · Sunshine Coast, QLD · 07 5371 0201<br />
        You're receiving this because we've worked on your building.
        <a href="${unsubscribeUrl(toEmail)}" style="color:#9a9c9b;">Unsubscribe</a>
      </p>
    </div>
  `;
}

export function unsubscribeHeaders(toEmail: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl(toEmail)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
