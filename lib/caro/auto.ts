// lib/caro/auto.ts
//
// Caro automations — the sentence grammar, the builder logic, a preview of
// what a rule would do today, and the reference engine the 6:00 run uses.
// Every rule is one sentence of chips:
//   When <trigger> [<condition>] [for <service line>] then <action> [<target>] (and …) ×≤3

import { OWNERS, isLineKey, type Derived, type LineKey, type Site, type Timing } from "./data";

/* ---------- vocabulary ---------- */
const SCOPES = ["any service line", "Height safety", "Window cleaning", "Building cleaning"];
export const SUBJECTS = ["Next due date", "a reminder", "Status", "nothing", "every week"];
const DUE = ["is 90 days away", "is 60 days away", "is 30 days away", "is 1 week away", "arrives", "is overdue"];
const ENGAGE = ["is opened twice with no reply", "is not opened after 7 days", "gets a reply"];
const STATUSES = ["Needs you", "Booked", "Snoozed"];
const SPANS = ["7 days after a reminder", "14 days after a reminder", "30 days after a reminder"];
const EVERY = ["Monday morning", "Friday afternoon", "the 1st of the month"];
export const VERBS = ["send email", "create a task for", "notify", "create a job", "move to", "post to Slack"];
const PEOPLE = ["the account owner", ...OWNERS.map((o) => o.name), "the whole team"];
const GROUPS = ["Needs you", "Snoozed for 30 days"];
const CHANNELS = ["#jobs", "#ops", "#sales"];
const PERSON_VERBS = ["create a task for", "notify"];
const SCOPED = ["Next due date", "a reminder", "nothing"];
export const MAX_ACTIONS = 3;

/* ---------- rule shape ----------
   Empty string = not chosen yet (dashed red "choose" chip). */
export interface Act {
  verb: string;
  who: string;
  group: string;
  template: string;
  channel: string;
}
export interface Rule {
  subject: string;
  pred: string;
  engage: string;
  status: string;
  span: string;
  every: string;
  scope: string;
  acts: Act[];
}
export interface LiveRule {
  id: string;
  on: boolean;
  owner: string;
  last: string;
  rule: Rule;
}
export interface Part {
  t: 0 | 1;
  text?: string;
  key?: string;
  opts?: string[];
  val?: string;
  isVerb?: boolean;
}

export const newAct = (verb = ""): Act => ({ verb, who: "", group: "", template: "", channel: "" });
export const newRule = (): Rule => ({ subject: "", pred: "", engage: "", status: "", span: "", every: "", scope: "", acts: [newAct()] });
const mk = (o: Partial<Omit<Rule, "acts">> & { acts: Partial<Act>[] }): Rule => ({
  ...newRule(),
  ...o,
  acts: o.acts.map((a) => ({ ...newAct(), ...a })),
});
export const clone = <T,>(r: T): T => JSON.parse(JSON.stringify(r));

/** Sentence parts. t:1 = fixed words, t:0 = a chip with options.
 *  `templates` are the Email templates page's names (the send-email chip). */
export function ruleParts(r: Rule, templates: string[]): Part[] {
  const p: Part[] = [];
  const T = (text: string) => p.push({ t: 1, text });
  const C = (key: string, opts: string[], val: string) =>
    p.push({ t: 0, key, opts, val, isVerb: key === "subject" || key.endsWith(".verb") });
  T("When");
  C("subject", SUBJECTS, r.subject);
  if (r.subject === "Next due date") C("pred", DUE, r.pred);
  else if (r.subject === "a reminder") C("engage", ENGAGE, r.engage);
  else if (r.subject === "Status") {
    T("changes to");
    C("status", STATUSES, r.status);
  } else if (r.subject === "nothing") {
    T("happens for");
    C("span", SPANS, r.span);
  } else if (r.subject === "every week") {
    T("rolls around on");
    C("every", EVERY, r.every);
  }
  if (SCOPED.includes(r.subject)) {
    T("for");
    C("scope", SCOPES, r.scope);
  }
  r.acts.forEach((a, i) => {
    T(i === 0 ? "then" : "and");
    const k = `acts.${i}.`;
    C(k + "verb", VERBS, a.verb);
    if (PERSON_VERBS.includes(a.verb)) C(k + "who", PEOPLE, a.who);
    else if (a.verb === "move to") C(k + "group", GROUPS, a.group);
    else if (a.verb === "send email") C(k + "template", templates, a.template);
    else if (a.verb === "post to Slack") C(k + "channel", CHANNELS, a.channel);
    else if (a.verb === "create a job") T("in the Schedule queue");
  });
  return p;
}
export const ruleText = (r: Rule, templates: string[]) =>
  ruleParts(r, templates)
    .map((p) => (p.t ? p.text : p.val || "…"))
    .join(" ");
