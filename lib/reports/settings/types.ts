// lib/reports/settings/types.ts
//
// Reports › Settings: what an admin can change without a code change. One
// ReportSettings document, saved in Neon (store.ts) and copied into each
// report when it's started, so rewording a code later never changes a report
// already sent. defaults.ts builds the document from today's hard-coded
// values, so with nothing saved every report comes out as before.

import type { ImageKey } from "@/lib/reports/inspection/codes";
import type { AnchorSubtype } from "@/lib/reports/anchor.types";

/** The three severities. Their wording, colour and order are editable; the
 *  keys are fixed because reports and proposals file codes by them. */
export type BandKey = "red" | "amber" | "grey";

export interface Severity {
  key: BandKey;
  name: string;
  /** After OT on a photo (OTP, OTR, OTM): an "other" item of this severity. */
  letter: string;
  /** Index into SEV_COLOURS, or a hex for a custom colour. */
  colour: number | string;
  desc: string;
  /** Closing sentence of this severity's row on the Summary page. */
  tail: string;
}

export interface DefectCodeDef {
  code: string;
  name: string;
  band: BandKey;
  what: string;
  action: string;
  work: string;
  why: string;
  /** Old or misspelt codes read as this one. */
  aliases: string[];
  archived?: boolean;
  /** OV and OT: understood by every report, not editable. */
  system?: boolean;
}

export type TagKind = "zone" | "level" | "unit";

export interface LocationTag {
  prefix: string;
  /** Followed by a number (D10), or exactly the prefix (LR). */
  num: boolean;
  /** "Drop #": # is the number. */
  prints: string;
  kind: TagKind;
}

export interface Card {
  t: string;
  d: string;
  img?: ImageKey;
  /** Next steps cards: only shown when one of these codes is found. */
  when?: string[];
  off?: boolean;
}

export interface PlanItemDef {
  service: string;
  interval: string;
  req: boolean;
  /** Ticked to start with when one of these codes is found. */
  when: string[];
  off?: boolean;
}

export interface Preset {
  key: string;
  name: string;
  /** null: every code. */
  codes: string[] | null;
  /** Codes listed first within their severity (a roof's own trade). */
  first?: string[];
  /** Level a photo gets when its label has none (LR on a roof). */
  level: string;
  scope: string;
  /** {street} fills in the site address. */
  intro: string;
  /** Cover fact: "Condition #11355". Blank uses the report name. */
  ref?: string;
  about: Card[];
  extras: Card[];
  /** One exclusion per line. */
  excl: string;
  plan: PlanItemDef[];
}

export interface ReportDef extends Preset {
  /** With types, each type is its own preset and this one isn't used. */
  types: Preset[];
}

export interface AnchorTypeDef {
  key: string;
  name: string;
  /** An icon file name (public/reports/anchor/icons) or an uploaded SVG data URL. */
  icon: string;
  /** Index into ANCHOR_PASTELS, or a hex. */
  colour: number | string;
  /** Load rating in kN; blank when not rated. */
  kn: string;
  /** Mounting options; null when the type has none. */
  subs: AnchorSubtype[] | null;
}

export interface ReportSettings {
  version: 1;
  severities: Severity[];
  codes: DefectCodeDef[];
  tags: LocationTag[];
  reports: ReportDef[];
  anchors: AnchorTypeDef[];
}

// ── Colours ──────────────────────────────────────────────────────────────────

export interface Tint {
  name: string;
  bg: string;
  fg: string;
}

export const SEV_COLOURS: Tint[] = [
  { name: "Red", bg: "#fbe7e7", fg: "#a83a3a" },
  { name: "Amber", bg: "#fcf0dc", fg: "#86561a" },
  { name: "Grey", bg: "#eef1f6", fg: "rgba(1,25,85,0.72)" },
  { name: "Green", bg: "#e3f5ea", fg: "#3f9a68" },
  { name: "Blue", bg: "#e5f0fd", fg: "#4a82c9" },
  { name: "Violet", bg: "#eeeafb", fg: "#7a66c7" },
  { name: "Pink", bg: "#fbe8f1", fg: "#c2557f" },
  { name: "Orange", bg: "#fdeee2", fg: "#c46f2e" },
];

export const ANCHOR_PASTELS: Tint[] = [
  { name: "Green", bg: "#e3f5ea", fg: "#3f9a68" },
  { name: "Violet", bg: "#eeeafb", fg: "#7a66c7" },
  { name: "Blue", bg: "#e5f0fd", fg: "#4a82c9" },
  { name: "Pink", bg: "#fbe8f1", fg: "#c2557f" },
  { name: "Orange", bg: "#fdeee2", fg: "#c46f2e" },
  { name: "Indigo", bg: "#e9ebfb", fg: "#5b63c4" },
  { name: "Yellow", bg: "#fbf4d9", fg: "#9a7a12" },
  { name: "Teal", bg: "#e0f4f2", fg: "#2f8f86" },
];

/** A custom colour as a pastel pair: background 86% towards white, text
 *  30% towards black. */
export function tint(hex: string): Tint {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16) || 0;
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const hx = (a: number[]) => "#" + a.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  return { name: "Custom", bg: hx(rgb.map((c) => c + (255 - c) * 0.86)), fg: hx(rgb.map((c) => c * 0.7)) };
}

export const colourOf = (c: number | string, list: Tint[]): Tint =>
  typeof c === "string" ? tint(c) : list[((c % list.length) + list.length) % list.length];
