// app/api/checkin/route.ts
// Client Check-in list: one slim row per SimPRO client, highest priority first.

import { NextResponse } from "next/server";
import { listCheckinRows } from "@/lib/checkin/store";

export async function GET() {
  try {
    return NextResponse.json(await listCheckinRows());
  } catch (err) {
    console.error("[Checkin] list failed:", err);
    return NextResponse.json({ error: "Could not load clients." }, { status: 500 });
  }
}
