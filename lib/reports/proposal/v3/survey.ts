// lib/reports/proposal/v3/survey.ts
//
// The survey pages (Site survey & findings, Flagged issues, Pre-start
// maintenance) built from the quote's photos. Techs tag photos in the SimPRO
// file name, the same way as for the Inspection Report —
//   D10 L2 SH LF - awning fixed through VJ cladding
// — but the proposal reads tags loosely: any recognised code counts, with
// whatever zone / level / unit is there ("S1 SH", "SH - cracked tile").
// Photos with no code are never dropped: in report style they sit in an
// "Other site photos" group at the end.

import { photoLabel } from "@/lib/reports/inspection/types";
import { CODES, LIMITS, codeRank, codesOf, withCodes, zoneOf, type Finding, type Proposal, type SimproPhoto } from "./types";

export interface Tag {
  zone: string | null; // D10 / S2
  level: string | null; // L2 / LG / LR
  unit: string | null; // U403
  codes: string[]; // most severe first
  note: string;
}

export interface TaggedPhoto extends Tag {
  photo: SimproPhoto;
}

/** Reads a photo name. Tags come first, the name after:
 *    S1 SH Cracked render beside the stairs
 *    S1 L2 SH LF Awning fixings loose
 *  Tags are read from the start only, so words in the name are never taken
 *  for codes. The older "D10 L2 SH - comment" form still works: everything
 *  before " - " is tags. */
export function parseTag(label: string): Tag {
  const split = label.indexOf(" - ");
  const head = split >= 0 ? label.slice(0, split) : label;
  const t: Tag = { zone: null, level: null, unit: null, codes: [], note: split >= 0 ? label.slice(split + 3).trim() : "" };
  const toks = head.trim().split(/\s+/).filter(Boolean);
  let k = 0;
  for (; k < toks.length; k++) {
    const x = toks[k].toUpperCase().replace(/[,;.]$/, "");
    if (/^[DS]\d+$/.test(x) && !t.zone) t.zone = x;
    else if (/^L(\d+|G|R)$/.test(x) && !t.level) t.level = x;
    else if (/^U\d+$/.test(x) && !t.unit) t.unit = x;
    else if (CODES[x]) {
      if (!t.codes.includes(x)) t.codes.push(x);
    } else if (split < 0) break; // the name starts here
  }
  if (split < 0) t.note = toks.slice(k).join(" ");
  t.codes.sort((a, b) => codeRank(a) - codeRank(b));
  return t;
}

/** SimPRO photos in the folders switched on for this proposal. */
export const enabledPhotos = (p: Proposal) => p.simpro.photos.filter((ph) => p.folders.includes(ph.folderId));

const labelOf = (ph: SimproPhoto) => photoLabel({ id: ph.id, name: ph.name, url: ph.url });

/** Enabled photos whose tag carries at least one code. */
export function taggedPhotos(p: Proposal): TaggedPhoto[] {
  return enabledPhotos(p)
    .map((photo) => ({ photo, ...parseTag(labelOf(photo)) }))
    .filter((t) => t.codes.length);
}

/** A few photos with no code, for the Quote step's hint. */
export function untaggedExamples(p: Proposal, n = 3): { label: string; reason: string }[] {
  return enabledPhotos(p)
    .map(labelOf)
    .filter((l) => !parseTag(l).codes.length)
    .slice(0, n)
    .map((label) => ({ label, reason: "No defect code" }));
}

const levelWord = (l: string) => (l === "LG" ? "ground level" : l === "LR" ? "roof" : `level ${l.slice(1)}`);
/** "D10 L2" — for Pre-start's Where and for counting locations. */
export const where = (t: Tag) => [t.zone, t.level, t.unit].filter(Boolean).join(" ");
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** A photo's title: its name with the tags taken off ("S1 SH Cracked
 *  render" → "Cracked render"); a photo that's only tags takes its code's
 *  name. Every photo gets one, camera names included. */
export function photoTitle(ph: SimproPhoto): string {
  const label = labelOf(ph);
  const t = parseTag(label);
  return sentence(t.note) || (t.codes[0] ? CODES[t.codes[0]].name : sentence(label));
}

/** A finding for a photo: codes and location from its tags, title from its
 *  name. The location prints beside the photo, not in the title. */
export function findingFor(ph: SimproPhoto): Finding {
  const t = parseTag(labelOf(ph));
  return withCodes({ photo: "ph:" + ph.id, code: "", title: photoTitle(ph), desc: "", where: where(t) }, t.codes);
}