export const missingCount = (r: Rule, templates: string[]) => ruleParts(r, templates).filter((p) => !p.t && !p.val).length;

/** Changing the trigger or a verb resets what depends on it and pre-fills the first option. */
export function setChoice(rule: Rule, key: string, v: string, templates: string[]): Rule {
  const r = clone(rule);
  const seg = key.split(".");
  if (seg.length === 1) {
    (r as unknown as Record<string, string>)[key] = v;
    if (key === "subject") {
      r.pred = v === "Next due date" ? DUE[1] : "";
      r.engage = v === "a reminder" ? ENGAGE[0] : "";
      r.status = v === "Status" ? STATUSES[1] : "";
      r.span = v === "nothing" ? SPANS[0] : "";
      r.every = v === "every week" ? EVERY[0] : "";
      r.scope = SCOPED.includes(v) ? SCOPES[0] : "";
    }
    return r;
  }
  const a = r.acts[+seg[1]];
  (a as unknown as Record<string, string>)[seg[2]] = v;
  if (seg[2] === "verb") {
    Object.assign(a, { who: "", group: "", template: "", channel: "" });
    if (PERSON_VERBS.includes(v)) a.who = PEOPLE[0];
    if (v === "move to") a.group = GROUPS[0];
    if (v === "send email") a.template = templates[0] ?? "";
    if (v === "post to Slack") a.channel = CHANNELS[0];
  }
  return r;
}
export function addAction(r: Rule): Rule {
  if (r.acts.length >= MAX_ACTIONS) return r;
  const x = clone(r);
  x.acts.push({ ...newAct("notify"), who: PEOPLE[0] });
  return x;
}
export function dropAction(r: Rule): Rule {
  if (r.acts.length <= 1) return r;
  const x = clone(r);
  x.acts.pop();
  return x;
}

