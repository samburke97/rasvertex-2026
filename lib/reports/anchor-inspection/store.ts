// lib/reports/anchor-inspection/store.ts
// Neon Postgres via @neondatabase/serverless
// Run the migration SQL once to create the table (see bottom of file).

import { neon } from "@neondatabase/serverless";
import type { AnchorReportData } from "../anchor.types";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Migration — run this ONCE in Neon SQL Editor ──────────────────────────
// CREATE TABLE IF NOT EXISTS anchor_inspection_reports (
//   job_id      TEXT PRIMARY KEY,
//   data        JSONB NOT NULL,
//   updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

export async function saveReport(
  jobId: string,
  data: AnchorReportData,
): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO anchor_inspection_reports (job_id, data, updated_at)
    VALUES (${jobId}, ${JSON.stringify(data)}, NOW())
    ON CONFLICT (job_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

export async function getReport(
  jobId: string,
): Promise<AnchorReportData | null> {
  const db = sql();
  const rows = await db`
    SELECT data FROM anchor_inspection_reports WHERE job_id = ${jobId}
  `;
  if (!rows.length) return null;
  return rows[0].data as AnchorReportData;
}

export async function deleteReport(jobId: string): Promise<boolean> {
  const db = sql();
  const result = await db`
    DELETE FROM anchor_inspection_reports WHERE job_id = ${jobId} RETURNING job_id
  `;
  return result.length > 0;
}
