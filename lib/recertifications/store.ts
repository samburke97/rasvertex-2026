// lib/recertifications/store.ts
// Neon Postgres — tracks which site+year combos have had quotes created.
//
// ── Migration — run this ONCE in Neon SQL Editor ──────────────────────────
// CREATE TABLE IF NOT EXISTS recertification_quotes (
//   id           SERIAL PRIMARY KEY,
//   site_id      INTEGER NOT NULL,
//   year         INTEGER NOT NULL,
//   quote_id     INTEGER NOT NULL,
//   quote_name   TEXT NOT NULL,
//   customer     TEXT NOT NULL,
//   site_name    TEXT NOT NULL,
//   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   UNIQUE (site_id, year)
// );

import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export interface RecertQuoteRecord {
  siteId: number;
  year: number;
  quoteId: number;
  quoteName: string;
  customer: string;
  siteName: string;
  createdAt: string;
}

export async function saveRecertQuote(
  record: Omit<RecertQuoteRecord, "createdAt">,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO recertification_quotes (site_id, year, quote_id, quote_name, customer, site_name)
    VALUES (${record.siteId}, ${record.year}, ${record.quoteId}, ${record.quoteName}, ${record.customer}, ${record.siteName})
    ON CONFLICT (site_id, year) DO UPDATE SET
      quote_id   = EXCLUDED.quote_id,
      quote_name = EXCLUDED.quote_name,
      customer   = EXCLUDED.customer,
      site_name  = EXCLUDED.site_name
  `;
}

export async function getAllRecertQuotes(): Promise<RecertQuoteRecord[]> {
  const sql = db();
  const rows = await sql`
    SELECT site_id, year, quote_id, quote_name, customer, site_name, created_at
    FROM recertification_quotes
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    siteId: r.site_id,
    year: r.year,
    quoteId: r.quote_id,
    quoteName: r.quote_name,
    customer: r.customer,
    siteName: r.site_name,
    createdAt: r.created_at,
  }));
}

export async function getRecertQuote(
  siteId: number,
  year: number,
): Promise<RecertQuoteRecord | null> {
  const sql = db();
  const rows = await sql`
    SELECT site_id, year, quote_id, quote_name, customer, site_name, created_at
    FROM recertification_quotes
    WHERE site_id = ${siteId} AND year = ${year}
  `;
  if (!rows.length) return null;
  const r = rows[0];
  return {
    siteId: r.site_id,
    year: r.year,
    quoteId: r.quote_id,
    quoteName: r.quote_name,
    customer: r.customer,
    siteName: r.site_name,
    createdAt: r.created_at,
  };
}
