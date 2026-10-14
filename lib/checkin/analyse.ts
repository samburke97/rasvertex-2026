// lib/checkin/analyse.ts
//
// Turns a raw SimPRO pull (lib/checkin/simpro.ts) into one check-in record
// per client: contact, sites, job history, open quotes, unpaid invoices,
// recommended follow-up angles (rules in config.ts), a 0–100 priority score
// and a one-line summary. Pure function of the data — no network, no writes.

import { CHECKIN_CONFIG as C, type AngleId, type ServiceKey } from "./config";
import type { RawCustomer, RawJob, RawSite, SimproPull } from "./simpro";

// ── Output types ─────────────────────────────────────────────────────────

export interface Angle {
  id: AngleId;
  label: string;
  weight: number;
  blocker: boolean;
  /** Short, filled: "Anchor recertification due 14 Nov 2026". */
  title: string;
  /** Why it fired, for staff. */
  reason: string;
  subject: string;
  /** The email paragraph for this angle. */
  para: string;
  /** Site name to use in the email. */
  site: string;
}

export interface HistoryJob {
  id: number;
  date: string | null;
  issued: string;
  active: boolean;
  unconfirmed: boolean;
  cc: string;
  desc: string;
  value: number;
  status: string;
  site: string;
  sm8: boolean;
}

export interface OpenQuote {
  id: number;
  name: string;
  status: string;
  issued: string;
  age: number;
  value: number;
  site: string;
}

export interface UnpaidInvoice {
  id: number;
  issued: string;
  due: string;
  owing: number;
  overdue: boolean;
}

export interface CheckinClient {
  id: number;
  name: string;
  type: "Residential" | "Strata" | "Commercial";
  contactName: string;
  first: string;
  email: string;
  phone: string;
  otherContacts: string[];
  sharedWith: string[];
  siteCount: number;
  site: string;
  suburb: string;
  jobCount: number;
  ltv: number;
  firstJob: string;
  lastJob: { date: string; desc: string; cc: string; value: number; site: string } | null;
  monthsSince: number | null;
  costCentres: string[];
  openQuotes: OpenQuote[];
  openQuoteValue: number;
  unpaid: UnpaidInvoice[];
  unpaidOwing: number;
  inProgress: string[];
  doNotSend: boolean;
  /** Top 3 (blockers first). */
  angles: Angle[];
  leadAngle: AngleId | null;
  /** Every other non-blocker angle that fired. */
  alternatives: Angle[];
  score: number;
  scoreParts: Record<string, number>;
  summary: string;
  jobs: HistoryJob[];
}

export interface DataQualityRow {
  issue: string;
  client: string;
  clientId: string | number;
  detail: string;
}

export interface CheckinResult {
  today: string;
  clients: CheckinClient[];
  dataQuality: DataQualityRow[];
}

// ── Dates & formatting (Australian) ─────────────────────────────────────

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_MS = 86_400_000;

export const todayISO = (): string =>
  C.today ?? new Date().toLocaleDateString("en-CA", { timeZone: "Australia/Brisbane" });
/** 08 Oct 2026 */
export const fmtDate = (iso?: string | null): string =>
  iso ? `${iso.slice(8, 10)} ${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}` : "";
