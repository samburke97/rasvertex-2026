// lib/reports/settings/store.ts
//
// Neon storage for the report settings: one row, created on first use.
//
// CREATE TABLE report_settings (
//   key        TEXT PRIMARY KEY,          -- 'current'
//   value      JSONB NOT NULL,            -- ReportSettings
//   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );

import { neon } from "@neondatabase/serverless";
import { defaultSettings } from "./defaults";
import type { ReportSettings } from "./types";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await db()`CREATE TABLE IF NOT EXISTS report_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  ensured = true;
}

/** The saved settings, or the defaults when none have been saved. */
export async function getSettings(): Promise<{ settings: ReportSettings; updatedAt: string | null }> {
  await ensureTable();
  const rows = await db()`SELECT value, updated_at FROM report_settings WHERE key = 'current'`;
  if (!rows.length) return { settings: defaultSettings(), updatedAt: null };
  return { settings: rows[0].value as ReportSettings, updatedAt: String(rows[0].updated_at) };
}

export async function saveSettings(s: ReportSettings): Promise<void> {
  await ensureTable();
  await db()`
    INSERT INTO report_settings (key, value, updated_at) VALUES ('current', ${JSON.stringify(s)}::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
}

/** Back to the defaults: the saved row is removed. */
export async function resetSettings(): Promise<void> {
  await ensureTable();
  await db()`DELETE FROM report_settings WHERE key = 'current'`;
}
