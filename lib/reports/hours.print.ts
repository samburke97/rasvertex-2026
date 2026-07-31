// lib/reports/hours.print.ts
//
// Print HTML builder for the Hours Breakdown report. Similar in shape to
// the schedule page in condition.print.ts (same page shell, same footer
// logos, brand colour/fonts from print-shared.ts) but its own table density
// and pagination — this report has no Notes column, so more rows fit per
// page (25 first / 28 continuation vs. 22/22), and its cell typography is
// intentionally its own rather than a byte-for-byte copy.
// No cover page, no photos, no summary — schedule pages only.

import type { HoursBreakdownData } from "./hours.types";
import type { ScheduleRow } from "./condition.types";
import { formatScheduleDate } from "./condition.types";
import {
  BRAND_NAVY,
  DEFAULT_PRINT_ASSETS,
  buildPrintFontFaceCSS,
  PRINT_RESET_CSS,
  ASSOC_LOGO_CSS,
  buildAssocLogosHTML,
  type ReportAssets,
} from "./print-shared";

// Must match ScheduleSection.tsx
const ROWS_PER_FIRST_PAGE = 25;
const ROWS_PER_CONTINUATION = 28;

function esc(str: string | number): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHeading(report: HoursBreakdownData): string {
  const parts: string[] = [];
  if (report.job.jobNo) parts.push(report.job.jobNo);
  if (report.job.customerName) parts.push(report.job.customerName);
  if (
    report.settings.filterByDate &&
    (report.settings.dateFrom || report.settings.dateTo)
  ) {
    const from = report.settings.dateFrom ?? "";
    const to = report.settings.dateTo ?? "";
    if (from && to) parts.push(`${from} – ${to}`);
    else if (from) parts.push(`From ${from}`);
    else parts.push(`To ${to}`);
  } else {
    parts.push("All Dates");
  }
  return parts.join("  |  ");
}

export function buildHoursPrintHTML(
  report: HoursBreakdownData,
  assets?: ReportAssets,
): string {
  const a = assets ?? DEFAULT_PRINT_ASSETS;
  const rows: ScheduleRow[] = report.schedule;
  const totalHours = rows.reduce((s, r) => s + r.actualHours, 0);
  const heading = buildHeading(report);

  const assocHTML = buildAssocLogosHTML(a);

  // Paginate
  const pages: ScheduleRow[][] = [];
  if (rows.length === 0) {
    pages.push([]);
  } else if (rows.length <= ROWS_PER_FIRST_PAGE) {
    pages.push(rows);
  } else {
    pages.push(rows.slice(0, ROWS_PER_FIRST_PAGE));
    let offset = ROWS_PER_FIRST_PAGE;
    while (offset < rows.length) {
      pages.push(rows.slice(offset, offset + ROWS_PER_CONTINUATION));
      offset += ROWS_PER_CONTINUATION;
    }
  }

  const pagesHTML = pages
    .map((pageRows, pageIdx) => {
      const isFirst = pageIdx === 0;
      const isLast = pageIdx === pages.length - 1;

      const topBar = isFirst
        ? `<div class="sch-topbar">
            <h1 class="sch-title">Schedule</h1>
            <img src="${esc(a.linkBlue)}" alt="rasvertex.com.au" class="sch-topbar-link" />
          </div>`
        : "";

      const subHeading = isFirst
        ? `<div class="sch-heading">
            <div class="sch-heading-title">${esc(heading)}</div>
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

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Hours Breakdown</title>
<style>${buildPrintFontFaceCSS(a)}</style>
<style>
  ${PRINT_RESET_CSS}

  @media print {
    @page { size: A4; margin: 0; }
    body { margin: 0; }
    .sch-page { break-before: page; page-break-before: always; }
    .sch-page:first-child { break-before: avoid; page-break-before: avoid; }
  }

  .sch-page { width: 210mm; min-height: 297mm; background: #fff; display: flex; flex-direction: column; }
  .sch-topbar { display: flex; align-items: flex-start; justify-content: space-between; padding: 2.75rem 2.75rem 0; flex-shrink: 0; }
  .sch-title { font-family: 'Bebas Neue', Arial, sans-serif; font-size: 3rem; font-weight: 400; letter-spacing: 0.04em; color: ${BRAND_NAVY}; line-height: 1; text-transform: uppercase; }
  .sch-topbar-link { height: 22px; width: auto; display: block; margin-top: 0.5rem; }
  .sch-body { padding: 2rem 2.75rem 2rem; flex: 1; display: flex; flex-direction: column; }
  .sch-heading { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
  .sch-heading-title { font-family: 'Bebas Neue', Arial, sans-serif; font-size: 1.15rem; letter-spacing: 0.08em; color: ${BRAND_NAVY}; white-space: nowrap; }
  .sch-table-wrap { flex: 1; }
  .sch-table { width: 100%; border-collapse: collapse; }
  .sch-th { padding: 0.55rem 0.875rem; font-family: 'Inter', Arial, sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #374151; background: #f9f9f9; border-bottom: 1px solid #e5e7eb; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sch-th-num { padding: 0.55rem 0.875rem; font-family: 'Inter', Arial, sans-serif; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: #374151; background: #f9f9f9; border-bottom: 1px solid #e5e7eb; text-align: right; white-space: nowrap; width: 100px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sch-row { border-bottom: 1px solid #f0f0f0; }
  .sch-row:last-child { border-bottom: none; }
  .sch-td { padding: 0.48rem 0.875rem; font-family: 'Inter', Arial, sans-serif; font-size: 0.8rem; font-weight: 300; color: #333; }
  .sch-td-num { padding: 0.48rem 0.875rem; font-family: 'Inter', Arial, sans-serif; font-size: 0.8rem; font-weight: 300; color: #333; text-align: right; width: 100px; }
  .sch-totals { border-top: 2px solid ${BRAND_NAVY}; }
  .sch-totals-label { padding: 0.55rem 0.875rem; font-family: 'Inter', Arial, sans-serif; font-size: 0.8rem; font-weight: 600; color: ${BRAND_NAVY}; text-transform: uppercase; letter-spacing: 0.04em; }
  .sch-totals-cell { padding: 0.55rem 0.875rem; font-family: 'Inter', Arial, sans-serif; font-size: 0.8rem; font-weight: 600; color: ${BRAND_NAVY}; text-align: right; }
  .sch-footer { padding: 1.5rem 2.75rem 2rem; border-top: 1px solid #ebebeb; display: flex; align-items: center; justify-content: center; gap: 20px; flex-wrap: nowrap; }
  .sch-footer img { ${ASSOC_LOGO_CSS} }
</style>
</head>
<body>
${pagesHTML}
</body>
</html>`;
}
