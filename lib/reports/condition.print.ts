// lib/reports/condition.print.ts
//
// This file is the single source of truth for the print/PDF HTML.
// It must be an exact replica of the React components it mirrors:
//   - PhotoSection.tsx    → photo pages with page numbers
//   - ScheduleSection.tsx → schedule pages with topBar, heading, table, footer
//   - SummarySection.tsx  → summary page with topBar, body, footer
//   - CoverSection.tsx    → cover page
//
// The browser Export PDF path uses this file directly (window.open + print()).
// The Save to Job path uses Puppeteer to render this HTML server-side.
// Both must produce identical output — do not diverge these two paths.

import type { ConditionReportData, ScheduleRow } from "./condition.types";
import { formatScheduleDate } from "./condition.types";

// ── Shared pagination constants (also used by PhotoSection.tsx) ───────────────
// A4 at 96dpi: 794 x 1123px; padding 2.75rem = 44px each side
// Available height: 1123 - (44 * 2) = 1035px
export const PAGE_AVAILABLE_H = 1035;
export const ROW_H = 270;
export const DATE_HEADER_H = 34;
export const GROUP_GAP = 36;

// Schedule rows per page — must match ScheduleSection.tsx
const ROWS_PER_FIRST_PAGE = 16;
const ROWS_PER_CONTINUATION = 22;

// ── Static asset map ──────────────────────────────────────────────────────────
// Browser path: omit — relative /public paths resolve normally.
// Puppeteer path: pass pre-read base64 data URIs so headless Chrome needs
// zero outbound requests and images always appear in the saved PDF.

export interface StaticAssets {
  rasLogo: string;
  linkWhite: string;
  linkBlue: string;
  associations: {
    communitySelect: string;
    dulux: string;
    haymes: string;
    mpa: string;
    qbcc: string;
    smartStrata: string;
  };
}

