// lib/reports/proposal/v3/derive.ts
//
// Pure values computed from a Proposal: page and section numbering, the
// Contents rows, totals, the job-bound strings, defect groups and the review
// checks. The builder preview and the PDF export both render from these, so
// numbering and money always agree.

import {
  BAND_ORDER,
  CODES,
  JOB_FIELDS,
  PAGE,
  PAGES,
  bandOf,
  lines,
  pad2,
  type Band,
  type PageId,
  type Proposal,
} from "./types";
import { layoutPage, type Sheet } from "./layout";

export const money = (n: number) =>
  "$" + Number(n || 0).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const parseAmt = (s: string) => parseFloat(String(s ?? "").replace(/[^0-9.]/g, "")) || 0;

const toDate = (iso: string) => {
  const d = new Date((iso || "") + "T00:00:00");
  return isNaN(d.getTime()) ? new Date() : d;
};
const longDate = (d: Date) => d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

const secOf = (id: PageId) => PAGE[id].sec ?? id;

export function isHidden(p: Proposal, id: PageId): boolean {
  return !!p.hidden[id];
}

export interface Derived {
  /** Every visible physical sheet, in order (cover and contents included). */
  sheets: Sheet[];
  /** Visible numbered pages (logical, not sheets). */
  body: PageId[];
  /** Page number of each page's first sheet. */
  pageNo: Partial<Record<PageId, string>>;
  /** Page number of each sheet, by sheet key. */
  sheetNo: Record<string, string>;
  /** How many sheets each page runs to. */
  sheetCount: Partial<Record<PageId, number>>;
  pageTotal: string;
  sectionLabel: Partial<Record<PageId, string>>;
  contents: { title: string; rows: { name: string; page: string }[] }[];
  subtotal: number;
  gst: number;
  total: number;
  bound: {
    building: string;
    client: string;
    contact: string;
    site: string;
    quote: string;
    date: string;
    valid: string;
    validUntil: string;
    priceEx: string;
    pm: string;
    pmTitle: string;
    phone: string;
    email: string;
    signer: string;
    signerTitle: string;
  };
  flagStats: { v: number; k: string }[];
  printCount: number;
}

export function derive(p: Proposal): Derived {
  const visible = p.order.filter((id) => !isHidden(p, id));
  const sheets = visible.flatMap((id) => layoutPage(p, id));
  const body = visible.filter((id) => id !== "cover" && id !== "contents");
  const pageNo: Derived["pageNo"] = {};
  const sheetNo: Derived["sheetNo"] = {};
  const sheetCount: Derived["sheetCount"] = {};
  let n0 = 0;
  for (const s of sheets) {
    sheetCount[s.id] = (sheetCount[s.id] ?? 0) + 1;
    if (s.id === "cover" || s.id === "contents") continue;
    sheetNo[s.key] = pad2(++n0);
    if (!s.part) pageNo[s.id] = sheetNo[s.key];
  }

  const secNo: Record<string, number> = {};
  let k = 0;
  body.forEach((id) => {
    const s = secOf(id);
    if (!(s in secNo)) secNo[s] = ++k;
  });
  const sectionLabel: Derived["sectionLabel"] = {};
  PAGES.forEach((pg) => (sectionLabel[pg.id] = `Section ${pad2(secNo[secOf(pg.id)] ?? 0)} / ${pad2(k)}`));

  const contents: Derived["contents"] = [];
  const seen = new Set<string>();
  body.forEach((id) => {
    const pg = PAGE[id];
    const s = secOf(id);
    if (seen.has(s) || !pg.cat) return;
    seen.add(s);
    let g = contents.find((x) => x.title === pg.cat);
    if (!g) contents.push((g = { title: pg.cat, rows: [] }));
    g.rows.push({ name: pg.name, page: pageNo[id] ?? "" });
  });

  const subtotal = Math.round(p.d.pricing.stages.reduce((a, x) => a + parseAmt(x.amt), 0) * 100) / 100;
  const gst = Math.round(subtotal * 10) / 100;

  const J = p.job;
  const d0 = toDate(J.date);
  const d1 = new Date(d0);
  d1.setDate(d1.getDate() + (parseInt(J.valid, 10) || 0));

  const n = (r: { count: string }) => parseInt(r.count, 10) || 0;
  const fr = p.d.flagged.rows;
  const band = (b: Band) => fr.filter((r) => bandOf(r.code) === b).reduce((a, r) => a + n(r), 0);

  return {
    sheets,
    body,
    pageNo,
    sheetNo,
    sheetCount,
    pageTotal: pad2(n0),
    sectionLabel,
    contents,
    subtotal,
    gst,
    total: Math.round((subtotal + gst) * 100) / 100,
    bound: {
      ...J,
      date: longDate(d0),
      valid: `${J.valid || "0"} days`,
      validUntil: longDate(d1),
      priceEx: money(subtotal),
    },
    flagStats: [
      { v: fr.reduce((a, r) => a + n(r), 0), k: "Defects flagged" },
      { v: band("red"), k: "Priority" },
      { v: band("amber"), k: "Repair" },
      { v: band("grey"), k: "Monitor" },
    ],
    printCount: sheets.length,
  };
}

/** Rows grouped by severity band, empty bands dropped. */
export function groups<T extends { code: string }>(rows: T[]): { band: Band; rows: T[] }[] {
  return BAND_ORDER.map((band) => ({ band, rows: rows.filter((r) => bandOf(r.code) === band) })).filter(
    (g) => g.rows.length,
  );
}

export const codeName = (code: string) => CODES[code]?.name ?? code;

// ── Review checks ────────────────────────────────────────────────────────────

export interface Check {
  ok?: boolean;
  info?: boolean;
  title: string;
  detail: string;
  fix?: PageId;
}

export function reviewChecks(p: Proposal, D: Derived): Check[] {
  const missing = JOB_FIELDS.filter((f) => !String(p.job[f.key] ?? "").trim());
  const hiddenCount = PAGES.filter((pg) => p.hidden[pg.id]).length;
  return [
    missing.length
      ? { ok: false, title: "Job details incomplete", detail: missing.map((f) => f.label).join(", "), fix: "cover" }
      : { ok: true, title: "Job details", detail: `${p.job.client} · Q ${p.job.quote}` },
    ...(!isHidden(p, "project") && !p.d.project.program.trim()
      ? [{ ok: false, title: "Program missing", detail: "Your project · how long the works take", fix: "project" as PageId }]
      : []),
    !isHidden(p, "access") && !p.d.access.aerial
      ? { ok: false, title: "Aerial photo missing", detail: "Access & disruption plan", fix: "access" }
      : { ok: true, title: "Photos", detail: "Every photo space is filled" },
    ...(!isHidden(p, "findings") && !p.d.findings.items.length
      ? [{ ok: false, title: "No findings added", detail: "Site survey & findings", fix: "findings" as PageId }]
      : []),
    D.subtotal > 0
      ? { ok: true, title: "Price", detail: `${money(D.subtotal)} ex GST · ${money(D.total)} incl.` }
      : { ok: false, title: "No price set", detail: "Add price stages", fix: "pricing" },
    {
      info: true,
      title: `${hiddenCount} ${hiddenCount === 1 ? "page" : "pages"} hidden`,
      detail: "Hidden pages are left out of the PDF",
    },
  ];
}

export { lines };
