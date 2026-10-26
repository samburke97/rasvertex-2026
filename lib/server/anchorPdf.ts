// lib/server/anchorPdf.ts
//
// Renders the Anchor Inspection Report to PDF from the same component the
// builder previews (AnchorDocument), with every image inlined so headless
// Chrome makes no outbound requests. Used by both the Export PDF route and
// Save to SimPRO.

import fs from "fs";
import path from "path";
import { createElement } from "react";
import sharp from "sharp";
import AnchorDocument, { ANCHOR_CSS, type AnchorAssets } from "@/components/reports/anchor-inspection/AnchorDocument";
import {
  ANCHOR_ICON_NAMES,
  ANCHOR_IMAGES,
  PAGE_H,
  PAGE_W,
  anchorIconPath,
  buildAnchorModel,
  type AnchorImageKey,
} from "@/lib/reports/anchor.layout";
import { DEFAULT_COVER_IMAGE, type AnchorReportData } from "@/lib/reports/anchor.types";
import { readPublicAsBase64, renderPDF } from "@/lib/server/pdf-utils";
import { createImageResolver, GRID_PHOTO_RESIZE } from "@/lib/server/resolveReportImages";

// Raster images in public/ are often multi-MB website photos; print-size
// them once per server instance. SVGs go through as they are.
async function shrink(rel: string, maxWidth: number): Promise<string> {
  if (rel.endsWith(".svg")) return readPublicAsBase64(rel);
  try {
    const input = fs.readFileSync(path.join(process.cwd(), "public", rel));
    const img = sharp(input).resize({ width: maxWidth, withoutEnlargement: true });
    const alpha = rel.endsWith(".png") && (await sharp(input).metadata()).hasAlpha;
    const out = alpha ? await img.png().toBuffer() : await img.jpeg({ quality: 80 }).toBuffer();
    return `data:image/${alpha ? "png" : "jpeg"};base64,${out.toString("base64")}`;
  } catch {
    return readPublicAsBase64(rel);
  }
}

const WIDTHS: Partial<Record<AnchorImageKey, number>> = { logo: 800, signature: 560, caroline: 240 };

let _assets: Promise<{ doc: AnchorAssets; cover: string; fontCSS: string }> | null = null;

function loadAssets() {
  _assets ??= (async () => {
    const entries = await Promise.all(
      Object.entries(ANCHOR_IMAGES).map(
        async ([k, rel]) => [k, await shrink(rel, WIDTHS[k as AnchorImageKey] ?? 900)] as const,
      ),
    );
    const icons = Object.fromEntries(ANCHOR_ICON_NAMES.map((n) => [n, readPublicAsBase64(anchorIconPath(n))]));
    const inter = readPublicAsBase64("fonts/inter.woff2");
    const bebas = readPublicAsBase64("fonts/bebas-neue.woff2");
    return {
      doc: { images: Object.fromEntries(entries) as Record<AnchorImageKey, string>, icons },
      cover: await shrink(DEFAULT_COVER_IMAGE, 1600),
      fontCSS:
        `@font-face{font-family:'Inter';font-weight:300 700;font-style:normal;src:url("${inter}") format('woff2');}` +
        `@font-face{font-family:'Bebas Neue';font-weight:400;font-style:normal;src:url("${bebas}") format('woff2');}`,
    };
  })();
  return _assets;
}

export async function buildAnchorPDF(report: AnchorReportData): Promise<Buffer> {
  const { doc, cover, fontCSS } = await loadAssets();
  const resolve = createImageResolver();

  // Inline every image the document shows: maps and cover at full size,
  // photos at grid size.
  const [zones, photos, coverUrl] = await Promise.all([
    Promise.all(
      report.zones.map(async (z) => ({
        ...z,
        mapImageUrl: z.mapImageUrl ? await resolve(z.mapImageUrl) : z.mapImageUrl,
      })),
    ),
    report.photoSettings?.enabled
      ? Promise.all((report.photos ?? []).map(async (p) => ({ ...p, url: await resolve(p.url, GRID_PHOTO_RESIZE) })))
      : Promise.resolve([]),
    report.coverUrl ? resolve(report.coverUrl) : Promise.resolve(null),
  ]);

  const model = buildAnchorModel({ ...report, zones, photos, coverUrl }, cover);
  const { renderToStaticMarkup } = await import("react-dom/server");
  const title = `Anchor Inspection Report - ${model.site}`.replace(/[<>&"]/g, "");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>
${fontCSS}
@page{size:${PAGE_W}px ${PAGE_H}px;margin:0;}
html,body{margin:0;padding:0;background:#fff;}
${ANCHOR_CSS}
</style></head><body>${renderToStaticMarkup(createElement(AnchorDocument, { model, assets: doc }))}</body></html>`;
  return renderPDF(html, { pageSize: { width: `${PAGE_W}px`, height: `${PAGE_H}px` } });
}
