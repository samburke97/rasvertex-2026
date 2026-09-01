// app/api/webhooks/resend/route.ts
// Resend delivery/open/click/bounce events → crm_lead_activity tracking
// columns (see lib/crm/store.ts's markDelivered/markOpened/markClicked/
// markBounced — those already existed as unused scaffolding; this is their
// first and only caller).
//
// Resend signs webhook payloads the same way Svix does: headers
// svix-id / svix-timestamp / svix-signature, secret shaped "whsec_<base64>",
// signed content is "<id>.<timestamp>.<raw body>", HMAC-SHA256, base64.
// Verified manually here (no svix/resend signature-verification package is
// installed) rather than adding a dependency for one HMAC check.
//
// Manual setup required after deploying this route (not something this code
// can do): register https://<domain>/api/webhooks/resend in the Resend
// dashboard, enable open/click tracking on the account, and set
// RESEND_WEBHOOK_SECRET to the signing secret Resend gives you.

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  findActivityByResendEmailId,
  markDelivered,
  markOpened,
  markClicked,
  markBounced,
} from "@/lib/crm/store";

const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

function verifySignature(
  secret: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  rawBody: string,
): boolean {
  const skewSeconds = Math.abs(Date.now() / 1000 - Number(svixTimestamp));
  if (!Number.isFinite(skewSeconds) || skewSeconds > MAX_TIMESTAMP_SKEW_SECONDS) {
    return false;
  }

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedContent)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  // svix-signature is a space-separated list of "v1,<base64 sig>" values —
  // any match is valid (supports secret rotation).
  return svixSignature.split(" ").some((entry) => {
    const sig = entry.split(",")[1];
    if (!sig) return false;
    const sigBuf = Buffer.from(sig);
    return (
      sigBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(sigBuf, expectedBuf)
    );
  });
}

interface ResendWebhookEvent {
  type: string;
  data?: { email_id?: string };
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[Resend webhook] RESEND_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 400 });
  }

  const rawBody = await request.text();
  if (!verifySignature(secret, svixId, svixTimestamp, svixSignature, rawBody)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: ResendWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const emailId = event.data?.email_id;
  if (!emailId) {
    return NextResponse.json({ received: true, skipped: "no email_id" });
  }

  const activity = await findActivityByResendEmailId(emailId);
  if (!activity) {
    return NextResponse.json({ received: true, skipped: "no matching activity" });
  }

  switch (event.type) {
    case "email.delivered":
      await markDelivered(emailId);
      break;
    case "email.opened":
      await markOpened(emailId);
      break;
    case "email.clicked":
      await markClicked(emailId);
      break;
    case "email.bounced":
      await markBounced(emailId);
      break;
    default:
      return NextResponse.json({ received: true, skipped: `unhandled type ${event.type}` });
  }

  return NextResponse.json({ received: true, type: event.type });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "Resend Webhook — email delivery/open/click/bounce tracking",
    configured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
  });
}
