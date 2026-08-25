// app/api/simpro/jobs/[jobId]/save-hours-report/route.ts
// Mirrors save-anchor-report — Hours Breakdown has no photos, so there's
// nothing here to resolve from Blob (see resolveReportImages.ts for why
// that step exists for the other report types).

import { NextRequest, NextResponse } from "next/server";
import { buildHoursPrintHTML } from "@/lib/reports/hours.print";
import { loadReportAssets, renderPDF } from "@/lib/server/pdf-utils";
import { saveReportToDestinations, getSimproConfig } from "@/lib/server/simpro";
import type { HoursBreakdownData } from "@/lib/reports/hours.types";

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
    report?: HoursBreakdownData;
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

  let buffer: Buffer;
  try {
    const html = buildHoursPrintHTML(report, loadReportAssets());
    buffer = await renderPDF(html);
  } catch (err) {
    console.error("[SaveHoursReport] PDF failed:", err);
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
    "[SaveHoursReport]",
  );

  return NextResponse.json({ filename: cleanFilename, job, site }, { status: 200 });
}
