// app/api/reports/export-proposal-pdf/route.ts
//
// Renders the Painting proposal to an A4 PDF from the very same component
// the builder previews (components/reports/proposal/v3/doc/ProposalPages),
// so what the rep sees is what the client gets. Each visible page is one
// 210×297mm sheet; hidden pages are left out.
//
// With saveToQuote, the finished PDF is also attached to the SimPRO quote
// (replacing an earlier export of the same name). The download is returned
// either way; X-Saved-To-Quote says whether the attachment succeeded.

import { createElement } from "react";
import { NextRequest, NextResponse } from "next/server";
import ProposalPages from "@/components/reports/proposal/v3/doc/ProposalPages";
import { derive } from "@/lib/reports/proposal/v3/derive";
import { ASSET_DIR, isProposal, resolvePhoto, type Proposal } from "@/lib/reports/proposal/v3/types";
import { pdfDownloadResponse, readPublicAsBase64, renderPDF } from "@/lib/server/pdf-utils";
import { createImageResolver, type ResizeTo } from "@/lib/server/resolveReportImages";
import { getSimproConfig, saveQuoteAttachment } from "@/lib/server/simpro";

export const maxDuration = 60;

// Static assets in public/reports/proposal/v3 are already compressed to
// print size, so they're inlined as-is (cached per server instance).
const assetCache = new Map<string, string>();
const staticAsset = (rel: string) => {
  let hit = assetCache.get(rel);
  if (hit == null) assetCache.set(rel, (hit = readPublicAsBase64(rel)));
  return hit;
};

// Photos under findings print about 4.5in wide: 1000px is ample. Full-width
// photos (cover, project, aerial) keep their size.
const FINDING_PHOTO: ResizeTo = { maxDimension: 1000, quality: 80 };

let _fonts: { inter: string; bebas: string; script: string } | null = null;
const fonts = () =>
  (_fonts ??= {
    inter: readPublicAsBase64("fonts/inter.woff2"),
    bebas: readPublicAsBase64("fonts/bebas-neue.woff2"),
    script: readPublicAsBase64("fonts/la-belle-aurore.woff2"),
  });

async function buildHTML(p: Proposal): Promise<string> {
  const D = derive(p);
  const { renderToStaticMarkup } = await import("react-dom/server");
  const render = (img: (ref: string) => string) =>
    renderToStaticMarkup(createElement(ProposalPages, { p, D, mode: "print", img }));

  // Pass 1 collects every image the visible pages use; pass 2 renders with
  // each one inlined as a data: URL.
  const refs = new Set<string>();
  render((ref) => {
    if (ref) refs.add(ref);
    return "";
  });
  const resolve = createImageResolver();
  const resolved = new Map<string, string>();
  const findingPhotos = new Set(p.d.findings.items.map((f) => f.photo));
  const fullWidth = new Set([p.d.cover.photo, p.d.project.photo, p.d.access.aerial]);
  await Promise.all(
    [...refs].map(async (ref) => {
      const url = resolvePhoto(p, ref);
      if (!url) return;
      if (url.startsWith("data:")) resolved.set(ref, url);
      else if (url.startsWith(ASSET_DIR)) resolved.set(ref, staticAsset(url.replace(/^\//, "")));
      else resolved.set(ref, await resolve(url, findingPhotos.has(ref) && !fullWidth.has(ref) ? FINDING_PHOTO : undefined));
    }),
  );
  const body = render((ref) => resolved.get(ref) ?? "");

  const { inter, bebas, script } = fonts();
  const title = `Proposal - ${p.job.client} - Q${p.job.quote}`.replace(/[<>&"]/g, "");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
@font-face{font-family:'Inter';font-weight:200 700;font-style:normal;src:url("${inter}") format('woff2');}
@font-face{font-family:'Bebas Neue';font-weight:400;font-style:normal;src:url("${bebas}") format('woff2');}
@font-face{font-family:'La Belle Aurore';font-weight:400;font-style:normal;src:url("${script}") format('woff2');}
@page{size:A4;margin:0;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.pb3-sheet:last-child{break-after:auto!important;page-break-after:auto!important;}
</style></head><body>${body}</body></html>`;
}

function safeName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  let body: { report?: unknown; saveToQuote?: boolean; companyId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const report = body.report;
  if (!isProposal(report)) {
    return NextResponse.json({ error: "proposal data is required" }, { status: 400 });
  }

  const filename = safeName(`Proposal - ${report.job.client || report.job.building || "Painting"} - Q${report.job.quote}`) + ".pdf";

  let buffer: Buffer;
  try {
    buffer = await renderPDF(await buildHTML(report));
  } catch (err) {
    console.error("[ExportProposalPDF]", err);
    return NextResponse.json({ error: "PDF generation failed." }, { status: 500 });
  }

  let savedToQuote = false;
  const quoteId = parseInt(report.quote, 10);
  if (body.saveToQuote && quoteId > 0) {
    try {
      getSimproConfig();
      await saveQuoteAttachment(body.companyId ?? 0, quoteId, filename, buffer);
      savedToQuote = true;
    } catch (err) {
      console.error("[ExportProposalPDF] save to quote failed:", err);
    }
  }

  const res = pdfDownloadResponse(buffer, filename);
  res.headers.set("X-Saved-To-Quote", savedToQuote ? "yes" : "no");
  res.headers.set("X-Filename", encodeURIComponent(filename));
  return res;
}
