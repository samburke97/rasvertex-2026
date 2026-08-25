// app/api/reports/photo-upload/route.ts
// Issues client tokens for direct browser → Vercel Blob uploads of report
// photos. The image bytes never pass through this route (or any Serverless
// Function body) — that's the point: Vercel caps request bodies at 4.5MB,
// and a photo-heavy report (100+ site photos) blows past that in a single
// POST every time, no matter how much the photos are compressed first. See
// lib/reports/compressImage.ts for the fuller explanation.

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { deleteBlobPhotos } from "@/lib/server/deleteBlobPhotos";

// Used when a tech removes a single photo while editing a report — deletes
// that one blob rather than leaving it orphaned. Report-level deletion
// (dropping a whole draft) is handled separately in each report type's
// store.ts, since that already has the full row (and every photo url) in
// hand right where the DB row itself gets deleted.
export async function DELETE(request: Request): Promise<NextResponse> {
  const { url } = (await request.json()) as { url?: string };
  if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });
  await deleteBlobPhotos([url]);
  return NextResponse.json({ success: true });
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {
        // Nothing to persist here — the caller stores the returned URL on
        // the report itself, same as any other photo field.
      },
    });
    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
