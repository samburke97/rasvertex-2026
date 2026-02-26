// lib/reports/works-agreement/pdf.ts
// Generates a print-ready HTML document for the Works Agreement cover sheet
// (Items 1–8 only — no T&Cs). Uses window.open + print() same as condition report.

import type { WorksAgreementData } from "./types";

function esc(str: string | number): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  }).format(value);
}

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 10pt;
    color: #1a1a1a;
    background: white;
  }

  /* ── Cover Page ── */
  .cover {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    position: relative;
    display: flex;
    flex-direction: column;
    page-break-after: always;
  }

  /* Hero image header */
  .cover-hero {
    background: linear-gradient(160deg, #0d1f3c 0%, #1a3a6e 60%, #2a5298 100%);
    height: 72mm;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: 0 14mm 8mm 14mm;
  }

  .cover-hero::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 18mm;
    background: white;
    clip-path: polygon(0 60%, 100% 0, 100% 100%, 0 100%);
  }

  .cover-logo-wrap {
    position: relative;
    z-index: 2;
  }

  .cover-logo-ras {
    font-size: 28pt;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: white;
  }

  .cover-logo-ras span {
    color: #74db89;
  }

  .cover-logo-sub {
    font-size: 7.5pt;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.75);
    margin-top: 2px;
  }

  .cover-creds {
    position: absolute;
    top: 12mm;
    right: 14mm;
    z-index: 2;
    text-align: right;
  }

  .cover-creds p {
    font-size: 8pt;
    color: rgba(255,255,255,0.85);
    line-height: 1.7;
  }

  .cover-creds span {
    font-weight: 700;
    color: white;
  }

  /* Content area */
  .cover-content {
    flex: 1;
    padding: 8mm 14mm 10mm;
  }

  .cover-title {
    font-size: 17pt;
    font-weight: 800;
    color: #0d1f3c;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 2mm;
  }

  .cover-intro {
    font-size: 9pt;
    color: #555;
    margin-bottom: 8mm;
    line-height: 1.6;
  }

  /* Address block */
  .address-block {
    margin-bottom: 7mm;
  }

  .address-block p {
    font-size: 9.5pt;
    line-height: 1.7;
    color: #1a1a1a;
  }

  .address-block strong {
    font-weight: 600;
  }

  /* ── Schedule heading ── */
  .schedule-heading {
    font-size: 13pt;
    font-weight: 700;
    color: #0d1f3c;
    margin-bottom: 5mm;
    padding-bottom: 2.5mm;
    border-bottom: 2px solid #0d1f3c;
  }

  .schedule-intro {
    font-size: 9pt;
    color: #444;
    margin-bottom: 6mm;
    line-height: 1.55;
  }

  /* ── Tables ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 5mm;
  }

  th, td {
    border: 1px solid #d0d0d0;
    padding: 3mm 4mm;
    font-size: 9pt;
    vertical-align: top;
  }

  thead th {
    background: #f0f4f8;
    font-weight: 700;
    font-size: 8.5pt;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #0d1f3c;
    text-align: left;
  }

  .row-label {
    font-weight: 600;
    color: #0d1f3c;
    width: 52mm;
    background: #fafafa;
  }

  .row-value {
    color: #222;
    line-height: 1.55;
  }

  /* Payment table */
  .payment-table td:nth-child(2) {
    text-align: center;
    width: 18mm;
  }

  .payment-table td:nth-child(3) {
    text-align: right;
    font-weight: 600;
    width: 28mm;
    color: #0d1f3c;
  }

  .payment-table td:nth-child(4) {
    color: #555;
    font-size: 8.5pt;
  }

  /* Total row */
  .total-row td {
    background: #0d1f3c;
    color: white;
    font-weight: 700;
    font-size: 10pt;
  }

  .total-row td:nth-child(2) {
    text-align: right;
    font-size: 11pt;
    letter-spacing: 0.02em;
  }

  /* Site table */
  .site-table th:nth-child(1) { width: 40mm; }
  .site-table th:nth-child(2) { width: auto; }
  .site-table th:nth-child(3) { width: 30mm; }

  /* ── Footer ── */
  .cover-footer {
    padding: 5mm 14mm;
    border-top: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 3mm;
    page-break-inside: avoid;
  }

  .footer-logo {
    font-size: 9pt;
    font-weight: 700;
    color: #0d1f3c;
    letter-spacing: 0.05em;
  }

  .footer-partners {
    font-size: 7.5pt;
    color: #9ca3af;
    text-align: right;
  }

  /* ── Watermark for DRAFT ── */
  .draft-stamp {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%) rotate(-35deg);
    font-size: 64pt;
    font-weight: 900;
    color: rgba(0, 0, 0, 0.04);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    pointer-events: none;
    z-index: 0;
  }

  .content-wrap {
    position: relative;
    z-index: 1;
  }

  @media print {
    body { margin: 0; }
    .cover { page-break-after: always; }
    .draft-stamp { color: rgba(0,0,0,0.05); }
  }
