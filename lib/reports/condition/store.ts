// lib/reports/condition/store.ts
// Neon Postgres via @neondatabase/serverless
// Run the migration SQL once to create the table (see bottom of file).
// Mirrors lib/reports/anchor-inspection/store.ts — same pattern, own table.

import { neon } from "@neondatabase/serverless";
import { deleteBlobPhotos } from "@/lib/server/deleteBlobPhotos";
import type { ConditionReportData } from "../condition.types";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Migration — run this ONCE in Neon SQL Editor ──────────────────────────
// CREATE TABLE IF NOT EXISTS condition_reports (
//   job_id      TEXT PRIMARY KEY,
//   data        JSONB NOT NULL,
//   updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

export async function saveReport(
  jobId: string,
  data: ConditionReportData,
): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO condition_reports (job_id, data, updated_at)
    VALUES (${jobId}, ${JSON.stringify(data)}, NOW())
    ON CONFLICT (job_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

export async function getReport(
  jobId: string,
): Promise<ConditionReportData | null> {
  const db = sql();
  const rows = await db`
    SELECT data FROM condition_reports WHERE job_id = ${jobId}
  `;
  if (!rows.length) return null;
  return rows[0].data as ConditionReportData;
}

export async function deleteReport(jobId: string): Promise<boolean> {
  const db = sql();
  const result = await db`
    DELETE FROM condition_reports WHERE job_id = ${jobId} RETURNING data
  `;
  if (!result.length) return false;
  const data = result[0].data as ConditionReportData;
  await deleteBlobPhotos([data.job.coverPhoto, ...data.photos.map((p) => p.url)]);
  return true;
}