/* ---------- library ---------- */
export const CATEGORIES = [
  { name: "Explore", icon: "M12 3l2.4 5.4L20 11l-5.6 2.6L12 19l-2.4-5.4L4 11l5.6-2.6L12 3z" },
  { name: "Popular", icon: "M12 3l2.6 6.6 6.4.4-4.8 4.3 1.4 6.7L12 17.4 6.4 21l1.4-6.7L3 10l6.4-.4L12 3z" },
  { name: "Due dates", icon: "M5 6h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2zM3 10h18M8 3v4M16 3v4" },
  { name: "Replies", icon: "M3 8l9 6 9-6M5.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9A2.5 2.5 0 015.5 5z" },
  { name: "Jobs", icon: "M4 6.5h16v13H4zM4 10h16M8.5 4v4M15.5 4v4" },
  { name: "Notify", icon: "M18 8a6 6 0 10-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 01-3.4 0" },
  { name: "Integrations", icon: "M10 3v6M14 3v6M7 9h10v4a5 5 0 01-10 0V9zM12 18v3" },
];
export interface Recipe {
  id: string;
  cat: string;
  basic?: boolean;
  tone: "blue" | "slate" | "amber";
  rule: Rule;
}
export const RECIPES: Recipe[] = [
  { id: "r1", cat: "Replies", basic: true, tone: "amber", rule: mk({ subject: "a reminder", engage: "is opened twice with no reply", scope: "any service line", acts: [{ verb: "create a task for", who: "the account owner" }] }) },
  { id: "r2", cat: "Jobs", basic: true, tone: "blue", rule: mk({ subject: "Status", status: "Booked", acts: [{ verb: "create a job" }] }) },
  { id: "r3", cat: "Due dates", basic: true, tone: "slate", rule: mk({ subject: "Next due date", pred: "is overdue", scope: "any service line", acts: [{ verb: "notify", who: "the account owner" }] }) },
  { id: "r4", cat: "Replies", tone: "blue", rule: mk({ subject: "a reminder", engage: "gets a reply", scope: "any service line", acts: [{ verb: "notify", who: "the account owner" }] }) },
  { id: "r5", cat: "Notify", tone: "amber", rule: mk({ subject: "every week", every: "Monday morning", acts: [{ verb: "notify", who: "the whole team" }] }) },
  { id: "r6", cat: "Replies", tone: "slate", rule: mk({ subject: "nothing", span: "30 days after a reminder", scope: "any service line", acts: [{ verb: "move to", group: "Needs you" }] }) },
  { id: "r7", cat: "Due dates", tone: "blue", rule: mk({ subject: "Next due date", pred: "is 90 days away", scope: "Height safety", acts: [{ verb: "create a task for", who: "the account owner" }] }) },
  { id: "r8", cat: "Replies", tone: "slate", rule: mk({ subject: "a reminder", engage: "is not opened after 7 days", scope: "any service line", acts: [{ verb: "send email", template: "Final nudge" }] }) },
  { id: "r9", cat: "Jobs", tone: "blue", rule: mk({ subject: "Next due date", pred: "is 1 week away", scope: "Window cleaning", acts: [{ verb: "create a job" }] }) },
  { id: "r10", cat: "Integrations", tone: "slate", rule: mk({ subject: "Status", status: "Booked", acts: [{ verb: "post to Slack", channel: "#jobs" }] }) },
];
// Brand tiles use each product's own colours — the one place non-system colour is allowed.
export const INTEGRATIONS = [
  { name: "Gmail", bg: "#ffffff", color: "#D93025", line: true, connected: false },
  { name: "Outlook", bg: "#0F6CBD", color: "#ffffff", connected: false },
  { name: "Resend", bg: "#17171a", color: "#ffffff", connected: true },
  { name: "SimPRO", bg: "#0A66B2", color: "#ffffff", connected: true },
  { name: "Slack", bg: "#3B0B3B", color: "#ffffff", connected: false },
  { name: "Xero", bg: "#13B5EA", color: "#ffffff", connected: false },
];
// Nothing runs until someone turns a rule on — new installs start empty.
export const DEFAULT_RULES: LiveRule[] = [];

/* ---------- reference engine (server side) ----------
   Every site passed in carries `d` = derive(site, timing[site.line]).
   onTick(rules, sites, ran)          — once a day at 6:00 local
   onEvent(rules, event, site, ran)   — reminder_reply · status_changed { to: 'needs' | 'booked' | 'snoozed' }
   Both return jobs { ruleId, siteKey, actions }, de-duplicated against `ran`
   (a persisted Set of "ruleId|siteKey|fireKey"). */
export type DSite = Site & { d: Derived };
export const LINE_OF: Record<string, LineKey> = { "Height safety": "hs", "Window cleaning": "wc", "Building cleaning": "bc" };
const DUE_DAYS: Record<string, number> = { "is 90 days away": 90, "is 60 days away": 60, "is 30 days away": 30, "is 1 week away": 7, arrives: 0 };
const SPAN_DAYS: Record<string, number> = { "7 days after a reminder": 7, "14 days after a reminder": 14, "30 days after a reminder": 30 };
export const STATUS_KEY: Record<string, string> = { "Needs you": "needs", Booked: "booked", Snoozed: "snoozed" };
const inScope = (r: Rule, s: Site) => !r.scope || r.scope === "any service line" || (isLineKey(LINE_OF[r.scope]) && LINE_OF[r.scope] === s.line);
export const isEvent = (r: Rule) => r.subject === "Status" || (r.subject === "a reminder" && r.engage === "gets a reply");

