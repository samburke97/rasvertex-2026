// app/api/reports/export-pdf/route.ts
// Job Overview → PDF download. Rendered by lib/server/overviewPdf.ts from the
// same component the builder previews.

import { NextRequest, NextResponse } from "next/server";
import { pdfDownloadResponse } from "@/lib/server/pdf-utils";
import { buildOverviewPDF } from "@/lib/server/overviewPdf";
import type { ConditionReportData } from "@/lib/reports/condition.types";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let body: { filename?: string; report?: ConditionReportData; photoData?: Record<string, string> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { filename = "report", report, photoData = {} } = body;
  if (!report) return NextResponse.json({ error: "report data is required" }, { status: 400 });

  try {
    // Older clients sent photo images separately in photoData.
    const photos = report.photos.map((p) => ({ ...p, url: photoData[p.id] ?? p.url ?? "" }));
    const buffer = await buildOverviewPDF({ ...report, photos });
    return pdfDownloadResponse(buffer, filename);
  } catch (err) {
    console.error("[ExportPDF]", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}
