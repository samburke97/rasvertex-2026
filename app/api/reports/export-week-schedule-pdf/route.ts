// app/api/reports/export-week-schedule-pdf/route.ts
// The Weekly schedule to PDF, from the same component the builder previews
// (WeekScheduleDocument), with the schedule the builder already read.

import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import WeekScheduleDocument, { WEEK_CSS } from "@/components/reports/week-schedule/WeekScheduleDocument";
import {
  buildWeekModel,
  DEFAULT_WEEK_OPTIONS,
  fromIso,
  WEEK_PAGE_H,
  WEEK_PAGE_W,
  type WeekOptions,
  type WeekScheduleResponse,
} from "@/lib/reports/weekSchedule";
import { pdfDownloadResponse, renderPDF } from "@/lib/server/pdf-utils";
import { loadAssets } from "@/lib/server/anchorPdf";

interface Body {
  filename?: string;
  monday?: string;
  data?: WeekScheduleResponse;
  opts?: Partial<WeekOptions>;
  hidden?: number[];
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { filename = "Weekly Schedule", monday, data, opts, hidden = [] } = body;
  if (!data || !monday || !/^\d{4}-\d{2}-\d{2}$/.test(monday)) {
    return NextResponse.json({ error: "monday and data are required" }, { status: 400 });
  }

  try {
    const { doc, fontCSS } = await loadAssets();
    const model = buildWeekModel(data, fromIso(monday), { ...DEFAULT_WEEK_OPTIONS, ...opts }, hidden);
    const { renderToStaticMarkup } = await import("react-dom/server");
    const title = `Weekly Schedule - ${model.title}`.replace(/[<>&"]/g, "");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
${fontCSS}
@page{size:${WEEK_PAGE_W}px ${WEEK_PAGE_H}px;margin:0;}
html,body{margin:0;padding:0;background:#fff;}
${WEEK_CSS}
</style></head><body>${renderToStaticMarkup(createElement(WeekScheduleDocument, { model, logo: doc.images.logo }))}</body></html>`;
    const buffer = await renderPDF(html, { pageSize: { width: `${WEEK_PAGE_W}px`, height: `${WEEK_PAGE_H}px` } });
    return pdfDownloadResponse(buffer, filename);
  } catch (err) {
    console.error("[ExportWeekSchedulePDF]", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}
