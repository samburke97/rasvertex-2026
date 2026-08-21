// lib/reports/compressImage.ts
//
// Photos come in from SimPRO at full camera resolution (often 3-5MB each as
// base64) and get stored directly in report state — which then gets
// JSON-serialized on every autosave, save-to-job/site, and PDF export.
// Uncompressed, a handful of photos is enough to blow past Vercel's 4.5MB
// serverless request-body cap (the cause of "export fails past ~5 photos").
// Downscaling + re-encoding once at import time, in-state, fixes payload
// size everywhere at once instead of patching each call site separately.
//
// Client-only (uses Image/canvas) — only ever called from "use client" report
// pages, right when a photo is fetched.

// Tuned to keep photo-heavy reports under Vercel's payload cap without an
// artificial photo-count limit. Grid cells in the PDF top out around
// 390x390 (see PHOTO_LAYOUTS in photos.ts), so 1280px source + q0.65 is
// still crisp at that display size while cutting typical output well
// below the old 1600px/q0.8 setting. This is the default — callers
// rendering an image much larger than a grid thumbnail (a full-bleed zone
// aerial, displayed near full page/viewport width) should pass a higher
// MapImageOpts instead; see compressMapImageDataUrl.
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.65;
// Below this we skip re-encoding entirely — not worth the CPU/quality cost.
const SKIP_BELOW_BYTES = 150_000;

// A zone/site aerial is a single image displayed as the full background of
// the editor and the printed report — often near full page width (up to
// ~2000px) — not a small grid cell. Static Maps' own hard API ceiling is
// 1280x1280px (scale=2 on a 640x640 request; this holds regardless of
// billing plan), so there's no more real detail to keep above that; the fix
// is not re-crushing it afterward. q0.65 on dense aerial texture (roof
// tiles, foliage) produced visible blocking once stretched across most of a
// screen — q0.92 keeps that away while still re-encoding (uploaded phone
// photos can be 10MB+ uncompressed).
const MAP_MAX_DIMENSION = 1600;
const MAP_JPEG_QUALITY = 0.92;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = src;
  });
}

/** Roughly the decoded byte length of a base64 data URL, without allocating. */
function approxDataUrlBytes(dataUrl: string): number {
  const commaIdx = dataUrl.indexOf(",");
  const b64Len = commaIdx === -1 ? dataUrl.length : dataUrl.length - commaIdx - 1;
  return Math.floor(b64Len * 0.75);
}

async function compress(
  dataUrl: string,
  maxDimension: number,
  quality: number,
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
  if (approxDataUrlBytes(dataUrl) < SKIP_BELOW_BYTES) return dataUrl;

  try {
    const img = await loadImage(dataUrl);
    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) return dataUrl;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL("image/jpeg", quality);
    // Guard against pathological cases (e.g. re-encoding a tiny/simple PNG
    // as JPEG comes out larger) — only use the result if it's actually smaller.
    return approxDataUrlBytes(compressed) < approxDataUrlBytes(dataUrl)
      ? compressed
      : dataUrl;
  } catch {
    return dataUrl;
  }
}

/**
 * Downscales + re-encodes a base64 image data URL as JPEG, capped at
 * MAX_DIMENSION on the longest edge. Returns the input unchanged for
 * non-image inputs, anything already small, or if canvas decoding fails for
 * any reason — compression is a size optimisation, never a hard requirement.
 * For a zone/site aerial map image, use compressMapImageDataUrl instead —
 * this default is tuned for small PDF photo-grid thumbnails and visibly
 * over-compresses a full-bleed background image.
 */
export function compressImageDataUrl(dataUrl: string): Promise<string> {
  return compress(dataUrl, MAX_DIMENSION, JPEG_QUALITY);
}

/**
 * Same idea as compressImageDataUrl, but for a zone/site aerial — captured
 * or uploaded — that gets displayed as a full-bleed background near page/
 * viewport width rather than a small grid thumbnail. See MAP_MAX_DIMENSION/
 * MAP_JPEG_QUALITY above for why the defaults differ.
 */
export function compressMapImageDataUrl(dataUrl: string): Promise<string> {
  return compress(dataUrl, MAP_MAX_DIMENSION, MAP_JPEG_QUALITY);
}
