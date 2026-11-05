// lib/server/hoursPdf.ts
//
// The Hours breakdown to PDF, from the same component the builder previews
// (HoursDocument). Fonts come from the Anchor report's asset loader, as the
// Job overview's do.

import { createElement } from "react";
import { OVERVIEW_CSS } from "@/components/reports/condition/OverviewDocument";
import HoursDocument, { HOURS_CSS } from "@/components/reports/hours-breakdown/HoursDocument";
import { buildHoursModel } from "@/lib/reports/hours.layout";
import { PAGE_H, PAGE_W } from "@/lib/reports/overview.layout";
import type { HoursBreakdownData } from "@/lib/reports/hours.types";
import { renderPDF } from "@/lib/server/pdf-utils";
import { loadAssets } from "@/lib/server/anchorPdf";

export async function buildHoursPDF(report: HoursBreakdownData): Promise<Buffer> {
  const { fontCSS } = await loadAssets();
  const model = buildHoursModel(report);
  const { renderToStaticMarkup } = await import("react-dom/server");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Hours breakdown</title><style>
${fontCSS}
@page{size:${PAGE_W}px ${PAGE_H}px;margin:0;}
html,body{margin:0;padding:0;background:#fff;}
${OVERVIEW_CSS}
${HOURS_CSS}
</style></head><body>${renderToStaticMarkup(createElement(HoursDocument, { model }))}</body></html>`;
  return renderPDF(html, { pageSize: { width: `${PAGE_W}px`, height: `${PAGE_H}px` } });
}
