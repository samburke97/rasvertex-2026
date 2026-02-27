// lib/reports/condition.print.ts
import type { ConditionReportData } from "./condition.types";

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

const D = "#e5e7eb";

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

  /* ── COVER ──────────────────────────────────────────────────────────────── */
  .cover {
    width: 210mm;
    height: 297mm;
    display: flex;
    flex-direction: column;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }

  .cover-hero {
    position: relative;
    height: 580px;
    flex-shrink: 0;
    overflow: hidden;
  }
  .cover-hero-navy { position: absolute; inset: 0; background: #0d1c45; }
  .cover-hero-photo { position: absolute; inset: 0; background-size: cover; background-position: center; }
  .cover-hero-overlay { position: absolute; inset: 0; background: rgba(10,22,60,0.68); }

  .cover-logo { position: absolute; top: 2.5rem; left: 2.75rem; z-index: 5; }
  .cover-logo img { height: 41px; width: auto; display: block; }
  .cover-web { position: absolute; top: 2.6rem; right: 2.75rem; z-index: 5; }
  .cover-web img { height: 22px; width: auto; display: block; }

  .cover-creds {
    position: absolute; bottom: 2.5rem; right: 2.75rem;
    text-align: right; z-index: 5;
    display: flex; flex-direction: column; gap: 3px;
  }
  .creds-item { display: flex; align-items: baseline; justify-content: flex-end; line-height: 1.4; }
  .cred-key { font-family: 'Bebas Neue', Arial, sans-serif; font-size: 0.95rem; letter-spacing: 0.08em; color: #fff; }
  .cred-val { font-family: 'Inter', Arial, sans-serif; font-size: 0.82rem; font-weight: 300; color: #fff; padding-left: 0.25rem; }

  /*
   * Cover body: justify-content:center so the title/intro/meta block sits
   * in the dead middle of the white area below the hero image.
   * (Was justify-content:flex-end with padding-bottom:4.5rem — changed.)
   */
  .cover-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 0 2.75rem;
  }

  .cover-title {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 2.75rem; letter-spacing: 0.04em; color: #0d1c45;
    line-height: 1.05; text-transform: uppercase;
    margin-bottom: 1.25rem;
  }

  .cover-intro {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem; font-weight: 300; color: #666;
    line-height: 1.8; max-width: 520px; margin-bottom: 1.75rem;
    white-space: pre-wrap;
  }

  /*
   * Meta table — labels include colon suffix, tighter right padding (1rem)
   * so values sit close to their labels, matching the editor layout.
   */
  .cover-meta {
    border-collapse: collapse;
  }
  .cover-meta td {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.82rem; font-weight: 300;
    padding: 0.5rem 0;
    border-bottom: 1px solid ${D};
    vertical-align: middle;
  }
  .cover-meta tr:first-child td { border-top: 1px solid ${D}; }
  .cover-meta td.lbl {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 0.78rem; letter-spacing: 0.1em; color: #0d1c45;
    padding-right: 1rem;
    white-space: nowrap;
  }
  .cover-meta td.val {
    color: #333;
    padding-right: 3rem;
    min-width: 160px;
  }

  /* ── PHOTO PAGES ─────────────────────────────────────────────────────────── */
  .photo-section { padding: 2.75rem; }
  .date-group { margin-bottom: 2.25rem; }
  .date-header { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .date-line { flex: 1; height: 1px; background: ${D}; }
  .date-text {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.65rem; font-weight: 600;
    letter-spacing: 0.1em; text-transform: uppercase;
    color: #9ca3af; white-space: nowrap;
  }
  .photo-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.875rem; }
  .photo-item { break-inside: avoid; page-break-inside: avoid; }
  .photo-thumb { aspect-ratio: 1; background: #f3f4f6; border-radius: 6px; overflow: hidden; }
  .photo-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo-caption {
    background: #f3f4f6; border-radius: 5px;
    padding: 0.35rem 0.6rem; margin-top: 0.4rem;
    text-align: center;
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.68rem; font-weight: 300; color: #374151;
  }

  /* ── SUMMARY PAGE ─────────────────────────────────────────────────────────── */
  .summary-page {
    width: 210mm; min-height: 297mm;
    page-break-before: always; break-before: page;
    display: flex; flex-direction: column;
  }
  .summary-topbar {
    display: flex; align-items: flex-start; justify-content: space-between;
    padding: 2.75rem 2.75rem 0;
  }
  .summary-title {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 3rem; font-weight: 400; letter-spacing: 0.04em;
    color: #0d1c45; line-height: 1; text-transform: uppercase;
  }
  .summary-link { height: 22px; width: auto; display: block; margin-top: 0.5rem; }
  .summary-body {
    padding: 2.5rem 2.75rem 2rem; flex: 1;
    display: flex; flex-direction: column; gap: 2.25rem;
  }
  .summary-section { display: flex; flex-direction: column; gap: 0.75rem; }
  .summary-label {
    font-family: 'Bebas Neue', Arial, sans-serif;
    font-size: 1.05rem; font-weight: 400; letter-spacing: 0.08em;
    color: #0d1c45; text-transform: uppercase; line-height: 1;
  }
  .summary-text {
    font-family: 'Inter', Arial, sans-serif;
    font-size: 0.85rem; font-weight: 300; color: #444;
    line-height: 1.85; white-space: pre-wrap;
  }
  .summary-footer {
    margin-top: auto;
    padding: 1.5rem 2.75rem;
    border-top: 1px solid ${D};
    display: flex; align-items: center; justify-content: center; gap: 20px;
  }
  .summary-footer img {
    height: 36px; width: auto; max-width: 80px;
    object-fit: contain; display: block; opacity: 0.85;
  }
`;

const ASSOCIATION_LOGOS = [
  { src: "/reports/associations/communityselect.png", alt: "Community Select" },
  { src: "/reports/associations/dulux.png", alt: "Dulux" },
  { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
  { src: "/reports/associations/mpa.png", alt: "MPA" },
  { src: "/reports/associations/qbcc.png", alt: "QBCC" },
  { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
];

export function buildPrintHTML(report: ConditionReportData): string {
  const { showDates } = report.settings;

  // ── Photo section HTML ────────────────────────────────────────────────
  let photoSectionInner = "";
  let globalIndex = 0;

  if (showDates) {
    const groups = groupPhotosByDate(report.photos);
    photoSectionInner = groups
      .map((group) => {
        const header = group.label
          ? `<div class="date-header">
            <span class="date-line"></span>
            <span class="date-text">${esc(group.label)}</span>
            <span class="date-line"></span>
          </div>`
          : "";
        const items = group.photos
          .map((photo) => {
            globalIndex++;
            return `<div class="photo-item">
          <div class="photo-thumb"><img src="${esc(photo.url)}" alt="${esc(photo.name)}" /></div>
          <div class="photo-caption">${globalIndex}. ${esc(stripExt(photo.name))}</div>
        </div>`;
          })
          .join("\n");
        return `<div class="date-group">${header}<div class="photo-grid">${items}</div></div>`;
      })
      .join("\n");
  } else {
    const items = report.photos
      .map(
        (photo, i) =>
          `<div class="photo-item">
        <div class="photo-thumb"><img src="${esc(photo.url)}" alt="${esc(photo.name)}" /></div>
        <div class="photo-caption">${i + 1}. ${esc(stripExt(photo.name))}</div>
      </div>`,
      )
      .join("\n");
    photoSectionInner = `<div class="photo-grid">${items}</div>`;
  }

  // ── Cover ─────────────────────────────────────────────────────────────
  const coverPhotoLayer = report.job.coverPhoto
    ? `<div class="cover-hero-photo" style="background-image:url('${report.job.coverPhoto}')"></div>`
    : "";

  // Labels include colon suffix — matches editor JSX {label}:
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
    <div class="cover-creds">
      <div class="creds-item"><span class="cred-key">QBCC:</span><span class="cred-val">1307234</span></div>
      <div class="creds-item"><span class="cred-key">ABN:</span><span class="cred-val">53 167 652 637</span></div>
    </div>
  </div>
  <div class="cover-body">
    <div class="cover-title">${esc(report.job.reportType || "Building Condition Report")}</div>
    <div class="cover-intro">${esc(introText)}</div>
    <table class="cover-meta">${metaRows}</table>
  </div>
</div>

<div class="photo-section">
${photoSectionInner}
</div>

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
