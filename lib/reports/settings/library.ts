// lib/reports/settings/library.ts
//
// Settings → what a report reads: the inspection Library for a report and
// type, and the location tag rules the label parser and generator use.

import {
  CARD_IMAGES,
  LIBRARIES,
  type BandDef,
  type DefectCode,
  type ImageKey,
  type Library,
} from "@/lib/reports/inspection/codes";
import { DEFAULT_TAGS } from "./defaults";
import { SEV_COLOURS, colourOf, type BandKey, type LocationTag, type Preset, type ReportSettings } from "./types";

// ── Report types ─────────────────────────────────────────────────────────────

/** A report a technician can start: a report, or one of its types. */
export interface Leaf {
  report: string;
  /** Undefined for a report without types. */
  type?: string;
  /** "Roof inspection · Membrane" */
  label: string;
  preset: Preset;
  /** Nothing set up yet (a new type before its wording is written). */
  empty: boolean;
}

export function leaves(s: ReportSettings): Leaf[] {
  return s.reports.flatMap((r) =>
    r.types.length
      ? r.types.map((t) => ({ report: r.key, type: t.key, label: `${r.name} · ${t.name}`, preset: t, empty: isEmpty(t) }))
      : [{ report: r.key, label: r.name, preset: r as Preset, empty: isEmpty(r) }],
  );
}

const isEmpty = (p: Preset) => !p.scope.trim() && !p.intro.trim() && !p.about.length && !p.plan.length;

export function leafFor(s: ReportSettings, report: string | undefined, type?: string): Leaf {
  const all = leaves(s);
  const r = report ?? "building";
  return (
    all.find((l) => l.report === r && l.type === type) ??
    all.find((l) => l.report === r) ??
    all[0]
  );
}

/** Saved drafts: building on the job number, the first roof type on
 *  "-roof" (as before types), anything else on report and type. */
export function draftKeyFor(s: ReportSettings, jobId: string, report: string, type?: string): string {
  const r = s.reports.find((x) => x.key === report);
  const firstType = r?.types[0]?.key;
  const base = report === "building" ? jobId : `${jobId}-${report}`;
  return type && type !== firstType ? `${base}-${type}` : base;
}

// ── Library ──────────────────────────────────────────────────────────────────

const IMAGE_KEYS = Object.keys(CARD_IMAGES) as ImageKey[];
const img = (k: ImageKey | undefined, fallback: ImageKey): ImageKey => (k && IMAGE_KEYS.includes(k) ? k : fallback);

export function bandsFrom(s: ReportSettings): Record<BandKey, BandDef> {
  const out = {} as Record<BandKey, BandDef>;
  for (const b of s.severities) {
    const c = colourOf(b.colour, SEV_COLOURS);
    out[b.key] = { name: b.name, desc: b.desc, tail: b.tail, fg: c.fg, bg: c.bg };
  }
  return out;
}