/** Oct 2026 */
const fmtMon = (iso: string) => `${MON[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
/** October 2026 */
const fmtMonth = (iso: string) => `${MONTH[+iso.slice(5, 7) - 1]} ${iso.slice(0, 4)}`;
export const money = (n: number): string => `$${Math.round(n || 0).toLocaleString("en-AU")}`;

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
const months = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / (DAY_MS * 30.4375);
function addMonths(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}
function agoText(m: number): string {
  if (m < 1.5) return "about a month";
  if (m < 11.5) return `${Math.round(m)} months`;
  if (m < 13) return "about a year";
  if (m < 23.5) return `${Math.round(m)} months`;
  return `over ${Math.floor(m / 12)} years`;
}
const cycleText = (m: number) => (Math.round(m) === 12 ? "yearly" : `every ~${Math.round(m)} months`);

type Vars = Record<string, string | number | undefined>;
export function fill(tpl: string | undefined, vars: Vars): string {
  return (tpl ?? "").replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

// ── Text helpers ────────────────────────────────────────────────────────

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', quot: '"', ndash: "-", mdash: "-", lt: "<", gt: ">", hellip: "…" };
const decode = (s: string) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&([a-z]+);/gi, (_, e: string) => ENTITIES[e.toLowerCase()] ?? "");

function descLines(html?: string | null): string[] {
  return decode((html || "").replace(/<br\s*\/?>|<\/(div|p|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function clip(s: string, max = 70): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const at = cut.lastIndexOf(" ");
  return `${cut.slice(0, at > 40 ? at : max).replace(/[,;:\s-]+$/, "")}…`;
}

// ServiceM8 imports are named "4938 - S8 - Painting Residential"; the real
// wording is the first line of the description.
const SM8_NAME = /^\s*\d+\s*-\s*S8\s*-\s*/i;
function shortDesc(name: string | undefined, lines: string[]): string {
  const n = (name || "").trim();
  if (n && !SM8_NAME.test(n)) return clip(n);
  const first = (lines[0] || "").replace(/[\s:–-]+$/, "");
  return clip(first) || n.replace(SM8_NAME, "").trim() || "job";
}

const EMAIL_RE = /^[^@\s,;/]+@[^@\s,;/]+\.[a-z]{2,}$/i;
export const validEmail = (e?: string | null): boolean => EMAIL_RE.test((e || "").trim());

function firstName(given?: string): string {
  const g = (given || "").trim().split(/\s+/)[0] ?? "";
  if (!/[a-z]/i.test(g)) return "";
  return g[0].toUpperCase() + g.slice(1);
}
// "Jedda CTS 10690" -> "Jedda": the plan number reads badly in an email.
const emailSite = (s: string) => s.replace(/\s*\bCTS\s*:?\s*\d*\s*$/i, "").replace(/\s+/g, " ").trim();
const fullName = (c?: { GivenName?: string; FamilyName?: string } | null) =>
  `${c?.GivenName ?? ""} ${c?.FamilyName ?? ""}`.replace(/\s+/g, " ").replace(/^\?\s*/, "").trim();

// ── Services ────────────────────────────────────────────────────────────

const SERVICES = Object.entries(C.services) as [ServiceKey, { label: string; costCentreIds: number[]; keywords: string[] }][];
function servicesFor(ccIds: Set<number>, text: string): Set<ServiceKey> {
  const out = new Set<ServiceKey>();
  for (const [key, s] of SERVICES) {
    if (s.costCentreIds.some((id) => ccIds.has(id)) || s.keywords.some((k) => text.includes(k))) out.add(key);
  }
  return out;
}

interface Job {
  id: number;
  siteId: number;
  site: string;
  desc: string;
  date: string | null;
  issued: string;
  active: boolean;
  stage: string;
  status: string;
  value: number;
  cc: string[];
  services: Set<ServiceKey>;
  contact: RawJob["CustomerContact"];
  fromSM8: boolean;
  unconfirmed: boolean;
}
type DoneJob = Job & { date: string };

interface Quote {
  id: number;
  name: string;
  site: string;
  issued: string;
  age: number;
  status: string;
  value: number;
  chase: boolean;
  open: boolean;
  services: Set<ServiceKey>;
}

interface Invoice {
  id: number;
  issued: string;
  due: string;
  owing: number;
  overdue: boolean;
}

type Customer = RawCustomer & { kind: "Company" | "Individual"; name: string };

/** Visit dates with repeat visits within 3 weeks merged (multi-day jobs). */
function visits(events: DoneJob[]): string[] {
  const out: string[] = [];
  for (const e of events) if (!out.length || days(out[out.length - 1], e.date) > 21) out.push(e.date);
  return out;
}

interface CycleConfig {
  defaultCycleMonths: number;
  minCycleMonths: number;
  maxCycleMonths: number;
}
function usualCycle(vs: string[], cfg: CycleConfig): { months: number; known: boolean } {
  const gaps: number[] = [];
  for (let i = 1; i < vs.length; i++) gaps.push(months(vs[i - 1], vs[i]));
  if (!gaps.length) return { months: cfg.defaultCycleMonths, known: false };
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  return { months: Math.min(cfg.maxCycleMonths, Math.max(cfg.minCycleMonths, median)), known: true };
}

const pushTo = <K, V>(map: Map<K, V[]>, key: K, v: V) => {
  const list = map.get(key);
  if (list) list.push(v);
  else map.set(key, [v]);
};

// ── Main ────────────────────────────────────────────────────────────────

export function analyse(raw: SimproPull): CheckinResult {
  const today = todayISO();
  const exclCust = new Set(C.excludeCustomerIds);
  const exclJob = new Set(C.excludeJobIds);
  const exclStatus = new Set(C.excludeJobStatusIds);
  const siteById = new Map(raw.sites.map((s) => [s.ID, s]));
  const dq: DataQualityRow[] = [];

  const ccByJob = new Map<number, Map<number, string>>();
  for (const r of raw.jobCostCentres) {
    if (!r.Job?.ID || !r.CostCenter?.ID) continue;
    if (!ccByJob.has(r.Job.ID)) ccByJob.set(r.Job.ID, new Map());
    ccByJob.get(r.Job.ID)!.set(r.CostCenter.ID, (r.CostCenter.Name || "").trim());
  }

  const customers: Customer[] = [
    ...raw.companies.map((c) => ({ ...c, kind: "Company" as const, name: (c.CompanyName || "").trim() })),
    ...raw.individuals.map((c) => ({ ...c, kind: "Individual" as const, name: fullName(c) })),
  ].filter((c) => !exclCust.has(c.ID));
  const custById = new Map(customers.map((c) => [c.ID, c]));
  const custName = (id: number) => custById.get(id)?.name ?? `#${id}`;

  // Jobs
  const jobsByCust = new Map<number, Job[]>();
  let sm8Count = 0;
  let unconfirmedCount = 0;
  for (const j of raw.jobs) {
    const cid = j.Customer?.ID;
    if (!cid || exclCust.has(cid) || exclJob.has(j.ID) || exclStatus.has(j.Status?.ID ?? -1)) continue;
    const ccs = ccByJob.get(j.ID) ?? new Map<number, string>();
    const lines = descLines(j.Description);
    const fromSM8 = (j.CompletedDate || "").startsWith(C.serviceM8BulkArchiveDate);
    const unconfirmed =
      fromSM8 && !C.countUnconfirmedServiceM8Jobs && !C.serviceM8CompletedStatusIds.includes(j.Status?.ID ?? -1);
    if (fromSM8) sm8Count++;
    if (unconfirmed) unconfirmedCount++;
    const active = C.activeJobStages.includes(j.Stage ?? "");
    const date = active ? null : ((fromSM8 ? j.DateIssued : j.CompletedDate) || j.DateIssued || "").slice(0, 10) || null;
    const job: Job = {
      id: j.ID,
      siteId: j.Site?.ID ?? 0,
      site: (j.Site?.Name || "").trim(),
      desc: shortDesc(j.Name, lines),
      date,
      issued: (j.DateIssued || "").slice(0, 10),
      active,
      stage: j.Stage ?? "",
      status: (j.Status?.Name || "").trim(),
      value: j.Total?.ExTax || 0,
      cc: [...ccs.values()],
      services: servicesFor(new Set(ccs.keys()), `${j.Name || ""} ${lines[0] || ""} `.toLowerCase()),
      contact: j.CustomerContact,
      fromSM8,
      unconfirmed,
    };
    pushTo(jobsByCust, cid, job);
    if (unconfirmed) continue;

    if (!ccs.size) dq.push({ issue: "Job missing cost centre", client: custName(cid), clientId: cid, detail: `Job #${j.ID} ${job.desc}` });
    if (!active && !j.CompletedDate) dq.push({ issue: "Finished job missing completed date", client: custName(cid), clientId: cid, detail: `Job #${j.ID} ${job.desc} (${j.Stage}, issued ${fmtDate(job.issued)})` });
    if (!active && !(job.value > 0)) dq.push({ issue: "Finished job with $0 value", client: custName(cid), clientId: cid, detail: `Job #${j.ID} ${job.desc} (${fmtDate(date)})` });
  }

  // Quotes
  const qc = C.quotes;
  const quotesByCust = new Map<number, Quote[]>();
  for (const q of raw.quotes) {
    const cid = q.Customer?.ID;
    if (!cid || exclCust.has(cid) || !q.DateIssued) continue;
    const name = (q.Name || "").replace(SM8_NAME, "").trim() || `Quote #${q.ID}`;
    const issued = q.DateIssued.slice(0, 10);
    const sid = q.Status?.ID ?? -1;
    const age = days(issued, today);
    pushTo(quotesByCust, cid, {
      id: q.ID,
      name: clip(name),
      site: (q.Site?.Name || "").trim(),
      issued,
      age,
      status: (q.Status?.Name || "").trim(),
      value: q.Total?.ExTax || 0,
      chase: !q.IsClosed && qc.chaseStatusIds.includes(sid) && age <= qc.maxAgeDays,
      open: !q.IsClosed && [...qc.chaseStatusIds, ...qc.inProgressStatusIds].includes(sid) && age <= qc.maxAgeDays,
      services: servicesFor(new Set(), `${name} `.toLowerCase()),
    });
  }

  // Invoices
  const invByCust = new Map<number, Invoice[]>();
  for (const i of raw.invoices) {
    const cid = i.Customer?.ID;
    if (!cid || i.IsPaid || i.IsCredit || !i.Total?.IncTax || i.Total.IncTax <= 0) continue;
    const owing = (i.Total.ExTax || 0) * (1 - (i.Total.Paid || 0) / i.Total.IncTax);
    if (owing < C.invoices.minOwingExTax) continue;
    const overdue = !!i.DueDate && i.DueDate.slice(0, 10) < today;
    pushTo(invByCust, cid, { id: i.ID, issued: (i.DateIssued || "").slice(0, 10), due: (i.DueDate || "").slice(0, 10), owing, overdue });
  }

  const clients = customers.map((c) =>
    buildClient(c, jobsByCust.get(c.ID) ?? [], quotesByCust.get(c.ID) ?? [], invByCust.get(c.ID) ?? [], siteById, today),
  );

  // Clients sharing one email address (strata managers etc.)
  const byEmail = new Map<string, CheckinClient[]>();
  for (const cl of clients) if (cl.email) pushTo(byEmail, cl.email.toLowerCase(), cl);
  for (const group of byEmail.values()) {
    if (group.length < 2) continue;
    for (const cl of group) cl.sharedWith = group.filter((o) => o !== cl).map((o) => o.name);
    dq.push({ issue: "Email shared by several clients", client: group.map((g) => g.name).join(" | "), clientId: group[0].id, detail: `${group[0].email} used by ${group.length} clients` });
  }

  clients.sort((a, b) => b.score - a.score || b.ltv - a.ltv);

  dataQuality(dq, customers, clients, raw, siteById);
  dq.unshift({
    issue: "Info: ServiceM8 imports",
    client: "",
    clientId: "",
    detail:
      `${sm8Count} jobs bulk-archived on ${fmtDate(C.serviceM8BulkArchiveDate)}; their issue date is used as the job date. ` +
      (unconfirmedCount
        ? `${unconfirmedCount} of them never reached Fully-paid in ServiceM8 (likely lost quotes or unfinished work), so they're shown as "unconfirmed" and left out of values and follow-ups (countUnconfirmedServiceM8Jobs in lib/checkin/config.ts).`
        : "All of them are counted as completed work."),
  });

  return { today, clients, dataQuality: dq };
}

