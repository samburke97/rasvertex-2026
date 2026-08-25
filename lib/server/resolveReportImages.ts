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

import { createUploadQueue } from "@/lib/reports/uploadQueue";

const CONCURRENCY = 16;

async function resolveOne(url: string | null | undefined): Promise<string> {
  if (!url || !url.startsWith("http")) return url ?? "";
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    // Fall back to the URL itself — Puppeteer will still try to fetch it
    // directly, just without the speed benefit of doing it in parallel here.
    return url;
  }
}

/**
 * Returns a resolver function sharing one concurrency-bounded queue — pass
 * every image url in a report through the *same* resolver instance so they
 * all draw from one pool instead of each Promise.all bypassing the limit.
 */
export function createImageResolver() {
  const schedule = createUploadQueue(CONCURRENCY);
  return (url: string | null | undefined): Promise<string> =>
    schedule(() => resolveOne(url));
}
