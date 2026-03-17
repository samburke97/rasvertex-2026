// lib/reports/anchor.print.ts
//
// Self-contained print/PDF HTML builder for the Anchor Inspection Report.
// Mirrors the React components exactly so output is WYSIWYG.
// Browser path: window.open + print()
// Server path (future): Puppeteer with base64 assets

import type { AnchorReportData, Zone } from "./anchor.types";
import { ANCHOR_TYPE_LABELS, ANCHOR_TYPE_COLOURS } from "./anchor.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str: string | number | null | undefined): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Static assets ─────────────────────────────────────────────────────────────

const ASSETS = {
  rasLogo: "/reports/ras-logo.png",
  linkWhite: "/reports/link_white.png",
  linkBlue: "/reports/link_blue.png",
  signature: "/reports/signature.png",
  associations: [
    {
      src: "/reports/associations/communityselect.png",
      alt: "Community Select",
    },
    { src: "/reports/associations/dulux.png", alt: "Dulux" },
    { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
    { src: "/reports/associations/mpa.png", alt: "MPA" },
    { src: "/reports/associations/qbcc.png", alt: "QBCC" },
    { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
  ],
};

const assocHTML = ASSETS.associations
  .map(
    (a) => `<img src="${esc(a.src)}" alt="${esc(a.alt)}" class="assoc-logo" />`,
  )
  .join("");

// ── Shared print CSS ──────────────────────────────────────────────────────────

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    font-family: 'Inter', Arial, sans-serif;
    font-weight: 300;
    background: white;
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
    color: #0d1c45;
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
  .assoc-logo {
    height: 36px;
    width: auto;
    max-width: 80px;
    object-fit: contain;
    display: block;
    opacity: 0.85;
  }

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
    background: #0d1c45;
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
    color: #0d1c45;
    line-height: 1.05;
    text-transform: uppercase;
    margin-bottom: 1.25rem;
  }
  .cover-meta-wrap { padding-bottom: 2rem; }
  .cover-meta { border-collapse: collapse; width: 1px; }
  .cover-lbl {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.05rem;
    letter-spacing: 0.08em;
    line-height: 1;
    color: #0d1c45;
    padding: 0.4rem 1.25rem 0.4rem 0;
    white-space: nowrap;
    vertical-align: middle;
  }
  .cover-val {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 300;
    color: #333;
    padding: 0.4rem 0;
    vertical-align: middle;
    white-space: nowrap;
  }

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
  .zone-pin {
    position: absolute;
    transform: translate(-50%, -100%);
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
    box-shadow: 0 1px 4px rgba(0,0,0,0.35);
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
  /* ── Zone legend ── */
  .zone-legend {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding: 0.75rem 1rem;
    background: #f8fafc;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
  }
  .zone-legend-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
  .zone-legend-label {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.78rem;
    font-weight: 400;
    color: #374151;
    flex: 1;
  }
  .zone-legend-count {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.78rem;
    font-weight: 400;
    color: #6b7280;
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
    color: #0d1c45;
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
    color: #0d1c45;
    line-height: 1;
  }
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
    color: #0d1c45;
  }
  .cert-details { width: 100%; border-collapse: collapse; }
  .cert-lbl {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #0d1c45;
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
    color: #0d1c45;
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
    color: #0d1c45;
    text-transform: uppercase;
    line-height: 1;
  }
`;

// ── Page builders ─────────────────────────────────────────────────────────────

function buildCoverPage(job: AnchorReportData["job"]): string {
  const coverPhotoLayer = job.coverPhoto
    ? `<div class="cover-hero-photo" style="background-image:url('${esc(job.coverPhoto)}')"></div>`
    : "";

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
    <div class="cover-logo"><img src="${ASSETS.rasLogo}" alt="RAS Vertex" /></div>
    <div class="cover-web"><img src="${ASSETS.linkWhite}" alt="rasvertex.com.au" /></div>
  </div>
  <div class="cover-body">
    <div class="cover-title-group">
      <div class="cover-report-title">${esc(job.reportType)}</div>
    </div>
    <div class="cover-meta-wrap">
      <table class="cover-meta"><tbody>${metaRows}</tbody></table>
    </div>
    <div class="footer" style="margin-top:0;">${assocHTML}</div>
  </div>
</div>`;
}

