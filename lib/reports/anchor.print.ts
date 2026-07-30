// lib/reports/anchor.print.ts
//
// Self-contained print/PDF HTML builder for the Anchor Inspection Report.
// Mirrors the React components exactly so output is WYSIWYG.
// Rendered server-side via Puppeteer (see lib/server/pdf-utils.ts) — pass
// loadReportAssets() via `assets` so headless Chrome needs zero outbound
// requests and images always appear in the rendered PDF.

import type { AnchorReportData, Zone, LegendIconShape } from "./anchor.types";
import {
  ANCHOR_TYPE_LABELS,
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_IS_RATED,
  computeStaticLineEdges,
  buildLegendGroups,
  anchorTypeDisplayLabel,
} from "./anchor.types";
import {
  BRAND_NAVY,
  DEFAULT_PRINT_ASSETS,
  buildPrintFontFaceCSS,
  PRINT_RESET_CSS,
  ASSOC_LOGO_CSS,
  buildAssocLogosHTML,
  type ReportAssets,
} from "./print-shared";
import { PHOTO_LAYOUTS, buildPhotoPages, stripExt } from "./photos";

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str: string | number | null | undefined): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function assocLogosHTML(assets: ReportAssets): string {
  return buildAssocLogosHTML(assets, "assoc-logo");
}

