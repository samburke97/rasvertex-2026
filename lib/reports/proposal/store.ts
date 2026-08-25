// lib/reports/proposal/store.ts
// Neon Postgres via @neondatabase/serverless
// Run the migration SQL once to create the table (see bottom of file).

import { neon } from "@neondatabase/serverless";
import { deleteBlobPhotos } from "@/lib/server/deleteBlobPhotos";
import type { ProposalData } from "../proposal.types";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Migration — run this ONCE in Neon SQL Editor ──────────────────────────
// CREATE TABLE IF NOT EXISTS proposal_reports (
//   quote_id    TEXT PRIMARY KEY,
//   data        JSONB NOT NULL,
//   updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

export async function saveReport(
  quoteId: string,
  data: ProposalData,
): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO proposal_reports (quote_id, data, updated_at)
    VALUES (${quoteId}, ${JSON.stringify(data)}, NOW())
    ON CONFLICT (quote_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

export async function getReport(
  quoteId: string,
): Promise<ProposalData | null> {
  const db = sql();
  const rows = await db`
    SELECT data FROM proposal_reports WHERE quote_id = ${quoteId}
  `;
  if (!rows.length) return null;
  return rows[0].data as ProposalData;
}

export async function deleteReport(quoteId: string): Promise<boolean> {
  const db = sql();
  const result = await db`
    DELETE FROM proposal_reports WHERE quote_id = ${quoteId} RETURNING data
  `;
  if (!result.length) return false;
  const data = result[0].data as ProposalData;
  await deleteBlobPhotos(data.photos.map((p) => p.url));
  return true;
}
