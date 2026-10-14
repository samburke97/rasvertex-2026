// lib/checkin/store.ts
//
// Neon storage for Client Check-in (/checkin). The sync route writes the
// latest analysis here so the page loads instantly instead of waiting on a
// 2-minute SimPRO pull. Tables are created on first use:
//
// CREATE TABLE checkin_clients (
//   id      INTEGER PRIMARY KEY,   -- SimPRO customer ID
//   score   INTEGER NOT NULL,
//   row     JSONB NOT NULL,        -- CheckinRow: what the table needs
//   detail  JSONB NOT NULL         -- CheckinClient: history, angles, etc.
// );
// CREATE TABLE checkin_meta (
//   id            INTEGER PRIMARY KEY,  -- always 1
//   synced_at     TIMESTAMPTZ NOT NULL,
//   data_quality  JSONB NOT NULL
// );

import { neon } from "@neondatabase/serverless";
import type { AngleId } from "./config";
import type { CheckinClient, CheckinResult, DataQualityRow } from "./analyse";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  const sql = db();
  await sql`
    CREATE TABLE IF NOT EXISTS checkin_clients (
      id INTEGER PRIMARY KEY, score INTEGER NOT NULL, row JSONB NOT NULL, detail JSONB NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS checkin_meta (
      id INTEGER PRIMARY KEY, synced_at TIMESTAMPTZ NOT NULL, data_quality JSONB NOT NULL
    )
  `;
  ensured = true;
}

/** One table row: just what the customer list shows and filters on. */
export interface CheckinRow {
  id: number;
  name: string;
  type: CheckinClient["type"];
  contactName: string;
  email: string;
  phone: string;
  site: string;
  suburb: string;
  jobCount: number;
  ltv: number;
  lastJobDate: string | null;
  lastJobDesc: string | null;
  monthsSince: number | null;
  score: number;
  leadId: AngleId | null;
  leadTitle: string;
  angleIds: AngleId[];
  blockers: string[];
  costCentres: string[];
  sharedCount: number;
}

function toRow(c: CheckinClient): CheckinRow {
  const lead = [...c.angles, ...c.alternatives].find((a) => a.id === c.leadAngle);
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    contactName: c.contactName,
    email: c.email,
    phone: c.phone,
    site: c.site,
    suburb: c.suburb,
    jobCount: c.jobCount,
    ltv: Math.round(c.ltv),
    lastJobDate: c.lastJob?.date ?? null,
    lastJobDesc: c.lastJob?.desc ?? null,
    monthsSince: c.monthsSince,
    score: c.score,
    leadId: c.leadAngle,
    leadTitle: lead?.title ?? "",
    angleIds: c.angles.map((a) => a.id),
    blockers: c.angles.filter((a) => a.blocker).map((a) => a.label),
    costCentres: c.costCentres,
    sharedCount: c.sharedWith.length,
  };
}

const BATCH = 150;

/** Replaces the stored analysis. Upserts in batches, then removes clients
 *  that no longer exist, so the page never sees an empty table mid-sync. */
export async function saveCheckin(result: CheckinResult): Promise<void> {
  await ensureTables();
  const sql = db();
  for (let i = 0; i < result.clients.length; i += BATCH) {
    const batch = result.clients.slice(i, i + BATCH).map((c) => ({ id: c.id, score: c.score, row: toRow(c), detail: c }));
    await sql`
      INSERT INTO checkin_clients (id, score, row, detail)
      SELECT (x->>'id')::int, (x->>'score')::int, x->'row', x->'detail'
      FROM jsonb_array_elements(${JSON.stringify(batch)}::jsonb) AS x
      ON CONFLICT (id) DO UPDATE SET score = EXCLUDED.score, row = EXCLUDED.row, detail = EXCLUDED.detail
    `;
  }
  const ids = result.clients.map((c) => c.id);
  await sql`DELETE FROM checkin_clients WHERE NOT (id = ANY(${ids}::int[]))`;
  await sql`
    INSERT INTO checkin_meta (id, synced_at, data_quality)
    VALUES (1, NOW(), ${JSON.stringify(result.dataQuality)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET synced_at = EXCLUDED.synced_at, data_quality = EXCLUDED.data_quality
  `;
}

export async function listCheckinRows(): Promise<{ rows: CheckinRow[]; syncedAt: string | null }> {
  await ensureTables();
  const sql = db();
  const [rows, meta] = await Promise.all([
    sql`SELECT row FROM checkin_clients ORDER BY score DESC, id`,
    sql`SELECT synced_at FROM checkin_meta WHERE id = 1`,
  ]);
  return {
    rows: rows.map((r) => r.row as CheckinRow),
    syncedAt: meta[0] ? new Date(meta[0].synced_at as string).toISOString() : null,
  };
}

export async function getCheckinClient(id: number): Promise<CheckinClient | null> {
  await ensureTables();
  const rows = await db()`SELECT detail FROM checkin_clients WHERE id = ${id}`;
  return (rows[0]?.detail as CheckinClient) ?? null;
}

export async function listAllCheckinClients(): Promise<CheckinClient[]> {
  await ensureTables();
  const rows = await db()`SELECT detail FROM checkin_clients ORDER BY score DESC, id`;
  return rows.map((r) => r.detail as CheckinClient);
}

export async function getDataQuality(): Promise<DataQualityRow[]> {
  await ensureTables();
  const rows = await db()`SELECT data_quality FROM checkin_meta WHERE id = 1`;
  return (rows[0]?.data_quality as DataQualityRow[]) ?? [];
}
