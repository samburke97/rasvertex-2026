// lib/reports/proposal/v3/layout.ts
//
// Turns the page order into physical A4 sheets. Most pages are one sheet;
// the ones with open-ended content (Scope, Site survey & findings, Flagged
// issues, Pre-start, Access drops) flow onto as many continuation sheets as
// they need, repeating the section label, column headers and group bars.
//
// Like the anchor report (lib/reports/anchor.layout.ts) this is arithmetic,
// not measured: every block has a fixed height or one estimated from its
// text, so the builder preview and the PDF paginate identically. Text
// estimates wrap word by word at a slightly generous character width, so a
// block is more likely to move to the next sheet early than to be clipped.

import { BAND_ORDER, bandOf, type Band, type Finding, type PageId, type Proposal } from "./types";
import { richItems, richText } from "./rich";

/** Item HTML → its text, for estimating. */
const plain = (html: string) => html.replace(/<[^>]*>/g, "");

// Page units: 1280 × 1810.29. Content starts at the 80 top padding and must
// end above the footer (150 bottom padding), with a little slack.
const TOP = 80;
const BOTTOM = 1640;
const CONTENT_W = 1088;

const SEC_LABEL = 58; // 18 label + 40 margin
const H2 = 53; // 48 × 1.1
const TABLE_HEAD = 37; // label line + 14 padding + 1 rule

// Findings cards: photo + gap + text block, two per row.
export const FINDING_PHOTO_H = 400;
export const FINDING_TEXT_H = 190;
const FINDING_GAP = 48;

/** Height of the text under a finding's photo, from what it actually
 *  holds: nothing when it has no title or points, otherwise the title and
 *  points (up to five, wrapped), capped so one row can't swamp a page.
 *  Both photos in a row share the taller of the two. */
const CARD_W = (1088 - 40) / 2;
export function findingTextH(f: Finding, report: boolean): number {
  const title = f.title.trim();
  const items = richItems(f.desc).slice(0, report ? 99 : MAX_POINTS);
  const chip = report && !!f.code;
  if (!title && !items.length) return chip ? 36 : 0;
  let h = chip ? 28 + 8 + 4 : 0;
  if (title) h += textLines(title, 22, CARD_W, 700) * 27.5;
  if (items.length) {
    h += 8;
    h += report ? richH(f.desc, 17, 25.5, CARD_W) : items.reduce((a, t) => a + textLines(plain(t), 17, CARD_W - 18) * 25.5, 0);
  }
  return Math.min(Math.ceil(h) + 4, FINDING_TEXT_H + 150);
}
export const MAX_POINTS = 5;

/** Lines a string wraps to at a font size and width (word-greedy). */
export function textLines(text: string, px: number, width: number, weight = 400): number {
  const charW = px * (weight >= 600 ? 0.55 : 0.5);
  const perLine = Math.max(8, Math.floor(width / charW));
  let total = 0;
  for (const para of String(text || "").split("\n")) {
    let n = 1;
    let col = 0;
    for (const w of para.split(/\s+/).filter(Boolean)) {
      const len = w.length;
      if (col === 0) col = len;
      else if (col + 1 + len <= perLine) col += 1 + len;
      else {
        n++;
        col = len;
      }
      while (col > perLine) {
        n++;
        col -= perLine;
      }
    }
    total += n;
  }
  return Math.max(1, total);
}

/** A rich prose block: its lines, plus the 0.6em gap between blocks. */
export function richH(v: string, px: number, lineH: number, width: number): number {
  const t = richText(v);
  if (!t.trim()) return 0;
  const blocks = t.split("\n").length;
  return textLines(t, px, width - (/<li>/.test(v) ? 22 : 0)) * lineH + (blocks - 1) * px * 0.6;
}
const ledeH = (text: string, width = 900, mt = 20) => (richText(text).trim() ? mt + richH(text, 20, 32, width) : 0);
/** Section label + H2 + lede + the 56 gap before content. */
const firstHead = (lede: string, width = 900) => SEC_LABEL + H2 + ledeH(lede, width) + 56;

// ── Sheets ───────────────────────────────────────────────────────────────────

export interface GroupSlice<T> {
  band: Band;
  rows: T[];
  /** First slice of this band (vs. carried on from the previous sheet). */
  start: boolean;
}