/** Older drafts: give any SimPRO photo with no title its name. */
export function fillTitles(p: Proposal): Proposal {
  const byId = new Map(p.simpro.photos.map((ph) => [ph.id, ph]));
  let changed = false;
  const items = p.d.findings.items.map((f) => {
    const ph = !f.title.trim() && f.photo.startsWith("ph:") ? byId.get(f.photo.slice(3)) : undefined;
    if (!ph) return f;
    changed = true;
    return { ...f, title: photoTitle(ph) };
  });
  return changed ? { ...p, d: { ...p.d, findings: { ...p.d.findings, items } } } : p;
}

/** "D10 L2" → "D10 · Level 2"; for the cards and site map. */
export function placeLabel(w: string | undefined): string {
  const t = parseTag(w ?? "");
  const parts = [t.zone, t.level && sentence(levelWord(t.level)), t.unit].filter(Boolean);
  return parts.length ? parts.join(" · ") : (w ?? "").trim();
}

const firstRank = (f: Finding) => {
  const c = codesOf(f)[0];
  return c ? codeRank(c) : 1e6;
};

/** Report style from the photos: every switched-on SimPRO photo, coded ones
 *  first (most severe first), then the rest for "Other site photos". The
 *  Flagged and Pre-start pages are rebuilt from the codes (syncSurvey);
 *  rows the rep added or edited stay. */
export function applySurvey(p: Proposal): Proposal {
  const items = enabledPhotos(p)
    .map(findingFor)
    .sort((a, b) => firstRank(a) - firstRank(b))
    .slice(0, LIMITS.findings);
  return syncSurvey({
    ...p,
    hidden: { ...p.hidden, findings: false, flagged: false, prestart: false },
    d: {
      ...p.d,
      findings: { ...p.d.findings, style: "report", items },
      flagged: { ...p.d.flagged, rows: p.d.flagged.rows.filter((r) => !r.auto) },
      prestart: { ...p.d.prestart, rows: p.d.prestart.rows.filter((r) => !r.auto) },
    },
  });
}

/** Standard style: one finding per switched-on SimPRO photo, titled from its
 *  note or file name. Existing points are cleared. */
export function standardFromPhotos(p: Proposal): Proposal {
  const items = enabledPhotos(p).slice(0, LIMITS.findings).map(findingFor);
  return { ...p, hidden: { ...p.hidden, findings: false }, d: { ...p.d, findings: { ...p.d.findings, style: "standard", items } } };
}

/** Codes for report style: a tagged photo takes its tag's codes; anything
 *  not tagged starts with none. */
export function recodeFromTags(p: Proposal): Proposal {
  const tags = new Map(taggedPhotos(p).map((t) => [t.photo.id, t]));
  const items = p.d.findings.items.map((f) => {
    const t = f.photo.startsWith("ph:") ? tags.get(f.photo.slice(3)) : undefined;
    return withCodes({ ...f, where: f.where || (t ? where(t) : "") }, t ? t.codes : []);
  });
  return { ...p, d: { ...p.d, findings: { ...p.d.findings, items } } };
}

/** Keeps Flagged issues and Pre-start in step with the findings' codes (report
 *  style only). Automatic rows are rebuilt from every code in use — counted
 *  by location, where a tag gives one — and dropped when no finding uses the
 *  code any more. Rows the rep added or edited are never touched. */
export function syncSurvey(p: Proposal): Proposal {
  if (p.d.findings.style !== "report") return p;
  const locs = new Map<string, string[]>(); // code → locations ("#i" if none)
  p.d.findings.items.forEach((f, i) => {
    const at = f.where?.trim() ? f.where.trim().toUpperCase() : `#${i}`;
    for (const code of codesOf(f)) {
      const list = locs.get(code) ?? [];
      if (!list.includes(at)) list.push(at);
      locs.set(code, list);
    }
  });
  const codes = [...locs.keys()].sort((a, b) => codeRank(a) - codeRank(b));
  const named = (code: string) => locs.get(code)!.filter((x) => !x.startsWith("#"));

  const fl = p.d.flagged.rows;
  const flagged = [
    ...fl.filter((r) => !r.auto),
    ...codes
      .filter((c) => !fl.some((r) => !r.auto && r.code === c))
      .map((code) => ({
        code,
        count: String(locs.get(code)!.length),
        where: [...new Set(named(code).map((w) => zoneOf(w) || w))].join(", "),
        auto: true,
      })),
  ];
  const ps = p.d.prestart.rows;
  const prestart = [
    ...ps.filter((r) => !r.auto),
    ...codes
      .filter((c) => !ps.some((r) => !r.auto && r.code === c))
      .map((code) => ({ code, work: CODES[code].defaultWork, where: named(code).join(", "), auto: true })),
  ];
  if (JSON.stringify(flagged) === JSON.stringify(fl) && JSON.stringify(prestart) === JSON.stringify(ps)) return p;
  return { ...p, d: { ...p.d, flagged: { ...p.d.flagged, rows: flagged }, prestart: { ...p.d.prestart, rows: prestart } } };
}
