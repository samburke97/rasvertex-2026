// lib/crm/store.ts
// Neon Postgres via @neondatabase/serverless
// Run the migration SQL once in the Neon SQL Editor (see bottom of file).
// Same house convention as lib/reports/anchor-inspection/store.ts and
// lib/deposit-notifications/store.ts — raw tagged-template SQL, no ORM.

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

function sql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// ── Migration — run this ONCE in Neon SQL Editor ──────────────────────────
// CREATE TABLE IF NOT EXISTS crm_leads (
//   id          SERIAL PRIMARY KEY,
//   name        TEXT NOT NULL,
//   company     TEXT,
//   email       TEXT,
//   phone       TEXT,
//   stage       TEXT NOT NULL DEFAULT 'cold',
//   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// CREATE TABLE IF NOT EXISTS crm_lead_activity (
//   id               SERIAL PRIMARY KEY,
//   lead_id          INTEGER NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
//   type             TEXT NOT NULL,        -- 'note' | 'email' | 'stage_change'
//   subject          TEXT,
//   body             TEXT,
//   resend_email_id  TEXT UNIQUE,
//   email_status     TEXT,                 -- 'queued' | 'sent' | 'failed'
//   delivered_at     TIMESTAMPTZ,
//   opened_at        TIMESTAMPTZ,
//   clicked_at       TIMESTAMPTZ,
//   bounced_at       TIMESTAMPTZ,
//   created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
//
// CREATE INDEX IF NOT EXISTS crm_lead_activity_lead_id_idx ON crm_lead_activity(lead_id);

// ── Types ────────────────────────────────────────────────────────────────────

export const LEAD_STAGES = [
  "cold",
  "contacted",
  "qualified",
  "quoted",
  "won",
  "lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  cold: "Cold",
  contacted: "Contacted",
  qualified: "Qualified",
  quoted: "Quoted",
  won: "Won",
  lost: "Lost",
};

