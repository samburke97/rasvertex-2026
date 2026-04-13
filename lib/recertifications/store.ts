// lib/recertifications/store.ts
// Neon Postgres — tracks ignored jobs and notification cadence.
//
// ── Schema ────────────────────────────────────────────────────────────────
//
// CREATE TABLE recertification_ignored (
//   job_id     INTEGER PRIMARY KEY,
//   reason     TEXT,
//   ignored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// CREATE TABLE recertification_notified (
//   job_id           INTEGER NOT NULL,
//   year             INTEGER NOT NULL,
//   last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   PRIMARY KEY (job_id, year)
// );
//
// -- Migration: if upgrading from old schema that had notified_at only:
// -- ALTER TABLE recertification_notified
// --   ADD COLUMN IF NOT EXISTS last_notified_at TIMESTAMPTZ;
// -- UPDATE recertification_notified SET last_notified_at = notified_at WHERE last_notified_at IS NULL;
// -- ALTER TABLE recertification_notified ALTER COLUMN last_notified_at SET NOT NULL;
// -- ALTER TABLE recertification_notified ALTER COLUMN last_notified_at SET DEFAULT NOW();
//
// ── Dropped tables (run once) ─────────────────────────────────────────────
// DROP TABLE IF EXISTS recertification_quotes;
// DROP TABLE IF EXISTS recertification_cache;
// ─────────────────────────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Ignored jobs ──────────────────────────────────────────────────────────

export async function ignoreJob(jobId: number, reason?: string): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO recertification_ignored (job_id, reason)
    VALUES (${jobId}, ${reason ?? null})
    ON CONFLICT (job_id) DO NOTHING
  `;
}

export async function restoreJob(jobId: number): Promise<void> {
  const sql = db();
  await sql`DELETE FROM recertification_ignored WHERE job_id = ${jobId}`;
}

export async function getIgnoredJobIds(): Promise<Set<number>> {
  const sql = db();
  const rows = await sql`SELECT job_id FROM recertification_ignored`;
  return new Set(rows.map((r) => r.job_id as number));
}

// ── Notification cadence ──────────────────────────────────────────────────
// Stores when each job was last notified so we can apply cadence rules:
//   daysUntilDue > 7  → notify if last notified > 3 days ago (or never)
//   daysUntilDue <= 7 → notify if last notified > 1 day ago (or never)
// Quote creation in SimPRO is the natural stop signal — once a quote exists
// the cron skips the job entirely.

export interface NotifiedRecord {
  jobId: number;
  year: number;
  lastNotifiedAt: Date;
}

export async function getLastNotified(
  jobId: number,
  year: number,
): Promise<Date | null> {
  const sql = db();
  const rows = await sql`
    SELECT last_notified_at
    FROM recertification_notified
    WHERE job_id = ${jobId} AND year = ${year}
  `;
  if (!rows.length) return null;
  return new Date(rows[0].last_notified_at as string);
}

export async function upsertLastNotified(
  jobId: number,
  year: number,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO recertification_notified (job_id, year, last_notified_at)
    VALUES (${jobId}, ${year}, NOW())
    ON CONFLICT (job_id, year) DO UPDATE SET
      last_notified_at = NOW()
  `;
}

// Convenience: load all notified records for a batch of jobs at once
// to avoid N+1 queries in the cron.
export async function getNotifiedMap(
  pairs: { jobId: number; year: number }[],
): Promise<Map<string, Date>> {
  if (!pairs.length) return new Map();
  const sql = db();
  const jobIds = pairs.map((p) => p.jobId);
  const years = [...new Set(pairs.map((p) => p.year))];
  const rows = await sql`
    SELECT job_id, year, last_notified_at
    FROM recertification_notified
    WHERE job_id = ANY(${jobIds}::int[])
      AND year = ANY(${years}::int[])
  `;
  const map = new Map<string, Date>();
  for (const row of rows) {
    map.set(
      `${row.job_id}:${row.year}`,
      new Date(row.last_notified_at as string),
    );
  }
  return map;
}

// ── Cadence helper ────────────────────────────────────────────────────────
// Returns true if this job should fire a notification today.
export function shouldNotify(
  daysUntilDue: number,
  lastNotifiedAt: Date | null,
): boolean {
  if (!lastNotifiedAt) return true; // never notified — always fire
  const daysSinceNotified =
    (Date.now() - lastNotifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue <= 7) return daysSinceNotified >= 1; // daily when urgent
  return daysSinceNotified >= 3; // every 3 days otherwise
}
