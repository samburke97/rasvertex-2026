// app/api/reports/export-inspection-pdf/route.ts
//
// Renders the Inspection Report to PDF from the very same component the
// builder previews (InspectionDocument). Two passes in headless Chrome:
//   1. measure — every flowed block rendered once at the content width, with
//      the real fonts, to read its height
//   2. print   — paginate() lays the blocks onto pages with those heights,
//      and the paginated document is printed at 1280px pages of A4 shape
//
// With saveToJob, the finished PDF is also attached to the SimPRO job
// (replacing an earlier export of the same name). The download is returned
// either way; X-Saved-To-Job says whether the attachment succeeded.

import fs from "fs";
import path from "path";
import { createElement } from "react";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import InspectionDocument, {
  INSPECTION_CSS,
  InspectionMeasure,
  type InspectionAssets,
} from "@/components/reports/inspection/InspectionDocument";
import { CARD_IMAGES, LOGO_IMAGE, type ImageKey } from "@/lib/reports/inspection/codes";
import { buildModel, paginate, PAGE_W, PAGE_H, CONTENT_W } from "@/lib/reports/inspection/generate";
import {
  isInspectionData,
  reportImages,
  type InspectionReportData,
} from "@/lib/reports/inspection/types";
import {
  evaluateHTML,
  pdfDownloadResponse,
  readPublicAsBase64,
  renderPDF,
} from "@/lib/server/pdf-utils";
import { createImageResolver, GRID_PHOTO_RESIZE } from "@/lib/server/resolveReportImages";
import { getSimproConfig, saveJobAttachment } from "@/lib/server/simpro";

export const maxDuration = 60;

// The website photos in public/ are 3-5MB PNGs, far beyond the cards they
// fill — print-size them once per server instance.
async function shrink(rel: string, maxWidth: number, format: "jpeg" | "png"): Promise<string> {
  try {
    const input = fs.readFileSync(path.join(process.cwd(), "public", rel));
    const img = sharp(input).resize({ width: maxWidth, withoutEnlargement: true });
    const out = format === "png" ? await img.png().toBuffer() : await img.jpeg({ quality: 80 }).toBuffer();
    return `data:image/${format};base64,${out.toString("base64")}`;
  } catch {
    return readPublicAsBase64(rel);
  }
}

let _assets: Promise<{ doc: InspectionAssets; fontCSS: string }> | null = null;

function loadAssets() {
  _assets ??= (async () => {
    const [logo, images] = await Promise.all([
      shrink(LOGO_IMAGE, 800, "png"),
      Promise.all(
        Object.entries(CARD_IMAGES).map(async ([k, rel]) => [k, await shrink(rel, 900, "jpeg")] as const),
      ).then((e) => Object.fromEntries(e) as Record<ImageKey, string>),
    ]);
    const inter = readPublicAsBase64("fonts/inter.woff2");
    const bebas = readPublicAsBase64("fonts/bebas-neue.woff2");
    return {
      doc: { logo, images },
      fontCSS:
        `@font-face{font-family:'Inter';font-weight:300 700;font-style:normal;src:url("${inter}") format('woff2');}` +
        `@font-face{font-family:'Bebas Neue';font-weight:400;font-style:normal;src:url("${bebas}") format('woff2');}`,
    };
  })();
  return _assets;
}

function page(fontCSS: string, title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
${fontCSS}
@page{size:${PAGE_W}px ${PAGE_H}px;margin:0;}
html,body{margin:0;padding:0;background:#fff;}
${INSPECTION_CSS}
</style></head><body>${body}</body></html>`;
}

const MEASURE_SCRIPT = `(() => {
  const out = {};
  document.querySelectorAll("[data-bk]").forEach((el) => { out[el.getAttribute("data-bk")] = el.offsetHeight; });
  return out;
})()`;

async function buildPDF(report: InspectionReportData): Promise<Buffer> {
  const { doc, fontCSS } = await loadAssets();
  const model = buildModel(report);
  const { renderToStaticMarkup } = await import("react-dom/server");
  const title = `Inspection Report - ${report.job.site} - J${report.jobId}`.replace(/[<>&"]/g, "");

  const measureHTML = page(
    fontCSS,
    title,
    renderToStaticMarkup(
      createElement(InspectionMeasure, { model, assets: doc }),
    ),
  );
  const heights = await evaluateHTML<Record<string, number>>(measureHTML, MEASURE_SCRIPT, {
    width: CONTENT_W + 200,
    height: PAGE_H,
  });
  const layout = paginate(model.blocks, heights);

  // Only photos the document shows get fetched and inlined. The cover and
  // site plan render near full width, so they keep their size.
  const shown = new Set<string>();
  if (model.coverPhotoId) shown.add(model.coverPhotoId);
  if (model.mapPhotoId) shown.add(model.mapPhotoId);
  model.parsed.forEach((p) => shown.add(p.id));
  const resolve = createImageResolver();
  const resolved = new Map<string, string>();
  await Promise.all(
    reportImages(report)
      .filter((p) => shown.has(p.id))
      .map(async (p) => {
        const full = p.id === model.coverPhotoId || p.id === model.mapPhotoId;
        resolved.set(p.id, await resolve(p.url, full ? undefined : GRID_PHOTO_RESIZE));
      }),
  );

  const html = page(
    fontCSS,
    title,
    renderToStaticMarkup(
      createElement(InspectionDocument, {
        model,
        layout,
        job: report.job,
        photoUrl: (id) => (id ? (resolved.get(id) ?? null) : null),
        assets: doc,
      }),
    ),
  );
  return renderPDF(html, { pageSize: { width: `${PAGE_W}px`, height: `${PAGE_H}px` } });
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  let body: { report?: unknown; saveToJob?: boolean; companyId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const report = body.report;
  if (!isInspectionData(report)) {
    return NextResponse.json({ error: "report data is required" }, { status: 400 });
  }

  const filename =
    safeName(`Inspection Report - ${report.job.site || "Building"} - J${report.jobId}`) + ".pdf";

  let buffer: Buffer;
  try {
    buffer = await buildPDF(report);
  } catch (err) {
    console.error("[ExportInspectionPDF]", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }

  let savedToJob = false;
  const jobId = parseInt(report.jobId, 10);
  if (body.saveToJob && jobId > 0) {
    try {
      getSimproConfig();
      await saveJobAttachment(body.companyId ?? 0, jobId, filename, buffer);
      savedToJob = true;
    } catch (err) {
      console.error("[ExportInspectionPDF] save to job failed:", err);
    }
  }

  const res = pdfDownloadResponse(buffer, filename);
  res.headers.set("X-Saved-To-Job", savedToJob ? "yes" : "no");
  res.headers.set("X-Filename", encodeURIComponent(filename));
  return res;
}