/** Does a time-based rule match this site today? */
export function matchesNow(r: Rule, s: DSite): boolean {
  if (!inScope(r, s) || s.booked || s.stopped) return false;
  const d = s.d;
  const rem = s.reminded;
  if (r.subject === "Next due date") return r.pred === "is overdue" ? d.days < 0 : d.days === DUE_DAYS[r.pred];
  if (r.subject === "a reminder") {
    if (!rem || rem.replied) return false;
    if (r.engage === "is opened twice with no reply") return rem.opened >= 2;
    if (r.engage === "is not opened after 7 days") return rem.opened === 0 && (d.sentAgo ?? 0) >= 7;
  }
  if (r.subject === "nothing") return !!rem && !rem.replied && (d.sentAgo ?? 0) >= SPAN_DAYS[r.span];
  return false;
}
// Fire once per due date (dates), once per reminder (engagement + quiet).
const fireKey = (r: Rule, s: Site) =>
  r.subject === "Next due date" ? `due:${s.lastDone}+${s.interval}` : `rem:${s.reminded ? s.reminded.at : ""}`;

export interface EngineJob {
  ruleId: string;
  siteKey: string | null;
  actions: Act[];
}
export function onTick(rules: LiveRule[], sites: DSite[], ran: Set<string> | null, now: Date = new Date()): EngineJob[] {
  const jobs: EngineJob[] = [];
  const push = (v: LiveRule, site: DSite | null, key: string) => {
    const k = `${v.id}|${site ? site.key : "*"}|${key}`;
    if (ran?.has(k)) return;
    ran?.add(k);
    jobs.push({ ruleId: v.id, siteKey: site ? site.key : null, actions: v.rule.acts });
  };
  rules
    .filter((v) => v.on && !isEvent(v.rule))
    .forEach((v) => {
      if (v.rule.subject === "every week") {
        const day = now.getDay();
        const fire =
          (v.rule.every === "Monday morning" && day === 1) ||
          (v.rule.every === "Friday afternoon" && day === 5) ||
          (v.rule.every === "the 1st of the month" && now.getDate() === 1);
        if (fire) push(v, null, "sched:" + now.toDateString()); // siteKey null = one digest
        return;
      }
      sites.filter((s) => matchesNow(v.rule, s)).forEach((s) => push(v, s, fireKey(v.rule, s)));
    });
  return jobs;
}
export function onEvent(
  rules: LiveRule[],
  event: { type: "reminder_reply" | "status_changed"; to?: string; id?: string },
  site: Site,
  ran: Set<string> | null,
): EngineJob[] {
  const jobs: EngineJob[] = [];
  rules
    .filter((v) => v.on && isEvent(v.rule) && inScope(v.rule, site))
    .forEach((v) => {
      const r = v.rule;
      const hit =
        (r.subject === "a reminder" && event.type === "reminder_reply") ||
        (r.subject === "Status" && event.type === "status_changed" && STATUS_KEY[r.status] === event.to);
      if (!hit) return;
      const k = `${v.id}|${site.key}|${event.type}:${event.id ?? Date.now()}`;
      if (ran?.has(k)) return;
      ran?.add(k);
      jobs.push({ ruleId: v.id, siteKey: site.key, actions: r.acts });
    });
  return jobs;
}

/** Builder preview — "what would this do today?" */
export function preview(rule: Rule, sites: DSite[], templates: string[]) {
  if (missingCount(rule, templates)) return null;
  if (isEvent(rule)) return { kind: "event" as const };
  if (rule.subject === "every week") return { kind: "schedule" as const };
  const hits = sites.filter((s) => matchesNow(rule, s));
  let soon = 0;
  if (rule.subject === "Next due date" && rule.pred !== "is overdue") {
    const n = DUE_DAYS[rule.pred];
    soon = sites.filter((s) => inScope(rule, s) && !s.booked && s.d.days > n && s.d.days <= n + 30).length;
  }
  return { kind: "now" as const, hits, soon };
}

/** The built-in reminder sequence (Reminder timing). What should happen to one site today? */
export function sequenceStep(site: Site, d: Derived, t: Timing): "remind" | "follow" | "flag" | null {
  if (site.booked || site.stopped || d.snoozed || site.doNotSend) return null;
  if (!site.reminded) return d.days <= t.lead ? "remind" : null; // template system:'reminder'
  if (site.reminded.replied || site.chase === "none") return null;
  if (site.chase === "follow" && !site.reminded.followups && (d.sentAgo ?? 0) >= t.follow) return "follow"; // template system:'follow'
  if ((d.sentAgo ?? 0) >= t.flag) return "flag"; // derive() puts it in Needs you
  return null;
}
