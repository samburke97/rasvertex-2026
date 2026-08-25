// app/api/simpro/jobs/[jobId]/save-anchor-report/route.ts

import { NextRequest, NextResponse } from "next/server";
import { buildAnchorPrintHTML } from "@/lib/reports/anchor.print";
import { loadReportAssets, renderPDF } from "@/lib/server/pdf-utils";
import { saveReportToDestinations, getSimproConfig } from "@/lib/server/simpro";
import { createImageResolver, GRID_PHOTO_RESIZE } from "@/lib/server/resolveReportImages";
import type { AnchorReportData } from "@/lib/reports/anchor.types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    getSimproConfig();
  } catch {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const { jobId } = await params;
  const parsedJobId = parseInt(jobId, 10);
  if (!jobId || isNaN(parsedJobId) || parsedJobId <= 0) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  let body: {
    filename?: string;
    report?: AnchorReportData;
    companyId?: number;
    siteId?: string;
    destinations?: { job?: boolean; site?: boolean };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const {
    filename,
    report,
    companyId = 0,
    siteId,
    destinations = { job: true, site: false },
  } = body;
  if (!filename?.trim())
    return NextResponse.json(
      { error: "filename is required" },
      { status: 400 },
    );
  if (!report)
    return NextResponse.json(
      { error: "report data is required" },
      { status: 400 },
    );
  if (!destinations.job && !destinations.site)
    return NextResponse.json(
      { error: "At least one save destination is required" },
      { status: 400 },
    );

  const cleanFilename = filename.trim().replace(/\.pdf$/i, "") + ".pdf";

  // Same resolve-and-resize step as export-anchor-pdf's route — see
  // resolveReportImages.ts — otherwise this path would still hand
  // Puppeteer raw Blob URLs to fetch one by one, and full-size photos to
  // embed, undoing both the speed and size fixes made there.
  let buffer: Buffer;
  try {
    const resolve = createImageResolver();
    const [photos, zones] = await Promise.all([
      Promise.all(
        report.photos.map(async (p) => ({
          ...p,
          url: await resolve(p.url, GRID_PHOTO_RESIZE),
        })),
      ),
      Promise.all(
        report.zones.map(async (z) => ({
          ...z,
          mapImageUrl: z.mapImageUrl ? await resolve(z.mapImageUrl) : z.mapImageUrl,
        })),
      ),
    ]);
    const pdfReport: AnchorReportData = { ...report, photos, zones };

    const html = buildAnchorPrintHTML(pdfReport, loadReportAssets());
    buffer = await renderPDF(html);
  } catch (err) {
    console.error("[SaveAnchorReport] PDF failed:", err);
    return NextResponse.json(
      { error: "PDF generation failed." },
      { status: 500 },
    );
  }

  const { job, site } = await saveReportToDestinations(
    companyId,
    parsedJobId,
    siteId,
    destinations,
    cleanFilename,
    buffer,
    "[SaveAnchorReport]",
  );

  return NextResponse.json({ filename: cleanFilename, job, site }, { status: 200 });
}
