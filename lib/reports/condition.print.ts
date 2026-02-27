// lib/reports/condition.print.ts

import type { ConditionReportData, ScheduleRow } from "./condition.types";
import { formatScheduleDate } from "./condition.types";

// ── Shared pagination constants (also used by PhotoSection.tsx) ───────────────
export const PAGE_AVAILABLE_H = 1035;
export const ROW_H = 270;
export const DATE_HEADER_H = 34;
export const GROUP_GAP = 36;

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

// ── Core paginator ────────────────────────────────────────────────────────────

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

// ── Schedule HTML builder ─────────────────────────────────────────────────────

function buildSchedulePageHTML(rows: ScheduleRow[], D: string): string {
  const totalScheduled = rows.reduce((s, r) => s + r.scheduledHours, 0);
  const totalActual = rows.reduce((s, r) => s + r.actualHours, 0);

  const dataRows = rows
    .map(
      (row) => `
    <tr class="sch-row">
      <td class="sch-td">${esc(formatScheduleDate(row.date))}</td>
      <td class="sch-td">${esc(row.employeeName)}</td>
      <td class="sch-td-num">${row.scheduledHours > 0 ? row.scheduledHours.toFixed(2) : "—"}</td>
      <td class="sch-td-num">${row.actualHours > 0 ? row.actualHours.toFixed(2) : "—"}</td>
      <td class="sch-td sch-note">${esc(row.note)}</td>
    </tr>`,
    )
    .join("\n");

  const totalsRow = `
    <tr class="sch-totals">
      <td colspan="2" class="sch-totals-label">Totals</td>
      <td class="sch-totals-cell">${totalScheduled > 0 ? totalScheduled.toFixed(2) : "—"}</td>
      <td class="sch-totals-cell">${totalActual > 0 ? totalActual.toFixed(2) : "—"}</td>
      <td></td>
    </tr>`;

  return `
<div class="sch-page">
  <div class="sch-page-inner">
    <div class="sch-heading">
      <div class="sch-title">Hours Schedule</div>
      <div class="sch-rule"></div>
    </div>
    <table class="sch-table">
      <thead>
        <tr>
          <th class="sch-th">Date</th>
          <th class="sch-th">Employee</th>
          <th class="sch-th-num">Scheduled Hrs</th>
          <th class="sch-th-num">Actual Hrs</th>
          <th class="sch-th">Note</th>
        </tr>
      </thead>
      <tbody>${dataRows}</tbody>
      <tfoot>${rows.length > 0 ? totalsRow : ""}</tfoot>
    </table>
  </div>
</div>`;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const D = "#e5e7eb";

const ASSOCIATION_LOGOS = [
  { src: "/reports/associations/communityselect.png", alt: "Community Select" },
  { src: "/reports/associations/dulux.png", alt: "Dulux" },
  { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
  { src: "/reports/associations/mpa.png", alt: "MPA" },
  { src: "/reports/associations/qbcc.png", alt: "QBCC" },
  { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
];

// ── Print styles ──────────────────────────────────────────────────────────────

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

  /* ── COVER ── */
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
  .cover-intro { font-family:'Inter',Arial,sans-serif; font-size:0.82rem; font-weight:300; color:#666; line-height:1.8; white-space:pre-wrap; }
  .cover-meta-wrap { padding-bottom:2rem; }
  .cover-meta { border-collapse:collapse; width:1px; }
  .cover-meta td { font-family:'Inter',Arial,sans-serif; font-size:0.82rem; font-weight:300; padding:0.4rem 0; border-bottom:1px solid ${D}; vertical-align:middle; white-space:nowrap; }
  .cover-meta tr:first-child td { border-top:1px solid ${D}; }
  .cover-meta td.lbl { font-family:'Bebas Neue',Arial,sans-serif; font-size:0.78rem; letter-spacing:0.1em; color:#0d1c45; padding-right:1.25rem; }
  .cover-meta td.val { color:#333; }
  .cover-footer { padding:1.5rem 0 2rem; border-top:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:nowrap; }
  .cover-footer img { height:36px; width:auto; max-width:80px; object-fit:contain; display:block; opacity:0.85; }

  /* ── PHOTO PAGES ── */
  .photo-page { width:210mm; break-after:page; page-break-after:always; }
  .photo-page:last-of-type { break-after:auto; page-break-after:auto; }
  .photo-page-inner { padding:2.75rem; }
  .date-header { display:flex; align-items:center; gap:1rem; margin-bottom:1rem; }
  .date-line { flex:1; height:1px; background:${D}; }
  .date-text { font-family:'Inter',Arial,sans-serif; font-size:0.65rem; font-weight:600; letter-spacing:0.1em; text-transform:uppercase; color:#9ca3af; white-space:nowrap; }
  .photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.875rem; margin-bottom:0.875rem; }
  .photo-grid:last-child { margin-bottom:0; }
  .photo-item { break-inside:avoid; page-break-inside:avoid; }
  .photo-thumb { aspect-ratio:1; background:#f3f4f6; border-radius:6px; overflow:hidden; }
  .photo-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .photo-caption { background:#f3f4f6; border-radius:5px; padding:0.35rem 0.6rem; margin-top:0.4rem; text-align:center; font-family:'Inter',Arial,sans-serif; font-size:0.68rem; font-weight:300; color:#374151; }

  /* ── SCHEDULE PAGE ── */
  .sch-page { width:210mm; break-after:page; page-break-after:always; }
  .sch-page-inner { padding:2.75rem; }
  .sch-heading { display:flex; align-items:center; gap:1rem; margin-bottom:1.5rem; }
  .sch-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:1.6rem; font-weight:400; letter-spacing:0.05em; color:#0d1c45; text-transform:uppercase; line-height:1; white-space:nowrap; }
  .sch-rule { flex:1; height:1px; background:${D}; }
  .sch-table { width:100%; border-collapse:collapse; border:1px solid ${D}; border-radius:6px; overflow:hidden; }
  .sch-th, .sch-th-num {
    padding:0.55rem 0.875rem;
    font-family:'Inter',Arial,sans-serif;
    font-size:0.62rem; font-weight:700;
    letter-spacing:0.1em; text-transform:uppercase;
    color:#6b7280; background:#f9f9f9;
    border-bottom:1px solid ${D};
    text-align:left; white-space:nowrap;
  }
  .sch-th-num { text-align:right; width:100px; }
  .sch-row { border-bottom:1px solid #f0f0f0; }
  .sch-row:last-child { border-bottom:none; }
  .sch-td, .sch-td-num {
    padding:0.48rem 0.875rem;
    font-family:'Inter',Arial,sans-serif;
    font-size:0.78rem; font-weight:300;
    color:#111827; vertical-align:middle;
  }
  .sch-td-num { text-align:right; font-variant-numeric:tabular-nums; width:100px; }
  .sch-note { color:#6b7280; font-size:0.72rem; }
  .sch-totals { border-top:2px solid ${D}; background:#f9f9f9; }
  .sch-totals-label { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.68rem; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#111827; text-align:right; }
  .sch-totals-cell { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.8rem; font-weight:600; font-variant-numeric:tabular-nums; color:#111827; text-align:right; width:100px; }

  /* ── SUMMARY PAGE ── */
  .summary-page { width:210mm; min-height:297mm; page-break-before:always; break-before:page; display:flex; flex-direction:column; }
  .summary-topbar { display:flex; align-items:flex-start; justify-content:space-between; padding:2.75rem 2.75rem 0; }
  .summary-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:3rem; font-weight:400; letter-spacing:0.04em; color:#0d1c45; line-height:1; text-transform:uppercase; }
  .summary-link { height:22px; width:auto; display:block; margin-top:0.5rem; }
  .summary-body { padding:2.5rem 2.75rem 2rem; flex:1; display:flex; flex-direction:column; gap:2.25rem; }
  .summary-section { display:flex; flex-direction:column; gap:0.75rem; }
  .summary-label { font-family:'Bebas Neue',Arial,sans-serif; font-size:1.05rem; font-weight:400; letter-spacing:0.08em; color:#0d1c45; text-transform:uppercase; line-height:1; }
  .summary-text { font-family:'Inter',Arial,sans-serif; font-size:0.85rem; font-weight:300; color:#444; line-height:1.85; white-space:pre-wrap; }
  .summary-footer { margin-top:auto; padding:1.5rem 2.75rem 2rem; border-top:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:nowrap; }
  .summary-footer img { height:36px; width:auto; max-width:80px; object-fit:contain; display:block; opacity:0.85; }
`;

// ── Main export ───────────────────────────────────────────────────────────────

export function buildPrintHTML(report: ConditionReportData): string {
  const { showDates, showSchedule } = report.settings;

  // ── Photo pages ───────────────────────────────────────────────────────────
  const groups = showDates
    ? groupPhotosByDate(report.photos)
    : [{ key: "all", label: null, photos: report.photos }];

  const pages = paginatePhotos(groups, showDates);
  let globalIndex = 0;

  const photoPageHTML = pages
    .map((items) => {
      const inner = items
        .map((item) => {
          if (item.type === "dateHeader") {
            return `<div class="date-header"><span class="date-line"></span><span class="date-text">${esc(item.label)}</span><span class="date-line"></span></div>`;
          }
          const cells = item.photos
            .map((photo) => {
              globalIndex++;
              return `<div class="photo-item"><div class="photo-thumb"><img src="${esc(photo.url)}" alt="${esc(photo.name)}" /></div><div class="photo-caption">${globalIndex}. ${esc(stripExt(photo.name))}</div></div>`;
            })
            .join("\n");
          return `<div class="photo-grid">${cells}</div>`;
        })
        .join("\n");
      return `<div class="photo-page"><div class="photo-page-inner">\n${inner}\n</div></div>`;
    })
    .join("\n");

  // ── Schedule page ─────────────────────────────────────────────────────────
  const schedulePageHTML =
    showSchedule && report.schedule.length > 0
      ? buildSchedulePageHTML(report.schedule, D)
      : "";

  // ── Cover ─────────────────────────────────────────────────────────────────
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

  const assocHTML = ASSOCIATION_LOGOS.map(
    (a) => `<img src="${esc(a.src)}" alt="${esc(a.alt)}" />`,
  ).join("");

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

<div class="cover">
  <div class="cover-hero">
    <div class="cover-hero-navy"></div>
    ${coverPhotoLayer}
    <div class="cover-hero-overlay"></div>
    <div class="cover-logo"><img src="/reports/ras-logo.png" alt="RAS Vertex" /></div>
    <div class="cover-web"><img src="/reports/link_white.png" alt="rasvertex.com.au" /></div>
  </div>
  <div class="cover-body">
    <div class="cover-title-group">
      <div class="cover-title">${esc(report.job.reportType || "Building Condition Report")}</div>
      <div class="cover-intro">${esc(introText)}</div>
    </div>
    <div class="cover-meta-wrap">
      <table class="cover-meta">${metaRows}</table>
    </div>
    <div class="cover-footer">${assocHTML}</div>
  </div>
</div>

${photoPageHTML}

${schedulePageHTML}

<div class="summary-page">
  <div class="summary-topbar">
    <div class="summary-title">Summary</div>
    <img src="/reports/link_blue.png" alt="rasvertex.com.au" class="summary-link" />
  </div>
  <div class="summary-body">
    <div class="summary-section">
      <div class="summary-label">Comments:</div>
      <div class="summary-text">${esc(report.comments || "")}</div>
    </div>
    <div class="summary-section">
      <div class="summary-label">Recommendations:</div>
      <div class="summary-text">${esc(report.recommendations || "")}</div>
    </div>
  </div>
  <div class="summary-footer">${assocHTML}</div>
</div>

</body>
</html>`;
}