export interface Lead {
  id: number;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  stage: LeadStage;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = "note" | "email" | "stage_change";
export type EmailSendStatus = "queued" | "sent" | "failed";

export interface LeadActivity {
  id: number;
  leadId: number;
  type: ActivityType;
  subject: string | null;
  body: string | null;
  resendEmailId: string | null;
  emailStatus: EmailSendStatus | null;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
  createdAt: string;
}

// ── Row mapping ──────────────────────────────────────────────────────────────
// DB is snake_case; app code is camelCase.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapLead(r: any): Lead {
  return {
    id: r.id,
    name: r.name,
    company: r.company,
    email: r.email,
    phone: r.phone,
    stage: r.stage,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapActivity(r: any): LeadActivity {
  return {
    id: r.id,
    leadId: r.lead_id,
    type: r.type,
    subject: r.subject,
    body: r.body,
    resendEmailId: r.resend_email_id,
    emailStatus: r.email_status,
    deliveredAt: r.delivered_at,
    openedAt: r.opened_at,
    clickedAt: r.clicked_at,
    bouncedAt: r.bounced_at,
    createdAt: r.created_at,
  };
}

// ── Leads ────────────────────────────────────────────────────────────────────

export async function listLeads(stage?: LeadStage): Promise<Lead[]> {
  const db = sql();
  const rows = stage
    ? await db`SELECT * FROM crm_leads WHERE stage = ${stage} ORDER BY updated_at DESC`
    : await db`SELECT * FROM crm_leads ORDER BY updated_at DESC`;
  return rows.map(mapLead);
}

export async function getLead(id: number): Promise<Lead | null> {
  const db = sql();
  const rows = await db`SELECT * FROM crm_leads WHERE id = ${id}`;
  return rows.length ? mapLead(rows[0]) : null;
}

export interface CreateLeadInput {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  stage?: LeadStage;
}

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  const db = sql();
  const rows = await db`
    INSERT INTO crm_leads (name, company, email, phone, stage)
    VALUES (
      ${input.name},
      ${input.company ?? null},
      ${input.email ?? null},
      ${input.phone ?? null},
      ${input.stage ?? "cold"}
    )
    RETURNING *
  `;
  return mapLead(rows[0]);
}

export interface UpdateLeadInput {
  name?: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  stage?: LeadStage;
}

// Writes a 'stage_change' activity row whenever `stage` actually changes, so
// the timeline reflects pipeline movement without the caller having to do it
// separately (and possibly forgetting to, or doing it out of sync with the
// actual update).
export async function updateLead(
  id: number,
  patch: UpdateLeadInput,
): Promise<Lead | null> {
  const db = sql();
  const existing = await getLead(id);
  if (!existing) return null;

  const next = { ...existing, ...patch };
  const rows = await db`
    UPDATE crm_leads
    SET name = ${next.name},
        company = ${next.company},
        email = ${next.email},
        phone = ${next.phone},
        stage = ${next.stage},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (patch.stage && patch.stage !== existing.stage) {
    await db`
      INSERT INTO crm_lead_activity (lead_id, type, body)
      VALUES (${id}, 'stage_change', ${`${LEAD_STAGE_LABELS[existing.stage]} → ${LEAD_STAGE_LABELS[patch.stage]}`})
    `;
  }

  return mapLead(rows[0]);
}

// ── Activity ─────────────────────────────────────────────────────────────────

export async function listActivity(leadId: number): Promise<LeadActivity[]> {
  const db = sql();
  const rows = await db`
    SELECT * FROM crm_lead_activity
    WHERE lead_id = ${leadId}
    ORDER BY created_at DESC
  `;
  return rows.map(mapActivity);
}

export async function addNote(
  leadId: number,
  body: string,
): Promise<LeadActivity> {
  const db = sql();
  const rows = await db`
    INSERT INTO crm_lead_activity (lead_id, type, body)
    VALUES (${leadId}, 'note', ${body})
    RETURNING *
  `;
  return mapActivity(rows[0]);
}

// Two-step email activity lifecycle: create the row before calling Resend
// (so a send-in-flight is visible in the timeline), then update it with the
// outcome. Keeps the timeline honest even if the process crashes mid-send.
export async function createEmailActivity(
  leadId: number,
  subject: string,
  body: string,
): Promise<LeadActivity> {
  const db = sql();
  const rows = await db`
    INSERT INTO crm_lead_activity (lead_id, type, subject, body, email_status)
    VALUES (${leadId}, 'email', ${subject}, ${body}, 'queued')
    RETURNING *
  `;
  return mapActivity(rows[0]);
}

export async function markEmailSent(
  activityId: number,
  resendEmailId: string,
): Promise<LeadActivity> {
  const db = sql();
  const rows = await db`
    UPDATE crm_lead_activity
    SET email_status = 'sent', resend_email_id = ${resendEmailId}
    WHERE id = ${activityId}
    RETURNING *
  `;
  return mapActivity(rows[0]);
}

export async function markEmailFailed(
  activityId: number,
): Promise<LeadActivity> {
  const db = sql();
  const rows = await db`
    UPDATE crm_lead_activity
    SET email_status = 'failed'
    WHERE id = ${activityId}
    RETURNING *
  `;
  return mapActivity(rows[0]);
}

// ── Delivery/open/click tracking (Phase 2 — Resend webhook) ───────────────────
// Each setter only writes its timestamp if still NULL, so out-of-order or
// duplicate webhook deliveries can never regress a more-advanced state (e.g.
// a delayed "delivered" event landing after "opened" already fired).

async function markEmailEventOnce(
  resendEmailId: string,
  column: "delivered_at" | "opened_at" | "clicked_at" | "bounced_at",
): Promise<LeadActivity | null> {
  const db = sql();
  const rows =
    column === "delivered_at"
      ? await db`UPDATE crm_lead_activity SET delivered_at = NOW() WHERE resend_email_id = ${resendEmailId} AND delivered_at IS NULL RETURNING *`
      : column === "opened_at"
        ? await db`UPDATE crm_lead_activity SET opened_at = NOW() WHERE resend_email_id = ${resendEmailId} AND opened_at IS NULL RETURNING *`
        : column === "clicked_at"
          ? await db`UPDATE crm_lead_activity SET clicked_at = NOW() WHERE resend_email_id = ${resendEmailId} AND clicked_at IS NULL RETURNING *`
          : await db`UPDATE crm_lead_activity SET bounced_at = NOW() WHERE resend_email_id = ${resendEmailId} AND bounced_at IS NULL RETURNING *`;
  return rows.length ? mapActivity(rows[0]) : null;
}

export async function findActivityByResendEmailId(
  resendEmailId: string,
): Promise<LeadActivity | null> {
  const db = sql();
  const rows = await db`
    SELECT * FROM crm_lead_activity WHERE resend_email_id = ${resendEmailId}
  `;
  return rows.length ? mapActivity(rows[0]) : null;
}

export const markDelivered = (resendEmailId: string) =>
  markEmailEventOnce(resendEmailId, "delivered_at");
export const markOpened = (resendEmailId: string) =>
  markEmailEventOnce(resendEmailId, "opened_at");
export const markClicked = (resendEmailId: string) =>
  markEmailEventOnce(resendEmailId, "clicked_at");
export const markBounced = (resendEmailId: string) =>
  markEmailEventOnce(resendEmailId, "bounced_at");
