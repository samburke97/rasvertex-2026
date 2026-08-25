// lib/server/resolveReportImages.ts
// Fetches every Blob-hosted photo a report references and inlines it as a
// base64 data: URL before Puppeteer renders it.
//
// Blob URLs (see lib/reports/uploadPhoto.ts) fixed Vercel's 4.5MB
// request/response cap by keeping report payloads small — but that left
// Puppeteer to fetch every photo itself, one network round trip per image,
// during page.setContent(). For a 100+ photo report that pushed export past
// a minute, since Chromium doesn't meaningfully parallelize past ~6
// connections per origin. Resolving every photo here, in parallel with far
// higher concurrency, and inlining the result as base64 is purely internal
// to the render step — it never crosses a Vercel Function request/response
// boundary, so it doesn't reintroduce the payload-size problem this exists
// to avoid.
//
// Grid photos also get resized down here — see GRID_PHOTO_RESIZE below.

import sharp from "sharp";
import { createUploadQueue } from "@/lib/reports/uploadQueue";

const CONCURRENCY = 16;

export interface ResizeTo {
  maxDimension: number;
  quality: number; // 1-100
}

// compressImage.ts compresses grid photos to 1280px for the on-screen
// editor, where a tech might view one larger than its grid cell — but the
// largest a photo ever actually renders in the PDF is a 390x390 grid cell
// (PHOTO_LAYOUTS.large in lib/reports/photos.ts). Shipping the full 1280px
// version into the PDF means the file is dominated by resolution nothing
// ever displays: a 256-photo report came out to 37MB — almost exactly
// photo-count × the editor-quality file size — because Chromium mostly
// just sums up whatever it's handed. Re-encoding down to a size that
// actually matches print use is the same fix a PDF-compression tool finds
// after the fact; doing it here means the PDF is small from the start.
// Benchmarked against a real 256-photo report's actual files (not a
// guess): a tighter 500/60 setting matched an external PDF compressor's
// result (~5.5MB) almost exactly, but these are inspection/condition
// photos where detail can matter — quality 75 trades some of that size
// back for visibly better quality, landing at roughly 8.5-9MB for the same
// report (~7.3MB was measured at quality 65; the jump to 75 is
// extrapolated from same-dimension quality deltas measured elsewhere,
// cross-checked against an independently measured 600/68 result landing in
// the same range). Still under a quarter of the original 37MB. Cover
// photos and Anchor zone maps are deliberately NOT resized this way — they
// render full-bleed near page width, so 1280-1600px is correctly sized
// already, not oversized like a grid thumbnail is.
export const GRID_PHOTO_RESIZE: ResizeTo = { maxDimension: 560, quality: 75 };

async function resolveOne(
  url: string | null | undefined,
  resize?: ResizeTo,
): Promise<string> {
  if (!url || !url.startsWith("http")) return url ?? "";
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    let buffer = Buffer.from(await res.arrayBuffer());
    let contentType = res.headers.get("content-type") || "image/jpeg";

    if (resize) {
      buffer = await sharp(buffer)
        .resize({
          width: resize.maxDimension,
          height: resize.maxDimension,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: resize.quality })
        .toBuffer();
      contentType = "image/jpeg";
    }

    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    // Fall back to the URL itself — Puppeteer will still try to fetch it
    // directly, just without the speed/size benefit of resolving it here.
    return url;
  }
}

/**
 * Returns a resolver function sharing one concurrency-bounded queue — pass
 * every image url in a report through the *same* resolver instance so they
 * all draw from one pool instead of each Promise.all bypassing the limit.
 * Pass `resize` for grid photos (see GRID_PHOTO_RESIZE); omit it for a
 * full-bleed image (cover photo, zone map) that's already correctly sized.
 */
export function createImageResolver() {
  const schedule = createUploadQueue(CONCURRENCY);
  return (url: string | null | undefined, resize?: ResizeTo): Promise<string> =>
    schedule(() => resolveOne(url, resize));
}