export function libraryFrom(s: ReportSettings, report: string | undefined, type?: string): Library {
  const leaf = leafFor(s, report, type);
  const p = leaf.preset;
  const r = s.reports.find((x) => x.key === leaf.report)!;
  const bandOrder = s.severities.map((b) => b.key);

  // The report's codes: master order, its own trade first within each band,
  // then OV and OT.
  const live = s.codes.filter((c) => !c.archived && !c.system && (p.codes === null || p.codes.includes(c.code)));
  const first = p.first ?? [];
  const rank = (code: string) => (first.includes(code) ? first.indexOf(code) : first.length + live.findIndex((c) => c.code === code));
  const sorted = [...live].sort((a, b) => rank(a.code) - rank(b.code));
  const sys = s.codes.filter((c) => c.system);
  const codes: DefectCode[] = [...sorted, ...sys].map((c, order) => ({
    code: c.code,
    name: c.name,
    band: c.band,
    what: c.what,
    action: c.action,
    work: c.work,
    why: c.why,
    order,
    system: !!c.system,
  }));
  const codeMap = Object.fromEntries(codes.map((d) => [d.code, d]));

  const aliases: Record<string, string> = {};
  for (const c of s.codes) if (!c.archived) for (const a of c.aliases) aliases[a.toUpperCase()] = c.code;
  // OTP, OTR, OTM: an "other" item; the letter names its severity.
  for (const b of s.severities) if (b.letter) aliases["OT" + b.letter.toUpperCase()] = "OT";

  // The "Reading a photo" example: the built-in one for the report, with a
  // code this report actually has.
  const base = leaf.report === "roof" ? LIBRARIES.roof : LIBRARIES.building;
  const exCode = codeMap[base.example.code] ? base.example.code : (sorted[0]?.code ?? "OT");
  return {
    kind: leaf.report,
    type: leaf.type,
    label: r.name,
    reportRef: p.ref?.trim() || (leaf.type ? p.name : r.name.replace(/ inspection$/i, "")),
    codes,
    codeMap,
    about: p.about.filter((a) => !a.off).map((a, i) => ({ t: a.t, d: a.d, img: img(a.img, (["project", "rope", "maintenance"] as const)[i % 3]) })),
    extras: p.extras.filter((x) => !x.off).map((x) => ({ t: x.t, d: x.d, img: img(x.img, "cleaning"), whenAny: x.when?.length ? x.when : undefined })),
    scope: p.scope,
    blurb: (street) => p.intro.replaceAll("{street}", street),
    defaultLevel: p.level.trim().toUpperCase() || null,
    plan: p.plan
      .filter((x) => !x.off)
      .map((x) => ({ service: x.service, interval: x.interval, priority: x.req ? "required" : "recommended", whenAny: x.when.length ? x.when : undefined })),
    example: { ...base.example, code: exCode },
    bands: bandsFrom(s),
    bandOrder,
    tags: s.tags.length ? s.tags : DEFAULT_TAGS,
    aliases,
    exclusions: p.excl.split("\n").map((l) => l.trim()).filter(Boolean),
  };
}

// ── Location tags ────────────────────────────────────────────────────────────

export interface TagHit {
  kind: LocationTag["kind"];
  tag: LocationTag;
  /** The number after the prefix, or null for an exact tag. */
  n: number | null;
}

/** What a label token is, if it's a location tag. Exact tags win, then the
 *  longest numbered prefix (so "LG" isn't read as L + G). */
export function readTag(tok: string, tags: LocationTag[]): TagHit | null {
  const t = tok.toUpperCase();
  const exact = tags.find((x) => !x.num && x.prefix === t);
  if (exact) return { kind: exact.kind, tag: exact, n: null };
  const numd = tags
    .filter((x) => x.num && t.startsWith(x.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)
    .find((x) => /^\d+$/.test(t.slice(x.prefix.length)));
  return numd ? { kind: numd.kind, tag: numd, n: parseInt(t.slice(numd.prefix.length), 10) } : null;
}

/** How a tag prints: "D10" → "Drop 10", "LR" → "Roof". */
export function tagText(tok: string, tags: LocationTag[]): string {
  if (!tok) return "";
  const h = readTag(tok, tags);
  if (!h) return tok;
  return h.n === null ? h.tag.prints : h.tag.prints.replace("#", String(h.n));
}

/** Sort key: zones by their tag's place in the list, then number. */
export function zoneRank(z: string, tags: LocationTag[]): number {
  if (!z) return 1e9;
  const h = readTag(z, tags);
  if (!h) return 1e8;
  const i = tags.filter((t) => t.kind === "zone").indexOf(h.tag);
  return i * 10000 + (h.n ?? 0);
}

/** Levels: ground-like first, numbered by number, the roof last. */
export function levelRank(l: string, tags: LocationTag[]): number {
  if (!l) return -1;
  const h = readTag(l, tags);
  if (!h) return 500;
  if (h.n !== null) return h.n;
  if (/roof/i.test(h.tag.prints)) return 9999;
  if (/basement|car ?park/i.test(h.tag.prints)) return -0.5;
  return 0;
}
