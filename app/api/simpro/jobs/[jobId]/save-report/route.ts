import { NextRequest, NextResponse } from "next/server";
import { buildPrintHTML } from "@/lib/reports/condition.print";
import { loadReportAssets, renderPDF } from "@/lib/server/pdf-utils";
import { saveReportToDestinations, getSimproConfig } from "@/lib/server/simpro";
import type { ConditionReportData } from "@/lib/reports/condition.types";

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
    report?: ConditionReportData;
    photoData?: Record<string, string>;
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
    photoData = {},
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

  const pdfReport: ConditionReportData = {
    ...report,
    photos: report.photos.map((p) => ({
      ...p,
      url: photoData[p.id] ?? p.url ?? "",
    })),
  };

  // Build + render PDF once, then fan out to whichever destinations were requested.
  let buffer: Buffer;
  try {
    const html = buildPrintHTML(pdfReport, loadReportAssets());
    buffer = await renderPDF(html);
  } catch (err) {
    console.error("[SaveReport] PDF failed:", err);
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
    "[SaveReport]",
  );

  return NextResponse.json({ filename: cleanFilename, job, site }, { status: 200 });
}
