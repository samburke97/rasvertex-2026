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
import { createImageResolver, GRID_PHOTO_RESIZE } from "@/lib/server/resolveReportImages";
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
    // The print templates only ever look up a photo by id — the cover via
    // job.sitePhotoId, each finding via its own photoId (max 6 findings) —
    // so at most 7 photos ever actually render. The pool itself can hold
    // far more (every attachment pulled from the quote), so resolve only
    // what's referenced instead of the whole pool.
    const coverPhotoId = report.job.sitePhotoId;
    const referencedIds = new Set(
      [coverPhotoId, ...report.findings.map((f) => f.photoId)].filter(
        (id): id is string => !!id,
      ),
    );
    const resolve = createImageResolver();
    const photos = await Promise.all(
      report.photos
        .filter((p) => referencedIds.has(p.id))
        .map(async (p) => ({
          ...p,
          // The cover photo renders up to ~1400px wide (see buildCover in
          // proposal.print.ts) — full-bleed, not a grid thumbnail, so it's
          // deliberately left at its already-correct size. Finding photos
          // are ~a third of that width, closer to a grid cell.
          url: await resolve(
            p.url,
            p.id === coverPhotoId ? undefined : GRID_PHOTO_RESIZE,
          ),
        })),
    );
    const pdfReport: ProposalData = { ...report, photos };

    const assets = loadReportAssets();
    // Same top/bottom margin on both renders so every page — front matter
    // or numbered — has identical breathing room and the two documents
    // line up visually once merged.
    const margin = { top: "80px", right: "0", bottom: "80px", left: "0" };

    const frontMatterHtml = buildProposalFrontMatterHTML(pdfReport, assets);
    const numberedHtml = buildProposalNumberedHTML(pdfReport, assets);

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
