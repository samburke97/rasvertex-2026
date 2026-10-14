// app/api/outreach/[id]/send/route.ts
//
// Sends the reviewed email { subject, body } to the opportunity's contact,
// records it, and schedules the next follow-up from the rule (or none, once
// every email has gone). In test mode (the default, see lib/outreach/email.ts)
// it goes to OUTREACH_TEST_TO instead and nothing is recorded.

import { NextRequest, NextResponse } from "next/server";
import { getResend } from "@/lib/crm/email";
import {
  OUTREACH_FROM,
  OUTREACH_REPLY_TO,
  OUTREACH_TEST_TO,
  buildOutreachEmail,
  isOutreachLive,
  unsubscribeHeaders,
} from "@/lib/outreach/email";
import { OUTREACH_RULES, maxTouches } from "@/lib/outreach/rules";
import { addDays, todayISO } from "@/lib/outreach/scan";
import { getOpportunity, isSuppressed, recordSend } from "@/lib/outreach/store";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const id = parseInt((await params).id, 10);
  if (!(id > 0)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: { subject?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const subject = body.subject?.trim();
  const text = body.body?.trim();
  if (!subject || !text) {
    return NextResponse.json({ error: "subject and body are required" }, { status: 400 });
  }

  const o = await getOpportunity(id);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const rule = OUTREACH_RULES[o.ruleId];
  if (o.status !== "open") {
    return NextResponse.json({ error: "This opportunity is no longer open." }, { status: 409 });
  }
  if (o.touchesSent >= maxTouches(rule)) {
    return NextResponse.json({ error: "Every email for this opportunity has been sent." }, { status: 409 });
  }
  if (!o.contactEmail) {
    return NextResponse.json({ error: "No contact email in SimPRO for this customer." }, { status: 400 });
  }
  const live = isOutreachLive();
  if (live && (await isSuppressed(o.contactEmail))) {
    return NextResponse.json({ error: "This address has unsubscribed or bounced." }, { status: 409 });
  }

  let resend;
  try {
    resend = getResend();
  } catch {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured." }, { status: 500 });
  }

  try {
    const to = live ? o.contactEmail : OUTREACH_TEST_TO;
    const { data, error } = await resend.emails.send({
      from: OUTREACH_FROM,
      to,
      replyTo: OUTREACH_REPLY_TO,
      subject: live ? subject : `[TEST for ${o.contactEmail}] ${subject}`,
      text,
      html: buildOutreachEmail(text, to, live ? undefined : o.contactEmail),
      headers: unsubscribeHeaders(to),
    });
    if (error || !data) throw new Error(error?.message ?? "Resend send failed");
    if (!live) {
      return NextResponse.json({ opportunity: o, test: true, sentTo: to });
    }

    const touch = o.touchesSent + 1;
    const wait = rule.followUpDays[touch - 1];
    await recordSend(
      id,
      { touch, toEmail: o.contactEmail, subject, body: text, resendEmailId: data.id },
      wait === undefined ? null : addDays(todayISO(), wait),
    );
    return NextResponse.json({ opportunity: await getOpportunity(id), test: false, sentTo: to });
  } catch (err) {
    console.error("[Outreach] send failed:", err);
    return NextResponse.json({ error: "Failed to send email." }, { status: 502 });
  }
}
