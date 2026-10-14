// lib/outreach/store.ts
//
// Neon storage for customer outreach (/outreach). Tables (run once):
//
// CREATE TABLE IF NOT EXISTS outreach_opportunities (
//   id               SERIAL PRIMARY KEY,
//   dedupe_key       TEXT NOT NULL UNIQUE,   -- rule + site + year, or rule + quote
//   rule_id          TEXT NOT NULL,
//   source_type      TEXT NOT NULL,          -- 'job' | 'quote'
//   source_id        INTEGER NOT NULL,
//   source_name      TEXT NOT NULL,
//   source_date      DATE NOT NULL,          -- job completed / quote issued
//   source_total     NUMERIC NOT NULL DEFAULT 0,
//   customer_id      INTEGER NOT NULL,
//   customer         TEXT NOT NULL,
//   site_id          INTEGER NOT NULL,
//   site             TEXT NOT NULL,
//   contact_name     TEXT NOT NULL DEFAULT '',
//   contact_email    TEXT NOT NULL DEFAULT '',
//   salesperson      TEXT NOT NULL DEFAULT '',
//   due_date         DATE NOT NULL,          -- when the first email is due
//   status           TEXT NOT NULL DEFAULT 'open', -- open | won | closed | dismissed
//   touches_sent     INTEGER NOT NULL DEFAULT 0,
//   next_touch_at    DATE,                   -- NULL once every email has gone
//   draft_subject    TEXT,
//   draft_body       TEXT,
//   drafted_at       TIMESTAMPTZ,
//   outcome_ref      TEXT,                   -- e.g. 'Quote 10614'
//   outcome_total    NUMERIC,
//   outcome_at       TIMESTAMPTZ,
//   dismissed_reason TEXT,
//   created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// CREATE INDEX IF NOT EXISTS outreach_opportunities_status ON outreach_opportunities (status);
//
// CREATE TABLE IF NOT EXISTS outreach_messages (
//   id               SERIAL PRIMARY KEY,
//   opportunity_id   INTEGER NOT NULL REFERENCES outreach_opportunities(id) ON DELETE CASCADE,
//   touch            INTEGER NOT NULL,       -- 1 = first email, 2+ = follow-ups
//   to_email         TEXT NOT NULL,
//   subject          TEXT NOT NULL,
//   body             TEXT NOT NULL,
//   resend_email_id  TEXT,
//   sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   delivered_at     TIMESTAMPTZ,
//   opened_at        TIMESTAMPTZ,
//   clicked_at       TIMESTAMPTZ,
//   bounced_at       TIMESTAMPTZ
// );
// CREATE INDEX IF NOT EXISTS outreach_messages_opp ON outreach_messages (opportunity_id);
// CREATE INDEX IF NOT EXISTS outreach_messages_resend ON outreach_messages (resend_email_id);
//
// CREATE TABLE IF NOT EXISTS outreach_suppressions (
//   email      TEXT PRIMARY KEY,             -- lower-cased
//   reason     TEXT NOT NULL,                -- 'unsubscribed' | 'bounced' | 'manual'
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// ─────────────────────────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";
import type { OutreachRuleId } from "./rules";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

export type OpportunityStatus = "open" | "won" | "closed" | "dismissed";

export interface OpportunityInput {
  dedupeKey: string;
  ruleId: OutreachRuleId;
  sourceType: "job" | "quote";
  sourceId: number;
  sourceName: string;
  sourceDate: string;
  sourceTotal: number;
  customerId: number;
  customer: string;
  siteId: number;
  site: string;
  contactName: string;
  contactEmail: string;
  salesperson: string;
  dueDate: string;
}

export interface OutreachMessage {
  id: number;
  touch: number;
  toEmail: string;
  subject: string;
  body: string;
  sentAt: string;
  openedAt: string | null;
  clickedAt: string | null;
  bouncedAt: string | null;
}

export interface Opportunity extends OpportunityInput {
  id: number;
  status: OpportunityStatus;
  touchesSent: number;
  nextTouchAt: string | null;
  draftSubject: string | null;
  draftBody: string | null;
  outcomeRef: string | null;
  outcomeTotal: number | null;
  outcomeAt: string | null;
  dismissedReason: string | null;
  createdAt: string;
  lastSentAt: string | null;
  opened: boolean;
  messages: OutreachMessage[];
}

const day = (v: unknown): string => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v ?? ""));
const ts = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

type Row = Record<string, unknown>;

