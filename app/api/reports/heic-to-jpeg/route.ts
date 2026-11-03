// app/api/reports/heic-to-jpeg/route.ts
// Converts an uploaded HEIC (iPhone) photo to JPEG: Chrome can't decode HEIC
// to compress it in the browser (see lib/reports/compressImage.ts).

import { NextRequest, NextResponse } from "next/server";
import { jpegDataUrl } from "@/lib/server/heic";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const dataUrl = body?.dataUrl;
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
    return NextResponse.json({ error: "dataUrl is required" }, { status: 400 });
  }
  try {
    return NextResponse.json({ dataUrl: await jpegDataUrl(dataUrl) });
  } catch (err) {
    console.error("[heic-to-jpeg]", err);
    return NextResponse.json({ error: "Couldn't convert this photo." }, { status: 500 });
  }
}