function buildClient(
  c: Customer,
  jobs: Job[],
  allQuotes: Quote[],
  invoices: Invoice[],
  siteById: Map<number, RawSite>,
  today: string,
): CheckinClient {
  const done = jobs
    .filter((j): j is DoneJob => !j.active && !j.unconfirmed && !!j.date)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  // Unconfirmed ServiceM8 jobs are treated as past (closed) quotes.
  const quotes: Quote[] = [
    ...allQuotes,
    ...jobs
      .filter((j) => j.unconfirmed && j.issued)
      .map((j) => ({ id: j.id, name: j.desc, site: j.site, issued: j.issued, age: days(j.issued, today), status: "ServiceM8 (unconfirmed)", value: j.value, chase: false, open: false, services: j.services })),
  ];
  const active = jobs.filter((j) => j.active);
  const last = done[done.length - 1];
  const ltv = done.reduce((s, j) => s + j.value, 0);
  const monthsSince = last ? months(last.date, today) : null;

  // Sites: the one with the most jobs (latest wins ties) is the main site.
  const siteJobs = new Map<number, { n: number; last: string; name: string }>();
  for (const j of done) siteJobs.set(j.siteId, { n: (siteJobs.get(j.siteId)?.n ?? 0) + 1, last: j.date, name: j.site });
  const siteIds = new Set([...(c.Sites ?? []).map((s) => s.ID), ...jobs.map((j) => j.siteId)].filter(Boolean));
  const mainSiteId =
    [...siteJobs.entries()].sort((a, b) => b[1].n - a[1].n || (b[1].last > a[1].last ? 1 : -1))[0]?.[0] ?? c.Sites?.[0]?.ID;
  const mainSite = mainSiteId != null ? siteById.get(mainSiteId) : undefined;
  const siteName = (mainSite?.Name || (mainSiteId != null ? siteJobs.get(mainSiteId)?.name : "") || c.Sites?.[0]?.Name || "").trim();
  const suburb = (mainSite?.Address?.City || "").trim();

  // Contacts: most recent job contact with an email, then the customer's
  // own email, then any contact on the customer card.
  interface Contact { name: string; first: string; email: string; uses: number; last: string }
  const seen = new Map<string, Contact>();
  for (const j of [...jobs].sort((a, b) => ((a.date || a.issued) < (b.date || b.issued) ? -1 : 1))) {
    const e = (j.contact?.Email || "").trim();
    if (!validEmail(e)) continue;
    const k = e.toLowerCase();
    seen.set(k, { name: fullName(j.contact), first: firstName(j.contact?.GivenName), email: e, uses: (seen.get(k)?.uses ?? 0) + 1, last: j.date || j.issued });
  }
  for (const k of c.Contacts ?? []) {
    const e = (k.Email || "").trim();
    if (validEmail(e) && !seen.has(e.toLowerCase())) seen.set(e.toLowerCase(), { name: fullName(k), first: firstName(k.GivenName), email: e, uses: 0, last: "" });
  }
  const custEmail = (c.Email || "").trim();
  const byRecency = [...seen.values()]
    .filter((x) => x.uses > 0)
    .sort((a, b) => (b.last > a.last ? 1 : b.last < a.last ? -1 : b.uses - a.uses));
  let primary: Contact | undefined = byRecency[0];
  if (!primary && validEmail(custEmail)) {
    primary = seen.get(custEmail.toLowerCase()) ?? {
      name: c.kind === "Individual" ? c.name : "",
      first: c.kind === "Individual" ? firstName(c.GivenName) : "",
      email: custEmail,
      uses: 0,
      last: "",
    };
  }
  primary ??= [...seen.values()][0];
  if (primary && !primary.first && c.kind === "Individual") primary = { ...primary, first: firstName(c.GivenName), name: primary.name || c.name };
  const primaryEmail = primary?.email.toLowerCase();
  const others = [...seen.values()]
    .filter((x) => x.email.toLowerCase() !== primaryEmail)
    .map((x) => (x.name ? `${x.name} <${x.email}>` : x.email));
  if (validEmail(custEmail) && primary && custEmail.toLowerCase() !== primaryEmail && !seen.has(custEmail.toLowerCase())) others.push(custEmail);

  // Service history
  const events = Object.fromEntries(
    SERVICES.map(([key]) => [key, done.filter((j) => j.services.has(key))]),
  ) as Record<ServiceKey, DoneJob[]>;
  const openQuotes = quotes.filter((q) => q.open);
  const blocked = new Set<ServiceKey>([...active, ...openQuotes].flatMap((x) => [...x.services]));

  const first = primary?.first || "there";
  const jobVars = (j: DoneJob): Vars => {
    const m = months(j.date, today);
    return { first, site: emailSite(j.site || siteName), job: j.desc, month: fmtMonth(j.date), date: fmtDate(j.date), ago: agoText(m), months: Math.round(m), value: money(j.value) };
  };

  const A = C.angles;
  const angles: Angle[] = [];
  const add = (id: AngleId, vars: Vars, extra: { weight?: number; para?: string } = {}) => {
    const a = A[id] as { enabled: boolean; weight: number; label: string; title: string; reason: string; subject?: string; para?: string; blocker?: boolean };
    if (!a.enabled) return;
    angles.push({
      id,
      label: a.label,
      weight: extra.weight ?? a.weight,
      blocker: !!a.blocker,
      title: fill(a.title, vars),
      reason: fill(a.reason, vars),
      subject: fill(a.subject, vars),
      para: fill(extra.para ?? a.para, vars),
      site: String(vars.site || emailSite(siteName)),
    });
  };

  // Blockers
  const overdueInv = invoices.filter((i) => i.overdue || !C.invoices.onlyOverdue);
  if (overdueInv.length) add("chasePayment", { count: overdueInv.length, owing: money(overdueInv.reduce((s, i) => s + i.owing, 0)) });
  const tags = (c.Tags ?? []).map((t) => (typeof t === "string" ? t : (t?.Name ?? "")).toUpperCase());
  if (tags.includes("BLACKLIST") || c.DoNotCall) add("doNotContact", {});

  // Anchors — per site, most urgent site wins.
  if (!blocked.has("anchors")) {
    const bySite = new Map<number, DoneJob>();
    for (const j of events.anchors) bySite.set(j.siteId, j); // sorted, so last = latest
    const due: { j: DoneJob; dueDate: string; toDue: number }[] = [];
    for (const j of bySite.values()) {
      const dueDate = addMonths(j.date, A.anchorsDue.monthsAfter);
      const toDue = days(today, dueDate);
      if (toDue <= A.anchorsDue.leadDays && -toDue / 30.4375 <= A.anchorsDue.maxMonthsOverdue) due.push({ j, dueDate, toDue });
    }
    due.sort((a, b) => a.toDue - b.toDue);
    if (due.length) {
      const { j, dueDate, toDue } = due.find((d) => d.toDue >= -183) ?? due[0];
      const upcoming = toDue >= 0;
      const more = due.length > 1 ? ` (+${due.length - 1} more site${due.length > 2 ? "s" : ""})` : "";
      add(
        "anchorsDue",
        {
          ...jobVars(j),
          due: fmtDate(dueDate) + more,
          dueWord: upcoming ? "due" : "overdue since",
          dueWordShort: upcoming ? `due ${fmtMon(dueDate)}` : "overdue",
          dueSentence: upcoming ? `is due in ${fmtMonth(dueDate)}` : `was due in ${fmtMonth(dueDate)} and is now overdue`,
        },
        { weight: toDue >= -183 ? A.anchorsDue.weight : Math.round(A.anchorsDue.weight * 0.8) },
      );
    }
  }

  // Open quotes we're waiting on
  const chase = quotes.filter((q) => q.chase && q.age >= C.quotes.chaseAfterDays && q.value > 0);
  if (chase.length) {
    const fresh = chase.filter((q) => q.age <= C.quotes.freshForDays).sort((a, b) => b.value - a.value);
    const q = fresh[0] ?? [...chase].sort((a, b) => b.value - a.value)[0];
    const more = chase.length > 1 ? ` +${chase.length - 1} more` : "";
    add(
      "quoteChase",
      { first, site: emailSite(q.site || siteName), quoteNo: q.id, quote: q.name, quoteValue: money(q.value), quoteDate: fmtDate(q.issued), quoteMonth: fmtMonth(q.issued), days: q.age, more },
      { weight: fresh.length ? A.quoteChase.weight : A.quoteChase.staleWeight },
    );
  }

  // Repaint → building wash
  let paintWashFired = false;
  const lastPaint = events.painting.filter((j) => j.value >= A.paintWash.minPaintValueExTax).pop();
  if (lastPaint && !blocked.has("wash")) {
    const m = months(lastPaint.date, today);
    const washedSince = events.wash.some((w) => w.date > lastPaint.date);
    if (m >= A.paintWash.minMonths && m <= A.paintWash.maxMonths && !washedSince) {
      add("paintWash", jobVars(lastPaint));
      paintWashFired = true;
    }
  }

  // Large job walk-through
  const big = done.filter((j) => j.value >= A.bigJobWalkthrough.minValueExTax).pop();
  if (big) {
    const m = months(big.date, today);
    if (m >= A.bigJobWalkthrough.minMonths && m <= A.bigJobWalkthrough.maxMonths) add("bigJobWalkthrough", jobVars(big));
  }

  // Repeating services past their usual cycle
  const cycleAngle = (id: "washDue" | "windowsDue" | "maintenanceDue", key: ServiceKey, minVisits = 1) => {
    const cfg = A[id];
    const ev = events[key];
    if (!ev.length || blocked.has(key)) return;
    const vs = visits(ev);
    if (vs.length < minVisits) return;
    const cyc = usualCycle(vs, cfg);
    const lastJob = ev[ev.length - 1];
    const m = months(lastJob.date, today);
    if (m < cyc.months * cfg.overdueFactor || m > cfg.maxMonths) return;
    add(
      id,
      { ...jobVars(lastJob), visits: vs.length, cycle: cyc.known ? cycleText(cyc.months) : `${cycleText(cyc.months)} (typical)` },
      { weight: cyc.known ? cfg.weight : Math.round(cfg.weight * 0.85) },
    );
  };
  if (!paintWashFired) cycleAngle("washDue", "wash");
  cycleAngle("windowsDue", "windows");

  // One-off work check-ins
  const checkin = (id: "waterproofCheck" | "paintCheckin" | "ropeAccessCheckin", key: ServiceKey) => {
    const cfg = A[id];
    const j = events[key][events[key].length - 1];
    if (!j || blocked.has(key)) return;
    const m = months(j.date, today);
    if (m >= cfg.minMonths && m <= cfg.maxMonths) add(id, jobVars(j));
  };
  checkin("waterproofCheck", "waterproofing");
  if (!paintWashFired) checkin("paintCheckin", "painting");
  checkin("ropeAccessCheckin", "ropeAccess");
  cycleAngle("maintenanceDue", "maintenance", A.maintenanceDue.minVisits);

  // Lapsed
  if (last && monthsSince! >= A.lapsed.minMonths && !active.length && !openQuotes.length) add("lapsed", jobVars(last));

  // Cross-sell
  if (last && monthsSince! <= A.crossSell.activeWithinMonths) {
    for (const r of A.crossSell.rules) {
      const has = events[r.has];
      if (!has.length || events[r.missing].length || blocked.has(r.missing)) continue;
      add(
        "crossSell",
        { ...jobVars(has[has.length - 1]), service: C.services[r.has].label.toLowerCase(), missing: C.services[r.missing].label.toLowerCase() },
        { para: r.para },
      );
      break;
    }
  }

  // Quoted but never a client
  if (!done.length && quotes.length && !chase.length) {
    const recent = quotes
      .filter((q) => months(q.issued, today) <= A.quotedNeverWon.withinMonths)
      .sort((a, b) => (a.issued < b.issued ? 1 : -1));
    const q = recent[0];
    if (q) add("quotedNeverWon", { first, site: emailSite(q.site || siteName), count: recent.length, quote: q.name, quoteValue: money(q.value), quoteDate: fmtDate(q.issued), quoteMonth: fmtMonth(q.issued) });
  }

  if (!angles.some((a) => !a.blocker)) add("general", { first, site: emailSite(siteName) || "your property" });

  angles.sort((a, b) => b.weight - a.weight);
  const top = angles.slice(0, 3);
  const lead = top.find((a) => !a.blocker) ?? angles.find((a) => !a.blocker);

  // Priority score
  const S = C.score;
  const lo = Math.log10(500);
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
  const openValue = openQuotes.reduce((s, q) => s + q.value, 0);
  const parts: Record<string, number> = {
    lifetimeValue: ltv > 0 ? clamp01((Math.log10(ltv) - lo) / (Math.log10(S.lifetimeValue.fullAt) - lo)) * S.lifetimeValue.points : 0,
    recency: last ? clamp01((S.recency.zeroAfterMonths - monthsSince!) / (S.recency.zeroAfterMonths - S.recency.fullWithinMonths)) * S.recency.points : 0,
    lastJobSize: last ? clamp01(Math.sqrt(Math.max(0, last.value) / S.lastJobSize.fullAt)) * S.lastJobSize.points : 0,
    repeat: clamp01((done.length - 1) / (S.repeat.fullAtJobs - 1)) * S.repeat.points,
    openQuotes: clamp01(openValue / S.openQuotes.fullAt) * S.openQuotes.points,
    angle: ((lead?.weight ?? 0) / 100) * S.angle.points,
  };
  const score = Math.round(Object.values(parts).reduce((s, x) => s + x, 0));

  // Cost centres, most used first
  const ccCount = new Map<string, number>();
  for (const j of done) for (const n of j.cc) ccCount.set(n, (ccCount.get(n) ?? 0) + 1);
  const costCentres = [...ccCount.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);

  // One-line summary
  const type: CheckinClient["type"] =
    c.kind === "Individual" ? "Residential" : /\b(cts|body corp\w*|bc|strata|owners corp\w*)\b/i.test(c.name) ? "Strata" : "Commercial";
  const next = lead ? `; next: ${lead.title.charAt(0).toLowerCase()}${lead.title.slice(1)}` : "";
  const block = top.filter((a) => a.blocker).map((a) => a.title.split(" — ")[0]).join("; ");
  let summary: string;
  if (last) {
    summary = `${type} client since ${done[0].date.slice(0, 4)}, ${done.length} job${done.length === 1 ? "" : "s"} worth ${money(ltv)}, last job ${last.desc}${last.cc.length ? ` (${last.cc[0]})` : ""} in ${fmtMon(last.date)}${next}.`;
  } else if (quotes.length) {
    const q = [...quotes].sort((a, b) => (a.issued < b.issued ? 1 : -1))[0];
    summary = `${type} contact with no completed jobs; ${quotes.length} quote${quotes.length === 1 ? "" : "s"}, latest ${q.name} (${money(q.value)}) in ${fmtMon(q.issued)}${next}.`;
  } else {
    summary = `${type} contact with no jobs or quotes on record${next}.`;
  }
  if (block) summary = `${block.toUpperCase()}. ${summary}`;

  return {
    id: c.ID,
    name: c.name || `Customer #${c.ID}`,
    type,
    contactName: primary?.name ?? "",
    first: primary?.first ?? "",
    email: primary?.email ?? "",
    phone: (c.Phone || c.CellPhone || c.AltPhone || "").trim(),
    otherContacts: others,
    sharedWith: [],
    siteCount: siteIds.size,
    site: siteName,
    suburb,
    jobCount: done.length,
    ltv,
    firstJob: done[0]?.date ?? "",
    lastJob: last ? { date: last.date, desc: last.desc, cc: last.cc.join(" / "), value: last.value, site: last.site } : null,
    monthsSince: monthsSince == null ? null : Math.round(monthsSince),
    costCentres,
    openQuotes: openQuotes.map((q) => ({ id: q.id, name: q.name, status: q.status, issued: q.issued, age: q.age, value: q.value, site: q.site })),
    openQuoteValue: openValue,
    unpaid: invoices,
    unpaidOwing: invoices.reduce((s, i) => s + i.owing, 0),
    inProgress: active.map((j) => `${j.desc} (${j.status || j.stage})`),
    doNotSend: top.some((a) => a.blocker),
    angles: top,
    leadAngle: lead?.id ?? null,
    alternatives: angles.filter((a) => !a.blocker && !top.includes(a)),
    score,
    scoreParts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v)])),
    summary,
    jobs: [...jobs]
      .sort((a, b) => ((b.date || "9999") > (a.date || "9999") ? 1 : -1))
      .map((j) => ({ id: j.id, date: j.date, issued: j.issued, active: j.active, unconfirmed: j.unconfirmed, cc: j.cc.join(" / "), desc: j.desc, value: j.value, status: j.status || j.stage, site: j.site, sm8: j.fromSM8 })),
  };
}

