// lib/recertifications/store.ts
// Neon Postgres — recurring-job cache, ignored jobs, notification cadence.
// Shared across all recurring-job categories (height-safety, window-cleaning,
// building-cleaning, ...) — every table is scoped by a `category` column so
// syncing/ignoring/notifying in one category never touches another's rows.
//
// ── Schema ────────────────────────────────────────────────────────────────
//
// CREATE TABLE recertification_ignored (
//   job_id     INTEGER NOT NULL,
//   category   TEXT NOT NULL,
//   reason     TEXT,
//   ignored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   PRIMARY KEY (job_id, category)
// );
//
// CREATE TABLE recertification_notified (
//   job_id           INTEGER NOT NULL,
//   year             INTEGER NOT NULL,
//   category         TEXT NOT NULL,
//   last_notified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   PRIMARY KEY (job_id, year, category)
// );
//
// CREATE TABLE recertification_cache (
//   site_id        INTEGER NOT NULL,
//   category       TEXT NOT NULL,
//   job_id         INTEGER NOT NULL,
//   customer_id    INTEGER NOT NULL,
//   customer       TEXT NOT NULL,
//   site           TEXT NOT NULL,
//   completed_date DATE NOT NULL,
//   next_due_date  DATE NOT NULL,
//   days_until_due INTEGER NOT NULL,
//   status         TEXT NOT NULL,
//   total_ex_tax   NUMERIC NOT NULL,
//   total_inc_tax  NUMERIC NOT NULL,
//   quote_year     INTEGER NOT NULL,
//   synced_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   PRIMARY KEY (site_id, category)
// );
// ─────────────────────────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";
import { computeDueStatus, type RecertificationJob } from "./types";
import type { RecurringCategory } from "./categories";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Ignored jobs ──────────────────────────────────────────────────────────

export async function ignoreJob(
  jobId: number,
  category: RecurringCategory,
  reason?: string,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO recertification_ignored (job_id, category, reason)
    VALUES (${jobId}, ${category}, ${reason ?? null})
    ON CONFLICT (job_id, category) DO NOTHING
  `;
}

export async function restoreJob(
  jobId: number,
  category: RecurringCategory,
): Promise<void> {
  const sql = db();
  await sql`
    DELETE FROM recertification_ignored
    WHERE job_id = ${jobId} AND category = ${category}
  `;
}

export async function getIgnoredJobIds(
  category: RecurringCategory,
): Promise<Set<number>> {
  const sql = db();
  const rows = await sql`
    SELECT job_id FROM recertification_ignored WHERE category = ${category}
  `;
  return new Set(rows.map((r) => r.job_id as number));
}

// ── Cache reads ───────────────────────────────────────────────────────────

export async function getCachedJobs(
  category: RecurringCategory,
  ignoredIds: Set<number>,
): Promise<{
  active: RecertificationJob[];
  ignored: RecertificationJob[];
  syncedAt: Date | null;
}> {
  const sql = db();
  // Not ordering by days_until_due here — that column is a snapshot from
  // whenever this row was last synced, and days-until-due (and everything
  // derived from it) is recomputed below relative to *today* regardless of
  // sync age. Sort after recomputing instead.
  const rows = await sql`
    SELECT * FROM recertification_cache WHERE category = ${category}
  `;

  if (!rows.length) return { active: [], ignored: [], syncedAt: null };

  const syncedAt = new Date(rows[0].synced_at as string);
  const currentYear = new Date().getFullYear();
  const active: RecertificationJob[] = [];
  const ignored: RecertificationJob[] = [];

  for (const r of rows) {
    const nextDueDate = (r.next_due_date as Date).toISOString().split("T")[0];
    const { daysUntilDue, status } = computeDueStatus(nextDueDate);
    const job: RecertificationJob = {
      id: r.job_id as number,
      name: "",
      customer: r.customer as string,
      customerId: r.customer_id as number,
      site: r.site as string,
      siteId: r.site_id as number,
      completedDate: (r.completed_date as Date).toISOString().split("T")[0],
      nextDueDate,
      daysUntilDue,
      status,
      totalExTax: Number(r.total_ex_tax),
      totalIncTax: Number(r.total_inc_tax),
      quoteYear: Math.max(r.quote_year as number, currentYear),
    };
    if (ignoredIds.has(job.id)) {
      ignored.push(job);
    } else {
      active.push(job);
    }
  }

  active.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  ignored.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  return { active, ignored, syncedAt };
}

// ── Cache writes ──────────────────────────────────────────────────────────

export async function replaceCachedJobs(
  category: RecurringCategory,
  jobs: RecertificationJob[],
): Promise<void> {
  const sql = db();
  // Scoped to this category only — other categories' cached rows are untouched.
  await sql`DELETE FROM recertification_cache WHERE category = ${category}`;
  if (!jobs.length) return;

  for (const j of jobs) {
    await sql`
      INSERT INTO recertification_cache (
        site_id,
        category,
        job_id,
        customer_id,
        customer,
        site,
        completed_date,
        next_due_date,
        days_until_due,
        status,
        total_ex_tax,
        total_inc_tax,
        quote_year
      ) VALUES (
        ${j.siteId},
        ${category},
        ${j.id},
        ${j.customerId},
        ${j.customer},
        ${j.site},
        ${j.completedDate},
        ${j.nextDueDate},
        ${j.daysUntilDue},
        ${j.status},
        ${j.totalExTax},
        ${j.totalIncTax},
        ${j.quoteYear}
      )
    `;
  }
}

export async function removeSiteFromCache(
  siteId: number,
  category: RecurringCategory,
): Promise<void> {
  const sql = db();
  await sql`
    DELETE FROM recertification_cache
    WHERE site_id = ${siteId} AND category = ${category}
  `;
}

// ── Notification cadence ──────────────────────────────────────────────────

export interface NotifiedRecord {
  jobId: number;
  year: number;
  lastNotifiedAt: Date;
}

export async function upsertLastNotified(
  jobId: number,
  year: number,
  category: RecurringCategory,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO recertification_notified (job_id, year, category, last_notified_at)
    VALUES (${jobId}, ${year}, ${category}, NOW())
    ON CONFLICT (job_id, year, category) DO UPDATE SET last_notified_at = NOW()
  `;
}

export async function getNotifiedMap(
  category: RecurringCategory,
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
      AND category = ${category}
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

export function shouldNotify(
  daysUntilDue: number,
  lastNotifiedAt: Date | null,
): boolean {
  if (!lastNotifiedAt) return true;
  const daysSinceNotified =
    (Date.now() - lastNotifiedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysUntilDue <= 7) return daysSinceNotified >= 1;
  return daysSinceNotified >= 3;
}
