// lib/server/progressPdf.ts
// The Project progress report to PDF, from the same component the builder
// previews (ProgressDocument), in the Job overview's page design.

import { createElement } from "react";
import { OVERVIEW_CSS } from "@/components/reports/condition/OverviewDocument";
import ProgressDocument, { PROGRESS_CSS } from "@/components/reports/project-progress/ProgressDocument";
import { buildProgressModel, type ProgressReport } from "@/lib/reports/projectProgress";
import { PAGE_H, PAGE_W } from "@/lib/reports/overview.layout";
import { renderPDF } from "@/lib/server/pdf-utils";
import { loadAssets } from "@/lib/server/anchorPdf";

export async function buildProgressPDF(report: ProgressReport): Promise<Buffer> {
  const { fontCSS } = await loadAssets();
  const model = buildProgressModel(report);
  const { renderToStaticMarkup } = await import("react-dom/server");
  const title = `Project progress - ${model.title}`.replace(/[<>&"]/g, "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
${fontCSS}
@page{size:${PAGE_W}px ${PAGE_H}px;margin:0;}
html,body{margin:0;padding:0;background:#fff;}
${OVERVIEW_CSS}
${PROGRESS_CSS}
</style></head><body>${renderToStaticMarkup(createElement(ProgressDocument, { model }))}</body></html>`;
  return renderPDF(html, { pageSize: { width: `${PAGE_W}px`, height: `${PAGE_H}px` } });
}
