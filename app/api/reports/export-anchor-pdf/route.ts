import { NextRequest, NextResponse } from "next/server";
import { buildAnchorPrintHTML } from "@/lib/reports/anchor.print";
import {
  loadReportAssets,
  renderPDF,
  pdfDownloadResponse,
} from "@/lib/server/pdf-utils";
import type { AnchorReportData } from "@/lib/reports/anchor.types";

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
    const html = buildAnchorPrintHTML(report, loadReportAssets());
    const buffer = await renderPDF(html);
    return pdfDownloadResponse(buffer, filename);
  } catch (err) {
    console.error("[ExportAnchorPDF]", err);
    return NextResponse.json(
      { error: "PDF generation failed." },
      { status: 500 },
    );
  }
}
