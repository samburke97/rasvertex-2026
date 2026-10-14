// app/api/checkin/sync/route.ts
//
// Re-reads SimPRO (read-only), rebuilds every client's check-in record and
// stores it (lib/checkin/store.ts). Called daily by Vercel cron (GET, see
// vercel.json) and by the "Refresh from SimPRO" button (POST).

import { NextResponse } from "next/server";
import { hasSimproConfig } from "@/lib/recertifications/simpro";
import { pullSimpro } from "@/lib/checkin/simpro";
import { analyse } from "@/lib/checkin/analyse";
import { saveCheckin } from "@/lib/checkin/store";

// A full pull pages through every customer, job, quote and invoice (~1–2 min).
export const maxDuration = 300;

async function sync() {
  if (!hasSimproConfig()) {
    return NextResponse.json({ error: "SimPRO configuration missing" }, { status: 500 });
  }
  try {
    const started = Date.now();
    const result = analyse(await pullSimpro());
    await saveCheckin(result);
    const summary = { clients: result.clients.length, seconds: Math.round((Date.now() - started) / 1000) };
    console.log("[Checkin] sync", summary);
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[Checkin] sync failed:", err);
    return NextResponse.json({ error: "Sync failed." }, { status: 500 });
  }
}

export const GET = sync;
export const POST = sync;