// ── Shared print CSS ──────────────────────────────────────────────────────────

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  ${PRINT_RESET_CSS}
  html, body {
    font-weight: 300;
    color: #1a1a2e;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* ── Page shell ── */
  .page {
    width: 210mm;
    min-height: 297mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
    background: #fff;
  }
  .page:last-of-type { page-break-after: avoid; break-after: avoid; }

  /* ── Top bar (shared by cert, summary, zone pages) ── */
  .top-bar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 2.75rem 2.75rem 0;
    flex-shrink: 0;
  }
  .top-title {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 3rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: ${BRAND_NAVY};
    line-height: 1;
    text-transform: uppercase;
  }
  .top-link { height: 22px; width: auto; display: block; margin-top: 0.5rem; }

  /* ── Footer logos ── */
  .footer {
    margin-top: auto;
    padding: 1.5rem 2.75rem 2rem;
    border-top: 1px solid #ebebeb;
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    gap: 20px;
    flex-wrap: nowrap;
    flex-shrink: 0;
  }
  .assoc-logo { ${ASSOC_LOGO_CSS} }

  /* ─────────────────────────────────────────────────────────────
     COVER PAGE
  ───────────────────────────────────────────────────────────── */
  .cover-hero {
    position: relative;
    height: 580px;
    flex-shrink: 0;
    overflow: hidden;
  }
  .cover-hero-navy {
    position: absolute;
    inset: 0;
    background: ${BRAND_NAVY};
  }
  .cover-hero-photo {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
  }
  .cover-hero-overlay {
    position: absolute;
    inset: 0;
    background: rgba(10, 22, 60, 0.68);
  }
  .cover-logo {
    position: absolute;
    top: 2.5rem;
    left: 2.75rem;
    z-index: 5;
  }
  .cover-logo img { height: 41px; width: auto; display: block; }
  .cover-web {
    position: absolute;
    top: 2.6rem;
    right: 2.75rem;
    z-index: 5;
  }
  .cover-web img { height: 22px; width: auto; display: block; }
  .cover-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 0 2.75rem 0;
  }
  .cover-title-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .cover-report-title {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 2.75rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: ${BRAND_NAVY};
    line-height: 1.05;
    text-transform: uppercase;
    margin-bottom: 1.25rem;
  }
  .cover-meta-wrap { padding-bottom: 2rem; }
  .cover-meta { border-collapse: collapse; width: 1px; }
  .cover-lbl {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    line-height: 1;
    color: ${BRAND_NAVY};
    padding: 0.55rem 1.25rem 0.55rem 0;
    border-bottom: 1px solid #f0f0f0;
    white-space: nowrap;
    vertical-align: middle;
  }
  .cover-val {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 300;
    line-height: 1.5;
    color: #374151;
    padding: 0.55rem 0;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
    white-space: nowrap;
  }
  .cover-meta tr:last-child .cover-lbl,
  .cover-meta tr:last-child .cover-val { border-bottom: none; }

  /* ─────────────────────────────────────────────────────────────
     ZONE SUMMARY PAGE
  ───────────────────────────────────────────────────────────── */
  .zone-body {
    padding: 2rem 2.75rem 2rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    overflow: hidden;
  }
  .zone-map-wrap {
    position: relative;
    width: 100%;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .zone-map-img {
    display: block;
    width: 100%;
    max-height: 340px;
    object-fit: cover;
  }
  .zone-line-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }
  .zone-pin {
    position: absolute;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
  }
  .zone-pin-label {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 16px;
    padding: 0 4px;
    border-radius: 3px;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.55rem;
    font-weight: 700;
    color: #fff;
    white-space: nowrap;
    letter-spacing: 0.02em;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .zone-table { width: 100%; border-collapse: collapse; }
  .zone-th {
    padding: 0.45rem 0.5rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #374151;
    text-align: left;
    white-space: nowrap;
  }
  .zone-td {
    padding: 0.35rem 0.5rem;
    border: 1px solid #e5e7eb;
    color: #374151;
    vertical-align: middle;
    font-size: 0.72rem;
  }
  /* ── Zone legend — compact wrapped chips, matches the live editor ── */
  .zone-legend {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem 1.125rem;
    padding: 0.875rem 1.125rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 10px;
  }
  .zone-legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .zone-legend-icon-slot {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 14px;
    flex-shrink: 0;
  }
  .zone-legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
    display: inline-block;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .zone-legend-line-icon,
  .zone-legend-shape-icon {
    flex-shrink: 0;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .zone-legend-label {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.78rem;
    font-weight: 500;
    color: #374151;
    white-space: nowrap;
  }
  .zone-legend-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.25rem;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.7rem;
    font-weight: 600;
    color: #7e807f;
    background: #fafafa;
    border-radius: 20px;
    padding: 0.15rem 0.4rem;
  }

  /* ── Zone stats banner ── */
  .zone-stats {
    display: flex;
    align-items: center;
    gap: 2rem;
    padding: 0.875rem 1.5rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }
  .zone-stat { display: flex; align-items: baseline; gap: 0.5rem; }
  .zone-stat-val {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 1.1rem;
    font-weight: 700;
    color: ${BRAND_NAVY};
  }
  .zone-stat-pass { color: #059669 !important; }
  .zone-stat-fail { color: #900c40 !important; }
  .zone-stat-key {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: #6b7280;
  }
  .zone-stat-divider { width: 1px; height: 20px; background: #d1d5db; }

  /* ── Asset register label ── */
  .zone-register-label {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${BRAND_NAVY};
    line-height: 1;
  }
  .badge-pass {
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
    padding: 0.15rem 0.4rem; border-radius: 4px;
    background: #d1fae5; color: #065f46;
  }
  .badge-fail {
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
    padding: 0.15rem 0.4rem; border-radius: 4px;
    background: #fdf2f8; color: #900c40;
  }
  .badge-na {
    display: inline-flex; align-items: center; justify-content: center;
    font-size: 0.6rem; font-weight: 700; letter-spacing: 0.05em;
    padding: 0.15rem 0.4rem; border-radius: 4px;
    background: #f3f4f6; color: #6b7280;
  }

  /* ─────────────────────────────────────────────────────────────
     CERTIFICATION PAGE
  ───────────────────────────────────────────────────────────── */
  .cert-body {
    padding: 2.5rem 2.75rem 2rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .cert-heading {
    display: flex;
    align-items: baseline;
    gap: 0.4rem;
    flex-wrap: wrap;
  }
  .cert-heading-title {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.85rem;
    font-weight: 300;
    color: #555;
  }
  .cert-num {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.85rem;
    font-weight: 600;
    color: ${BRAND_NAVY};
  }
  .cert-details { width: 100%; border-collapse: collapse; }
  .cert-lbl {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${BRAND_NAVY};
    line-height: 1;
    padding: 0.55rem 1.25rem 0.55rem 0;
    border-bottom: 1px solid #f0f0f0;
    white-space: nowrap;
    width: 220px;
    vertical-align: middle;
  }
  .cert-val {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 300;
    color: #374151;
    line-height: 1.5;
    padding: 0.55rem 0;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
  }
  .cert-details tr:last-child .cert-lbl,
  .cert-details tr:last-child .cert-val { border-bottom: none; }

  .standards-intro {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.85rem;
    font-weight: 300;
    color: #444;
    line-height: 1.75;
  }
  .standards-list {
    padding-left: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }
  .standards-list li {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 300;
    color: #444;
    line-height: 1.65;
    list-style-type: disc;
  }

  /* Anchor type summary table */
  .at-table { width: 100%; border-collapse: collapse; }
  .at-head {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${BRAND_NAVY};
    line-height: 1;
    padding: 0.55rem 0.875rem;
    background: #f9f9f9;
    border-bottom: 1px solid #e5e7eb;
    text-align: left;
    white-space: nowrap;
  }
  .at-row { border-bottom: 1px solid #f0f0f0; }
  .at-row:last-child { border-bottom: none; }
  .at-cell {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 300;
    color: #374151;
    line-height: 1.2;
    padding: 0.48rem 0.875rem;
    vertical-align: middle;
  }
  .at-pass { color: #065f46 !important; font-weight: 400 !important; }
  .at-fail { color: #900c40 !important; font-weight: 400 !important; }

  .comments-block { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
  .comments-lbl {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${BRAND_NAVY};
    line-height: 1;
  }
  .comments-box {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 300;
    color: #374151;
    line-height: 1.5;
  }

  /* ─────────────────────────────────────────────────────────────
     SUMMARY / SIGN-OFF PAGE
  ───────────────────────────────────────────────────────────── */
  .summary-body {
    padding: 2.5rem 2.75rem 2rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .summary-para {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.85rem;
    font-weight: 300;
    color: #444;
    line-height: 1.85;
  }
  .signoff { display: flex; flex-direction: column; gap: 0.2rem; margin-top: 1.5rem; }
  .sincerely {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.85rem;
    font-weight: 300;
    color: #444;
    line-height: 1.85;
    margin-bottom: 0.75rem;
  }
  .sig-img { height: 36px; width: auto; max-width: 160px; display: block; margin-bottom: 0.5rem; }
  .sig-name {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 300;
    color: #374151;
    line-height: 1.5;
  }
  .sig-title {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    color: ${BRAND_NAVY};
    text-transform: uppercase;
    line-height: 1;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     PHOTO PAGES — mirrors shared/PhotoSection.tsx / PhotoSection.module.css
     (same classes/values as condition.print.ts's photo pages)
  ───────────────────────────────────────────────────────────────────────── */
  .photo-page { width:210mm; min-height:297mm; break-before:page; page-break-before:always; display:flex; flex-direction:column; justify-content:space-between; padding:2.75rem; }
  .photo-page-inner { display:flex; flex-direction:column; gap:0.875rem; flex:1; }
  .photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.875rem; align-items:start; }
  .photo-item { display:flex; flex-direction:column; gap:0; min-width:0; width:100%; }
  .photo-thumb { width:100%; aspect-ratio:1/1; border-radius:6px; overflow:hidden; }
  .photo-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .photo-caption { padding:0.35rem 0.25rem 0; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:400; color:#374151; text-align:center; }
  .date-header { display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem; }
  .date-line { flex:1; height:1px; background:#e5e7eb; }
  .date-text { font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#6b7280; white-space:nowrap; padding:0 0.25rem; }
  .page-num { text-align:right; font-family:'Inter',Arial,sans-serif; font-size:0.68rem; font-weight:400; letter-spacing:0.1em; text-transform:uppercase; color:#9ca3af; padding-top:1rem; }
`;

// ── Photo pages HTML builder ──────────────────────────────────────────────────
// Pagination/grouping comes from lib/reports/photos.ts (shared with
// Condition Report) — only the HTML template is local to this file.
function buildPhotoPagesHTML(report: AnchorReportData): string {
  // Defensive: a draft saved before photos/photoSettings existed (or a
  // stale client tab that hasn't picked up this feature yet) won't have
  // either field — treat that the same as "no photos" rather than crash
  // PDF generation.
  if (!report.photos?.length || !report.photoSettings) return "";
  const { showDates, photoLayout, filterByDate, dateFrom, dateTo } =
    report.photoSettings;

  const photos = filterByDate
    ? report.photos.filter((p) => {
        if (!p.dateAdded) return true;
        const day = p.dateAdded.slice(0, 10);
        if (dateFrom && day < dateFrom) return false;
        if (dateTo && day > dateTo) return false;
        return true;
      })
    : report.photos;
  if (photos.length === 0) return "";

  const { columns, aspectRatio } =
    PHOTO_LAYOUTS[photoLayout] ?? PHOTO_LAYOUTS.small;
  const pages = buildPhotoPages(photos, showDates, photoLayout);
  const totalPages = pages.length;

  return pages
    .map((items, pageIdx) => {
      const inner = items
        .map((item) => {
          if (item.type === "dateHeader") {
            return `<div class="date-header"><span class="date-line"></span><span class="date-text">${esc(item.label)}</span><span class="date-line"></span></div>`;
          }
          const cells = item.photos
            .map(
              (photo) => `<div class="photo-item">
  <div class="photo-thumb" style="aspect-ratio:${aspectRatio}"><img src="${esc(photo.url)}" alt="${esc(photo.name)}" /></div>
  <div class="photo-caption">${esc(stripExt(photo.name))}</div>
</div>`,
            )
            .join("\n");
          return `<div class="photo-grid" style="grid-template-columns:repeat(${columns}, 1fr)">${cells}</div>`;
        })
        .join("\n");

      const pageLabel =
        totalPages > 1 ? `PAGE ${pageIdx + 1} / ${totalPages}` : `PAGE ${pageIdx + 1}`;

      return `<div class="photo-page">
  <div class="photo-page-inner">${inner}</div>
  <div class="page-num">${pageLabel}</div>
</div>`;
    })
    .join("\n");
}

// ── Page builders ─────────────────────────────────────────────────────────────

function buildCoverPage(
  job: AnchorReportData["job"],
  assets: ReportAssets,
): string {
  const coverPhotoLayer = `<div class="cover-hero-photo" style="background-image:url('${esc(assets.heightSafety)}')"></div>`;

  const metaRows = [
    { label: "Prepared For", value: job.preparedFor },
    { label: "Prepared By", value: job.preparedBy },
    { label: "Address", value: job.address },
    { label: "Date", value: job.date },
  ]
    .map(
      (r) =>
        `<tr><td class="cover-lbl">${esc(r.label)}:</td><td class="cover-val">${esc(r.value)}</td></tr>`,
    )
    .join("");

  return `
<div class="page">
  <div class="cover-hero">
    <div class="cover-hero-navy"></div>
    ${coverPhotoLayer}
    <div class="cover-hero-overlay"></div>
    <div class="cover-logo"><img src="${esc(assets.rasLogo)}" alt="RAS Vertex" /></div>
    <div class="cover-web"><img src="${esc(assets.linkWhite)}" alt="rasvertex.com.au" /></div>
  </div>
  <div class="cover-body">
    <div class="cover-title-group">
      <div class="cover-report-title">${esc(job.reportType)}</div>
    </div>
    <div class="cover-meta-wrap">
      <table class="cover-meta"><tbody>${metaRows}</tbody></table>
    </div>
    <div class="footer" style="margin-top:0;">${assocLogosHTML(assets)}</div>
  </div>
</div>`;
}

// A zone's map/legend/stats banner already eat most of a page, so far fewer
// asset rows fit on the first page than on a continuation page (which is
// just a repeated header + table). Splitting explicitly here — rather than
// letting one unbounded div overflow and get auto-sliced by the printer —
// is what keeps rows from being cut in half across a page boundary.
//
// The map and stats banner are fixed-height, but the legend is not — its
// chips wrap (same compact layout as the live editor), so it grows by one
// *row* per ~3 distinct anchor types present, not one row per type. A zone
// with many types (e.g. 7-9) still wraps to 2-3 legend rows and eats more
// vertical space than one with 2-3 types on a single row. A flat row budget
// sized for a short legend silently overflows the page for a tall one,
// pushing the footer onto its own orphaned page — so the first-page row
// count is computed per zone from how much of the page the map/legend/
// stats banner actually consume, rather than assumed constant. Pixel
// estimates below come from the print CSS (map max-height, legend/stats
// padding + row heights, A4 content height minus top bar/footer) with a
// small safety margin.
const ZONE_ROWS_CONTINUATION = 28;

const ZONE_BODY_AVAILABLE_PX = 820; // A4 content height minus top-bar, footer, body padding
const ZONE_BODY_GAP_PX = 24; // 1.5rem gap between each stacked block
const ZONE_MAP_HEIGHT_PX = 340;
const ZONE_STATS_HEIGHT_PX = 72;
const ZONE_LEGEND_BASE_PX = 24; // vertical padding only, no rows
const ZONE_LEGEND_ROW_PX = 22; // per wrapped legend row, gap included
const ZONE_LEGEND_TYPES_PER_ROW = 3; // conservative — "Fall Arrest Anchor"-length chips at page width
const ZONE_REGISTER_LABEL_PX = 28;
const ZONE_TABLE_HEADER_PX = 26;
const ZONE_TABLE_ROW_PX = 26;
const ZONE_ROWS_FIRST_PAGE_MAX = 12;

function computeFirstPageRowBudget(
  hasMap: boolean,
  legendTypeCount: number,
  hasStats: boolean,
): number {
  const mapPx = hasMap ? ZONE_MAP_HEIGHT_PX : 0;
  const statsPx = hasStats ? ZONE_STATS_HEIGHT_PX : 0;
  const legendRows =
    legendTypeCount > 0
      ? Math.ceil(legendTypeCount / ZONE_LEGEND_TYPES_PER_ROW)
      : 0;
  const legendPx =
    legendRows > 0 ? ZONE_LEGEND_BASE_PX + legendRows * ZONE_LEGEND_ROW_PX : 0;
  // Blocks stacked in .zone-body: map?, legend?, stats?, register label, table.
  const blockCount =
    [mapPx, legendPx, statsPx].filter((h) => h > 0).length + 2;
  const gapsPx = (blockCount - 1) * ZONE_BODY_GAP_PX;

  const availableForRows =
    ZONE_BODY_AVAILABLE_PX -
    mapPx -
    legendPx -
    statsPx -
    gapsPx -
    ZONE_REGISTER_LABEL_PX -
    ZONE_TABLE_HEADER_PX;

  return Math.max(
    1,
    Math.min(
      ZONE_ROWS_FIRST_PAGE_MAX,
      Math.floor(availableForRows / ZONE_TABLE_ROW_PX),
    ),
  );
}

function buildAssetTableHead(): string {
  return `<thead><tr>
           <th class="zone-th">Asset No.</th>
           <th class="zone-th">Type</th>
           <th class="zone-th">Commission</th>
           <th class="zone-th">Inspection</th>
           <th class="zone-th">Next Inspection</th>
           <th class="zone-th">Pass/Fail</th>
         </tr></thead>`;
}

// HTML-string mirror of MapLegend.tsx's LegendIcon — same shapes, same
// meanings, kept in sync manually since one renders React and the other
// raw markup for Puppeteer.
function legendIconHTML(icon: LegendIconShape, colour: string): string {
  if (icon === "static-line") {
    return `<svg class="zone-legend-line-icon" width="14" height="10" viewBox="0 0 14 10">
      <line x1="1" y1="5" x2="13" y2="5" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" />
      <circle cx="1" cy="5" r="1.5" fill="${colour}" />
      <circle cx="13" cy="5" r="1.5" fill="${colour}" />
    </svg>`;
  }
  if (icon === "dot") {
    return `<span class="zone-legend-dot" style="background:${colour};"></span>`;
  }
  const shapes: Record<string, string> = {
    circle: `<circle cx="7" cy="7" r="5" fill="${colour}" />`,
    ring: `<circle cx="7" cy="7" r="4.5" fill="none" stroke="${colour}" stroke-width="2.5" />`,
    square: `<rect x="2" y="2" width="10" height="10" rx="1.5" fill="${colour}" />`,
    triangle: `<polygon points="7,1.5 13,12.5 1,12.5" fill="${colour}" />`,
    diamond: `<polygon points="7,1 13,7 7,13 1,7" fill="${colour}" />`,
  };
  return `<svg class="zone-legend-shape-icon" width="14" height="14" viewBox="0 0 14 14">${shapes[icon] ?? ""}</svg>`;
}

function buildAssetTableRows(
  anchors: Zone["anchors"],
  startIndex: number,
): string {
  return anchors
    .map((a, i) => {
      const colour = ANCHOR_TYPE_COLOURS[a.type] ?? "#10b981";
      const passFail =
        a.result === "PASSED"
          ? `<span class="badge-pass">PASSED</span>`
          : a.result === "FAILED"
            ? `<span class="badge-fail">FAILED</span>`
            : `<span class="badge-na">—</span>`;
      return `<tr style="${(startIndex + i) % 2 === 0 ? "" : "background:#fafbfc;"}">
      <td class="zone-td">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${colour};flex-shrink:0;display:inline-block;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
          <strong>${esc(a.label)}</strong>
        </div>
      </td>
      <td class="zone-td">${esc(anchorTypeDisplayLabel(a))}</td>
      <td class="zone-td">${
        a.commissionDate
          ? esc(a.commissionDate)
          : `<span style="display:block;text-align:center;">-</span>`
      }</td>
      <td class="zone-td">${esc(a.inspectionDate || "")}</td>
      <td class="zone-td">${esc(a.nextInspection || "")}</td>
      <td class="zone-td">${passFail}</td>
    </tr>`;
    })
    .join("");
}

function buildZonePages(zone: Zone, assets: ReportAssets): string {
  // Map image + pin overlay
  const pinOverlays = zone.anchors
    .filter((a) => typeof a.x === "number" && typeof a.y === "number")
    .map((a) => {
      const colour = ANCHOR_TYPE_COLOURS[a.type] ?? "#10b981";
      return `<div class="zone-pin" style="left:${a.x}%;top:${a.y}%;">
        <span class="zone-pin-label" style="background:${colour};">${esc(a.label)}</span>
      </div>`;
    })
    .join("");

  // Static line cable path — every explicit connection between static-line
  // pins (chain or loop alike), drawn behind the pins. See
  // computeStaticLineEdges for how connections are determined.
  const staticLineEdges = computeStaticLineEdges(zone.anchors);
  const staticLineSvg =
    staticLineEdges.length > 0
      ? `<svg class="zone-line-overlay" viewBox="0 0 100 100" preserveAspectRatio="none">
          ${staticLineEdges
            .map(
              (edge) =>
                `<line x1="${edge.from.x}" y1="${edge.from.y}" x2="${edge.to.x}" y2="${edge.to.y}" stroke="${ANCHOR_TYPE_COLOURS["static-line"]}" stroke-width="0.5" vector-effect="non-scaling-stroke" stroke-linecap="round" />`,
            )
            .join("")}
        </svg>`
      : "";

  const mapBlock = zone.mapImageUrl
    ? `<div class="zone-map-wrap">
        <img class="zone-map-img" src="${esc(zone.mapImageUrl)}" alt="Zone aerial" />
        ${staticLineSvg}
        ${pinOverlays}
      </div>`
    : "";

  // Legend — same grouping logic the live editor and in-app report preview
  // use (buildLegendGroups), so all three always show the same rows.
  const legendGroups = buildLegendGroups(
    [...new Set(zone.anchors.map((a) => a.type))],
    zone.anchors,
  );
  const legendHTML =
    legendGroups.length > 0
      ? `<div class="zone-legend">
        ${legendGroups
          .map(
            (g) => `
          <div class="zone-legend-item">
            <span class="zone-legend-icon-slot">${legendIconHTML(g.icon, g.colour)}</span>
            <span class="zone-legend-label">${esc(g.label)}</span>
            <span class="zone-legend-count">${g.count}</span>
          </div>`,
          )
          .join("")}
      </div>`
      : "";

  // Stats banner
  const total = zone.anchors.length;
  const passed = zone.anchors.filter((a) => a.result === "PASSED").length;
  const failed = zone.anchors.filter((a) => a.result === "FAILED").length;
  const statsHTML =
    total > 0
      ? `<div class="zone-stats">
        <div class="zone-stat"><span class="zone-stat-val">${total}</span><span class="zone-stat-key">Total Assets</span></div>
        <div class="zone-stat-divider"></div>
        <div class="zone-stat"><span class="zone-stat-val zone-stat-pass">${passed}</span><span class="zone-stat-key">Passed</span></div>
        <div class="zone-stat-divider"></div>
        <div class="zone-stat"><span class="zone-stat-val${failed > 0 ? " zone-stat-fail" : ""}">${failed}</span><span class="zone-stat-key">Failed</span></div>
      </div>`
      : "";

  // Asset register — first page gets whatever fits alongside the map/
  // legend/stats; any remainder flows onto continuation pages that repeat
  // just the table header, so a long register never splits a row in half.
  const firstPageRowBudget = computeFirstPageRowBudget(
    !!zone.mapImageUrl,
    legendGroups.length,
    total > 0,
  );
  const firstPageAnchors = zone.anchors.slice(0, firstPageRowBudget);
  const remainingAnchors = zone.anchors.slice(firstPageRowBudget);

  const firstPageTable =
    total > 0
      ? `<div class="zone-register-label">Asset Register</div>
       <table class="zone-table">
         ${buildAssetTableHead()}
         <tbody>${buildAssetTableRows(firstPageAnchors, 0)}</tbody>
       </table>`
      : `<p style="font-size:0.85rem;color:#9ca3af;text-align:center;padding:2rem 0;">No anchors recorded for this zone.</p>`;

  const firstPage = `
<div class="page">
  <div class="top-bar">
    <span class="top-title">${esc(zone.name)}</span>
    <img src="${esc(assets.linkBlue)}" alt="rasvertex.com.au" class="top-link" />
  </div>
  <div class="zone-body">
    ${mapBlock}
    ${legendHTML}
    ${statsHTML}
    ${firstPageTable}
  </div>
  <div class="footer">${assocLogosHTML(assets)}</div>
</div>`;

  const continuationPages: string[] = [];
  for (let i = 0; i < remainingAnchors.length; i += ZONE_ROWS_CONTINUATION) {
    const chunk = remainingAnchors.slice(i, i + ZONE_ROWS_CONTINUATION);
    continuationPages.push(`
<div class="page">
  <div class="top-bar">
    <span class="top-title">${esc(zone.name)}</span>
    <img src="${esc(assets.linkBlue)}" alt="rasvertex.com.au" class="top-link" />
  </div>
  <div class="zone-body">
    <div class="zone-register-label">Asset Register (continued)</div>
    <table class="zone-table">
      ${buildAssetTableHead()}
      <tbody>${buildAssetTableRows(chunk, firstPageRowBudget + i)}</tbody>
    </table>
  </div>
  <div class="footer">${assocLogosHTML(assets)}</div>
</div>`);
  }

  return firstPage + continuationPages.join("");
}

function buildCertificationPage(
  job: AnchorReportData["job"],
  zones: Zone[],
  assets: ReportAssets,
): string {
  // Aggregate anchor types across all zones
  const typeMap = new Map<
    string,
    { label: string; qty: number; anyFail: boolean }
  >();
  for (const zone of zones) {
    for (const anchor of zone.anchors) {
      const existing = typeMap.get(anchor.type);
      if (existing) {
        existing.qty += 1;
        if (anchor.result === "FAILED") existing.anyFail = true;
      } else {
        typeMap.set(anchor.type, {
          label: ANCHOR_TYPE_LABELS[anchor.type],
          qty: 1,
          anyFail: anchor.result === "FAILED",
        });
      }
    }
  }

  const anchorTableRows = [...typeMap.entries()]
    .map(
      ([type, row]) => `
    <tr class="at-row">
      <td class="at-cell">${esc(row.label)}</td>
      <td class="at-cell">${row.qty}</td>
      <td class="at-cell">${ANCHOR_TYPE_IS_RATED[type as keyof typeof ANCHOR_TYPE_IS_RATED] ? "15kn" : "-"}</td>
      <td class="at-cell ${row.anyFail ? "at-fail" : "at-pass"}">${row.anyFail ? "Fail" : "Pass"}</td>
    </tr>`,
    )
    .join("");

  const anchorTable =
    typeMap.size > 0
      ? `<table class="at-table">
          <thead><tr>
            <th class="at-head">Anchor Type</th>
            <th class="at-head">QTY</th>
            <th class="at-head">Rating</th>
            <th class="at-head">Pass Or Fail</th>
          </tr></thead>
          <tbody>${anchorTableRows}</tbody>
        </table>`
      : "";

  const commentsHTML = job.certComments?.trim()
    ? esc(job.certComments).replace(/\n/g, "<br />")
    : "";

  return `
<div class="page">
  <div class="top-bar">
    <span class="top-title">Certification</span>
    <img src="${esc(assets.linkBlue)}" alt="rasvertex.com.au" class="top-link" />
  </div>
  <div class="cert-body">
    <div class="cert-heading">
      <span class="cert-heading-title">Certification of Test and Examination</span>
      <span class="cert-num">#${esc(job.certNumber)}</span>
    </div>

    <table class="cert-details">
      <tbody>
        <tr><td class="cert-lbl">Attention:</td><td class="cert-val">${esc(job.preparedFor)}</td></tr>
        <tr><td class="cert-lbl">Building Name:</td><td class="cert-val">${esc(job.buildingName)}</td></tr>
        <tr><td class="cert-lbl">Building Address:</td><td class="cert-val">${esc(job.address)}</td></tr>
        <tr><td class="cert-lbl">Inspection Date:</td><td class="cert-val">${esc(job.inspectionDate)}</td></tr>
        <tr><td class="cert-lbl">Next Inspection Date:</td><td class="cert-val">${esc(job.nextInspectionDate)}</td></tr>
        <tr><td class="cert-lbl">Authorised By:</td><td class="cert-val">${esc(job.authorisedBy)}</td></tr>
      </tbody>
    </table>

    <div>
      <p class="standards-intro">RAS-VERTEX have completed a height safety system inspection and applied hydraulic load testing to the required components as specified by:</p>
      <ul class="standards-list">
        <li>AS/NZS 4488.2:1997 Industrial rope access systems: Selection, use and maintenance</li>
        <li>AS/NZS 1891.4:2009 Industrial fall-arrest systems and devices: Selection, use and maintenance</li>
        <li>AS/NZS 1891.1:2007 Industrial fall-arrest systems and devices: Harnesses and equipment.</li>
      </ul>
    </div>

    ${anchorTable}

    ${
      commentsHTML
        ? `<div class="comments-block">
             <div class="comments-lbl">Comments</div>
             <div class="comments-box">${commentsHTML}</div>
           </div>`
        : ""
    }
  </div>
  <div class="footer">${assocLogosHTML(assets)}</div>
</div>`;
}

function buildSummaryPage(assets: ReportAssets): string {
  return `
<div class="page">
  <div class="top-bar">
    <span class="top-title">Summary</span>
    <img src="${esc(assets.linkBlue)}" alt="rasvertex.com.au" class="top-link" />
  </div>
  <div class="summary-body">
    <p class="summary-para">Hydraulic load testing equipment holds valid calibration and service certification.</p>
    <p class="summary-para">Height safety systems are for the use of competent persons only. For limitations and conditions, users must refer to the installer&apos;s user manual.</p>
    <p class="summary-para">All height safety systems require annual recertification of hardware items and semiannual recertification of synthetic material equipment, e.g. harnesses and impact absorbers, as specified in the above standards.</p>
    <p class="summary-para">Please note that RAS-VERTEX attaches coloured test tags to all anchor points identifying the type and intended use of each anchor point.</p>

    <div class="signoff">
      <p class="sincerely">Sincerely,</p>
      <img src="${esc(assets.signature)}" alt="Phil Clark signature" class="sig-img" />
      <p class="sig-name">Phil Clark</p>
      <p class="sig-title">Director</p>
    </div>
  </div>
  <div class="footer">${assocLogosHTML(assets)}</div>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildAnchorPrintHTML(
  report: AnchorReportData,
  assets?: ReportAssets,
): string {
  const a = assets ?? DEFAULT_PRINT_ASSETS;
  const coverPage = buildCoverPage(report.job, a);
  const zonePages = report.zones.map((z) => buildZonePages(z, a)).join("\n");
  const certPage = buildCertificationPage(report.job, report.zones, a);
  const photoPages = report.photoSettings?.enabled
    ? buildPhotoPagesHTML(report)
    : "";
  const summaryPage = buildSummaryPage(a);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(report.job.reportType || "Anchor Inspection Report")}</title>
  <style>${buildPrintFontFaceCSS(a)}</style>
  <style>${PRINT_STYLES}</style>
</head>
<body>
${coverPage}
${zonePages}
${certPage}
${photoPages}
${summaryPage}
</body>
</html>`;
}
