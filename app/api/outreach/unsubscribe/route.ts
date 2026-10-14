// app/api/outreach/unsubscribe/route.ts
//
// Unsubscribe link from outreach emails. GET shows a confirm button rather
// than unsubscribing outright, because mail scanners open links on their
// own; POST does it, and is also what Gmail/Outlook's one-click
// unsubscribe (List-Unsubscribe-Post) calls.

import { NextRequest, NextResponse } from "next/server";
import { verifyUnsubscribe } from "@/lib/outreach/email";
import { suppressEmail } from "@/lib/outreach/store";

function decode(request: NextRequest): { email: string; token: string } | null {
  const e = request.nextUrl.searchParams.get("e");
  const token = request.nextUrl.searchParams.get("t");
  if (!e || !token) return null;
  const email = Buffer.from(e, "base64url").toString("utf8");
  try {
    return verifyUnsubscribe(email, token) ? { email, token } : null;
  } catch {
    return null;
  }
}

function page(title: string, inner: string, status = 200) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f4f4f0;font-family:Arial,Helvetica,sans-serif;color:#141414;">
<div style="max-width:440px;margin:15vh auto;padding:32px;background:#fff;border-radius:10px;border:1px solid #ebebeb;">
<p style="margin:0 0 4px;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#9a9c9b;">RAS-VERTEX Maintenance Solutions</p>
<h1 style="margin:0 0 16px;font-size:20px;">${title}</h1>${inner}</div></body></html>`;
  return new NextResponse(html, { status, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

const invalid = () => page("Link not valid", `<p style="font-size:14px;line-height:1.5;">This unsubscribe link isn't valid. Reply to any of our emails and we'll take you off the list.</p>`, 400);

export async function GET(request: NextRequest) {
  const d = decode(request);
  if (!d) return invalid();
  return page(
    "Unsubscribe",
    `<p style="font-size:14px;line-height:1.5;">Stop maintenance reminders and follow-ups to <strong>${d.email.replace(/</g, "&lt;")}</strong>?</p>
<form method="post"><button type="submit" style="background:#0f2d4a;color:#fff;border:0;border-radius:7px;padding:11px 22px;font-size:14px;cursor:pointer;">Unsubscribe</button></form>`,
  );
}

export async function POST(request: NextRequest) {
  const d = decode(request);
  if (!d) return invalid();
  await suppressEmail(d.email, "unsubscribed");
  return page("You're unsubscribed", `<p style="font-size:14px;line-height:1.5;">We won't send any more reminders to this address. Sorry to see you go.</p>`);
}
