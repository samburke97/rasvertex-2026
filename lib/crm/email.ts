// lib/crm/email.ts
// Mirrors the Resend usage in app/api/recertifications/notify-due-soon/route.ts
// exactly — same lazy client, same "throw if key missing" guard.

import { Resend } from "resend";

export const CRM_SENDER = "Sam <sam@rasvertex.com.au>";

export function getResend(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  return new Resend(key);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Plain-text compose body -> minimal branded HTML. Keeps line breaks, no
// rich-text editor on the compose side — matches "really simple" scope.
export function buildLeadEmail(bodyText: string): string {
  const paragraphs = bodyText
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 1em;">${escapeHtml(para).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#141414;max-width:560px;">
      ${paragraphs}
      <p style="margin:2em 0 0;color:#7e807f;font-size:12px;">
        RAS Vertex Maintenance Solutions
      </p>
    </div>
  `;
}
