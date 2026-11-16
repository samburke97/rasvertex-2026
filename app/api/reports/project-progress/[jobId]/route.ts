// app/api/reports/project-progress/[jobId]/route.ts
// The Project progress report's draft, keyed by the main (first) job number:
// GET (resume), PATCH (autosave), DELETE (start again). Same shape as the
// other builders' draft routes, so useDraftAutosave works as is. The table
// is created on first use.

import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { isProgressReport } from "@/lib/reports/projectProgress";

type Ctx = { params: Promise<{ jobId: string }> };

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await db()`CREATE TABLE IF NOT EXISTS project_progress_drafts (job_id TEXT PRIMARY KEY, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  ensured = true;
}

async function keyOf(ctx: Ctx) {
  const { jobId } = await ctx.params;
  return /^\d{1,8}$/.test(jobId) ? jobId : null;
}

const fail = (e: unknown) => NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 });

export async function GET(_req: NextRequest, ctx: Ctx) {
  const key = await keyOf(ctx);
  if (!key) return NextResponse.json({ error: "Bad job number" }, { status: 400 });
  try {
    await ensureTable();
    const rows = await db()`SELECT data FROM project_progress_drafts WHERE job_id = ${key}`;
    const report = rows[0]?.data;
    if (!isProgressReport(report)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ report });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const key = await keyOf(ctx);
  if (!key) return NextResponse.json({ error: "Bad job number" }, { status: 400 });
  const report: unknown = await req.json().catch(() => null);
  if (!isProgressReport(report)) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  try {
    await ensureTable();
    await db()`
      INSERT INTO project_progress_drafts (job_id, data, updated_at) VALUES (${key}, ${JSON.stringify(report)}::jsonb, NOW())
      ON CONFLICT (job_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const key = await keyOf(ctx);
  if (!key) return NextResponse.json({ error: "Bad job number" }, { status: 400 });
  try {
    await ensureTable();
    await db()`DELETE FROM project_progress_drafts WHERE job_id = ${key}`;
    return NextResponse.json({ success: true });
  } catch (e) {
    return fail(e);
  }
}
