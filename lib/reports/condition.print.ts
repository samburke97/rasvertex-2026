// lib/reports/condition.print.ts
import type { ConditionReportData } from "./condition.types";

const PRINT_STYLES = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Inter', Arial, sans-serif;
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
    /* No margin/padding — full bleed to page edge */
  }

  /* Hero container — full bleed, no rounding */
  .cover-hero {
    position: relative;
    height: 58vh;
    min-height: 420px;
    flex-shrink: 0;
    /* overflow visible so chevron clips cleanly without gap */
    overflow: visible;
  }

  /* Layer 1 — solid navy base */
  .cover-hero-navy {
    position: absolute;
    inset: 0;
    background: #0d1c45;
  }

  /* Layer 2 — cover photo (conditionally rendered) */
  .cover-hero-photo {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
  }

  /* Layer 3 — dark tint over photo */
  .cover-hero-overlay {
    position: absolute;
    inset: 0;
    background: rgba(10, 22, 60, 0.68);
  }

  /* Layer 4 — flat bottom, no chevron */
  .cover-hero-chevron {
    display: none;
  }

  /* All positioned content sits above layers */
  .cover-logo {
    position: absolute;
    top: 2rem;
    left: 2.5rem;
    z-index: 5;
  }
  .cover-logo img { height: 56px; width: auto; display: block; }

  .cover-web {
    position: absolute;
    top: 2.1rem;
    right: 2.5rem;
    z-index: 5;
  }
  .cover-web img { height: 18px; width: auto; display: block; }

  /* QBCC / ABN — key in Bebas, number value in Inter */
  .cover-creds {
    position: absolute;
    bottom: 2.5rem;
    right: 2.5rem;
    text-align: right;
    z-index: 5;
  }
  .cover-creds p {
    line-height: 1.6;
  }
  .cred-key {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1rem;
    letter-spacing: 0.08em;
    color: #fff;
  }
  .cred-val {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    font-weight: 400;
    color: rgba(255, 255, 255, 0.6);
    letter-spacing: 0.02em;
  }

  /* ── Cover content ── */
  .cover-content {
    padding: 2.5rem 2.75rem 3rem;
    flex: 1;
  }

  /* Title — Bebas Neue */
  .cover-title {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 2.6rem;
    letter-spacing: 0.04em;
    color: #0d1c45;
    margin-bottom: 0.6rem;
    line-height: 1.1;
    text-transform: uppercase;
  }

  /* Intro — Inter */
  .cover-intro {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.85rem;
    color: #555;
    line-height: 1.7;
    max-width: 460px;
    margin-bottom: 1.75rem;
  }

  /* Meta grid — label Bebas, value Inter */
  .cover-meta {
    display: grid;
    grid-template-columns: 140px 1fr;
    border-top: 1px solid #eee;
  }
  .cover-meta .label {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 0.82rem;
    letter-spacing: 0.1em;
    color: #0d1c45;
    padding: 0.6rem 0;
    border-bottom: 1px solid #f0f0f0;
  }
  .cover-meta .value {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem;
    color: #333;
    padding: 0.6rem 0 0.6rem 1rem;
    border-bottom: 1px solid #f0f0f0;
  }

  /* ── Photo pages ── */
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
    padding: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background: #fff;
  }

  /* Top bar: SUMMARY left, link_blue right */
  .summary-topbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 2.75rem 2.75rem 0;
    flex-shrink: 0;
  }

  .summary-title {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 3rem;
    font-weight: 400;
    letter-spacing: 0.04em;
    color: #0d1c45;
    line-height: 1;
    margin: 0;
    text-transform: uppercase;
  }

  .summary-topbar-link {
    height: 22px;
    width: auto;
    display: block;
    margin-top: 0.5rem;
  }

  /* Body */
  .summary-body {
    padding: 2.5rem 2.75rem 2rem;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2.25rem;
  }

  .summary-section { display: flex; flex-direction: column; gap: 0.75rem; }

  /* "COMMENTS:" — Bebas with colon */
  .summary-label {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.1rem;
    font-weight: 400;
    letter-spacing: 0.08em;
    color: #0d1c45;
    text-transform: uppercase;
    line-height: 1;
    /* No border, no inline-block — matches reference exactly */
  }

  .summary-text {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.875rem;
    color: #444;
    line-height: 1.85;
    white-space: pre-wrap;
  }

  /* Footer: 6 partner logos in one row */
  .summary-footer {
    margin-top: auto;
    padding: 1.5rem 2.75rem 2rem;
    border-top: 1px solid #eee;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    align-items: center;
    justify-items: center;
    gap: 1rem;
  }

  .summary-footer img {
    height: 36px;
    width: auto;
    max-width: 100%;
    object-fit: contain;
    display: block;
  }

  @media print {
    body { margin: 0; }
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

  const coverPhotoLayer = report.job.coverPhoto
    ? `\n      <div class="cover-hero-photo" style="background-image:url('${report.job.coverPhoto}')"></div>`
    : "";

  // Font preload links — loaded before styles so fonts are ready before print fires
  const fontLinks = `
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(report.job.reportType || report.job.project)} — ${esc(report.job.project)}</title>
  ${fontLinks}
  <style>${PRINT_STYLES}</style>
</head>
<body>

  <div class="cover">
    <div class="cover-hero">
      <div class="cover-hero-navy"></div>${coverPhotoLayer}
      <div class="cover-hero-overlay"></div>
      <div class="cover-hero-chevron"></div>

      <div class="cover-logo">
        <img src="/reports/ras-logo.png" alt="RAS Vertex Maintenance Solutions" />
      </div>
      <div class="cover-web">
        <img src="/reports/link_white.png" alt="rasvertex.com.au" />
      </div>
      <div class="cover-creds">
        <p><span class="cred-key">QBCC:&nbsp;</span><span class="cred-val">1307234</span></p>
        <p><span class="cred-key">ABN:&nbsp;</span><span class="cred-val">53 167 652 637</span></p>
      </div>
    </div>

    <div class="cover-content">
      <div class="cover-title">${esc(report.job.reportType || "Building Condition Report")}</div>
      <div class="cover-intro">
        This report outlines the repairs and maintenance works completed, including any
        updates, adjustments, and variations from the original scope.
      </div>
      <div class="cover-meta">
        <span class="label">Prepared For</span><span class="value">${esc(report.job.preparedFor || "—")}</span>
        <span class="label">Prepared By</span><span class="value">${esc(report.job.preparedBy)}</span>
        <span class="label">Address</span><span class="value">${esc(report.job.address || "—")}</span>
        <span class="label">Project</span><span class="value">${esc(report.job.project || "—")}</span>
        <span class="label">Date</span><span class="value">${esc(report.job.date)}</span>
      </div>
    </div>
  </div>

  ${photoPageHTML}

  <div class="summary-page">
    <div class="summary-topbar">
      <div class="summary-title">Summary</div>
      <img src="/reports/link_blue.png" alt="rasvertex.com.au" class="summary-topbar-link" />
    </div>

    <div class="summary-body">
      <div class="summary-section">
        <div class="summary-label">Comments:</div>
        <div class="summary-text">${esc(report.comments)}</div>
      </div>
      <div class="summary-section">
        <div class="summary-label">Recommendations:</div>
        <div class="summary-text">${esc(report.recommendations)}</div>
      </div>
    </div>

    <div class="summary-footer">
      <img src="/reports/partners/smart-strata.png"    alt="Smart Strata"      />
      <img src="/reports/partners/ebix.png"             alt="Ebix"              />
      <img src="/reports/partners/trades-monitor.png"  alt="Trades Monitor"    />
      <img src="/reports/partners/pegasus.png"          alt="Pegasus"           />
      <img src="/reports/partners/community-select.png" alt="Community Select"  />
      <img src="/reports/partners/haymes.png"           alt="Haymes Paint"      />
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
