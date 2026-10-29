// lib/caro/store.ts
//
// Neon storage for Caro (/caro). Builds each recurring site from three
// places and keeps Caro's own state alongside. Tables are created on first use:
//
// CREATE TABLE caro_site_state (
//   key        TEXT PRIMARY KEY,         -- "hs:<SimPRO site ID>" or "m:<id>"
//   state      JSONB NOT NULL,           -- SiteState: reminders, booking, snooze, log, overrides
//   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// CREATE TABLE caro_manual_sites (
//   key        TEXT PRIMARY KEY,         -- "m:<id>"
//   site       JSONB NOT NULL,           -- the Site fields SimPRO would otherwise supply
//   stopped    BOOLEAN NOT NULL DEFAULT FALSE,
//   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
// );
// CREATE TABLE caro_settings (
//   key   TEXT PRIMARY KEY,              -- 'timing' | 'templates' | 'rules'
//   value JSONB NOT NULL
// );
// CREATE TABLE caro_messages (
//   id              SERIAL PRIMARY KEY,
//   site_key        TEXT NOT NULL,
//   kind            TEXT NOT NULL,       -- 'reminder' | 'follow' | 'email'
//   to_email        TEXT NOT NULL,
//   subject         TEXT NOT NULL,
//   body            TEXT NOT NULL,
//   resend_email_id TEXT,
//   sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   opens           INTEGER NOT NULL DEFAULT 0,
//   bounced_at      TIMESTAMPTZ
// );
//
// Stopping a SimPRO site reuses recertification_ignored (the old Recurring
// jobs page's "Hide"), so the two stay in step.

import { neon } from "@neondatabase/serverless";
import {
  getCachedJobs,
  getIgnoredJobIds,
  ignoreJob,
  replaceCachedJobs,
  restoreJob,
} from "@/lib/recertifications/store";
import { fetchCategoryJobs } from "@/lib/recertifications/simpro";
import { RECURRING_CATEGORIES } from "@/lib/recertifications/categories";
import type { CheckinClient, HistoryJob } from "@/lib/checkin/analyse";
import { suppressEmail } from "@/lib/outreach/store";
import {
  DEFAULT_TEMPLATES,
  DEFAULT_TIMING,
  EMPTY_STATE,
  LINE,
  LINES,
  OWNERS,
  parse,
  type LineKey,
  type Site,
  type SiteState,
  type Template,
  type TimingMap,
} from "./data";
import { DEFAULT_RULES, type LiveRule } from "./auto";

function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

let ensured = false;
async function ensureTables() {
  if (ensured) return;
  const sql = db();
  await sql`CREATE TABLE IF NOT EXISTS caro_site_state (key TEXT PRIMARY KEY, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS caro_manual_sites (key TEXT PRIMARY KEY, site JSONB NOT NULL, stopped BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`;
  await sql`CREATE TABLE IF NOT EXISTS caro_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL)`;
  await sql`
    CREATE TABLE IF NOT EXISTS caro_messages (
      id SERIAL PRIMARY KEY, site_key TEXT NOT NULL, kind TEXT NOT NULL, to_email TEXT NOT NULL,
      subject TEXT NOT NULL, body TEXT NOT NULL, resend_email_id TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), opens INTEGER NOT NULL DEFAULT 0, bounced_at TIMESTAMPTZ
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS caro_messages_resend ON caro_messages (resend_email_id)`;
  ensured = true;
}

/* ---------- matching a site to its check-in history ---------- */

// Which check-in cost centre names belong to each service line.
const LINE_CC: Record<LineKey, RegExp> = {
  hs: /height|anchor|recert/i,
  wc: /window|glass/i,
  bc: /surface|pressure|building clean|wash/i,
};
const norm = (s: string) => s.trim().toLowerCase();

function historyFor(client: CheckinClient | undefined, line: LineKey, siteName: string): HistoryJob[] {
  if (!client) return [];
  return client.jobs
    .filter((j) => j.date && !j.unconfirmed && !j.active && norm(j.site) === norm(siteName) && (LINE_CC[line].test(j.cc) || LINE_CC[line].test(j.desc)))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
}

/** The year the current price was first charged: walk back through past
 *  visits while the price stayed the same. */
function priceSinceOf(history: HistoryJob[], price: number, lastDone: string): number {
  let year = parse(lastDone).getFullYear();
  for (const j of history) {
    if (Math.abs(j.value - price) >= 1) break;
    year = Math.min(year, parse(j.date!).getFullYear());
  }
  return year;
}

/* ---------- reading sites ---------- */

async function checkinClients(ids: number[]): Promise<Map<number, CheckinClient>> {
  if (!ids.length) return new Map();
  try {
    const rows = await db()`SELECT detail FROM checkin_clients WHERE id = ANY(${ids}::int[])`;
    return new Map(rows.map((r) => [(r.detail as CheckinClient).id, r.detail as CheckinClient]));
  } catch (err) {
    // No check-in sync yet — sites still work, just without contact details.
    console.warn("[Caro] check-in clients unavailable:", err instanceof Error ? err.message : err);
    return new Map();
  }
}

