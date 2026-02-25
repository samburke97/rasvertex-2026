// lib/report/templates/inspection.ts
// Inspection Report template — same structure as variation but visually distinct.
// Green accent, slightly different cover layout.

import { formatDateHeading } from "../exif";
import type { ReportData, ReportPhoto } from "./variation";

export { ReportData, ReportPhoto };

const BRAND = {
  navy: "#0a1628",
  green: "#065f46",
  greenLight: "#10b981",
  qbcc: "1307234",
  abn: "53 167 652 637",
};

function coverPage(data: ReportData): string {
  const heroStyle = data.heroImageDataUrl
    ? `background-image: url('${data.heroImageDataUrl}'); background-size: cover; background-position: center;`
    : `background: linear-gradient(160deg, #0a1628 0%, #064e3b 60%, #065f46 100%);`;

  return `
    <div class="page cover-page">
      <div class="hero" style="${heroStyle}">
        <div class="hero-overlay"></div>
        <div class="logo-area">
          <div class="logo-lockup">
            <div class="logo-text">
              <span class="logo-ras">RAS</span><span class="logo-vertex"> VERTEX</span>
              <div class="logo-sub">MAINTENANCE SOLUTIONS — SUNSHINE COAST</div>
            </div>
          </div>
          <div class="logo-url">rasvertex.com.au</div>
        </div>
        <div class="credentials">
          <div class="cred-line"><span class="cred-label">QBCC:</span> ${data.qbcc || BRAND.qbcc}</div>
          <div class="cred-line"><span class="cred-label">ABN:</span> ${data.abn || BRAND.abn}</div>
        </div>
      </div>

      <div class="title-band">
        <div class="report-type-badge">INSPECTION REPORT</div>
        <h1 class="report-title">${escHtml(data.projectTitle)}</h1>
        <p class="report-subtitle">
          This report documents the inspection findings for ${escHtml(data.projectTitle)},
          including observations and recommendations.
        </p>
        <div class="meta-grid">
          <div class="meta-row"><span class="meta-label">PREPARED FOR:</span><span class="meta-value">${escHtml(data.preparedFor)}</span></div>
          <div class="meta-row"><span class="meta-label">PREPARED BY:</span><span class="meta-value">${escHtml(data.preparedBy)}</span></div>
          <div class="meta-row"><span class="meta-label">ADDRESS:</span><span class="meta-value">${escHtml(data.address)}</span></div>
          <div class="meta-row"><span class="meta-label">DATE:</span><span class="meta-value">${escHtml(data.reportDate)}</span></div>
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
    const groups = new Map<string, ReportPhoto[]>();
    for (const photo of photos) {
      const key = photo.displayDate
        ? photo.displayDate.toISOString().slice(0, 10)
        : "undated";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(photo);
    }
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
      chunkArray(group, 12).forEach((chunk, i) =>
        pages.push(photoPage(chunk, i === 0 ? heading : null)),
      );
    }
  } else {
    chunkArray(photos, 12).forEach((chunk) =>
      pages.push(photoPage(chunk, null)),
    );
  }

  return pages.join("\n");
}

function photoPage(photos: ReportPhoto[], heading: string | null): string {
  const items = photos
    .map(
      (p, i) => `
    <div class="photo-item">
      <div class="photo-container">
        <img src="data:${p.mimeType};base64,${p.base64}" alt="${escHtml(p.name)}" />
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
      <div class="photo-grid">${items}</div>
    </div>
  `;
}

function summaryPage(data: ReportData): string {
  return `
    <div class="page summary-page">
      <div class="summary-hero">
        <h2 class="summary-title">FINDINGS</h2>
      </div>
      <div class="summary-content">
        <div class="summary-section">
          <h3 class="summary-label">OBSERVATIONS:</h3>
          <p class="summary-text">${escHtml(data.comments || "")}</p>
        </div>
        <div class="summary-section">
          <h3 class="summary-label">RECOMMENDATIONS:</h3>
          <p class="summary-text">${escHtml(data.recommendations || "")}</p>
        </div>
      </div>
    </div>
  `;
}

export function buildInspectionReportHtml(data: ReportData): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(data.projectTitle)} — Inspection Report</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@300;400;500;600;700&family=Barlow+Condensed:wght@600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Barlow', sans-serif; font-weight: 300; background: white; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .page { width: 210mm; min-height: 297mm; position: relative; page-break-after: always; overflow: hidden; }
    .page:last-child { page-break-after: avoid; }

    /* Cover */
    .cover-page { display: flex; flex-direction: column; }
    .hero { position: relative; height: 185mm; flex-shrink: 0; }
    .hero-overlay { position: absolute; inset: 0; background: linear-gradient(to bottom, rgba(6,95,70,0.35) 0%, rgba(10,22,40,0.65) 100%); }
    .logo-area { position: absolute; top: 20px; left: 24px; right: 24px; display: flex; align-items: center; justify-content: space-between; }
    .logo-lockup { display: flex; align-items: center; gap: 10px; }
    .logo-text { color: white; }
    .logo-ras { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 800; letter-spacing: 1px; }
    .logo-vertex { font-family: 'Barlow Condensed', sans-serif; font-size: 22px; font-weight: 300; letter-spacing: 2px; }
    .logo-sub { font-size: 7px; font-weight: 500; letter-spacing: 2px; color: rgba(255,255,255,0.75); text-transform: uppercase; margin-top: 2px; }
    .logo-url { color: rgba(255,255,255,0.85); font-size: 11px; }
    .credentials { position: absolute; bottom: 20px; right: 24px; text-align: right; }
    .cred-line { color: rgba(255,255,255,0.9); font-size: 10px; font-weight: 500; line-height: 1.6; }
    .cred-label { font-weight: 700; color: white; }

    .title-band { background: white; padding: 28px 32px 32px; flex: 1; }
    .report-type-badge { display: inline-block; background: ${BRAND.green}; color: white; font-family: 'Barlow Condensed', sans-serif; font-size: 10px; font-weight: 700; letter-spacing: 2px; padding: 4px 12px; border-radius: 2px; margin-bottom: 12px; }
    .report-title { font-family: 'Barlow Condensed', sans-serif; font-size: 32px; font-weight: 800; text-transform: uppercase; color: ${BRAND.navy}; margin-bottom: 10px; }
    .report-subtitle { font-size: 11px; color: #6b7280; margin-bottom: 24px; line-height: 1.6; max-width: 420px; }
    .meta-grid { display: flex; flex-direction: column; gap: 6px; }
    .meta-row { display: flex; gap: 16px; }
    .meta-label { font-family: 'Barlow Condensed', sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: ${BRAND.navy}; min-width: 120px; }
    .meta-value { font-size: 12px; color: #374151; }

    /* Photos */
    .photo-page { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .date-heading { font-family: 'Barlow Condensed', sans-serif; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: ${BRAND.navy}; border-bottom: 2px solid ${BRAND.greenLight}; padding-bottom: 6px; }
    .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .photo-item { display: flex; flex-direction: column; gap: 4px; }
    .photo-container { position: relative; aspect-ratio: 1; background: #f3f4f6; border-radius: 4px; overflow: hidden; }
    .photo-container img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .photo-number { position: absolute; bottom: 6px; right: 6px; background: rgba(6,95,70,0.8); color: white; font-size: 9px; font-weight: 600; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .photo-caption { background: #f3f4f6; border-radius: 3px; padding: 4px 8px; font-size: 9px; color: #374151; text-align: center; }

    /* Summary */
    .summary-page { display: flex; flex-direction: column; }
    .summary-hero { background: ${BRAND.green}; padding: 40px 40px 32px; }
    .summary-title { font-family: 'Barlow Condensed', sans-serif; font-size: 48px; font-weight: 800; color: white; letter-spacing: 3px; }
    .summary-content { padding: 40px; flex: 1; display: flex; flex-direction: column; gap: 36px; }
    .summary-section { display: flex; flex-direction: column; gap: 10px; }
    .summary-label { font-family: 'Barlow Condensed', sans-serif; font-size: 13px; font-weight: 700; letter-spacing: 2px; color: ${BRAND.navy}; }
    .summary-text { font-size: 12px; color: #6b7280; line-height: 1.7; }

    @page { size: A4; margin: 0; }
  </style>
</head>
<body>
  ${coverPage(data)}
  ${photoPages(data)}
  ${summaryPage(data)}
</body>
</html>`;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size)
    chunks.push(arr.slice(i, i + size));
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