const DEFAULT_ASSETS: StaticAssets = {
  rasLogo: "/reports/ras-logo.png",
  linkWhite: "/reports/link_white.png",
  linkBlue: "/reports/link_blue.png",
  associations: {
    communitySelect: "/reports/associations/communityselect.png",
    dulux: "/reports/associations/dulux.png",
    haymes: "/reports/associations/haymes.svg",
    mpa: "/reports/associations/mpa.png",
    qbcc: "/reports/associations/qbcc.png",
    smartStrata: "/reports/associations/smartstrata.png",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str: string | number): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripExt(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

function formatGroupDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getDayKey(iso: string | null | undefined): string {
  if (!iso) return "undated";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "undated";
  }
}

type Photo = ConditionReportData["photos"][0];
interface PhotoGroup {
  key: string;
  label: string | null;
  photos: Photo[];
}

function groupPhotosByDate(photos: Photo[]): PhotoGroup[] {
  const map = new Map<string, Photo[]>();
  for (const p of photos) {
    const key = getDayKey(p.dateAdded);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([key, group]) => ({
    key,
    label: key === "undated" ? null : formatGroupDate(group[0].dateAdded!),
    photos: group,
  }));
}

// ── Photo paginator ───────────────────────────────────────────────────────────

type PrintItem =
  | { type: "dateHeader"; label: string }
  | { type: "photoRow"; photos: Photo[] };

function paginatePhotos(
  groups: PhotoGroup[],
  showDates: boolean,
): PrintItem[][] {
  const pages: PrintItem[][] = [];
  let current: PrintItem[] = [];
  let usedH = 0;

  function flush() {
    if (current.length > 0) {
      pages.push(current);
      current = [];
      usedH = 0;
    }
  }

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (showDates && group.label) {
      const neededH = DATE_HEADER_H + ROW_H;
      if (usedH > 0 && usedH + neededH > PAGE_AVAILABLE_H) flush();
      current.push({ type: "dateHeader", label: group.label });
      usedH += DATE_HEADER_H;
    }
    const rows: Photo[][] = [];
    for (let i = 0; i < group.photos.length; i += 3)
      rows.push(group.photos.slice(i, i + 3));
    for (const row of rows) {
      if (usedH > 0 && usedH + ROW_H > PAGE_AVAILABLE_H) flush();
      current.push({ type: "photoRow", photos: row });
      usedH += ROW_H;
    }
    const isLastGroup = g === groups.length - 1;
    if (!isLastGroup && usedH > 0 && usedH + GROUP_GAP < PAGE_AVAILABLE_H)
      usedH += GROUP_GAP;
  }
  flush();
  return pages;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const D = "#e5e7eb";

// ── Print styles ──────────────────────────────────────────────────────────────
// Every rule here must exactly match the corresponding .module.css files.

const PRINT_STYLES = `
  @page { size: A4; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'Inter', Arial, sans-serif;
    font-weight: 300;
    background: white;
    color: #1a1a2e;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     COVER PAGE — mirrors CoverSection.tsx / CoverSection.module.css
  ───────────────────────────────────────────────────────────────────────── */
  .cover { width:210mm; height:297mm; display:flex; flex-direction:column; page-break-after:always; break-after:page; overflow:hidden; }
  .cover-hero { position:relative; height:580px; flex-shrink:0; overflow:hidden; }
  .cover-hero-navy { position:absolute; inset:0; background:#0d1c45; }
  .cover-hero-photo { position:absolute; inset:0; background-size:cover; background-position:center; }
  .cover-hero-overlay { position:absolute; inset:0; background:rgba(10,22,60,0.68); }
  .cover-logo { position:absolute; top:2.5rem; left:2.75rem; z-index:5; }
  .cover-logo img { height:41px; width:auto; display:block; }
  .cover-web { position:absolute; top:2.6rem; right:2.75rem; z-index:5; }
  .cover-web img { height:22px; width:auto; display:block; }
  .cover-body { flex:1; display:flex; flex-direction:column; padding:0 2.75rem 0; }
  .cover-title-group { flex:1; display:flex; flex-direction:column; justify-content:center; }
  .cover-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:2.75rem; letter-spacing:0.04em; color:#0d1c45; line-height:1.05; text-transform:uppercase; margin-bottom:1.25rem; }
  .cover-intro { font-family:'Inter',Arial,sans-serif; font-size:0.82rem; font-weight:300; color:#666; line-height:1.8; overflow-wrap:break-word; word-break:break-word; }
  .cover-intro p { margin:0 0 0.35em; min-height:1.476em; }
  .cover-intro p:last-child { margin-bottom:0; }
  .cover-intro strong { font-weight:600; }
  .cover-intro em { font-style:italic; }
  .cover-intro ul { list-style-type:disc; padding-left:1.4em; margin:0.2em 0 0.35em; }
  .cover-intro ol { list-style-type:decimal; padding-left:1.4em; margin:0.2em 0 0.35em; }
  .cover-intro li { margin-bottom:0.15em; }
  .cover-meta-wrap { padding-bottom:2rem; }
  .cover-meta { border-collapse:collapse; width:1px; }
  .lbl { font-family:'Bebas Neue',Arial,sans-serif; font-size:1.05rem; letter-spacing:0.08em; line-height:1; color:#0d1c45; padding:0.4rem 1.25rem 0.4rem 0; white-space:nowrap; vertical-align:middle; }
  .val { font-family:'Inter',Arial,sans-serif; font-size:0.82rem; font-weight:300; color:#333; padding:0.4rem 0; vertical-align:middle; white-space:nowrap; }
  .cover-footer { margin-top:auto; padding:1.5rem 0 2rem; border-top:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:nowrap; }
  .cover-footer img { height:36px; width:auto; max-width:80px; object-fit:contain; display:block; opacity:0.85; }

  /* ─────────────────────────────────────────────────────────────────────────
     PHOTO PAGES — mirrors PhotoSection.tsx / PhotoSection.module.css
  ───────────────────────────────────────────────────────────────────────── */
  .photo-page { width:210mm; min-height:297mm; break-before:page; page-break-before:always; display:flex; flex-direction:column; justify-content:space-between; padding:2.75rem; }
  .photo-page:first-of-type { break-before:auto; page-break-before:auto; }
  .photo-page-inner { display:flex; flex-direction:column; gap:0.875rem; flex:1; }
  .photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.875rem; }
  .photo-item { display:flex; flex-direction:column; gap:0; }
  .photo-thumb { width:100%; aspect-ratio:1/1; background:#f3f4f6; border-radius:6px; overflow:hidden; }
  .photo-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .photo-caption { background:#f3f4f6; border-radius:0 0 6px 6px; padding:0.35rem 0.6rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:400; color:#374151; text-align:center; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .date-header { display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem; }
  .date-line { flex:1; height:1px; background:#e5e7eb; }
  .date-text { font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#6b7280; white-space:nowrap; }
  .page-num { text-align:right; font-family:'Inter',Arial,sans-serif; font-size:0.68rem; font-weight:400; letter-spacing:0.1em; text-transform:uppercase; color:#9ca3af; padding-top:1rem; }

  /* ─────────────────────────────────────────────────────────────────────────
     SCHEDULE PAGES — mirrors ScheduleSection.tsx / ScheduleSection.module.css
  ───────────────────────────────────────────────────────────────────────── */
  .sch-page { width:210mm; min-height:297mm; break-before:page; page-break-before:always; display:flex; flex-direction:column; }
  .sch-topbar { display:flex; align-items:flex-start; justify-content:space-between; padding:2.75rem 2.75rem 0; flex-shrink:0; }
  .sch-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:3rem; font-weight:400; letter-spacing:0.04em; color:#0d1c45; line-height:1; text-transform:uppercase; }
  .sch-topbar-link { height:22px; width:auto; display:block; margin-top:0.5rem; }
  .sch-body { padding:2rem 2.75rem 2rem; flex:1; display:flex; flex-direction:column; }
  .sch-heading { display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem; }
  .sch-heading-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:1.15rem; letter-spacing:0.08em; color:#0d1c45; white-space:nowrap; }
  .sch-heading-rule { flex:1; height:2px; background:#0d1c45; }
  .sch-table-wrap { flex:1; }
  .sch-table { width:100%; border-collapse:collapse; }
  .sch-th { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#374151; background:#f9f9f9; border-bottom:1px solid ${D}; text-align:left; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-th-num { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#374151; background:#f9f9f9; border-bottom:1px solid ${D}; text-align:right; white-space:nowrap; width:100px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-row { border-bottom:1px solid #f0f0f0; }
  .sch-row:last-child { border-bottom:none; }
  .sch-td { padding:0.48rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.78rem; font-weight:300; color:#111827; vertical-align:middle; }
  .sch-td-num { padding:0.48rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.78rem; font-weight:300; color:#111827; text-align:right; font-variant-numeric:tabular-nums; vertical-align:middle; width:100px; }
  .sch-totals { border-top:2px solid ${D}; background:#f9f9f9; }
  .sch-totals-label { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#374151; text-align:left; }
  .sch-totals-cell { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.78rem; font-weight:600; color:#111827; text-align:right; font-variant-numeric:tabular-nums; }
  .sch-footer { margin-top:auto; padding:1.5rem 2.75rem 2rem; border-top:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:nowrap; }
  .sch-footer img { height:36px; width:auto; max-width:80px; object-fit:contain; display:block; opacity:0.85; }

  /* ─────────────────────────────────────────────────────────────────────────
     SUMMARY PAGE — mirrors SummarySection.tsx / SummarySection.module.css
  ───────────────────────────────────────────────────────────────────────── */
  .summary-page { width:210mm; min-height:297mm; break-before:page; page-break-before:always; display:flex; flex-direction:column; }
  .summary-topbar { display:flex; align-items:flex-start; justify-content:space-between; padding:2.75rem 2.75rem 0; }
  .summary-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:3rem; font-weight:400; letter-spacing:0.04em; color:#0d1c45; line-height:1; text-transform:uppercase; }
  .summary-link { height:22px; width:auto; display:block; margin-top:0.5rem; }
  .summary-body { padding:2.5rem 2.75rem 2rem; flex:1; display:flex; flex-direction:column; gap:2.25rem; }
  .summary-section { display:flex; flex-direction:column; gap:0.75rem; }
  .summary-label { font-family:'Bebas Neue',Arial,sans-serif; font-size:1.05rem; font-weight:400; letter-spacing:0.08em; color:#0d1c45; text-transform:uppercase; line-height:1; }

  /* FIX 1: overflow-wrap + word-break prevent text escaping the page edge    */
  /* FIX 2: p min-height preserves blank lines (empty <p> from Tiptap)        */
  /* FIX 3: margins/spacing aligned exactly with RichTextEditor.module.css    */
  .summary-text { font-family:'Inter',Arial,sans-serif; font-size:0.85rem; font-weight:300; color:#444; line-height:1.85; overflow-wrap:break-word; word-break:break-word; }
  .summary-text p { margin:0 0 0.35em; min-height:1.572em; }
  .summary-text p:last-child { margin-bottom:0; }
  .summary-text strong { font-weight:600; color:#333; }
  .summary-text em { font-style:italic; }
  .summary-text ul,.summary-text ol { padding-left:1.4em; margin:0.2em 0 0.35em; }
  .summary-text ul { list-style-type:disc; }
  .summary-text ol { list-style-type:decimal; }
  .summary-text li { margin-bottom:0.15em; }
  .summary-footer { margin-top:auto; padding:1.5rem 2.75rem 2rem; border-top:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:nowrap; }
  .summary-footer img { height:36px; width:auto; max-width:80px; object-fit:contain; display:block; opacity:0.85; }
`;

// ── Schedule pages HTML builder ───────────────────────────────────────────────
// Mirrors ScheduleSection.tsx exactly:
//   - Paginates at ROWS_PER_FIRST_PAGE (16) then ROWS_PER_CONTINUATION (22)
//   - topBar + sub-heading only on first page
//   - Association footer on every page
//   - Total row on last page only
//   - 3 columns: Date, Employee, Hours (matches React component)

function buildSchedulePagesHTML(
  rows: ScheduleRow[],
  assocHTML: string,
  linkBlue: string,
): string {
  if (rows.length === 0) return "";

  const totalHours = rows.reduce((s, r) => s + r.actualHours, 0);

  // Paginate — identical logic to ScheduleSection.tsx
  const pages: ScheduleRow[][] = [];
  if (rows.length <= ROWS_PER_FIRST_PAGE) {
    pages.push(rows);
  } else {
    pages.push(rows.slice(0, ROWS_PER_FIRST_PAGE));
    let offset = ROWS_PER_FIRST_PAGE;
    while (offset < rows.length) {
      pages.push(rows.slice(offset, offset + ROWS_PER_CONTINUATION));
      offset += ROWS_PER_CONTINUATION;
    }
  }

  return pages
    .map((pageRows, pageIdx) => {
      const isFirst = pageIdx === 0;
      const isLast = pageIdx === pages.length - 1;

      const topBar = isFirst
        ? `<div class="sch-topbar">
            <h1 class="sch-title">Schedule</h1>
            <img src="${esc(linkBlue)}" alt="rasvertex.com.au" class="sch-topbar-link" />
          </div>`
        : "";

      const subHeading = isFirst
        ? `<div class="sch-heading">
            <div class="sch-heading-title">Hours Schedule</div>
            <div class="sch-heading-rule"></div>
          </div>`
        : "";

      const dataRows = pageRows
        .map(
          (row) => `
        <tr class="sch-row">
          <td class="sch-td">${esc(formatScheduleDate(row.date))}</td>
          <td class="sch-td">${esc(row.employeeName)}</td>
          <td class="sch-td-num">${row.actualHours > 0 ? row.actualHours.toFixed(2) : "—"}</td>
        </tr>`,
        )
        .join("\n");

      const totalsRow =
        isLast && rows.length > 0
          ? `<tfoot>
              <tr class="sch-totals">
                <td class="sch-totals-label">Total</td>
                <td class="sch-td"></td>
                <td class="sch-totals-cell">${totalHours > 0 ? totalHours.toFixed(2) : "—"}</td>
              </tr>
            </tfoot>`
          : "";

      return `
<div class="sch-page">
  ${topBar}
  <div class="sch-body">
    ${subHeading}
    <div class="sch-table-wrap">
      <table class="sch-table">
        <thead>
          <tr>
            <th class="sch-th">Date</th>
            <th class="sch-th">Employee</th>
            <th class="sch-th-num">Hours</th>
          </tr>
        </thead>
        <tbody>${dataRows}</tbody>
        ${totalsRow}
      </table>
    </div>
  </div>
  <div class="sch-footer">${assocHTML}</div>
</div>`;
    })
    .join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Builds the full print-ready HTML for a condition report.
 *
 * @param report  Report data. Photos must already have base64 `url` values
 *                when called server-side (Puppeteer path).
 * @param assets  Optional pre-loaded base64 data URIs for /public static assets.
 *                Omit when calling from the browser — relative paths work fine.
 *                Pass when calling from Puppeteer so headless Chrome has no
 *                outbound image requests and all assets are embedded inline.
 */
export function buildPrintHTML(
  report: ConditionReportData,
  assets?: StaticAssets,
): string {
  const { showDates, showSchedule } = report.settings;
  const a = assets ?? DEFAULT_ASSETS;

  // ── Association logos fragment (reused in cover, schedule, summary footers) ─
  const ASSOC_LOGOS = [
    { src: a.associations.communitySelect, alt: "Community Select" },
    { src: a.associations.dulux, alt: "Dulux" },
    { src: a.associations.haymes, alt: "Haymes Paint" },
    { src: a.associations.mpa, alt: "MPA" },
    { src: a.associations.qbcc, alt: "QBCC" },
    { src: a.associations.smartStrata, alt: "Smart Strata" },
  ];
  const assocHTML = ASSOC_LOGOS.map(
    (l) => `<img src="${esc(l.src)}" alt="${esc(l.alt)}" />`,
  ).join("");

  // ── Photo pages ───────────────────────────────────────────────────────────
  const groups = showDates
    ? groupPhotosByDate(report.photos)
    : [{ key: "all", label: null, photos: report.photos }];

  const photoPages = paginatePhotos(groups, showDates);
  const totalPhotoPages = photoPages.length;
  let globalIndex = 0;

  const photoPageHTML = photoPages
    .map((items, pageIdx) => {
      const inner = items
        .map((item) => {
          if (item.type === "dateHeader") {
            return `<div class="date-header"><span class="date-line"></span><span class="date-text">${esc(item.label)}</span><span class="date-line"></span></div>`;
          }
          const cells = item.photos
            .map((photo) => {
              globalIndex++;
              return `<div class="photo-item">
  <div class="photo-thumb"><img src="${esc(photo.url)}" alt="${esc(photo.name)}" /></div>
  <div class="photo-caption">${globalIndex}. ${esc(stripExt(photo.name))}</div>
</div>`;
            })
            .join("\n");
          return `<div class="photo-grid">${cells}</div>`;
        })
        .join("\n");

      // Page number — mirrors .pageNumber in PhotoSection.module.css
      const pageLabel =
        totalPhotoPages > 1
          ? `PAGE ${pageIdx + 1} / ${totalPhotoPages}`
          : `PAGE ${pageIdx + 1}`;

      return `<div class="photo-page">
  <div class="photo-page-inner">${inner}</div>
  <div class="page-num">${pageLabel}</div>
</div>`;
    })
    .join("\n");

  // ── Schedule pages ────────────────────────────────────────────────────────
  const scheduleHTML =
    showSchedule && report.schedule.length > 0
      ? buildSchedulePagesHTML(report.schedule, assocHTML, a.linkBlue)
      : "";

  // ── Cover page ────────────────────────────────────────────────────────────
  const coverPhotoLayer = report.job.coverPhoto
    ? `<div class="cover-hero-photo" style="background-image:url('${report.job.coverPhoto}')"></div>`
    : "";

  const metaRows = [
    { label: "Prepared For:", value: report.job.preparedFor },
    { label: "Prepared By:", value: report.job.preparedBy },
    { label: "Address:", value: report.job.address },
    { label: "Project:", value: report.job.project },
    { label: "Date:", value: report.job.date },
  ]
    .map(
      (r) =>
        `<tr><td class="lbl">${esc(r.label)}</td><td class="val">${esc(r.value || "")}</td></tr>`,
    )
    .join("");

  const introText =
    report.job.intro ||
    "This report outlines the repairs and maintenance works completed, including any updates, adjustments, and variations from the original scope.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(report.job.reportType || "Building Condition Report")} — ${esc(report.job.project)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;600&display=swap" rel="stylesheet" />
  <style>${PRINT_STYLES}</style>
</head>
<body>

<!-- ── COVER ── -->
<div class="cover">
  <div class="cover-hero">
    <div class="cover-hero-navy"></div>
    ${coverPhotoLayer}
    <div class="cover-hero-overlay"></div>
    <div class="cover-logo"><img src="${esc(a.rasLogo)}" alt="RAS Vertex" /></div>
    <div class="cover-web"><img src="${esc(a.linkWhite)}" alt="rasvertex.com.au" /></div>
  </div>
  <div class="cover-body">
    <div class="cover-title-group">
      <div class="cover-title">${esc(report.job.reportType || "Building Condition Report")}</div>
      <div class="cover-intro">${introText}</div>
    </div>
    <div class="cover-meta-wrap">
      <table class="cover-meta">${metaRows}</table>
    </div>
    <div class="cover-footer">${assocHTML}</div>
  </div>
</div>

<!-- ── PHOTO PAGES ── -->
${photoPageHTML}

<!-- ── SCHEDULE PAGES ── -->
${scheduleHTML}

<!-- ── SUMMARY ── -->
<div class="summary-page">
  <div class="summary-topbar">
    <div class="summary-title">Summary</div>
    <img src="${esc(a.linkBlue)}" alt="rasvertex.com.au" class="summary-link" />
  </div>
  <div class="summary-body">
    <div class="summary-section">
      <div class="summary-label">Comments:</div>
      <div class="summary-text">${report.comments || ""}</div>
    </div>
    <div class="summary-section">
      <div class="summary-label">Recommendations:</div>
      <div class="summary-text">${report.recommendations || ""}</div>
    </div>
  </div>
  <div class="summary-footer">${assocHTML}</div>
</div>

</body>
</html>`;
}
