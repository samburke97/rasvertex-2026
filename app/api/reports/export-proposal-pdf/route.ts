import { NextRequest, NextResponse } from "next/server";
import {
  buildProposalPrintHTML,
  buildProposalFooterTemplate,
} from "@/lib/reports/proposal.print";
import {
  loadReportAssets,
  renderPDF,
  pdfDownloadResponse,
} from "@/lib/server/pdf-utils";
import type { ProposalData } from "@/lib/reports/proposal.types";

export async function POST(request: NextRequest) {
  let body: { filename?: string; report?: ProposalData };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { filename = "Proposal", report } = body;
  if (!report) {
    return NextResponse.json({ error: "report data is required" }, { status: 400 });
  }

  try {
    const assets = loadReportAssets();
    const html = buildProposalPrintHTML(report, assets);
    const buffer = await renderPDF(html, {
      // Symmetric top/bottom so every page has the same breathing room
      // above its first line as below its last, whether or not that page
      // happens to start mid-flow after a natural page break.
      margin: { top: "56px", right: "0", bottom: "56px", left: "0" },
      footerTemplate: buildProposalFooterTemplate(assets),
    });
    return pdfDownloadResponse(buffer, filename);
  } catch (err) {
    console.error("[ExportProposalPDF]", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}