function applyState(base: Omit<Site, keyof SiteState>, state: SiteState | undefined): Site {
  const st = { ...EMPTY_STATE, ...(state ?? {}) };
  // A newer completed job in SimPRO closes the cycle: the booking and the
  // reminder belonged to the visit that's now done, so the site starts over.
  if (st.booked && base.lastDone >= st.booked) st.booked = null;
  if (st.reminded && base.lastDone >= st.reminded.at) Object.assign(st, { reminded: null, flagged: false, snoozedUntil: null });
  const ov = st.ov ?? {};
  return {
    ...base,
    ...st,
    price: ov.price ?? base.price,
    priceSince: ov.priceSince ?? base.priceSince,
    interval: ov.interval ?? base.interval,
    // A changed repeat interval replaces SimPRO's own next due date.
    nextDue: ov.interval !== undefined ? null : base.nextDue,
    owner: ov.owner ?? base.owner,
  };
}

export async function loadSites(): Promise<{ sites: Site[]; syncedAt: string | null }> {
  await ensureTables();
  const sql = db();
  const timing = await getTiming();

  const perLine = await Promise.all(
    LINES.map(async (L) => {
      const ignoredIds = await getIgnoredJobIds(L.category);
      let { active, ignored, syncedAt } = await getCachedJobs(L.category, ignoredIds);
      if (syncedAt === null) {
        // Never synced — populate the cache now, like the old Recurring jobs page did.
        const cfg = RECURRING_CATEGORIES[L.category];
        const jobs = await fetchCategoryJobs(cfg.costCentreIds, cfg.quoteMatchKeywords, cfg.historySince);
        await replaceCachedJobs(L.category, jobs);
        active = jobs.filter((j) => !ignoredIds.has(j.id));
        ignored = jobs.filter((j) => ignoredIds.has(j.id));
        syncedAt = new Date();
      }
      return { line: L.key, active, ignored, syncedAt };
    }),
  );

  const customerIds = [...new Set(perLine.flatMap((p) => [...p.active, ...p.ignored].map((j) => j.customerId)))];
  const [clients, stateRows, manualRows] = await Promise.all([
    checkinClients(customerIds),
    sql`SELECT key, state FROM caro_site_state`,
    sql`SELECT key, site, stopped FROM caro_manual_sites`,
  ]);
  const states = new Map(stateRows.map((r) => [r.key as string, r.state as SiteState]));

  const sites: Site[] = [];
  for (const p of perLine) {
    const rows = [...p.active.map((j) => ({ j, stopped: false })), ...p.ignored.map((j) => ({ j, stopped: true }))];
    for (const { j, stopped } of rows) {
      const c = clients.get(j.customerId);
      const history = historyFor(c, p.line, j.site);
      const lastDone = j.completedDate.slice(0, 10);
      const key = `${p.line}:${j.siteId}`;
      sites.push(
        applyState(
          {
            key,
            source: "simpro",
            line: p.line,
            jobId: j.id,
            siteId: j.siteId,
            customerId: j.customerId,
            customer: j.customer,
            name: j.site,
            first: c?.first ?? "",
            contact: c?.contactName ?? "",
            email: c?.email ?? "",
            phone: c?.phone ?? "",
            address: "",
            suburb: c && c.siteCount === 1 ? c.suburb : "",
            interval: timing[p.line].interval,
            lastDone,
            // SimPRO's due date assumes a year (and skips one when already re-quoted);
            // a different repeat on the Reminder timing page takes over from it.
            nextDue: timing[p.line].interval === 12 ? j.nextDueDate.slice(0, 10) : null,
            price: j.totalExTax,
            priceSince: priceSinceOf(history, j.totalExTax, lastDone),
            since: c?.firstJob ? parse(c.firstJob).getFullYear() : parse(lastDone).getFullYear(),
            owner: OWNERS[0].id,
            stopped,
            ltv: c?.ltv ?? 0,
            history: history.map((h) => ({ id: h.id, date: h.date!.slice(0, 10), desc: h.desc, value: h.value })),
            blockers: c ? c.angles.filter((a) => a.blocker).map((a) => a.title) : [],
            doNotSend: !!c?.doNotSend,
            checkinId: c?.id ?? null,
          },
          states.get(key),
        ),
      );
    }
  }
  for (const r of manualRows) {
    const base = r.site as Omit<Site, keyof SiteState>;
    sites.push(applyState({ ...base, stopped: r.stopped as boolean }, states.get(r.key as string)));
  }

  const synced = perLine.map((p) => p.syncedAt).filter(Boolean) as Date[];
  const oldest = synced.length ? new Date(Math.min(...synced.map((d) => d.getTime()))) : null;
  return { sites, syncedAt: oldest?.toISOString() ?? null };
}

