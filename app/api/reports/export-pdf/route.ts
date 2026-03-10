import { NextRequest, NextResponse } from "next/server";
import { buildPrintHTML } from "@/lib/reports/condition.print";
import {
  loadReportAssets,
  renderPDF,
  pdfDownloadResponse,
} from "@/lib/server/pdf-utils";
import type { ConditionReportData } from "@/lib/reports/condition.types";

export async function POST(request: NextRequest) {
  let body: {
    filename?: string;
    report?: ConditionReportData;
    photoData?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { filename = "report", report, photoData = {} } = body;
  if (!report)
    return NextResponse.json(
      { error: "report data is required" },
      { status: 400 },
    );

  const pdfReport: ConditionReportData = {
    ...report,
    photos: report.photos.map((p) => ({
      ...p,
      url: photoData[p.id] ?? p.url ?? "",
    })),
  };

  try {
    const html = buildPrintHTML(pdfReport, loadReportAssets());
    const buffer = await renderPDF(html);
    return pdfDownloadResponse(buffer, filename);
  } catch (err) {
    console.error("[ExportPDF]", err);
    return NextResponse.json(
      { error: "PDF generation failed." },
      { status: 500 },
    );
  }
}