// ── Data quality ────────────────────────────────────────────────────────

function dataQuality(dq: DataQualityRow[], customers: Customer[], clients: CheckinClient[], raw: SimproPull, siteById: Map<number, RawSite>) {
  for (const cl of clients) {
    if (!cl.email) dq.push({ issue: "No usable email", client: cl.name, clientId: cl.id, detail: cl.jobCount ? `${cl.jobCount} jobs, last ${fmtDate(cl.lastJob?.date)}` : "No completed jobs" });
  }
  for (const c of customers) {
    const bad = [c.Email, ...(c.Contacts ?? []).map((k) => k.Email)].map((e) => (e || "").trim()).filter((e) => e && !validEmail(e));
    for (const e of bad) dq.push({ issue: "Malformed email", client: c.name, clientId: c.ID, detail: e });
    for (const k of c.Contacts ?? []) {
      if (!/[a-z]/i.test(k.GivenName || "")) dq.push({ issue: "Contact with blank or '?' first name", client: c.name, clientId: c.ID, detail: `${fullName(k) || "(no name)"} ${k.Email || ""}`.trim() });
    }
  }
  const norm = (s: string) => s.toLowerCase().replace(/\b(pty|ltd|limited|the|cts|bc|body corporate)\b/g, "").replace(/[^a-z0-9]/g, "");
  const byName = new Map<string, Customer[]>();
  for (const c of customers) {
    const k = norm(c.name);
    if (k) pushTo(byName, k, c);
  }
  for (const g of byName.values()) {
    if (g.length > 1) dq.push({ issue: "Possible duplicate client", client: g.map((c) => c.name).join(" | "), clientId: g.map((c) => c.ID).join(" | "), detail: `${g.length} SimPRO customers with near-identical names` });
  }
  const noSuburb = [...siteById.values()].filter((s) => !(s.Address?.City || "").trim());
  dq.push({ issue: "Info: sites with no suburb", client: "", clientId: "", detail: `${noSuburb.length} of ${raw.sites.length} sites have no suburb in their address` });
}