function buildZonePage(zone: Zone): string {
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

  const mapBlock = zone.mapImageUrl
    ? `<div class="zone-map-wrap">
        <img class="zone-map-img" src="${esc(zone.mapImageUrl)}" alt="Zone aerial" />
        ${pinOverlays}
      </div>`
    : "";

  // Type legend — deduplicated, one row per type present
  const typesSeen = new Map<
    string,
    { colour: string; label: string; total: number; passed: number }
  >();
  for (const a of zone.anchors) {
    const colour = ANCHOR_TYPE_COLOURS[a.type] ?? "#10b981";
    const label = ANCHOR_TYPE_LABELS[a.type] ?? a.type;
    const existing = typesSeen.get(a.type);
    if (existing) {
      existing.total++;
      if (a.result === "PASSED") existing.passed++;
    } else {
      typesSeen.set(a.type, {
        colour,
        label,
        total: 1,
        passed: a.result === "PASSED" ? 1 : 0,
      });
    }
  }
  const legendHTML =
    typesSeen.size > 0
      ? `<div class="zone-legend">
        ${[...typesSeen.values()]
          .map(
            (t) => `
          <div class="zone-legend-item">
            <span class="zone-legend-dot" style="background:${t.colour};"></span>
            <span class="zone-legend-label">${esc(t.label)}</span>
            <span class="zone-legend-count">${t.passed}/${t.total}</span>
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

  // Asset register table
  const assetRows = zone.anchors
    .map((a, i) => {
      const colour = ANCHOR_TYPE_COLOURS[a.type] ?? "#10b981";
      const passFail =
        a.result === "PASSED"
          ? `<span class="badge-pass">PASSED</span>`
          : a.result === "FAILED"
            ? `<span class="badge-fail">FAILED</span>`
            : `<span class="badge-na">—</span>`;
      return `<tr style="${i % 2 === 0 ? "" : "background:#fafbfc;"}">
      <td class="zone-td">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="width:8px;height:8px;border-radius:50%;background:${colour};flex-shrink:0;display:inline-block;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></span>
          <strong>${esc(a.label)}</strong>
        </div>
      </td>
      <td class="zone-td">${esc(ANCHOR_TYPE_LABELS[a.type])}</td>
      <td class="zone-td">${esc(a.model ?? "—")}</td>
      <td class="zone-td">${esc(a.manufacturer ?? "—")}</td>
      <td class="zone-td">${esc(a.inspectionDate || "")}</td>
      <td class="zone-td">${esc(a.nextInspection || "")}</td>
      <td class="zone-td">${passFail}</td>
    </tr>`;
    })
    .join("");

  const assetTable =
    total > 0
      ? `<div class="zone-register-label">Asset Register</div>
       <table class="zone-table">
         <thead><tr>
           <th class="zone-th">Asset No.</th>
           <th class="zone-th">Description</th>
           <th class="zone-th">Model</th>
           <th class="zone-th">Manufacturer</th>
           <th class="zone-th">Inspection</th>
           <th class="zone-th">Next Inspection</th>
           <th class="zone-th">Pass/Fail</th>
         </tr></thead>
         <tbody>${assetRows}</tbody>
       </table>`
      : `<p style="font-size:0.85rem;color:#9ca3af;text-align:center;padding:2rem 0;">No anchors recorded for this zone.</p>`;

  return `
<div class="page">
  <div class="top-bar">
    <span class="top-title">${esc(zone.name)}</span>
    <img src="${ASSETS.linkBlue}" alt="rasvertex.com.au" class="top-link" />
  </div>
  <div class="zone-body">
    ${mapBlock}
    ${legendHTML}
    ${statsHTML}
    ${assetTable}
  </div>
  <div class="footer">${assocHTML}</div>
</div>`;
}

function buildCertificationPage(
  job: AnchorReportData["job"],
  zones: Zone[],
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

  const anchorTableRows = [...typeMap.values()]
    .map(
      (row) => `
    <tr class="at-row">
      <td class="at-cell">${esc(row.label)}</td>
      <td class="at-cell">${row.qty}</td>
      <td class="at-cell">15kn</td>
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

  return `
<div class="page">
  <div class="top-bar">
    <span class="top-title">Certification</span>
    <img src="${ASSETS.linkBlue}" alt="rasvertex.com.au" class="top-link" />
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
  </div>
  <div class="footer">${assocHTML}</div>
</div>`;
}

function buildSummaryPage(): string {
  return `
<div class="page">
  <div class="top-bar">
    <span class="top-title">Summary</span>
    <img src="${ASSETS.linkBlue}" alt="rasvertex.com.au" class="top-link" />
  </div>
  <div class="summary-body">
    <p class="summary-para">Hydraulic load testing equipment holds valid calibration and service certification.</p>
    <p class="summary-para">Height safety systems are for the use of competent persons only. For limitations and conditions, users must refer to the installer&apos;s user manual.</p>
    <p class="summary-para">All height safety systems require annual recertification of hardware items and semiannual recertification of synthetic material equipment, e.g. harnesses and impact absorbers, as specified in the above standards.</p>
    <p class="summary-para">Please note that RAS-VERTEX attaches coloured test tags to all anchor points identifying the type and intended use of each anchor point.</p>

    <div class="signoff">
      <p class="sincerely">Sincerely,</p>
      <img src="${ASSETS.signature}" alt="Phil Clark signature" class="sig-img" />
      <p class="sig-name">Phil Clark</p>
      <p class="sig-title">Director</p>
    </div>
  </div>
  <div class="footer">${assocHTML}</div>
</div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildAnchorPrintHTML(report: AnchorReportData): string {
  const coverPage = buildCoverPage(report.job);
  const zonePages = report.zones.map(buildZonePage).join("\n");
  const certPage = buildCertificationPage(report.job, report.zones);
  const summaryPage = buildSummaryPage();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <base href="${typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}" />
  <title>${esc(report.job.reportType || "Anchor Inspection Report")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;600&display=swap" rel="stylesheet" />
  <style>${PRINT_STYLES}</style>
</head>
<body>
${coverPage}
${zonePages}
${certPage}
${summaryPage}
</body>
</html>`;
}