export type SheetData =
  | { kind: "single" }
  | { kind: "scope"; inc: string[]; exc: string[] }
  | { kind: "findings"; items: { f: Finding; i: number; textH: number }[] }
  | { kind: "flagged"; groups: GroupSlice<Proposal["d"]["flagged"]["rows"][number]>[] }
  | { kind: "prestart"; groups: GroupSlice<Proposal["d"]["prestart"]["rows"][number]>[]; note: boolean }
  | { kind: "access"; drops: Proposal["d"]["access"]["drops"] }
  | {
      kind: "pricing";
      rows: { x: Proposal["d"]["pricing"]["stages"][number]; i: number }[];
      totals: boolean;
      terms: string[];
      termsHead: boolean;
      qualified: boolean;
    };

type PricingBlock =
  | { t: "row"; x: Proposal["d"]["pricing"]["stages"][number]; i: number }
  | { t: "totals" }
  | { t: "termsHead" }
  | { t: "term"; text: string }
  | { t: "qualified" };

export interface Sheet {
  key: string; // "<id>" or "<id>:<part>"
  id: PageId;
  part: number; // 0 = first sheet of the page
  data: SheetData;
}

/** Packs items into sheets: `first` and `rest` are each sheet's capacity. */
function pack<T>(items: T[], h: (t: T) => number, first: number, rest: number, gap = 0): T[][] {
  const out: T[][] = [[]];
  let room = first;
  for (const it of items) {
    const need = h(it) + (out[out.length - 1].length ? gap : 0);
    if (need > room && out[out.length - 1].length) {
      out.push([]);
      room = rest;
      room -= h(it);
    } else room -= need;
    out[out.length - 1].push(it);
  }
  return out;
}

/** Packs band-grouped rows: a group bar starts each band, and is repeated at
 *  the top of a sheet when a band carries over. A bar never sits alone at the
 *  bottom of a sheet. */
function packGroups<T extends { code: string }>(
  rows: T[],
  rowH: (r: T) => number,
  first: number,
  rest: number,
): GroupSlice<T>[][] {
  const sheets: GroupSlice<T>[][] = [[]];
  let room = first;
  const barH = (top: boolean) => (top ? 16 : 28) + 8 + 32 + 28;
  for (const band of BAND_ORDER) {
    const list = rows.filter((r) => bandOf(r.code) === band);
    let start = true;
    for (const r of list) {
      let cur = sheets[sheets.length - 1];
      let slice = cur[cur.length - 1];
      const needsBar = !slice || slice.band !== band;
      const need = rowH(r) + (needsBar ? barH(cur.length === 0) : 0);
      if (need > room && cur.length) {
        sheets.push((cur = []));
        room = rest - barH(true) - rowH(r);
        cur.push((slice = { band, rows: [r], start }));
      } else {
        room -= need;
        if (needsBar) cur.push((slice = { band, rows: [], start }));
        slice!.rows.push(r);
      }
      start = false;
    }
  }
  return sheets;
}

const cap = (head: number) => BOTTOM - TOP - head;
const sheetsOf = (id: PageId, parts: SheetData[]): Sheet[] =>
  parts.map((data, part) => ({ key: part ? `${id}:${part}` : id, id, part, data }));

