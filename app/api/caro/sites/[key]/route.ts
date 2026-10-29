// app/api/caro/sites/[key]/route.ts
// PATCH { state?, stopped? } — save a site's Caro state (bookings, snoozes,
// calls, edits), and stop or restart it. Undo sends the previous state back.
// DELETE — removes a hand-added site (undo of "New recurring job").

import { NextRequest, NextResponse } from "next/server";
import { deleteManualSite, saveSiteState, setStopped } from "@/lib/caro/store";
import { LINES, isLineKey, type SiteState } from "@/lib/caro/data";

type Params = { params: Promise<{ key: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const key = decodeURIComponent((await params).key);
  const [prefix] = key.split(":");
  if (prefix !== "m" && !isLineKey(prefix)) return NextResponse.json({ error: "Invalid site" }, { status: 400 });

  let body: { state?: SiteState; stopped?: boolean; jobId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  try {
    if (body.state) await saveSiteState(key, body.state);
    if (typeof body.stopped === "boolean") {
      if (prefix === "m") await setStopped({ key, source: "manual", jobId: 0, line: LINES[0].key }, body.stopped);
      else if (body.jobId) await setStopped({ key, source: "simpro", jobId: body.jobId, line: prefix }, body.stopped);
      else return NextResponse.json({ error: "jobId is required to stop a SimPRO site" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Caro] save site failed:", err);
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const key = decodeURIComponent((await params).key);
  if (!key.startsWith("m:")) return NextResponse.json({ error: "Only hand-added sites can be deleted" }, { status: 400 });
  try {
    await deleteManualSite(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Caro] delete site failed:", err);
    return NextResponse.json({ error: "Could not delete." }, { status: 500 });
  }
}
