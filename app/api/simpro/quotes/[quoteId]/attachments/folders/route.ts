// app/api/simpro/quotes/[quoteId]/attachments/folders/route.ts
//
// Lists a quote's photo folders, with how many images each holds, so the
// Proposal builder's Quote step can show one chip per folder before any
// (slow) photo download starts. Built from the attachment file list rather
// than SimPRO's folders endpoint so the counts are image-only and unfiled
// photos still show up (under id "none" — the attachments stream accepts
// the same id as its folderId filter).

import { NextRequest, NextResponse } from "next/server";
import { getSimproConfig, simproFetch } from "@/lib/server/simpro";

const SIMPRO_PAGE_SIZE = 250;
const MAX_ATTACHMENTS = 500;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic|heif)$/i;

interface SimproAttachmentListItem {
  ID: string;
  Filename: string;
  Folder?: { ID: number; Name: string } | null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { quoteId } = await params;
  const parsedQuoteId = parseInt(quoteId, 10);
  if (!quoteId || isNaN(parsedQuoteId) || parsedQuoteId <= 0) {
    return NextResponse.json({ error: "Invalid quote ID" }, { status: 400 });
  }

  let baseUrl: string;
  try {
    baseUrl = getSimproConfig().baseUrl;
  } catch {
    return NextResponse.json({ error: "SimPRO configuration missing" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = parseInt(searchParams.get("companyId") || "0", 10);

  try {
    const files: SimproAttachmentListItem[] = [];
    for (let page = 1; files.length < MAX_ATTACHMENTS; page++) {
      const pageItems = await simproFetch<SimproAttachmentListItem[]>(
        `${baseUrl}/api/v1.0/companies/${companyId}/quotes/${parsedQuoteId}/attachments/files/?pageSize=${SIMPRO_PAGE_SIZE}&page=${page}&columns=ID,Filename,Folder`,
      );
      files.push(...pageItems);
      if (pageItems.length < SIMPRO_PAGE_SIZE) break;
    }

    const order: string[] = [];
    const folders = new Map<string, { id: string; name: string; count: number }>();
    for (const f of files.slice(0, MAX_ATTACHMENTS)) {
      if (!IMAGE_EXT.test(f.Filename)) continue;
      const id = f.Folder ? String(f.Folder.ID) : "none";
      if (!folders.has(id)) {
        folders.set(id, { id, name: f.Folder?.Name?.trim() || "Unfiled", count: 0 });
        order.push(id);
      }
      folders.get(id)!.count++;
    }

    return NextResponse.json({ folders: order.map((id) => folders.get(id)!) });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // No attachments yet comes back as a 404 — that's just "no folders".
    if (msg.includes("404")) return NextResponse.json({ folders: [] });
    console.warn(`[QuoteAttachmentFolders] quote ${parsedQuoteId}:`, msg);
    return NextResponse.json({ error: "Failed to list photo folders" }, { status: 502 });
  }
}
