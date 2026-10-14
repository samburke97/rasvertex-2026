// lib/outreach/scan.ts
//
// The daily outreach scan (cron + "Scan SimPRO" button): reads SimPRO,
// turns each rule into opportunities, and resolves open ones whose work has
// since been quoted. Never sends anything — emails only go out from the
// review queue.

import { fetchCategoryJobIds, simproGet } from "@/lib/recertifications/simpro";
import {
  OUTREACH_RULE_LIST,
  maxTouches,
  nameMatches,
  type JobRule,
  type OutreachRule,
  type QuoteRule,
} from "./rules";
import {
  listOpenOpportunities,
  setOutcome,
  upsertOpportunities,
  type OpportunityInput,
} from "./store";

const BASE = `${process.env.NEXT_PUBLIC_SIMPRO_BASE_URL}/api/v1.0/companies/0`;
const PAGE_SIZE = 250;
const WON_STATUS_ID = 6; // "Quote: Won"
// Opportunities that have had every email and no reply for this long close.
const CLOSE_AFTER_DAYS = 60;

interface Contact {
  GivenName?: string;
  FamilyName?: string;
  Email?: string;
}

interface SimproJob {
  ID: number;
  Name: string;
  CompletedDate: string | null;
  Customer?: { ID: number; CompanyName?: string; GivenName?: string; FamilyName?: string };
  Site?: { ID: number; Name?: string };
  Total?: { ExTax?: number };
  Tags?: (string | { Name?: string })[];
  CustomerContact?: Contact | null;
  Salesperson?: { Name?: string } | null;
}

interface SimproQuote {
  ID: number;
  Name: string;
  DateIssued: string | null;
  Status?: { ID: number; Name?: string };
  Customer?: SimproJob["Customer"];
  Site?: { ID: number; Name?: string };
  Total?: { ExTax?: number };
  CustomerContact?: Contact | null;
  Salesperson?: { Name?: string } | null;
}

// ── Dates (Sunshine Coast, no DST) ────────────────────────────────────────

export function todayISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

// ── SimPRO reads ──────────────────────────────────────────────────────────

async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await simproGet<T[]>(`${BASE}${path}&pageSize=${PAGE_SIZE}&page=${page}`);
    out.push(...batch);
    if (batch.length < PAGE_SIZE) return out;
  }
}

const customerName = (c: SimproJob["Customer"]) =>
  (c?.CompanyName || `${c?.GivenName ?? ""} ${c?.FamilyName ?? ""}`).trim() || "Unknown";
const contactName = (c?: Contact | null) =>
  `${c?.GivenName ?? ""} ${c?.FamilyName ?? ""}`.replace(/\s+/g, " ").trim();
const contactEmail = (c?: Contact | null) => (c?.Email ?? "").trim();
const isBlacklisted = (j: SimproJob) =>
  (j.Tags ?? []).some((t) => (typeof t === "string" ? t : (t?.Name ?? "")).toUpperCase() === "BLACKLIST");

/** Quotes per site, newest first. */
function indexBySite(quotes: SimproQuote[]): Map<number, SimproQuote[]> {
  const map = new Map<number, SimproQuote[]>();
  for (const q of quotes) {
    if (!q.Site?.ID || !q.DateIssued) continue;
    const list = map.get(q.Site.ID) ?? [];
    list.push(q);
    map.set(q.Site.ID, list);
  }
  for (const list of map.values()) list.sort((a, b) => (b.DateIssued! < a.DateIssued! ? -1 : 1));
  return map;
}

function matchingQuoteSince(
  bySite: Map<number, SimproQuote[]>,
  siteId: number,
  since: string,
  keywords: string[],
): SimproQuote | undefined {
  return (bySite.get(siteId) ?? []).find((q) => q.DateIssued! >= since && nameMatches(q.Name, keywords));
}

// ── Candidates ────────────────────────────────────────────────────────────

function jobCandidates(
  rule: JobRule,
  jobs: SimproJob[],
  jobIds: Set<number>,
  quotesBySite: Map<number, SimproQuote[]>,
  today: string,
): OpportunityInput[] {
  // Latest qualifying job per site.
  const latest = new Map<number, SimproJob>();
  for (const j of jobs) {
    if (!jobIds.has(j.ID) || !j.CompletedDate || !j.Site?.ID || isBlacklisted(j)) continue;
    if (rule.minValueExTax && (j.Total?.ExTax ?? 0) < rule.minValueExTax) continue;
    const prev = latest.get(j.Site.ID);
    if (!prev || j.CompletedDate > prev.CompletedDate!) latest.set(j.Site.ID, j);
  }

  const out: OpportunityInput[] = [];
  for (const [siteId, j] of latest) {
    const completed = j.CompletedDate!.slice(0, 10);
    const anniversary = addMonths(completed, rule.monthsAfter);
    const due = addDays(anniversary, -rule.leadDays);
    if (today < due || today > addMonths(anniversary, rule.windowMonths)) continue;
    // Already quoted for this work since the job? Nothing to chase.
    if (matchingQuoteSince(quotesBySite, siteId, completed, rule.matchKeywords)) continue;
    out.push({
      dedupeKey: `${rule.id}:site:${siteId}:${anniversary.slice(0, 4)}`,
      ruleId: rule.id,
      sourceType: "job",
      sourceId: j.ID,
      sourceName: j.Name,
      sourceDate: completed,
      sourceTotal: j.Total?.ExTax ?? 0,
      customerId: j.Customer?.ID ?? 0,
      customer: customerName(j.Customer),
      siteId,
      site: (j.Site?.Name ?? "").trim() || "Unknown",
      contactName: contactName(j.CustomerContact),
      contactEmail: contactEmail(j.CustomerContact),
      salesperson: j.Salesperson?.Name ?? "",
      dueDate: due,
    });
  }
  return out;
}

