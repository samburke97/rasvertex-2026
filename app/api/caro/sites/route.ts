// app/api/caro/sites/route.ts
// POST — a recurring job added by hand (not from SimPRO).

import { NextRequest, NextResponse } from "next/server";
import { addManualSite } from "@/lib/caro/store";
import { isLineKey, type Site } from "@/lib/caro/data";

export async function POST(request: NextRequest) {
  let site: Site;
  try {
    site = (await request.json()).site;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!site?.key?.startsWith("m:") || !isLineKey(site.line) || !site.name?.trim() || !(site.price > 0) || !site.lastDone) {
    return NextResponse.json({ error: "Name, service line, price and last done are required." }, { status: 400 });
  }
  try {
    await addManualSite({ ...site, source: "manual" });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[Caro] add site failed:", err);
    return NextResponse.json({ error: "Could not add the recurring job." }, { status: 500 });
  }
}
