// lib/reports/proposal/v3/survey.ts
//
// Optional: builds the survey pages (Site survey & findings, Flagged issues,
// Pre-start maintenance) from the quote's tagged inspection photos. Photos
// are tagged the same way as for the Inspection Report —
//   D10 L2 SH LF - awning fixed through VJ cladding
// — and parsed with the same parser, so a tech tags once for both reports.
// Untagged photos are ignored; proposals without a survey simply keep those
// pages hidden and use the standard photo folders.

import { libraryFor } from "@/lib/reports/inspection/codes";
import { parseLabel, photoLabel } from "@/lib/reports/inspection/types";
import { BAND_ORDER, CODES, LIMITS, bandOf, type Proposal, type SimproPhoto } from "./types";

const LIB = libraryFor("building");

export interface TaggedPhoto {
  photo: SimproPhoto;
  zone: string;
  level: string;
  unit: string | null;
  codes: string[];
  note: string;
}

/** SimPRO photos in the folders switched on for this proposal. */
export const enabledPhotos = (p: Proposal) => p.simpro.photos.filter((ph) => p.folders.includes(ph.folderId));

const labelOf = (ph: SimproPhoto) => photoLabel({ id: ph.id, name: ph.name, url: ph.url });

export function taggedPhotos(p: Proposal): TaggedPhoto[] {
  const out: TaggedPhoto[] = [];
  for (const photo of enabledPhotos(p)) {
    const r = parseLabel(labelOf(photo), LIB);
    if (r.kind !== "photo") continue;
    const codes = r.codes.filter((c) => CODES[c]);
    if (codes.length) out.push({ photo, zone: r.zone, level: r.level, unit: r.unit, codes, note: r.note });
  }
  return out;
}

const levelWord = (l: string) => (l === "LG" ? "ground level" : l === "LR" ? "roof" : `level ${l.slice(1)}`);
const where = (t: TaggedPhoto) => `${t.zone} ${t.level}`;
const sentence = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const rank = (code: string) => BAND_ORDER.indexOf(bandOf(code)) * 100 + Object.keys(CODES).indexOf(code);

/** Replaces the three survey pages' rows with ones built from the tags, and
 *  shows those pages. Intros, notes and everything else are kept. */
export function applySurvey(p: Proposal, tagged: TaggedPhoto[]): Proposal {
  const byCode = new Map<string, TaggedPhoto[]>();
  for (const t of tagged)
    for (const c of t.codes) {
      if (!byCode.has(c)) byCode.set(c, []);
      byCode.get(c)!.push(t);
    }
  const codes = [...byCode.keys()].sort((a, b) => rank(a) - rank(b));
  const places = (c: string) => [...new Set(byCode.get(c)!.map(where))];

  // One finding per code, most severe first, then fill to 8 with more photos.
  const picked: { t: TaggedPhoto; code: string }[] = [];
  for (const c of codes) picked.push({ t: byCode.get(c)![0], code: c });
  for (const c of codes)
    for (const t of byCode.get(c)!.slice(1))
      if (picked.length < LIMITS.findings && !picked.some((x) => x.t === t)) picked.push({ t, code: c });

  const items = picked.slice(0, LIMITS.findings).map(({ t, code }) => ({
    photo: "ph:" + t.photo.id,
    code,
    title: `${sentence(t.note) || CODES[code].name}, ${t.zone} ${levelWord(t.level)}`,
    desc: LIB.codeMap[code]?.action ?? "",
  }));

  return {
    ...p,
    hidden: { ...p.hidden, findings: false, flagged: false, prestart: false },
    d: {
      ...p.d,
      findings: { ...p.d.findings, style: "report", items },
      flagged: {
        ...p.d.flagged,
        rows: codes.slice(0, LIMITS.flagged).map((code) => ({ code, count: String(places(code).length) })),
      },
      prestart: {
        ...p.d.prestart,
        rows: codes
          .slice(0, LIMITS.prestart)
          .map((code) => ({ code, work: CODES[code].defaultWork, where: places(code).join(", ") })),
      },
    },
  };
}

/** Why photos didn't read as tagged: the first few untagged labels and the
 *  parser's reason, for the Quote step. */
export function untaggedExamples(p: Proposal, n = 3): { label: string; reason: string }[] {
  const out: { label: string; reason: string }[] = [];
  for (const ph of enabledPhotos(p)) {
    const label = labelOf(ph);
    const r = parseLabel(label, LIB);
    if (r.kind === "rejected") out.push({ label, reason: r.reason });
    if (out.length >= n) break;
  }
  return out;
}

const CAMERA_NAME = /^(img|dsc|pxl|photo|image|screenshot)?[\s_-]*\d[\d\s_-]*$/i;

/** Standard style: one finding per photo from the enabled SimPRO folders,
 *  titled from the photo's comment (or its file name, unless that's just a
 *  camera number). Existing points are cleared. */
export function standardFromPhotos(p: Proposal): Proposal {
  const items = enabledPhotos(p)
    .slice(0, LIMITS.findings)
    .map((ph) => {
      const label = labelOf(ph);
      const r = parseLabel(label, LIB);
      const title = r.kind === "photo" ? sentence(r.note) : CAMERA_NAME.test(label) ? "" : sentence(label);
      return { photo: "ph:" + ph.id, code: r.kind === "photo" ? r.codes[0] ?? "RC" : "RC", title, desc: "" };
    });
  return { ...p, hidden: { ...p.hidden, findings: false }, d: { ...p.d, findings: { ...p.d.findings, style: "standard", items } } };
}