function quoteCandidates(rule: QuoteRule, quotes: SimproQuote[], today: string): OpportunityInput[] {
  const out: OpportunityInput[] = [];
  for (const q of quotes) {
    if (!q.Status || !rule.statusIds.includes(q.Status.ID) || !q.DateIssued || !q.Site?.ID) continue;
    const issued = q.DateIssued.slice(0, 10);
    const due = addDays(issued, rule.firstAfterDays);
    if (today < due || issued < addDays(today, -rule.maxAgeDays)) continue;
    out.push({
      dedupeKey: `${rule.id}:quote:${q.ID}`,
      ruleId: rule.id,
      sourceType: "quote",
      sourceId: q.ID,
      sourceName: q.Name,
      sourceDate: issued,
      sourceTotal: q.Total?.ExTax ?? 0,
      customerId: q.Customer?.ID ?? 0,
      customer: customerName(q.Customer),
      siteId: q.Site.ID,
      site: (q.Site.Name ?? "").trim() || "Unknown",
      contactName: contactName(q.CustomerContact),
      contactEmail: contactEmail(q.CustomerContact),
      salesperson: q.Salesperson?.Name ?? "",
      dueDate: due,
    });
  }
  return out;
}

// ── Scan ──────────────────────────────────────────────────────────────────

export interface ScanResult {
  found: number;
  created: number;
  won: number;
  closed: number;
}

interface ScanData {
  candidates: OpportunityInput[];
  quotesBySite: Map<number, SimproQuote[]>;
  quotesById: Map<number, SimproQuote>;
}

/** Reads SimPRO and works out every opportunity the rules produce today.
 *  Writes nothing. */
export async function findCandidates(today = todayISO()): Promise<ScanData> {
  const jobRules = OUTREACH_RULE_LIST.filter((r): r is JobRule => r.kind === "job");
  const quoteRules = OUTREACH_RULE_LIST.filter((r): r is QuoteRule => r.kind === "quote");

  // Oldest job any rule could still act on; quotes since then are what
  // "already quoted" and win detection compare against.
  const since = jobRules
    .map((r) => addDays(addMonths(today, -(r.monthsAfter + r.windowMonths)), -r.leadDays))
    .reduce((a, b) => (a < b ? a : b), today);

  const [jobIdSets, jobs, quotes] = await Promise.all([
    Promise.all(jobRules.map((r) => fetchCategoryJobIds(r.triggerCostCentreIds))),
    fetchAll<SimproJob>(
      `/jobs/?CompletedDate=gt(${since})` +
        `&columns=ID,Name,CompletedDate,Customer,Site,Total,Tags,CustomerContact,Salesperson`,
    ),
    fetchAll<SimproQuote>(
      `/quotes/?DateIssued=gt(${since})` +
        `&columns=ID,Name,DateIssued,Status,Customer,Site,Total,CustomerContact,Salesperson`,
    ),
  ]);
  const quotesBySite = indexBySite(quotes);
  const quotesById = new Map(quotes.map((q) => [q.ID, q]));

  const candidates = [
    ...jobRules.flatMap((r, i) => jobCandidates(r, jobs, jobIdSets[i], quotesBySite, today)),
    ...quoteRules.flatMap((r) => quoteCandidates(r, quotes, today)),
  ];
  return { candidates, quotesBySite, quotesById };
}

export async function runOutreachScan(): Promise<ScanResult> {
  const today = todayISO();
  const { candidates, quotesBySite, quotesById } = await findCandidates(today);
  const created = await upsertOpportunities(candidates);

  // Resolve open opportunities.
  let won = 0;
  let closed = 0;
  const rules = new Map<string, OutreachRule>(OUTREACH_RULE_LIST.map((r) => [r.id, r]));
  for (const o of await listOpenOpportunities()) {
    const rule = rules.get(o.ruleId);
    if (!rule) continue;
    if (rule.kind === "job") {
      const q = matchingQuoteSince(quotesBySite, o.siteId, o.createdAt.slice(0, 10), rule.matchKeywords);
      if (q) {
        await setOutcome(o.id, "won", `Quote ${q.ID}`, q.Total?.ExTax ?? null);
        won++;
        continue;
      }
    } else {
      const q = quotesById.get(o.sourceId);
      if (q?.Status && !rule.statusIds.includes(q.Status.ID)) {
        if (q.Status.ID === WON_STATUS_ID) {
          await setOutcome(o.id, "won", `Quote ${q.ID}`, q.Total?.ExTax ?? null);
          won++;
        } else {
          await setOutcome(o.id, "closed", q.Status.Name ?? "Quote status changed", null);
          closed++;
        }
        continue;
      }
    }
    if (
      o.touchesSent >= maxTouches(rule) &&
      o.lastSentAt &&
      o.lastSentAt.slice(0, 10) < addDays(today, -CLOSE_AFTER_DAYS)
    ) {
      await setOutcome(o.id, "closed", "No response", null);
      closed++;
    }
  }

  return { found: candidates.length, created, won, closed };
}
