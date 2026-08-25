// lib/reports/uploadPhoto.ts
// Uploads a compressed photo (already a data: URL from compressImage.ts)
// straight from the browser to Vercel Blob, returning a public https URL to
// store on the report instead of the base64 string. This is what actually
// keeps report payloads (autosave PATCH, PDF export POST) under Vercel's
// 4.5MB request-body cap for photo-heavy reports — compression alone gets
// individual photos smaller, but 100+ of them still adds up past the cap if
// they're embedded as base64 in the same request. Uploading via the client
// token flow (upload() from @vercel/blob/client) means the image bytes go
// browser → Blob directly, never through one of our own Serverless Functions.
//
// Client-only — only ever called from "use client" report pages.

import { upload } from "@vercel/blob/client";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/data:(.*?);base64/)?.[1] ?? "image/jpeg";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/**
 * Uploads a data: URL to Blob storage under the given pathname. Returns the
 * input unchanged if it isn't a data: URL (already a Blob URL, or empty) —
 * safe to call on every photo without checking first.
 */
export async function uploadReportPhoto(
  dataUrl: string,
  pathname: string,
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith("data:")) return dataUrl;

  try {
    const blob = await upload(pathname, dataUrlToBlob(dataUrl), {
      access: "public",
      handleUploadUrl: "/api/reports/photo-upload",
    });
    return blob.url;
  } catch (err) {
    // Upload is a size-safety optimisation, not a hard requirement — fall
    // back to the data URL so the photo still shows up (even if it later
    // risks the same payload-size problem this exists to avoid).
    console.error("[uploadReportPhoto]", err);
    return dataUrl;
  }
}
