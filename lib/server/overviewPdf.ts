// lib/server/overviewPdf.ts
//
// Renders the Job Overview report to PDF from the same component the builder
// previews (OverviewDocument), with every image inlined so headless Chrome
// makes no outbound requests. Used by both the Export PDF route and Save to
// SimPRO. Logo, closing-page images and fonts come from the Anchor report's
// asset loader, since the two reports share that page.

import { createElement } from "react";
import OverviewDocument, { OVERVIEW_CSS } from "@/components/reports/condition/OverviewDocument";
import { buildOverviewModel, DEFAULT_OVERVIEW_COVER, PAGE_H, PAGE_W } from "@/lib/reports/overview.layout";
import { filterPhotosByDateRange, type ConditionReportData } from "@/lib/reports/condition.types";
import { renderPDF } from "@/lib/server/pdf-utils";
import { createImageResolver, GRID_PHOTO_RESIZE } from "@/lib/server/resolveReportImages";
import { loadAssets, shrink } from "@/lib/server/anchorPdf";

let _cover: Promise<string> | null = null;

export async function buildOverviewPDF(report: ConditionReportData): Promise<Buffer> {
  const [{ doc, fontCSS }, defaultCover] = await Promise.all([loadAssets(), (_cover ??= shrink(DEFAULT_OVERVIEW_COVER, 1600))]);
  const resolve = createImageResolver();

  // Only photos the document shows get fetched: grid size for photos, full
  // size for the cover.
  const s = report.settings;
  const shown = !s.showPhotos ? [] : s.filterByDate ? filterPhotosByDateRange(report.photos, s.dateFrom, s.dateTo) : report.photos;
  const [photos, coverPhoto] = await Promise.all([
    Promise.all(shown.map(async (p) => ({ ...p, url: await resolve(p.url, GRID_PHOTO_RESIZE) }))),
    report.job.coverPhoto ? resolve(report.job.coverPhoto) : Promise.resolve(null),
  ]);

  const model = buildOverviewModel({ ...report, photos, job: { ...report.job, coverPhoto } }, defaultCover);
  const { renderToStaticMarkup } = await import("react-dom/server");
  const title = `${model.reportType} - ${model.site}`.replace(/[<>&"]/g, "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
${fontCSS}
@page{size:${PAGE_W}px ${PAGE_H}px;margin:0;}
html,body{margin:0;padding:0;background:#fff;}
${OVERVIEW_CSS}
</style></head><body>${renderToStaticMarkup(createElement(OverviewDocument, { model, assets: { images: doc.images } }))}</body></html>`;
  return renderPDF(html, { pageSize: { width: `${PAGE_W}px`, height: `${PAGE_H}px` } });
}