function toOpportunity(r: Row, messages: OutreachMessage[]): Opportunity {
  return {
    id: r.id as number,
    dedupeKey: r.dedupe_key as string,
    ruleId: r.rule_id as OutreachRuleId,
    sourceType: r.source_type as "job" | "quote",
    sourceId: r.source_id as number,
    sourceName: r.source_name as string,
    sourceDate: day(r.source_date),
    sourceTotal: Number(r.source_total),
    customerId: r.customer_id as number,
    customer: r.customer as string,
    siteId: r.site_id as number,
    site: r.site as string,
    contactName: r.contact_name as string,
    contactEmail: r.contact_email as string,
    salesperson: r.salesperson as string,
    dueDate: day(r.due_date),
    status: r.status as OpportunityStatus,
    touchesSent: r.touches_sent as number,
    nextTouchAt: r.next_touch_at ? day(r.next_touch_at) : null,
    draftSubject: (r.draft_subject as string) ?? null,
    draftBody: (r.draft_body as string) ?? null,
    outcomeRef: (r.outcome_ref as string) ?? null,
    outcomeTotal: r.outcome_total == null ? null : Number(r.outcome_total),
    outcomeAt: ts(r.outcome_at),
    dismissedReason: (r.dismissed_reason as string) ?? null,
    createdAt: ts(r.created_at)!,
    lastSentAt: messages.length ? messages[messages.length - 1].sentAt : null,
    opened: messages.some((m) => m.openedAt || m.clickedAt),
    messages,
  };
}

function toMessage(r: Row): OutreachMessage {
  return {
    id: r.id as number,
    touch: r.touch as number,
    toEmail: r.to_email as string,
    subject: r.subject as string,
    body: r.body as string,
    sentAt: ts(r.sent_at)!,
    openedAt: ts(r.opened_at),
    clickedAt: ts(r.clicked_at),
    bouncedAt: ts(r.bounced_at),
  };
}

async function withMessages(rows: Row[]): Promise<Opportunity[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id as number);
  const msgRows = await db()`
    SELECT * FROM outreach_messages WHERE opportunity_id = ANY(${ids}) ORDER BY sent_at
  `;
  const byOpp = new Map<number, OutreachMessage[]>();
  for (const m of msgRows) {
    const list = byOpp.get(m.opportunity_id as number) ?? [];
    list.push(toMessage(m));
    byOpp.set(m.opportunity_id as number, list);
  }
  return rows.map((r) => toOpportunity(r, byOpp.get(r.id as number) ?? []));
}

// ── Opportunities ─────────────────────────────────────────────────────────

/** Inserts new opportunities; for ones not yet emailed, refreshes the contact
 *  details in case they changed in SimPRO. Returns how many were new. */
export async function upsertOpportunities(list: OpportunityInput[]): Promise<number> {
  const sql = db();
  let created = 0;
  for (const o of list) {
    const rows = await sql`
      INSERT INTO outreach_opportunities (
        dedupe_key, rule_id, source_type, source_id, source_name, source_date, source_total,
        customer_id, customer, site_id, site, contact_name, contact_email, salesperson,
        due_date, next_touch_at
      ) VALUES (
        ${o.dedupeKey}, ${o.ruleId}, ${o.sourceType}, ${o.sourceId}, ${o.sourceName}, ${o.sourceDate},
        ${o.sourceTotal}, ${o.customerId}, ${o.customer}, ${o.siteId}, ${o.site}, ${o.contactName},
        ${o.contactEmail}, ${o.salesperson}, ${o.dueDate}, ${o.dueDate}
      )
      ON CONFLICT (dedupe_key) DO UPDATE SET
        contact_name = EXCLUDED.contact_name,
        contact_email = EXCLUDED.contact_email,
        salesperson = EXCLUDED.salesperson,
        updated_at = NOW()
      WHERE outreach_opportunities.touches_sent = 0 AND outreach_opportunities.status = 'open'
      RETURNING (xmax = 0) AS inserted
    `;
    if (rows[0]?.inserted) created++;
  }
  return created;
}

/** Everything still open, plus anything resolved in the last 180 days. */
export async function listOpportunities(): Promise<Opportunity[]> {
  const rows = await db()`
    SELECT * FROM outreach_opportunities
    WHERE status = 'open' OR updated_at > NOW() - INTERVAL '180 days'
    ORDER BY COALESCE(next_touch_at, due_date), id
  `;
  return withMessages(rows);
}

export async function listOpenOpportunities(): Promise<Opportunity[]> {
  const rows = await db()`SELECT * FROM outreach_opportunities WHERE status = 'open'`;
  return withMessages(rows);
}

