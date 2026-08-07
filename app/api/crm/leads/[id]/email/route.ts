// app/api/crm/leads/[id]/email/route.ts
// Sends a one-off email to a lead via Resend and logs it as activity.
// Activity row is created BEFORE the send call (status 'queued') so a
// crash mid-send still leaves a visible, honest trace in the timeline.

import { NextRequest, NextResponse } from "next/server";
import {
  getLead,
  createEmailActivity,
  markEmailSent,
  markEmailFailed,
} from "@/lib/crm/store";
import { getResend, buildLeadEmail, CRM_SENDER } from "@/lib/crm/email";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (isNaN(id) || id <= 0)
    return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });

  let body: { subject?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.subject?.trim() || !body.body?.trim()) {
    return NextResponse.json(
      { error: "subject and body are required" },
      { status: 400 },
    );
  }

  let resend;
  try {
    resend = getResend();
  } catch {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured." },
      { status: 500 },
    );
  }

  const lead = await getLead(id);
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!lead.email) {
    return NextResponse.json(
      { error: "This lead has no email address." },
      { status: 400 },
    );
  }

  const activity = await createEmailActivity(
    id,
    body.subject.trim(),
    body.body.trim(),
  );

  try {
    const { data, error } = await resend.emails.send({
      from: CRM_SENDER,
      to: lead.email,
      subject: body.subject.trim(),
      html: buildLeadEmail(body.body.trim()),
    });
    if (error || !data) throw new Error(error?.message ?? "Resend send failed");

    const updated = await markEmailSent(activity.id, data.id);
    return NextResponse.json({ activity: updated }, { status: 201 });
  } catch (err) {
    console.error("[CRM] Email send failed:", err);
    const updated = await markEmailFailed(activity.id);
    return NextResponse.json(
      { error: "Failed to send email.", activity: updated },
      { status: 502 },
    );
  }
}
