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

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.8;
// Below this we skip re-encoding entirely — not worth the CPU/quality cost.
const SKIP_BELOW_BYTES = 400_000;

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

/**
 * Downscales + re-encodes a base64 image data URL as JPEG, capped at
 * MAX_DIMENSION on the longest edge. Returns the input unchanged for
 * non-image inputs, anything already small, or if canvas decoding fails for
 * any reason — compression is a size optimisation, never a hard requirement.
 */
export async function compressImageDataUrl(dataUrl: string): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:image/")) return dataUrl;
  if (approxDataUrlBytes(dataUrl) < SKIP_BELOW_BYTES) return dataUrl;

  try {
    const img = await loadImage(dataUrl);
    const { naturalWidth: width, naturalHeight: height } = img;
    if (!width || !height) return dataUrl;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    // Guard against pathological cases (e.g. re-encoding a tiny/simple PNG
    // as JPEG comes out larger) — only use the result if it's actually smaller.
    return approxDataUrlBytes(compressed) < approxDataUrlBytes(dataUrl)
      ? compressed
      : dataUrl;
  } catch {
    return dataUrl;
  }
}
