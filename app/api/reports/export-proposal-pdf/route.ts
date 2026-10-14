// app/api/reports/export-proposal-pdf/route.ts
//
// Renders the Painting proposal to PDF from the very same component the
// builder previews (ProposalDocument), so what the rep sees is what the
// client gets. The document is a fixed 1440px wide; before printing it is
// laid onto 1440px pages of A4 proportion (lib/reports/proposal/paginate.ts),
// with whole sections moved rather than split, footers and page numbers.
//
// With saveToQuote, the finished PDF is also attached to the SimPRO quote
// (replacing an earlier export of the same name). The download is returned
// either way; X-Saved-To-Quote says whether the attachment succeeded.

import fs from "fs";
import path from "path";
import { createElement } from "react";
import sharp from "sharp";
import { NextRequest, NextResponse } from "next/server";
import ProposalDocument, {
  type ProposalDocAssets,
} from "@/components/reports/proposal/builder/ProposalDocument";
import {
  CLIENT_LOGOS,
  CLIENT_LOGO_DIR,
  SERVICES,
  isProposalData,
  referencedPhotoIds,
  todayLong,
  type ProposalData,
} from "@/lib/reports/proposal.types";
import { paginateScript } from "@/lib/reports/proposal/paginate";
import { pdfDownloadResponse, readPublicAsBase64, renderPDF } from "@/lib/server/pdf-utils";
import { createImageResolver, GRID_PHOTO_RESIZE } from "@/lib/server/resolveReportImages";
import { getSimproConfig, saveQuoteAttachment } from "@/lib/server/simpro";

export const maxDuration = 60;

// 1440 × (1440 × √2): A4 proportions at the document's own width.
const PAGE_W = 1440;
const PAGE_H = 2036;
const PAGE = { width: `${PAGE_W}px`, height: `${PAGE_H}px` };

interface StaticAssets {
  doc: ProposalDocAssets;
  clientLogos: Record<string, string>;
  fonts: { inter: string; bebas: string; script: string };
}

// The static images are print-sized once per server instance: the service
// photos in public/ are 3-5MB PNGs, far beyond the ~450px cards they fill.
async function shrink(rel: string, maxWidth: number, format: "jpeg" | "png"): Promise<string> {
  try {
    const input = fs.readFileSync(path.join(process.cwd(), "public", rel));
    const img = sharp(input).resize({ width: maxWidth, withoutEnlargement: true });
    const out = format === "png" ? await img.png().toBuffer() : await img.jpeg({ quality: 80 }).toBuffer();
    return `data:image/${format};base64,${out.toString("base64")}`;
  } catch {
    return readPublicAsBase64(rel);
  }
}

let _assets: Promise<StaticAssets> | null = null;

function loadAssets(): Promise<StaticAssets> {
  _assets ??= (async () => {
    const clientLogos: Record<string, string> = {};
    for (const [name, { file }] of Object.entries(CLIENT_LOGOS)) {
      const rel = CLIENT_LOGO_DIR.replace(/^\//, "") + file;
      if (fs.existsSync(path.join(process.cwd(), "public", rel))) {
        clientLogos[name] = readPublicAsBase64(rel);
      }
    }
    const services = await Promise.all(
      SERVICES.map(async (s) => [s.id, await shrink(s.img.replace(/^\//, ""), 900, "jpeg")] as const),
    );
    return {
      doc: {
        logo: await shrink("reports/proposal/assets/logo-full.png", 800, "png"),
        haymes: readPublicAsBase64("reports/proposal/assets/haymes.svg"),
        dulux: readPublicAsBase64("reports/proposal/assets/dulux.svg"),
        services: Object.fromEntries(services),
      },
      clientLogos,
      fonts: {
        inter: readPublicAsBase64("fonts/inter.woff2"),
        bebas: readPublicAsBase64("fonts/bebas-neue.woff2"),
        script: readPublicAsBase64("fonts/la-belle-aurore.woff2"),
      },
    };
  })();
  return _assets;
}

async function buildHTML(report: ProposalData): Promise<string> {
  const assets = await loadAssets();

  // Only the photos the document actually shows get fetched and inlined.
  // Cover and aerial render near full width, so they keep their size;
  // finding photos are a third of the page and get the grid resize.
  const ids = referencedPhotoIds(report);
  const resolve = createImageResolver();
  const resolved = new Map<string, string>();
  await Promise.all(
    report.photos
      .filter((ph) => ids.has(ph.id))
      .map(async (ph) => {
        const fullSize = ph.id === report.cover.photo || ph.id === report.access.aerial;
        resolved.set(ph.id, await resolve(ph.url, fullSize ? undefined : GRID_PHOTO_RESIZE));
      }),
  );

  // Dynamic import keeps react-dom/server out of the route's module graph
  // until it's actually needed.
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(
    createElement(ProposalDocument, {
      p: report,
      photoUrl: (id) => (id ? (resolved.get(id) ?? null) : null),
      assets: assets.doc,
      clientLogos: assets.clientLogos,
      today: todayLong(),
    }),
  );

  const { inter, bebas, script } = assets.fonts;
  const title = `Proposal - ${report.job.building} - Q${report.quote}`.replace(/[<>&"]/g, "");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
@font-face{font-family:'Inter';font-weight:300 700;font-style:normal;src:url("${inter}") format('woff2');}
@font-face{font-family:'Bebas Neue';font-weight:400;font-style:normal;src:url("${bebas}") format('woff2');}
@font-face{font-family:'La Belle Aurore';font-weight:400;font-style:normal;src:url("${script}") format('woff2');}
@page{size:${PAGE.width} ${PAGE.height};margin:0;}
*{box-sizing:border-box;}
html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
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
  if (!isProposalData(report)) {
    return NextResponse.json({ error: "proposal data is required" }, { status: 400 });
  }

  const filename =
    safeName(`Proposal - ${report.job.building || "Painting"} - Q${report.quote}`) + ".pdf";

  let buffer: Buffer;
  try {
    const html = await buildHTML(report);
    buffer = await renderPDF(html, {
      pageSize: PAGE,
      prepareScript: paginateScript({
        width: PAGE_W,
        height: PAGE_H,
        footerLeft: `RAS-VERTEX · Proposal Q ${report.quote}`,
      }),
    });
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
