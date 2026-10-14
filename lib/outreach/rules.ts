// lib/outreach/rules.ts
//
// Customer outreach rules — the "when should we be in touch, and about
// what" half of the outreach feature (/outreach). Each rule turns SimPRO
// history into opportunities:
//
//   kind "job"   — a completed job in one of the trigger cost centres
//                  becomes an opportunity `monthsAfter` months later
//                  (from `leadDays` before that date), one per site.
//   kind "quote" — a quote sitting at one of `statusIds` for
//                  `firstAfterDays` gets chased until its status moves.
//
// Every opportunity gets up to 1 + followUpDays.length emails; each
// follow-up waits followUpDays[n] days after the previous send. Outreach
// stops by itself when a SimPRO quote at the site matches `matchKeywords`
// (job rules) or the quote leaves `statusIds` (quote rules) — that's
// recorded as won/closed.
//
// Each rule's emails are templates in lib/outreach/templates.ts.
//
// Cost centre IDs from SimPRO setup/accounts/costCenters (2026-10-07):
// Height Safety=11, Inspections=9, Maintenance=2, Painting Commercial=6,
// Painting Residential=12, Pressure Cleaning=13, Warranty=7,
// Waterproofing=15, Window Cleaning=16. Quote statuses: 112 = "1.e Quote:
// Sent", 4 = "Quote: Due Date Reached".

import { RECURRING_CATEGORIES } from "@/lib/recertifications/categories";

export type OutreachRuleId =
  | "painting-wash"
  | "waterproofing-inspection"
  | "height-safety-annual"
  | "open-quote";

interface BaseRule {
  id: OutreachRuleId;
  label: string;
  /** One line for the UI: what fires this rule. */
  trigger: string;
  followUpDays: number[];
}

export interface JobRule extends BaseRule {
  kind: "job";
  triggerCostCentreIds: number[];
  monthsAfter: number;
  /** Start reaching out this many days before the anniversary. */
  leadDays: number;
  /** Stop picking up jobs whose anniversary passed more than this long ago. */
  windowMonths: number;
  /** Lower-cased substrings of a quote name that mean "already quoted/booked". */
  matchKeywords: string[];
  /** Custom condition: ignore trigger jobs below this value (ex GST). */
  minValueExTax?: number;
}

export interface QuoteRule extends BaseRule {
  kind: "quote";
  statusIds: number[];
  firstAfterDays: number;
  /** Quotes issued longer ago than this are left alone. */
  maxAgeDays: number;
}

export type OutreachRule = JobRule | QuoteRule;

export const OUTREACH_RULES: Record<OutreachRuleId, OutreachRule> = {
  "painting-wash": {
    id: "painting-wash",
    kind: "job",
    label: "Painting → building wash",
    trigger: "12 months after a painting job is completed",
    triggerCostCentreIds: [6, 12],
    monthsAfter: 12,
    leadDays: 14,
    windowMonths: 6,
    minValueExTax: 1000,
    matchKeywords: ["wash", "pressure clean", "building clean", "surface clean", "soft wash"],
    followUpDays: [10, 21],
  },
  "waterproofing-inspection": {
    id: "waterproofing-inspection",
    kind: "job",
    label: "Waterproofing → inspection",
    trigger: "12 months after a waterproofing job is completed",
    triggerCostCentreIds: [15],
    monthsAfter: 12,
    leadDays: 14,
    windowMonths: 6,
    matchKeywords: ["inspection", "inspect"],
    followUpDays: [10, 21],
  },
  "height-safety-annual": {
    id: "height-safety-annual",
    kind: "job",
    label: "Height safety annual",
    trigger: "Anchor recertification due 12 months after the last one",
    triggerCostCentreIds: [11],
    monthsAfter: 12,
    leadDays: 30,
    windowMonths: 3,
    matchKeywords: RECURRING_CATEGORIES["height-safety"].quoteMatchKeywords,
    followUpDays: [10, 21],
  },
  "open-quote": {
    id: "open-quote",
    kind: "quote",
    label: "Open quote follow-up",
    trigger: "Quote sent 7+ days ago with no decision",
    statusIds: [112, 4],
    firstAfterDays: 7,
    maxAgeDays: 90,
    followUpDays: [7, 14],
  },
};

export const OUTREACH_RULE_LIST: OutreachRule[] = Object.values(OUTREACH_RULES);

export function isOutreachRuleId(v: unknown): v is OutreachRuleId {
  return typeof v === "string" && v in OUTREACH_RULES;
}

/** Total emails an opportunity can get under its rule. */
export function maxTouches(rule: OutreachRule): number {
  return 1 + rule.followUpDays.length;
}

export function nameMatches(name: string, keywords: string[]): boolean {
  const n = name.toLowerCase();
  return keywords.some((k) => n.includes(k.toLowerCase()));
}
