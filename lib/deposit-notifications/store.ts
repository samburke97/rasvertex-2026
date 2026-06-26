// lib/deposit-notifications/store.ts
// Neon Postgres — deposit notification queue for $5k–$20k jobs.
//
// ── Schema ────────────────────────────────────────────────────────────────────
//
// CREATE TABLE deposit_notifications (
//   job_id         INTEGER PRIMARY KEY,
//   job_no         TEXT NOT NULL,
//   job_name       TEXT NOT NULL,
//   client_name    TEXT NOT NULL,
//   site_name      TEXT NOT NULL,
//   site_address   TEXT NOT NULL,
//   scheduled_date DATE NOT NULL,
//   total_ex_tax   NUMERIC NOT NULL,
//   total_inc_gst  NUMERIC NOT NULL,
//   deposit_amount NUMERIC NOT NULL,
//   notified_at    TIMESTAMPTZ,
//   created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// ─────────────────────────────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export interface DepositRecord {
  jobId: number;
  jobNo: string;
  jobName: string;
  clientName: string;
  siteName: string;
  siteAddress: string;
  scheduledDate: string; // YYYY-MM-DD
  totalExTax: number;
  totalIncGst: number;
  depositAmount: number;
}

// Upsert a job's schedule. If the scheduled_date changes, notified_at is
// cleared so the notification fires again 1 month before the new date.
export async function upsertDepositNotification(
  record: DepositRecord,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO deposit_notifications (
      job_id, job_no, job_name, client_name, site_name, site_address,
      scheduled_date, total_ex_tax, total_inc_gst, deposit_amount, updated_at
    ) VALUES (
      ${record.jobId}, ${record.jobNo}, ${record.jobName}, ${record.clientName},
      ${record.siteName}, ${record.siteAddress}, ${record.scheduledDate},
      ${record.totalExTax}, ${record.totalIncGst}, ${record.depositAmount}, NOW()
    )
    ON CONFLICT (job_id) DO UPDATE SET
      job_no         = EXCLUDED.job_no,
      job_name       = EXCLUDED.job_name,
      client_name    = EXCLUDED.client_name,
      site_name      = EXCLUDED.site_name,
      site_address   = EXCLUDED.site_address,
      scheduled_date = EXCLUDED.scheduled_date,
      total_ex_tax   = EXCLUDED.total_ex_tax,
      total_inc_gst  = EXCLUDED.total_inc_gst,
      deposit_amount = EXCLUDED.deposit_amount,
      updated_at     = NOW(),
      notified_at    = CASE
        WHEN deposit_notifications.scheduled_date != EXCLUDED.scheduled_date THEN NULL
        ELSE deposit_notifications.notified_at
      END
  `;
}

// Returns jobs where today >= scheduled_date - 30 days, not yet notified.
export async function getPendingNotifications(): Promise<DepositRecord[]> {
  const sql = db();
  const rows = await sql`
    SELECT *
    FROM deposit_notifications
    WHERE notified_at IS NULL
      AND scheduled_date - INTERVAL '30 days' <= CURRENT_DATE
    ORDER BY scheduled_date ASC
  `;
  return rows.map((r) => ({
    jobId: r.job_id as number,
    jobNo: r.job_no as string,
    jobName: r.job_name as string,
    clientName: r.client_name as string,
    siteName: r.site_name as string,
    siteAddress: r.site_address as string,
    scheduledDate: (r.scheduled_date as Date).toISOString().split("T")[0],
    totalExTax: Number(r.total_ex_tax),
    totalIncGst: Number(r.total_inc_gst),
    depositAmount: Number(r.deposit_amount),
  }));
}

export async function markNotified(jobId: number): Promise<void> {
  const sql = db();
  await sql`
    UPDATE deposit_notifications SET notified_at = NOW() WHERE job_id = ${jobId}
  `;
}
