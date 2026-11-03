// lib/server/heic.ts
// iPhone photos often arrive as HEIC. Neither sharp's prebuilt binaries nor
// Chrome (which renders every PDF) can read them, so they're converted to
// JPEG on the way in (SimPRO import, uploads) and again on export for any
// that slipped through.

import convert from "heic-convert";

/** HEIC / HEIF by content (the ISO-BMFF "ftyp" brand), whatever the name. */
export function isHeic(buf: Buffer): boolean {
  if (buf.length < 12 || buf.toString("ascii", 4, 8) !== "ftyp") return false;
  const brand = buf.toString("ascii", 8, 12);
  return ["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand);
}

export async function heicToJpeg(buf: Buffer, quality = 0.9): Promise<Buffer> {
  const out = await convert({ buffer: buf, format: "JPEG", quality });
  return Buffer.from(out);
}

/** A data: URL as JPEG if it holds a HEIC image; anything else unchanged. */
export async function jpegDataUrl(dataUrl: string): Promise<string> {
  const m = dataUrl.match(/^data:[^;,]*;base64,(.*)$/);
  if (!m) return dataUrl;
  const buf = Buffer.from(m[1], "base64");
  if (!isHeic(buf)) return dataUrl;
  return `data:image/jpeg;base64,${(await heicToJpeg(buf)).toString("base64")}`;
}
