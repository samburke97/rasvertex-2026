// app/api/simpro/jobs/[jobId]/save-progress-report/route.ts
// Saves the Project progress report PDF to the main job (and/or its site)
// in SimPRO, as the Hours breakdown's save does.

import { NextRequest, NextResponse } from "next/server";
import { buildProgressPDF } from "@/lib/server/progressPdf";
import { saveReportToDestinations, getSimproConfig } from "@/lib/server/simpro";
import { isProgressReport } from "@/lib/reports/projectProgress";

export async function POST(request: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    getSimproConfig();
  } catch {
    return NextResponse.json({ error: "SimPRO configuration missing" }, { status: 500 });
  }
  const { jobId } = await params;
  const id = parseInt(jobId, 10);
  if (!id || id <= 0) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });

  const body = (await request.json().catch(() => null)) as {
    filename?: string;
    report?: unknown;
    companyId?: number;
    siteId?: string;
    destinations?: { job?: boolean; site?: boolean };
  } | null;
  if (!body?.filename?.trim()) return NextResponse.json({ error: "filename is required" }, { status: 400 });
  if (!isProgressReport(body.report)) return NextResponse.json({ error: "report data is required" }, { status: 400 });
  const destinations = body.destinations ?? { job: true, site: false };
  if (!destinations.job && !destinations.site) return NextResponse.json({ error: "At least one save destination is required" }, { status: 400 });

  const filename = body.filename.trim().replace(/\.pdf$/i, "") + ".pdf";
  let buffer: Buffer;
  try {
    buffer = await buildProgressPDF(body.report);
  } catch (err) {
    console.error("[SaveProgressReport] PDF failed:", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
  const { job, site } = await saveReportToDestinations(body.companyId ?? 0, id, body.siteId, destinations, filename, buffer, "[SaveProgressReport]");
  return NextResponse.json({ filename, job, site }, { status: 200 });
}
