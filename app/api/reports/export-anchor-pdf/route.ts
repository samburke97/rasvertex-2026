import { NextRequest, NextResponse } from "next/server";
import { pdfDownloadResponse } from "@/lib/server/pdf-utils";
import { buildAnchorPDF } from "@/lib/server/anchorPdf";
import type { AnchorReportData } from "@/lib/reports/anchor.types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { filename?: string; report?: AnchorReportData };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { filename = "report", report } = body;
  if (!report)
    return NextResponse.json(
      { error: "report data is required" },
      { status: 400 },
    );

  try {
    const buffer = await buildAnchorPDF(report);
    return pdfDownloadResponse(buffer, filename);
  } catch (err) {
    console.error("[ExportAnchorPDF]", err);
    return NextResponse.json(
      { error: "PDF generation failed." },
      { status: 500 },
    );
  }
}
