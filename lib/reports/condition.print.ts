import type { ConditionReportData } from "./condition.types";

const PRINT_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700;800&display=swap');

  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Barlow', Arial, sans-serif;
    background: white;
    color: #1a1a2e;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  /* ── Cover ── */
  .cover {
    page-break-after: always;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }
  .cover-hero {
    background: linear-gradient(160deg, #0d1b3e 0%, #1a3a6e 60%, #0d2a4a 100%);
    flex: 1;
    position: relative;
    clip-path: polygon(0 0, 100% 0, 100% 80%, 0 100%);
    min-height: 55vh;
  }
  .cover-logo { position: absolute; top: 2rem; left: 2.5rem; }
  .cover-logo-name { color: white; font-size: 1.5rem; font-weight: 800; letter-spacing: 0.06em; }
  .cover-logo-sub { color: rgba(255,255,255,0.5); font-size: 0.55rem; letter-spacing: 0.14em; text-transform: uppercase; margin-top: 2px; }
  .cover-web { position: absolute; top: 2.2rem; right: 2.5rem; color: rgba(255,255,255,0.65); font-size: 0.75rem; }
  .cover-creds { position: absolute; bottom: 4rem; right: 2.5rem; text-align: right; }
  .cover-creds p { color: white; font-size: 0.78rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; line-height: 1.6; }
  .cover-creds span { color: rgba(255,255,255,0.5); font-weight: 400; }
  .cover-content { padding: 2.5rem 3rem; }
  .cover-title { font-size: 2.2rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #0d1b3e; margin-bottom: 0.75rem; }
  .cover-intro { font-size: 0.85rem; color: #555; line-height: 1.7; max-width: 440px; margin-bottom: 1.75rem; }
  .cover-meta { display: grid; grid-template-columns: 130px 1fr; gap: 0.35rem 0.75rem; font-size: 0.82rem; }
  .cover-meta .label { font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #0d1b3e; font-size: 0.68rem; padding-top: 2px; }
  .cover-meta .value { color: #333; }

  /* ── Photo pages ──
     Only non-last photo pages get a forced break.
     We add class="last" on the final batch. */
  .photo-page { padding: 1.25rem 1.5rem; }
  .photo-page:not(.last) { page-break-after: always; }
  .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; }
  .photo-item { break-inside: avoid; page-break-inside: avoid; }
  .photo-thumb { aspect-ratio: 1; background: #f3f4f6; border-radius: 6px; overflow: hidden; }
  .photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-caption {
    background: #f3f4f6;
    border-radius: 5px;
    padding: 0.35rem 0.6rem;
    margin-top: 0.4rem;
    text-align: center;
    font-size: 0.68rem;
    color: #374151;
  }

  /* ── Summary ── */
  .summary-page {
    page-break-before: always;
    padding: 3rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .summary-hero {
    background: linear-gradient(150deg, #0d1b3e 0%, #1a3a6e 100%);
    border-radius: 12px;
    padding: 1.75rem 2.5rem;
    margin-bottom: 3rem;
  }
  .summary-hero-title { color: white; font-size: 2rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; }
  .summary-section { margin-bottom: 2.5rem; }
  .summary-label {
    font-size: 0.7rem; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
    color: #0d1b3e; padding-bottom: 0.5rem; border-bottom: 2px solid #0d1b3e;
    display: inline-block; margin-bottom: 1rem;
  }
  .summary-text { font-size: 0.875rem; color: #444; line-height: 1.85; white-space: pre-wrap; }
  .summary-footer {
    margin-top: auto; padding-top: 2rem; border-top: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
    font-size: 0.72rem; color: #9ca3af;
  }

  @media print {
    .photo-page:not(.last) { page-break-after: always; }
    .summary-page { page-break-before: always; }
  }
`;

export function buildPrintHTML(report: ConditionReportData): string {
  const perPage = 12;
  const pageCount = Math.max(1, Math.ceil(report.photos.length / perPage));

  const photoPageHTML = Array.from({ length: pageCount }, (_, pageIndex) => {
    const start = pageIndex * perPage;
    const batch = report.photos.slice(start, start + perPage);
    const isLast = pageIndex === pageCount - 1;

    const items = batch
      .map(
        (photo, i) => `
        <div class="photo-item">
          <div class="photo-thumb">
            <img src="${esc(photo.url)}" alt="${esc(photo.name)}" />
          </div>
          <div class="photo-caption">${start + i + 1}. ${esc(stripExt(photo.name))}</div>
        </div>`,
      )
      .join("");

    return `<div class="photo-page${isLast ? " last" : ""}"><div class="photo-grid">${items}</div></div>`;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(report.job.reportType || report.job.project)} — ${esc(report.job.project)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>

  <div class="cover">
    <div class="cover-hero">
      <div class="cover-logo">
        <div class="cover-logo-name">RAS VERTEX</div>
        <div class="cover-logo-sub">Maintenance Solutions · Sunshine Coast</div>
      </div>
      <div class="cover-web">rasvertex.com.au</div>
      <div class="cover-creds">
        <p>QBCC: <span>1307234</span></p>
        <p>ABN: <span>53 167 652 637</span></p>
      </div>
    </div>
    <div class="cover-content">
      <div class="cover-title">${esc(report.job.reportType || "Building Condition Report")}</div>
      <div class="cover-intro">
        This report documents the condition of the building and identifies maintenance
        requirements, defects, and recommended remediation works.
      </div>
      <div class="cover-meta">
        <span class="label">Prepared For</span><span class="value">${esc(report.job.preparedFor || "—")}</span>
        <span class="label">Prepared By</span><span class="value">${esc(report.job.preparedBy)}</span>
        <span class="label">Address</span><span class="value">${esc(report.job.address || "—")}</span>
        <span class="label">Report Type</span><span class="value">${esc(report.job.reportType || "—")}</span>
        <span class="label">Project</span><span class="value">${esc(report.job.project || "—")}</span>
        <span class="label">Date</span><span class="value">${esc(report.job.date)}</span>
      </div>
    </div>
  </div>

  ${photoPageHTML}

  <div class="summary-page">
    <div class="summary-hero">
      <div class="summary-hero-title">Summary</div>
    </div>
    <div class="summary-section">
      <div class="summary-label">Comments</div>
      <div class="summary-text">${esc(report.comments)}</div>
    </div>
    <div class="summary-section">
      <div class="summary-label">Recommendations</div>
      <div class="summary-text">${esc(report.recommendations)}</div>
    </div>
    <div class="summary-footer">
      <span>RAS-VERTEX Maintenance Solutions · QBCC 1307234 · ABN 53 167 652 637 · rasvertex.com.au</span>
      <span>Smart Strata · Ebix · Trades Monitor · Pegasus · Haymes Paint</span>
    </div>
  </div>

</body>
</html>`;
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripExt(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}
