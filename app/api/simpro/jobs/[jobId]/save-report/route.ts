import { NextRequest, NextResponse } from "next/server";
import { buildPrintHTML } from "@/lib/reports/condition.print";
import { loadReportAssets, renderPDF } from "@/lib/server/pdf-utils";
import {
  checkDuplicateAttachment,
  uploadPDFToJob,
  getSimproConfig,
} from "@/lib/server/simpro";
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
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { filename, report, photoData = {}, companyId = 0 } = body;
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

  const cleanFilename = filename.trim().replace(/\.pdf$/i, "") + ".pdf";

  // Duplicate check
  try {
    const duplicate = await checkDuplicateAttachment(
      companyId,
      parsedJobId,
      cleanFilename,
    );
    if (duplicate) {
      return NextResponse.json(
        {
          error: `A file named "${cleanFilename}" already exists on this job.`,
          code: "DUPLICATE_FILENAME",
          existingFile: { id: duplicate.ID, filename: duplicate.Filename },
        },
        { status: 409 },
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: "Could not verify existing attachments.",
        code: "LIST_FETCH_FAILED",
      },
      { status: 502 },
    );
  }

  // Build + render PDF
  const pdfReport: ConditionReportData = {
    ...report,
    photos: report.photos.map((p) => ({
      ...p,
      url: photoData[p.id] ?? p.url ?? "",
    })),
  };

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

  // Upload
  try {
    const attachment = await uploadPDFToJob(
      companyId,
      parsedJobId,
      cleanFilename,
      buffer,
    );
    return NextResponse.json(
      { success: true, filename: cleanFilename, attachment },
      { status: 201 },
    );
  } catch (err) {
    console.error("[SaveReport] Upload failed:", err);
    return NextResponse.json(
      { error: "Failed to upload PDF to SimPRO." },
      { status: 502 },
    );
  }
}
