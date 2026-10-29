// app/api/caro/reminders/route.ts
// POST { keys, subject, body, chase } — send a reminder to each site, merge
// fields filled per site. Test mode (default) sends one sample to Sam and
// records nothing; see lib/caro/send.ts.

import { NextRequest, NextResponse } from "next/server";
import { getTiming, loadSites } from "@/lib/caro/store";
import { sendReminders } from "@/lib/caro/send";
import type { Chase } from "@/lib/caro/data";

export async function POST(request: NextRequest) {
  let body: { keys?: string[]; subject?: string; body?: string; chase?: Chase };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const subject = body.subject?.trim();
  const text = body.body?.trim();
  if (!body.keys?.length || !subject || !text) {
    return NextResponse.json({ error: "keys, subject and body are required" }, { status: 400 });
  }
  const chase: Chase = body.chase === "none" || body.chase === "flag" ? body.chase : "follow";
  try {
    const keys = new Set(body.keys);
    const [{ sites }, timing] = await Promise.all([loadSites(), getTiming()]);
    const picked = sites.filter((s) => keys.has(s.key) && !s.stopped);
    return NextResponse.json(await sendReminders(picked, timing, { subject, body: text }, { chase }));
  } catch (err) {
    console.error("[Caro] send failed:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to send." }, { status: 502 });
  }
}
