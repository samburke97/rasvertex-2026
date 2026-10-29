// lib/reports/proposal/store.ts
// Neon Postgres via @neondatabase/serverless
// Run the migration SQL once to create the table (see bottom of file).

import { neon } from "@neondatabase/serverless";
import { deleteBlobPhotos } from "@/lib/server/deleteBlobPhotos";
import { isProposal, type Proposal } from "./v3/types";

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
  data: Proposal,
): Promise<void> {
  const db = sql();
  await db`
    INSERT INTO proposal_reports (quote_id, data, updated_at)
    VALUES (${quoteId}, ${JSON.stringify(data)}, NOW())
    ON CONFLICT (quote_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `;
}

// Drafts saved by earlier versions of the builder have a different shape —
// they aren't loaded (the builder starts fresh from the quote).
export async function getReport(
  quoteId: string,
): Promise<Proposal | null> {
  const db = sql();
  const rows = await db`
    SELECT data FROM proposal_reports WHERE quote_id = ${quoteId}
  `;
  if (!rows.length) return null;
  return isProposal(rows[0].data) ? rows[0].data : null;
}

export async function deleteReport(quoteId: string): Promise<boolean> {
  const db = sql();
  const result = await db`
    DELETE FROM proposal_reports WHERE quote_id = ${quoteId} RETURNING data
  `;
  if (!result.length) return false;
  const data = result[0].data as Partial<Proposal> & { photos?: { url: string }[] };
  await deleteBlobPhotos([
    ...(data.photos ?? []).map((p) => p.url),
    ...(data.simpro?.photos ?? []).map((p) => p.url),
    ...(data.uploads ?? []),
  ]);
  return true;
}
