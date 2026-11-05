// lib/reports/settings/validate.ts
//
// Checks a settings document before it's saved. Each problem is a sentence
// the settings page can show as it is.

import type { ReportSettings } from "./types";

export function settingsProblems(s: ReportSettings): string[] {
  const out: string[] = [];
  if (!s || s.version !== 1 || !Array.isArray(s.codes) || !Array.isArray(s.severities) || !Array.isArray(s.tags) || !Array.isArray(s.reports) || !Array.isArray(s.anchors))
    return ["The settings aren't in the expected shape."];

  const bands = new Set(s.severities.map((b) => b.key));
  const codes = new Set<string>();
  for (const c of s.codes) {
    if (!/^[A-Z]{2,4}$/.test(c.code)) out.push(`Code “${c.code}” must be 2 to 4 letters.`);
    if (codes.has(c.code)) out.push(`Code ${c.code} is used twice.`);
    codes.add(c.code);
    if (!bands.has(c.band)) out.push(`Code ${c.code} has a severity that doesn't exist.`);
    if (!c.name.trim()) out.push(`Code ${c.code} needs a name.`);
  }
  const seen = new Map<string, string>();
  for (const c of s.codes)
    for (const a of c.aliases) {
      if (codes.has(a)) out.push(`${c.code} also matches ${a}, which is a code of its own.`);
      else if (seen.has(a)) out.push(`${a} is listed under both ${seen.get(a)} and ${c.code}.`);
      seen.set(a, c.code);
    }

  const letters = s.severities.map((b) => b.letter).filter(Boolean);
  if (new Set(letters).size !== letters.length) out.push("Two severities use the same OT letter.");

  for (const t of s.tags) {
    if (!/^[A-Z]{1,3}$/.test(t.prefix)) out.push(`Location tag “${t.prefix}” must be 1 to 3 letters.`);
    if (!t.num && codes.has(t.prefix)) out.push(`Location tag ${t.prefix} is also a defect code.`);
  }
  const tagKeys = s.tags.map((t) => t.prefix + (t.num ? "#" : ""));
  if (new Set(tagKeys).size !== tagKeys.length) out.push("Two location tags are the same.");

  const presets = s.reports.flatMap((r) => (r.types.length ? r.types : [r]));
  for (const p of presets) {
    for (const c of p.codes ?? []) if (!codes.has(c)) out.push(`${p.name} uses code ${c}, which doesn't exist.`);
    for (const x of [...p.extras, ...p.plan]) for (const c of x.when ?? []) if (!codes.has(c)) out.push(`${p.name} refers to code ${c}, which doesn't exist.`);
  }
  const reportKeys = s.reports.map((r) => r.key);
  if (new Set(reportKeys).size !== reportKeys.length) out.push("Two reports have the same key.");

  const anchorKeys = s.anchors.map((a) => a.key);
  if (new Set(anchorKeys).size !== anchorKeys.length) out.push("Two anchor types have the same key.");
  for (const a of s.anchors) if (!a.name.trim()) out.push("Every anchor type needs a name.");

  return [...new Set(out)];
}