export async function getOpportunity(id: number): Promise<Opportunity | null> {
  const rows = await db()`SELECT * FROM outreach_opportunities WHERE id = ${id}`;
  return (await withMessages(rows))[0] ?? null;
}

export async function saveDraft(id: number, subject: string, body: string): Promise<void> {
  await db()`
    UPDATE outreach_opportunities
    SET draft_subject = ${subject}, draft_body = ${body}, drafted_at = NOW(), updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function recordSend(
  id: number,
  msg: { touch: number; toEmail: string; subject: string; body: string; resendEmailId: string },
  nextTouchAt: string | null,
): Promise<void> {
  const sql = db();
  await sql`
    INSERT INTO outreach_messages (opportunity_id, touch, to_email, subject, body, resend_email_id)
    VALUES (${id}, ${msg.touch}, ${msg.toEmail}, ${msg.subject}, ${msg.body}, ${msg.resendEmailId})
  `;
  await sql`
    UPDATE outreach_opportunities
    SET touches_sent = ${msg.touch}, next_touch_at = ${nextTouchAt},
        draft_subject = NULL, draft_body = NULL, drafted_at = NULL, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function setOutcome(
  id: number,
  status: Exclude<OpportunityStatus, "open">,
  ref: string | null,
  total: number | null,
): Promise<void> {
  await db()`
    UPDATE outreach_opportunities
    SET status = ${status}, outcome_ref = ${ref}, outcome_total = ${total},
        outcome_at = NOW(), next_touch_at = NULL, updated_at = NOW()
    WHERE id = ${id} AND status = 'open'
  `;
}

export async function dismissOpportunity(id: number, reason: string): Promise<void> {
  await db()`
    UPDATE outreach_opportunities
    SET status = 'dismissed', dismissed_reason = ${reason}, next_touch_at = NULL, updated_at = NOW()
    WHERE id = ${id}
  `;
}

export async function restoreOpportunity(id: number): Promise<void> {
  await db()`
    UPDATE outreach_opportunities
    SET status = 'open', dismissed_reason = NULL,
        next_touch_at = CASE WHEN touches_sent = 0 THEN due_date ELSE CURRENT_DATE END,
        updated_at = NOW()
    WHERE id = ${id} AND status = 'dismissed'
  `;
}

// ── Suppressions (unsubscribes, bounces) ─────────────────────────────────

export async function getSuppressedEmails(): Promise<Set<string>> {
  const rows = await db()`SELECT email FROM outreach_suppressions`;
  return new Set(rows.map((r) => r.email as string));
}

export async function isSuppressed(email: string): Promise<boolean> {
  const rows = await db()`SELECT 1 FROM outreach_suppressions WHERE email = ${email.toLowerCase()}`;
  return rows.length > 0;
}

/** Suppresses the address and stops every open opportunity emailing it. */
export async function suppressEmail(email: string, reason: string): Promise<void> {
  const sql = db();
  const e = email.trim().toLowerCase();
  await sql`
    INSERT INTO outreach_suppressions (email, reason) VALUES (${e}, ${reason})
    ON CONFLICT (email) DO NOTHING
  `;
  await sql`
    UPDATE outreach_opportunities
    SET status = 'dismissed', dismissed_reason = ${reason}, next_touch_at = NULL, updated_at = NOW()
    WHERE status = 'open' AND LOWER(contact_email) = ${e}
  `;
}

// ── Resend delivery events ────────────────────────────────────────────────

/** Returns false when the email isn't an outreach message. */
export async function markMessageEvent(
  resendEmailId: string,
  event: "delivered" | "opened" | "clicked" | "bounced",
): Promise<boolean> {
  const sql = db();
  const rows =
    event === "delivered"
      ? await sql`UPDATE outreach_messages SET delivered_at = COALESCE(delivered_at, NOW()) WHERE resend_email_id = ${resendEmailId} RETURNING to_email`
      : event === "opened"
        ? await sql`UPDATE outreach_messages SET opened_at = COALESCE(opened_at, NOW()) WHERE resend_email_id = ${resendEmailId} RETURNING to_email`
        : event === "clicked"
          ? await sql`UPDATE outreach_messages SET clicked_at = COALESCE(clicked_at, NOW()) WHERE resend_email_id = ${resendEmailId} RETURNING to_email`
          : await sql`UPDATE outreach_messages SET bounced_at = COALESCE(bounced_at, NOW()) WHERE resend_email_id = ${resendEmailId} RETURNING to_email`;
  if (!rows.length) return false;
  if (event === "bounced") await suppressEmail(rows[0].to_email as string, "bounced");
  return true;
}
