// app/api/reports/project-progress/pdf/route.ts
// POST { filename, report } → the Project progress report as a PDF download.

import { NextRequest, NextResponse } from "next/server";
import { isProgressReport } from "@/lib/reports/projectProgress";
import { buildProgressPDF } from "@/lib/server/progressPdf";
import { pdfDownloadResponse } from "@/lib/server/pdf-utils";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { filename?: string; report?: unknown } | null;
  if (!body || !isProgressReport(body.report)) return NextResponse.json({ error: "report is required" }, { status: 400 });
  try {
    return pdfDownloadResponse(await buildProgressPDF(body.report), body.filename || "Project Progress");
  } catch (err) {
    console.error("[ProjectProgressPDF]", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}
