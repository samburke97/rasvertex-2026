// app/api/caro/settings/route.ts
// PUT { timing? , templates?, rules? } — saves whichever were sent.

import { NextRequest, NextResponse } from "next/server";
import { saveSetting } from "@/lib/caro/store";

export async function PUT(request: NextRequest) {
  let body: { timing?: unknown; templates?: unknown; rules?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    if (body.timing) await saveSetting("timing", body.timing);
    if (Array.isArray(body.templates)) await saveSetting("templates", body.templates);
    if (Array.isArray(body.rules)) await saveSetting("rules", body.rules);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Caro] save settings failed:", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
