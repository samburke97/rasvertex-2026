// app/api/report/generate/route.ts
// Receives report data from the wizard, builds HTML, runs Puppeteer, returns PDF.
// maxDuration: 60 set in vercel.json

import { NextRequest, NextResponse } from "next/server";
import { generatePdfFromHtml } from "@/lib/report/pdf";
import { buildVariationReportHtml } from "@/lib/report/templates/variation";
import { buildInspectionReportHtml } from "@/lib/report/templates/inspection";
import { buildCompletionReportHtml } from "@/lib/report/templates/completion";
import type { ReportData } from "@/lib/report/templates/variation";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = body as ReportData;

    // Basic validation
    if (!data.projectTitle || !data.reportType) {
      return NextResponse.json(
        { error: "Missing required fields: projectTitle, reportType" },
        { status: 400 },
      );
    }

    const validTypes = ["variation", "inspection", "completion"];
    if (!validTypes.includes(data.reportType)) {
      return NextResponse.json(
        {
          error: `Invalid reportType. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Build the HTML from the appropriate template
    let html: string;
    switch (data.reportType) {
      case "inspection":
        html = buildInspectionReportHtml(data);
        break;
      case "completion":
        html = buildCompletionReportHtml(data);
        break;
      case "variation":
      default:
        html = buildVariationReportHtml(data);
        break;
    }

    // Generate PDF via Puppeteer
    const pdfBuffer = await generatePdfFromHtml(html, {
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });

    // Build a clean filename
    const safeTitle = data.projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const reportLabel = data.reportType;
    const filename = `${safeTitle}-${reportLabel}-report.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
