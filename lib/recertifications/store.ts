// lib/recertifications/store.ts
// Neon Postgres — tracks quotes, caches the SimPRO job list, and ignored jobs.
//
// ── Schema ────────────────────────────────────────────────────────────────
// CREATE TABLE recertification_quotes (
//   id              SERIAL PRIMARY KEY,
//   site_id         INTEGER NOT NULL,
//   year            INTEGER NOT NULL,
//   quote_type      TEXT NOT NULL DEFAULT 'recertification',
//   quote_id        INTEGER NOT NULL,
//   quote_name      TEXT NOT NULL,
//   quote_status    TEXT NOT NULL DEFAULT 'created',
//   simpro_quote_no TEXT,
//   customer        TEXT NOT NULL,
//   site_name       TEXT NOT NULL,
//   created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   UNIQUE (site_id, year, quote_type)
// );
//
// CREATE TABLE recertification_cache (
//   id          INTEGER PRIMARY KEY DEFAULT 1,
//   jobs        JSONB NOT NULL,
//   fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// CREATE TABLE recertification_ignored (
//   job_id     INTEGER PRIMARY KEY,
//   reason     TEXT,
//   ignored_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// ─────────────────────────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Quote records ─────────────────────────────────────────────────────────

export interface RecertQuoteRecord {
  siteId: number;
  year: number;
  quoteType: string;
  quoteId: number;
  quoteName: string;
  quoteStatus: string;
  simproQuoteNo: string | null;
  customer: string;
  siteName: string;
  createdAt: string;
}

export async function saveRecertQuote(
  record: Omit<RecertQuoteRecord, "createdAt">,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO recertification_quotes (
      site_id, year, quote_type, quote_id, quote_name,
      quote_status, simpro_quote_no, customer, site_name
    )
    VALUES (
      ${record.siteId}, ${record.year}, ${record.quoteType ?? "recertification"},
      ${record.quoteId}, ${record.quoteName},
      ${record.quoteStatus ?? "created"}, ${record.simproQuoteNo ?? null},
      ${record.customer}, ${record.siteName}
    )
    ON CONFLICT (site_id, year, quote_type) DO UPDATE SET
      quote_id        = EXCLUDED.quote_id,
      quote_name      = EXCLUDED.quote_name,
      quote_status    = EXCLUDED.quote_status,
      simpro_quote_no = EXCLUDED.simpro_quote_no,
      customer        = EXCLUDED.customer,
      site_name       = EXCLUDED.site_name
  `;
}

export async function getAllRecertQuotes(): Promise<RecertQuoteRecord[]> {
  const sql = db();
  const rows = await sql`
    SELECT site_id, year, quote_type, quote_id, quote_name,
           quote_status, simpro_quote_no, customer, site_name, created_at
    FROM recertification_quotes
    ORDER BY created_at DESC
  `;
  return rows.map(rowToRecord);
}

export async function getRecertQuote(
  siteId: number,
  year: number,
  quoteType = "recertification",
): Promise<RecertQuoteRecord | null> {
  const sql = db();
  const rows = await sql`
    SELECT site_id, year, quote_type, quote_id, quote_name,
           quote_status, simpro_quote_no, customer, site_name, created_at
    FROM recertification_quotes
    WHERE site_id = ${siteId} AND year = ${year} AND quote_type = ${quoteType}
  `;
  if (!rows.length) return null;
  return rowToRecord(rows[0]);
}

export async function getRecertQuoteMap(
  pairs: { siteId: number; year: number }[],
  quoteType = "recertification",
): Promise<Map<string, RecertQuoteRecord>> {
  if (!pairs.length) return new Map();
  const sql = db();
  const siteIds = pairs.map((p) => p.siteId);
  const years = [...new Set(pairs.map((p) => p.year))];
  const rows = await sql`
    SELECT site_id, year, quote_type, quote_id, quote_name,
           quote_status, simpro_quote_no, customer, site_name, created_at
    FROM recertification_quotes
    WHERE site_id = ANY(${siteIds}::int[])
      AND year = ANY(${years}::int[])
      AND quote_type = ${quoteType}
  `;
  const map = new Map<string, RecertQuoteRecord>();
  for (const row of rows) {
    map.set(`${row.site_id}:${row.year}`, rowToRecord(row));
  }
  return map;
}

function rowToRecord(r: Record<string, unknown>): RecertQuoteRecord {
  return {
    siteId: r.site_id as number,
    year: r.year as number,
    quoteType: (r.quote_type as string) ?? "recertification",
    quoteId: r.quote_id as number,
    quoteName: r.quote_name as string,
    quoteStatus: (r.quote_status as string) ?? "created",
    simproQuoteNo: (r.simpro_quote_no as string | null) ?? null,
    customer: r.customer as string,
    siteName: r.site_name as string,
    createdAt: r.created_at as string,
  };
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

// ── Job list cache ────────────────────────────────────────────────────────

const CACHE_TTL_MINUTES = 30;

export async function getCachedJobs<T>(): Promise<{
  jobs: T[];
  fetchedAt: Date;
} | null> {
  const sql = db();
  try {
    const rows = await sql`
      SELECT jobs, fetched_at FROM recertification_cache WHERE id = 1
    `;
    if (!rows.length) return null;
    const fetchedAt = new Date(rows[0].fetched_at as string);
    const ageMinutes = (Date.now() - fetchedAt.getTime()) / 60000;
    if (ageMinutes > CACHE_TTL_MINUTES) return null;
    return { jobs: rows[0].jobs as T[], fetchedAt };
  } catch {
    return null;
  }
}

export async function setCachedJobs<T>(jobs: T[]): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO recertification_cache (id, jobs, fetched_at)
    VALUES (1, ${JSON.stringify(jobs)}, NOW())
    ON CONFLICT (id) DO UPDATE SET
      jobs       = EXCLUDED.jobs,
      fetched_at = EXCLUDED.fetched_at
  `;
}
