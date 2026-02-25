// app/api/report/upload/route.ts
// Accepts a PDF (as base64) and uploads it to a SimPRO job as an attachment.
// Called as the final step in the wizard after PDF generation.

import { NextRequest, NextResponse } from "next/server";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

export const dynamic = "force-dynamic";

interface UploadBody {
  jobId: number;
  companyId?: number;
  pdfBase64: string; // base64-encoded PDF bytes
  filename: string; // e.g. "baywatch-variation-report.pdf"
  folderName?: string; // optional SimPRO folder name, defaults to "Reports"
}

export async function POST(request: NextRequest) {
  try {
    if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "SimPRO configuration missing" },
        { status: 500 },
      );
    }

    const body: UploadBody = await request.json();
    const {
      jobId,
      companyId = 0,
      pdfBase64,
      filename,
      folderName = "Reports",
    } = body;

    if (!jobId || !pdfBase64 || !filename) {
      return NextResponse.json(
        { error: "Missing required fields: jobId, pdfBase64, filename" },
        { status: 400 },
      );
    }

    // SimPRO attachment upload expects multipart/form-data
    // We convert base64 back to a Buffer then into a Blob for the form
    const pdfBuffer = Buffer.from(pdfBase64, "base64");
    const pdfBlob = new Blob([pdfBuffer], { type: "application/pdf" });

    const formData = new FormData();
    formData.append("File", pdfBlob, filename);
    formData.append("Filename", filename);
    formData.append("Public", "false");
    formData.append("Email", "false");

    // If a folder name is provided, SimPRO needs the folder ID.
    // We'll create the folder if it doesn't exist, or just upload without a folder
    // if that step fails — keeping the upload non-blocking.
    let folderId: number | null = null;
    try {
      folderId = await ensureFolder(companyId, jobId, folderName);
    } catch {
      console.warn(
        "Could not resolve SimPRO folder — uploading without folder",
      );
    }

    if (folderId) {
      formData.append("Folder", JSON.stringify({ ID: folderId }));
    }

    const uploadUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/files/`;

    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
        // Do NOT set Content-Type — fetch sets it automatically with the boundary for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SimPRO upload error:", errorText);
      return NextResponse.json(
        {
          error: "Failed to upload PDF to SimPRO",
          details: errorText,
          status: response.status,
        },
        { status: response.status },
      );
    }

    const result = await response.json();

    return NextResponse.json({
      success: true,
      attachmentId: result.ID,
      filename: result.Filename,
      message: `PDF saved to SimPRO job ${jobId}`,
    });
  } catch (error) {
    console.error("Upload route error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload PDF",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Find or create a folder on the SimPRO job by name.
 * Returns the folder ID.
 */
async function ensureFolder(
  companyId: number,
  jobId: number,
  folderName: string,
): Promise<number> {
  const listUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/folders/`;

  const listRes = await fetch(listUrl, {
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
  });

  if (!listRes.ok) throw new Error("Could not list folders");

  const folders: Array<{ ID: number; Name: string }> = await listRes.json();
  const existing = folders.find(
    (f) => f.Name.toLowerCase() === folderName.toLowerCase(),
  );

  if (existing) return existing.ID;

  // Create the folder
  const createRes = await fetch(listUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Name: folderName }),
  });

  if (!createRes.ok) throw new Error("Could not create folder");

  const created: { ID: number } = await createRes.json();
  return created.ID;
}