export function layoutPage(p: Proposal, id: PageId): Sheet[] {
  const d = p.d;
  switch (id) {
    case "scope": {
      const colW = (CONTENT_W - 64) / 2 - 44;
      const itemH = (t: string) => 28 + Math.max(29, textLines(t, 20, colW) * 30);
      const first = cap(firstHead(d.scope.intro) + TABLE_HEAD);
      const rest = cap(SEC_LABEL + TABLE_HEAD);
      const inc = pack(richItems(d.scope.inc), (t) => itemH(plain(t)), first, rest);
      const exc = pack(richItems(d.scope.exc), (t) => itemH(plain(t)), first, rest);
      const n = Math.max(inc.length, exc.length);
      return sheetsOf(
        id,
        Array.from({ length: n }, (_, i) => ({ kind: "scope" as const, inc: inc[i] ?? [], exc: exc[i] ?? [] })),
      );
    }
    case "findings": {
      const report = d.findings.style === "report";
      const items = d.findings.items;
      // Pair into rows; a row is as tall as its photo plus its taller text.
      const rows: { f: Finding; i: number; textH: number }[][] = [];
      for (let i = 0; i < items.length; i += 2) {
        const pair = items.slice(i, i + 2);
        const textH = Math.max(...pair.map((f) => findingTextH(f, report)));
        rows.push(pair.map((f, k) => ({ f, i: i + k, textH })));
      }
      const rowH = (row: { textH: number }[]) => FINDING_PHOTO_H + (row[0].textH ? 20 + row[0].textH : 0);
      const packed = pack(rows, rowH, cap(firstHead(d.findings.intro)), cap(SEC_LABEL), FINDING_GAP);
      return sheetsOf(id, packed.map((rs) => ({ kind: "findings" as const, items: rs.flat() })));
    }
    case "flagged": {
      const head = firstHead(d.flagged.intro) + 186 + 72 + TABLE_HEAD;
      const groups = packGroups(d.flagged.rows, () => 53, cap(head), cap(SEC_LABEL + TABLE_HEAD));
      return sheetsOf(id, groups.map((g) => ({ kind: "flagged", groups: g })));
    }
    case "prestart": {
      const rowH = (r: Proposal["d"]["prestart"]["rows"][number]) =>
        33 + Math.max(28, textLines(r.work, 20, 550, 600) * 27, textLines(r.where, 17, 380) * 23);
      const groups = packGroups(d.prestart.rows, rowH, cap(firstHead(d.prestart.intro) + TABLE_HEAD), cap(SEC_LABEL + TABLE_HEAD));
      const noteH = richText(d.prestart.note).trim() ? 56 + 32 + richH(d.prestart.note, 17, 27.2, 960) : 0;
      // Room left on the last sheet, to see whether the note fits under it.
      const last = groups[groups.length - 1];
      const used =
        (groups.length === 1 ? firstHead(d.prestart.intro) : SEC_LABEL) +
        TABLE_HEAD +
        last.reduce((a, g, gi) => a + (gi ? 28 : 16) + 68 + g.rows.reduce((b, r) => b + rowH(r), 0), 0);
      const parts: SheetData[] = groups.map((g) => ({ kind: "prestart", groups: g, note: false }));
      if (noteH && used + noteH > BOTTOM - TOP) parts.push({ kind: "prestart", groups: [], note: true });
      else (parts[parts.length - 1] as { note: boolean }).note = !!noteH;
      return sheetsOf(id, parts);
    }
    case "access": {
      const n = Math.max(1, d.access.stages.length);
      const stageW = (CONTENT_W - 40 * (n - 1)) / n;
      const stagesH = Math.max(
        0,
        ...d.access.stages.map((s) => 28 + 14 + textLines(s.what, 22, stageW, 700) * 28 + 8 + textLines(s.where, 17, stageW) * 26),
      );
      const head = firstHead(d.access.intro, 860) + CONTENT_W / 2 + 56 + stagesH + 72 + TABLE_HEAD;
      const dropH = (x: Proposal["d"]["access"]["drops"][number]) => 25 + Math.max(28, textLines(x.where, 20, 330, 600) * 26);
      const drops = pack(d.access.drops, dropH, cap(head), cap(SEC_LABEL + TABLE_HEAD));
      return sheetsOf(id, drops.map((x) => ({ kind: "access", drops: x })));
    }
    case "pricing": {
      const rowH = (x: Proposal["d"]["pricing"]["stages"][number]) => 45 + textLines(`${x.label} ${x.note}`, 20, 840) * 30;
      const h = (b: PricingBlock): number =>
        b.t === "row"
          ? rowH(b.x)
          : b.t === "totals"
            ? 320
            : b.t === "termsHead"
              ? 120
              : b.t === "term"
                ? 12 + textLines(plain(b.text), 20, 1066) * 30
                : 196;
      const terms = richItems(d.pricing.terms);
      // Keep the totals with the last stage, and the heading with the first term.
      const units: PricingBlock[][] = [
        ...d.pricing.stages.map((x, i) => [{ t: "row" as const, x, i }]),
        [{ t: "totals" }],
        ...terms.map((text) => [{ t: "term" as const, text }]),
        [{ t: "qualified" }],
      ];
      const tot = d.pricing.stages.length;
      if (tot) units.splice(tot - 1, 2, [...units[tot - 1], ...units[tot]]);
      const ti = units.findIndex((u) => u[0].t === "term");
      if (ti >= 0) units[ti] = [{ t: "termsHead" }, ...units[ti]];
      const packed = pack(units, (u) => u.reduce((a, b) => a + h(b), 0), cap(firstHead(d.pricing.intro) + TABLE_HEAD), cap(SEC_LABEL + TABLE_HEAD));
      return sheetsOf(
        id,
        packed.map((us) => {
          const bs = us.flat();
          return {
            kind: "pricing" as const,
            rows: bs.flatMap((b) => (b.t === "row" ? [{ x: b.x, i: b.i }] : [])),
            totals: bs.some((b) => b.t === "totals"),
            terms: bs.flatMap((b) => (b.t === "term" ? [b.text] : [])),
            termsHead: bs.some((b) => b.t === "termsHead"),
            qualified: bs.some((b) => b.t === "qualified"),
          };
        }),
      );
    }
    default:
      return sheetsOf(id, [{ kind: "single" }]);
  }
}
