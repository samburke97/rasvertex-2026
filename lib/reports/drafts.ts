// lib/reports/drafts.ts
//
// Draft persistence for every report builder: one Neon table per report,
// keyed by the SimPRO job or quote number, holding the draft as JSON. A
// builder resumes its draft when the same number is loaded again, and
// autosaves as the user works (see useDraftAutosave).
//
// Each report's API route is just a config for draftRoutes(). A new report
// needs its table created once in the Neon SQL editor:
//   CREATE TABLE IF NOT EXISTS <table> (
//     <key>       TEXT PRIMARY KEY,
//     data        JSONB NOT NULL,
//     updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );

import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { deleteBlobPhotos } from "@/lib/server/deleteBlobPhotos";

export interface DraftConfig<T> {
  table: string;
  key: "job_id" | "quote_id";
  /** The route's dynamic segment, e.g. "jobId" for [jobId]. */
  param: string;
  /** Rejects malformed saves, and drafts from older builder versions. */
  isValid: (x: unknown) => x is T;
  /** Uploaded images to delete from Blob storage with the draft. */
  blobUrls: (d: Partial<T>) => (string | null | undefined)[];
}

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

/** GET (resume), PATCH (autosave) and DELETE (start again) for one report. */
export function draftRoutes<T>(c: DraftConfig<T>) {
  // Table and column names come from code, never the request.
  const id = async (ctx: { params: Promise<Record<string, string>> }) => (await ctx.params)[c.param];

  async function GET(_req: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
    const rows = await sql().query(`SELECT data FROM ${c.table} WHERE ${c.key} = $1`, [await id(ctx)]);
    const report = rows[0]?.data;
    if (!c.isValid(report)) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ report });
  }

  async function PATCH(req: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
    const report: unknown = await req.json().catch(() => null);
    if (!c.isValid(report)) return NextResponse.json({ error: "Invalid report" }, { status: 400 });
    await sql().query(
      `INSERT INTO ${c.table} (${c.key}, data, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (${c.key}) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [await id(ctx), JSON.stringify(report)],
    );
    return NextResponse.json({ success: true });
  }

  async function DELETE(_req: NextRequest, ctx: { params: Promise<Record<string, string>> }) {
    const rows = await sql().query(`DELETE FROM ${c.table} WHERE ${c.key} = $1 RETURNING data`, [await id(ctx)]);
    if (!rows.length) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await deleteBlobPhotos(c.blobUrls((rows[0].data ?? {}) as Partial<T>));
    return NextResponse.json({ success: true });
  }

  return { GET, PATCH, DELETE };
}

/** For reports with no version check: any object with a job. */
export const hasJob = <T,>(x: unknown): x is T => !!x && typeof x === "object" && "job" in x;