`;

export function buildWorksAgreementHTML(data: WorksAgreementData): string {
  const isDraft = data.status === "draft";

  const siteTableRow = `
    <tr>
      <td>${esc(data.siteName)}</td>
      <td>${esc(data.siteAddress)}</td>
      <td>${esc(data.date)}</td>
    </tr>
  `;

  const detailRows = [
    { label: "1. Date", value: esc(data.date) },
    { label: "2. Client", value: esc(data.clientName) },
    {
      label: "3. Contractor",
      value:
        "Rope Access Services Pty Ltd trading as RAS-VERTEX<br>Unit 1, 1–3 Kessling Avenue, Kunda Park, QLD, 4556",
    },
    { label: "4. Site Address", value: esc(data.siteAddress) },
    {
      label: "5. Initial Works",
      value: esc(data.initialWorks).replace(/\n/g, "<br>") || "&nbsp;",
    },
    { label: "6. Colour Scheme", value: esc(data.colourScheme) || "&nbsp;" },
  ]
    .map(
      (r) => `
      <tr>
        <td class="row-label">${r.label}</td>
        <td class="row-value">${r.value}</td>
      </tr>`,
    )
    .join("");

  const paymentRows = data.paymentSchedule
    .map(
      (p) => `
      <tr>
        <td>${esc(p.label)}</td>
        <td>${p.percentage}%</td>
        <td>${formatCurrency(p.value)}</td>
        <td>${esc(p.description)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Works Agreement — ${esc(data.jobName)}</title>
  <style>${STYLES}</style>
</head>
<body>

${isDraft ? '<div class="draft-stamp">DRAFT</div>' : ""}

<div class="cover content-wrap">

  <!-- ── Hero Header ─────────────────────────────────── -->
  <div class="cover-hero">
    <div class="cover-creds">
      <p>QBCC: <span>1307234</span></p>
      <p>ABN: <span>53 167 652 637</span></p>
    </div>
    <div class="cover-logo-wrap">
      <div class="cover-logo-ras">RAS<span>|VERTEX</span></div>
      <div class="cover-logo-sub">Maintenance Solutions · Sunshine Coast</div>
    </div>
  </div>

  <!-- ── Content ─────────────────────────────────────── -->
  <div class="cover-content">

    <!-- Address block (top-left of first page) -->
    <div class="address-block">
      <p><strong>${esc(data.clientName)}</strong></p>
      <p>${esc(data.siteAddress)}</p>
    </div>

    <!-- Schedule heading -->
    <div class="schedule-heading">
      Schedule for Works Agreement Job ${esc(data.jobNo)}
    </div>

    <p class="schedule-intro">
      This agreement outlines <strong>${esc(data.jobName)}</strong>
      to <strong>${esc(data.siteAddress)}</strong>
      following Job ${esc(data.jobNo)}.
    </p>

    <!-- Site table -->
    <table class="site-table">
      <thead>
        <tr>
          <th>Site</th>
          <th>Site Address</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        ${siteTableRow}
      </tbody>
    </table>

    <!-- Detail rows (items 1–6) -->
    <table>
      <tbody>
        ${detailRows}
      </tbody>
    </table>

    <!-- Payment schedule (item 7) -->
    <table class="payment-table">
      <thead>
        <tr>
          <th>7. Payment Schedule</th>
          <th>%</th>
          <th>Value</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${paymentRows}
      </tbody>
    </table>

    <!-- Total (item 8) -->
    <table>
      <tbody>
        <tr class="total-row">
          <td>8. Total Price Inc GST</td>
          <td>${formatCurrency(data.totalIncGst)}</td>
        </tr>
      </tbody>
    </table>

  </div>

  <!-- ── Footer ──────────────────────────────────────── -->
  <div class="cover-footer">
    <div class="footer-logo">RAS-VERTEX · rasvertex.com.au</div>
    <div class="footer-partners">Smart Strata · Ebix · Trades Monitor · Pegasus · Haymes Paint</div>
  </div>

</div>

</body>
</html>`;
}
