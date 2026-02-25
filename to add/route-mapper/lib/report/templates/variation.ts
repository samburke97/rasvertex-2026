// lib/report/templates/variation.ts
// HTML template for the Variation Report.
// This is pure HTML/CSS — edit this file to control exactly what prints.
// Puppeteer renders this with full Chrome so any valid CSS works.

import { formatDateHeading } from "../exif";

export interface ReportPhoto {
  id: string;
  name: string;
  base64: string;
  mimeType: string;
  displayDate: Date | null;
  dateSource: "exif" | "simproDateAdded" | "unknown";
}

export interface ReportData {
  // Cover page fields — all editable in the wizard
  preparedFor: string;
  preparedBy: string;
  projectTitle: string;
  address: string;
  reportDate: string; // formatted display string e.g. "25 February 2026"
  reportType: "variation" | "inspection" | "completion";

  // Hero image as base64 data URL (embedded so Puppeteer doesn't need network)
  heroImageDataUrl: string | null;

  // Photos — already sorted/grouped by the wizard
  photos: ReportPhoto[];
  groupByDate: boolean;

  // Summary page
  comments: string;
  recommendations: string;

  // Company details (static)
  qbcc?: string;
  abn?: string;
}

const REPORT_LABELS: Record<ReportData["reportType"], string> = {
  variation: "Variation Report",
  inspection: "Inspection Report",
  completion: "Completion Report",
};

const BRAND = {
  navy: "#0a1628",
  navyMid: "#122040",
  blue: "#1a3a6b",
  accent: "#2563eb",
  qbcc: "1307234",
  abn: "53 167 652 637",
};

