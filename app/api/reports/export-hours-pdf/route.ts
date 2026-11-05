import { NextRequest, NextResponse } from "next/server";
import { buildHoursPDF } from "@/lib/server/hoursPdf";
import { pdfDownloadResponse } from "@/lib/server/pdf-utils";
import type { HoursBreakdownData } from "@/lib/reports/hours.types";

export async function POST(request: NextRequest) {
  let body: { filename?: string; report?: HoursBreakdownData };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { filename = "Hours Breakdown", report } = body;
  if (!report)
    return NextResponse.json(
      { error: "report data is required" },
      { status: 400 },
    );

  try {
    const buffer = await buildHoursPDF(report);
    return pdfDownloadResponse(buffer, filename);
  } catch (err) {
    console.error("[ExportHoursPDF]", err);
    return NextResponse.json(
      { error: "PDF generation failed." },
      { status: 500 },
    );
  }
}