export async function getSite(key: string): Promise<Site | null> {
  const { sites } = await loadSites();
  return sites.find((s) => s.key === key) ?? null;
}

/* ---------- writing sites ---------- */

export async function saveSiteState(key: string, state: SiteState): Promise<void> {
  await ensureTables();
  await db()`
    INSERT INTO caro_site_state (key, state) VALUES (${key}, ${JSON.stringify(state)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET state = EXCLUDED.state, updated_at = NOW()
  `;
}

/** Stop or restart a site. SimPRO sites use the same ignore list as the old
 *  Recurring jobs page; manual sites keep the flag on their own row. */
export async function setStopped(site: Pick<Site, "key" | "source" | "jobId" | "line">, stopped: boolean): Promise<void> {
  await ensureTables();
  if (site.source === "manual") {
    await db()`UPDATE caro_manual_sites SET stopped = ${stopped} WHERE key = ${site.key}`;
    return;
  }
  const category = LINE[site.line].category;
  if (stopped) await ignoreJob(site.jobId, category, "Stopped in Caro");
  else await restoreJob(site.jobId, category);
}

export async function addManualSite(site: Site): Promise<void> {
  await ensureTables();
  const base: Record<string, unknown> = { ...site };
  for (const k of ["booked", "reminded", "chase", "snoozedUntil", "flagged", "log", "ov", "stopped"]) delete base[k];
  await db()`INSERT INTO caro_manual_sites (key, site) VALUES (${site.key}, ${JSON.stringify(base)}::jsonb)`;
  await saveSiteState(site.key, { booked: null, reminded: null, chase: site.chase, snoozedUntil: null, log: site.log });
}

export async function deleteManualSite(key: string): Promise<void> {
  await ensureTables();
  await db()`DELETE FROM caro_manual_sites WHERE key = ${key}`;
  await db()`DELETE FROM caro_site_state WHERE key = ${key}`;
}

/* ---------- settings ---------- */

async function getSetting<T>(key: string, fallback: T): Promise<T> {
  await ensureTables();
  const rows = await db()`SELECT value FROM caro_settings WHERE key = ${key}`;
  return rows.length ? (rows[0].value as T) : fallback;
}
export async function saveSetting(key: "timing" | "templates" | "rules" | "ran", value: unknown): Promise<void> {
  await ensureTables();
  await db()`
    INSERT INTO caro_settings (key, value) VALUES (${key}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `;
}
export async function getTiming(): Promise<TimingMap> {
  const saved = await getSetting<Partial<TimingMap>>("timing", {});
  return {
    hs: { ...DEFAULT_TIMING.hs, ...saved.hs },
    wc: { ...DEFAULT_TIMING.wc, ...saved.wc },
    bc: { ...DEFAULT_TIMING.bc, ...saved.bc },
  };
}
export const getTemplates = () => getSetting<Template[]>("templates", DEFAULT_TEMPLATES);
export const getRules = () => getSetting<LiveRule[]>("rules", DEFAULT_RULES);
export const getRan = async () => new Set(await getSetting<string[]>("ran", []));

/* ---------- sent emails + Resend events ---------- */

export async function recordMessage(m: {
  siteKey: string;
  kind: "reminder" | "follow" | "email";
  toEmail: string;
  subject: string;
  body: string;
  resendEmailId: string | null;
}): Promise<void> {
  await ensureTables();
  await db()`
    INSERT INTO caro_messages (site_key, kind, to_email, subject, body, resend_email_id)
    VALUES (${m.siteKey}, ${m.kind}, ${m.toEmail}, ${m.subject}, ${m.body}, ${m.resendEmailId})
  `;
}

/** Called by the Resend webhook. Returns false when the email isn't one of Caro's.
 *  An open bumps the site's "opened N×"; a bounce suppresses the address. */
export async function markCaroMessageEvent(resendEmailId: string, event: "opened" | "bounced"): Promise<boolean> {
  await ensureTables();
  const sql = db();
  const rows =
    event === "opened"
      ? await sql`UPDATE caro_messages SET opens = opens + 1 WHERE resend_email_id = ${resendEmailId} RETURNING site_key, to_email`
      : await sql`UPDATE caro_messages SET bounced_at = COALESCE(bounced_at, NOW()) WHERE resend_email_id = ${resendEmailId} RETURNING site_key, to_email`;
  if (!rows.length) return false;
  if (event === "bounced") {
    await suppressEmail(rows[0].to_email as string, "bounced");
    return true;
  }
  await sql`
    UPDATE caro_site_state
    SET state = jsonb_set(state, '{reminded,opened}', to_jsonb(COALESCE((state->'reminded'->>'opened')::int, 0) + 1)),
        updated_at = NOW()
    WHERE key = ${rows[0].site_key as string} AND jsonb_typeof(state->'reminded') = 'object'
  `;
  return true;
}
