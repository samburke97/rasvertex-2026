// app/api/reports/week-schedule/[range]/route.ts
// The Weekly schedule's edits for one date range ("2026-11-16_2026-11-22"):
// GET (resume), PATCH (autosave), DELETE (reset all edits). Same shape as
// the other builders' draft routes (lib/reports/drafts.ts), so
// useDraftAutosave works as is. The table is created on first use.

import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { isWeekDraft } from "@/lib/reports/weekSchedule";

type Ctx = { params: Promise<{ range: string }> };

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await db()`CREATE TABLE IF NOT EXISTS week_schedule_drafts (range_key TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  ensured = true;
}

async function keyOf(ctx: Ctx): Promise<string | null> {
  const { range } = await ctx.params;
  return /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(range) ? range : null;
}

const fail = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });

export async function GET(_req: NextRequest, ctx: Ctx) {
  const key = await keyOf(ctx);
  if (!key) return NextResponse.json({ error: "Bad range" }, { status: 400 });
  try {
    await ensureTable();
    const rows = await db()`SELECT data FROM week_schedule_drafts WHERE range_key = ${key}`;
    const report = rows[0]?.data;
    if (!isWeekDraft(report)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ report });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const key = await keyOf(ctx);
  if (!key) return NextResponse.json({ error: "Bad range" }, { status: 400 });
  const report: unknown = await req.json().catch(() => null);
  if (!isWeekDraft(report)) return NextResponse.json({ error: "Invalid draft" }, { status: 400 });
  try {
    await ensureTable();
    await db()`
      INSERT INTO week_schedule_drafts (range_key, data, updated_at) VALUES (${key}, ${JSON.stringify(report)}::jsonb, NOW())
      ON CONFLICT (range_key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const key = await keyOf(ctx);
  if (!key) return NextResponse.json({ error: "Bad range" }, { status: 400 });
  try {
    await ensureTable();
    await db()`DELETE FROM week_schedule_drafts WHERE range_key = ${key}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}
