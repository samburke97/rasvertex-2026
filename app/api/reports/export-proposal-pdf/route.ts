import { NextRequest, NextResponse } from "next/server";
import { PDFDocument } from "pdf-lib";
import {
  buildProposalFrontMatterHTML,
  buildProposalNumberedHTML,
  buildProposalFooterTemplate,
} from "@/lib/reports/proposal.print";
import {
  loadReportAssets,
  renderPDF,
  pdfDownloadResponse,
} from "@/lib/server/pdf-utils";
import type { ProposalData } from "@/lib/reports/proposal.types";

// Front matter (Cover, Contents, Cover Letter) and the numbered body are
// rendered as two separate PDFs — Puppeteer's footerTemplate has no way to
// suppress itself on specific pages or offset its own page-number counter,
// so getting "no numbers on the first three pages, numbering restarts at 1
// after Contents" means giving the numbered section its own document (its
// own page.pdf() call naturally starts counting at 1) and stitching the two
// together here.
async function mergePDFs(buffers: Buffer[]): Promise<Buffer> {
  const merged = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return Buffer.from(await merged.save());
}

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
    // Same top/bottom margin on both renders so every page — front matter
    // or numbered — has identical breathing room and the two documents
    // line up visually once merged.
    const margin = { top: "80px", right: "0", bottom: "80px", left: "0" };

    const frontMatterHtml = buildProposalFrontMatterHTML(report, assets);
    const numberedHtml = buildProposalNumberedHTML(report, assets);

    const [frontMatterPdf, numberedPdf] = await Promise.all([
      renderPDF(frontMatterHtml, { margin }),
      renderPDF(numberedHtml, {
        margin,
        footerTemplate: buildProposalFooterTemplate(assets),
      }),
    ]);

    const buffer = await mergePDFs([frontMatterPdf, numberedPdf]);
    return pdfDownloadResponse(buffer, filename);
  } catch (err) {
    console.error("[ExportProposalPDF]", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }
}