function coverPage(data: ReportData): string {
  const heroStyle = data.heroImageDataUrl
    ? `background-image: url('${data.heroImageDataUrl}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(160deg, ${BRAND.navy} 0%, ${BRAND.blue} 60%, #1e4080 100%);`;

  const reportLabel = REPORT_LABELS[data.reportType];
  const jobName = data.projectTitle.toLowerCase().replace(/\s+/g, "-");

  return `
    <div class="page cover-page">
      <!-- Hero background -->
      <div class="hero" style="${heroStyle}">
        <div class="hero-overlay"></div>

        <!-- Logo top-left -->
        <div class="logo-area">
          <div class="logo-lockup">
            <div class="logo-icon">
              <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
                <rect width="40" height="40" rx="4" fill="white" fill-opacity="0.15"/>
                <path d="M8 28L20 12L32 28" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M14 28L20 20L26 28" stroke="#60a5fa" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="logo-text">
              <span class="logo-ras">RAS</span><span class="logo-vertex"> VERTEX</span>
              <div class="logo-sub">MAINTENANCE SOLUTIONS</div>
              <div class="logo-sub logo-region">SUNSHINE COAST</div>
            </div>
          </div>
          <div class="logo-url">rasvertex.com.au</div>
        </div>

        <!-- Credentials bottom-right of hero -->
        <div class="credentials">
          <div class="cred-line"><span class="cred-label">QBCC:</span> ${data.qbcc || BRAND.qbcc}</div>
          <div class="cred-line"><span class="cred-label">ABN:</span> ${data.abn || BRAND.abn}</div>
        </div>
      </div>

      <!-- Report title band -->
      <div class="title-band">
        <h1 class="report-title">${jobName} - ${reportLabel.toLowerCase()}</h1>
        <p class="report-subtitle">
          This report documents changes to the original ${data.projectTitle} scope,
          including repair work and scope adjustments.
        </p>

        <div class="meta-grid">
          <div class="meta-row">
            <span class="meta-label">PREPARED FOR:</span>
            <span class="meta-value">${data.preparedFor}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">PREPARED BY:</span>
            <span class="meta-value">${data.preparedBy}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">ADDRESS:</span>
            <span class="meta-value">${data.address}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">PROJECT:</span>
            <span class="meta-value">${data.projectTitle}</span>
          </div>
          <div class="meta-row">
            <span class="meta-label">DATE:</span>
            <span class="meta-value">${data.reportDate}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

function photoPages(data: ReportData): string {
  const { photos, groupByDate } = data;
  if (photos.length === 0) return "";

  const pages: string[] = [];

  if (groupByDate) {
    // Group by date — insert a date heading before each group
    const groups = new Map<string, ReportPhoto[]>();
    for (const photo of photos) {
      const key = photo.displayDate
        ? photo.displayDate.toISOString().slice(0, 10)
        : "undated";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(photo);
    }

    // Sort groups chronologically, undated last
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      if (a === "undated") return 1;
      if (b === "undated") return -1;
      return a.localeCompare(b);
    });

    for (const key of sortedKeys) {
      const group = groups.get(key)!;
      const heading =
        key === "undated"
          ? "Undated"
          : formatDateHeading(new Date(key + "T12:00:00"));

      // Split group into pages of 12 photos (3×4 grid)
      const chunks = chunkArray(group, 12);
      chunks.forEach((chunk, i) => {
        pages.push(photoPage(chunk, i === 0 ? heading : null));
      });
    }
  } else {
    // No grouping — straight 3×4 pages
    const chunks = chunkArray(photos, 12);
    chunks.forEach((chunk) => pages.push(photoPage(chunk, null)));
  }

  return pages.join("\n");
}

function photoPage(photos: ReportPhoto[], heading: string | null): string {
  const photoItems = photos
    .map(
      (p, i) => `
      <div class="photo-item">
        <div class="photo-container">
          <img src="data:${p.mimeType};base64,${p.base64}" alt="${escHtml(p.name)}" loading="eager" />
          <div class="photo-number">${i + 1}</div>
        </div>
        <div class="photo-caption">${escHtml(p.name.replace(/\.[^/.]+$/, ""))}</div>
      </div>
    `,
    )
    .join("");

  return `
    <div class="page photo-page">
      ${heading ? `<div class="date-heading">${escHtml(heading)}</div>` : ""}
      <div class="photo-grid">
        ${photoItems}
      </div>
    </div>
  `;
}

function summaryPage(data: ReportData): string {
  return `
    <div class="page summary-page">
      <div class="summary-hero">
        <h2 class="summary-title">SUMMARY</h2>
      </div>

      <div class="summary-content">
        <div class="summary-section">
          <h3 class="summary-label">COMMENTS:</h3>
          <p class="summary-text">${escHtml(data.comments || "General maintenance requirements")}</p>
        </div>

        <div class="summary-section">
          <h3 class="summary-label">RECOMMENDATIONS:</h3>
          <p class="summary-text">${escHtml(data.recommendations || "")}</p>
        </div>
      </div>

      <div class="summary-footer">
        <div class="footer-logos">
          <span class="footer-logo-text">Smart Strata</span>
          <span class="footer-logo-text">EBIX | TRADES MONITOR</span>
          <span class="footer-logo-text">Pegasus</span>
          <span class="footer-logo-text">Community SELECT</span>
          <span class="footer-logo-text">Haymes PAINT</span>
        </div>
      </div>
    </div>
  `;
}

export function buildVariationReportHtml(data: ReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escHtml(data.projectTitle)} — ${REPORT_LABELS[data.reportType]}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700;800&family=Barlow+Condensed:wght@600;700;800&display=swap');

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Barlow', sans-serif;
      font-weight: 300;
      background: white;
      color: #1a1a2e;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* ─── PAGE LAYOUT ─────────────────────────────── */
    .page {
      width: 210mm;
      min-height: 297mm;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }

    .page:last-child { page-break-after: avoid; }

    /* ─── COVER PAGE ──────────────────────────────── */
    .cover-page { display: flex; flex-direction: column; }

    .hero {
      position: relative;
      height: 185mm;
      flex-shrink: 0;
    }

    .hero-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(
        to bottom,
        rgba(10,22,40,0.4) 0%,
        rgba(10,22,40,0.2) 40%,
        rgba(10,22,40,0.7) 100%
      );
    }

    .logo-area {
      position: absolute;
      top: 20px;
      left: 24px;
      right: 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .logo-lockup { display: flex; align-items: center; gap: 10px; }

    .logo-icon { flex-shrink: 0; }

    .logo-text { color: white; }

    .logo-ras {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 1px;
      color: white;
    }

    .logo-vertex {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 22px;
      font-weight: 300;
      letter-spacing: 2px;
      color: white;
    }

    .logo-sub {
      font-size: 7px;
      font-weight: 500;
      letter-spacing: 2.5px;
      color: rgba(255,255,255,0.8);
      text-transform: uppercase;
      margin-top: 1px;
    }

    .logo-url {
      color: rgba(255,255,255,0.85);
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.5px;
    }

    .credentials {
      position: absolute;
      bottom: 20px;
      right: 24px;
      text-align: right;
    }

    .cred-line {
      color: rgba(255,255,255,0.9);
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0.5px;
      line-height: 1.6;
    }

    .cred-label {
      font-weight: 700;
      color: white;
    }

    /* ─── TITLE BAND ──────────────────────────────── */
    .title-band {
      background: white;
      padding: 28px 32px 32px;
      flex: 1;
    }

    .report-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 32px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${BRAND.navy};
      margin-bottom: 10px;
      line-height: 1.1;
    }

    .report-subtitle {
      font-size: 11px;
      font-weight: 300;
      color: #6b7280;
      margin-bottom: 24px;
      line-height: 1.6;
      max-width: 420px;
    }

    .meta-grid { display: flex; flex-direction: column; gap: 6px; }

    .meta-row { display: flex; gap: 16px; align-items: baseline; }

    .meta-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: ${BRAND.navy};
      min-width: 120px;
      flex-shrink: 0;
    }

    .meta-value {
      font-size: 12px;
      font-weight: 400;
      color: #374151;
    }

    /* ─── PHOTO PAGES ─────────────────────────────── */
    .photo-page {
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .date-heading {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 16px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 2px;
      color: ${BRAND.navy};
      border-bottom: 2px solid ${BRAND.accent};
      padding-bottom: 6px;
      margin-bottom: 4px;
    }

    .photo-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      flex: 1;
    }

    .photo-item { display: flex; flex-direction: column; gap: 4px; }

    .photo-container {
      position: relative;
      aspect-ratio: 1;
      background: #f3f4f6;
      border-radius: 4px;
      overflow: hidden;
    }

    .photo-container img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .photo-number {
      position: absolute;
      bottom: 6px;
      right: 6px;
      background: rgba(10,22,40,0.75);
      color: white;
      font-size: 9px;
      font-weight: 600;
      width: 18px;
      height: 18px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .photo-caption {
      background: #f3f4f6;
      border-radius: 3px;
      padding: 4px 8px;
      font-size: 9px;
      font-weight: 400;
      color: #374151;
      text-align: center;
      line-height: 1.3;
    }

    /* ─── SUMMARY PAGE ────────────────────────────── */
    .summary-page {
      display: flex;
      flex-direction: column;
    }

    .summary-hero {
      background: ${BRAND.navy};
      padding: 40px 40px 32px;
      position: relative;
      overflow: hidden;
    }

    .summary-hero::after {
      content: '';
      position: absolute;
      right: -40px;
      top: -40px;
      width: 200px;
      height: 200px;
      background: rgba(37,99,235,0.15);
      border-radius: 50%;
    }

    .summary-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 48px;
      font-weight: 800;
      color: white;
      letter-spacing: 3px;
      position: relative;
      z-index: 1;
    }

    .summary-content {
      padding: 40px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 36px;
    }

    .summary-section { display: flex; flex-direction: column; gap: 10px; }

    .summary-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 2px;
      color: ${BRAND.navy};
      text-transform: uppercase;
    }

    .summary-text {
      font-size: 12px;
      font-weight: 300;
      color: #6b7280;
      line-height: 1.7;
    }

    .summary-footer {
      border-top: 1px solid #e5e7eb;
      padding: 20px 40px;
    }

    .footer-logos {
      display: flex;
      align-items: center;
      gap: 24px;
      flex-wrap: wrap;
    }

    .footer-logo-text {
      font-size: 9px;
      font-weight: 600;
      color: #9ca3af;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }

    /* ─── PRINT ───────────────────────────────────── */
    @page {
      size: A4;
      margin: 0;
    }
  </style>
</head>
<body>
  ${coverPage(data)}
  ${photoPages(data)}
  ${summaryPage(data)}
</body>
</html>`;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
