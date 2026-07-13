// app/api/simpro/jobs/[jobId]/attachments/folders/route.ts
//
// Lists a job's attachment folders so the report editor can offer "import
// all photos" vs "import from this folder only" before the (slow) photo
// download step begins.

import { NextRequest, NextResponse } from "next/server";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

interface SimproAttachmentFolder {
  ID: number;
  Name: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const parsedJobId = parseInt(jobId, 10);
  if (!jobId || isNaN(parsedJobId) || parsedJobId <= 0) {
    return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = parseInt(searchParams.get("companyId") || "0", 10);

  try {
    const res = await fetch(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}/attachments/folders/?pageSize=250`,
      {
        headers: {
          Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      },
    );

    // Some jobs/companies don't expose this endpoint at all — treat as "no folders"
    // rather than failing the whole import.
    if (!res.ok) {
      return NextResponse.json({ folders: [] });
    }

    const data: SimproAttachmentFolder[] = await res.json();
    const folders = data.map((f) => ({ id: f.ID, name: f.Name }));
    return NextResponse.json({ folders });
  } catch (err) {
    console.warn(
      `[AttachmentFolders] Failed for job ${parsedJobId}:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ folders: [] });
  }
}
