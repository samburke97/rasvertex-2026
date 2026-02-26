// lib/reports/works-agreement/store.ts
// Neon Postgres via @neondatabase/serverless
// Run the migration SQL once to create the table (see bottom of file).

import { neon } from "@neondatabase/serverless";
import type { WorksAgreementData } from "./types";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Migration — run this ONCE in Neon SQL Editor ──────────────────────────
// CREATE TABLE IF NOT EXISTS works_agreements (
//   job_id        TEXT PRIMARY KEY,
//   data          JSONB NOT NULL,
//   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

export async function saveAgreement(
  agreement: WorksAgreementData,
): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO works_agreements (job_id, data, created_at)
    VALUES (${agreement.jobId}, ${JSON.stringify(agreement)}, ${agreement.createdAt})
    ON CONFLICT (job_id) DO UPDATE SET data = EXCLUDED.data
  `;
}

export async function getAgreement(
  jobId: string,
): Promise<WorksAgreementData | null> {
  const db = sql();
  const rows = await db`
    SELECT data FROM works_agreements WHERE job_id = ${jobId}
  `;
  if (!rows.length) return null;
  return rows[0].data as WorksAgreementData;
}

export async function getAllAgreements(): Promise<WorksAgreementData[]> {
  const db = sql();
  const rows = await db`
    SELECT data FROM works_agreements ORDER BY created_at DESC
  `;
  return rows.map((r) => r.data as WorksAgreementData);
}

export async function updateAgreement(
  jobId: string,
  updates: Partial<WorksAgreementData>,
): Promise<WorksAgreementData | null> {
  const existing = await getAgreement(jobId);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  const db = sql();
  await db`
    UPDATE works_agreements SET data = ${JSON.stringify(updated)} WHERE job_id = ${jobId}
  `;
  return updated;
}

export async function deleteAgreement(jobId: string): Promise<boolean> {
  const db = sql();
  const result = await db`
    DELETE FROM works_agreements WHERE job_id = ${jobId} RETURNING job_id
  `;
  return result.length > 0;
}
