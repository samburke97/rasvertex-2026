// app/api/simpro/jobs/[jobId]/save-hours-report/route.ts
//
// Generates a PDF from Hours Breakdown data and uploads it to a SimPRO job.
// Same pattern as save-report — just uses buildHoursPrintHTML instead.

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  buildHoursPrintHTML,
  type HoursStaticAssets,
} from "@/lib/reports/hours.print";
import type { HoursBreakdownData } from "@/lib/reports/hours.types";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

interface SimproAttachmentListItem {
  ID: string;
  Filename: string;
}

let cachedAssets: HoursStaticAssets | null = null;

function readPublicAsBase64(relativePath: string): string {
  const fullPath = path.join(process.cwd(), "public", relativePath);
  try {
    const buffer = fs.readFileSync(fullPath);
    const ext = path.extname(relativePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
    };
    const mime = mimeTypes[ext] ?? "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return `/${relativePath}`;
  }
}

function loadStaticAssets(): HoursStaticAssets {
  if (cachedAssets) return cachedAssets;
  cachedAssets = {
    rasLogo: readPublicAsBase64("reports/ras-logo.png"),
    linkBlue: readPublicAsBase64("reports/link_blue.png"),
    associations: {
      communitySelect: readPublicAsBase64(
        "reports/associations/communityselect.png",
      ),
      dulux: readPublicAsBase64("reports/associations/dulux.png"),
      haymes: readPublicAsBase64("reports/associations/haymes.svg"),
      mpa: readPublicAsBase64("reports/associations/mpa.png"),
      qbcc: readPublicAsBase64("reports/associations/qbcc.png"),
      smartStrata: readPublicAsBase64("reports/associations/smartstrata.png"),
    },
  };
  return cachedAssets;
}

async function simproFetch<T>(url: string, options?: RequestInit): Promise<T> {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN)
    throw new Error("SimPRO configuration missing");
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SimPRO HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing", code: "CONFIGURATION_MISSING" },
      { status: 500 },
    );
  }

  const { jobId } = await params;
  const parsedJobId = parseInt(jobId, 10);
  if (!jobId || isNaN(parsedJobId) || parsedJobId <= 0) {
    return NextResponse.json(
      { error: "Invalid job ID", code: "INVALID_JOB_ID" },
      { status: 400 },
    );
  }

  let body: {
    filename?: string;
    report?: HoursBreakdownData;
    companyId?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body", code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const { filename, report, companyId = 0 } = body;

  if (!filename?.trim()) {
    return NextResponse.json(
      { error: "filename is required", code: "MISSING_FILENAME" },
      { status: 400 },
    );
  }
  if (!report) {
    return NextResponse.json(
      { error: "report data is required", code: "MISSING_REPORT" },
      { status: 400 },
    );
  }

  const cleanFilename = filename.trim().replace(/\.pdf$/i, "") + ".pdf";

  // Duplicate check
  const listUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}/attachments/files/?pageSize=250`;
  let existingFiles: SimproAttachmentListItem[] = [];
  try {
    existingFiles = await simproFetch<SimproAttachmentListItem[]>(listUrl);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (!msg.includes("404")) {
      return NextResponse.json(
        {
          error: "Could not verify existing attachments.",
          code: "LIST_FETCH_FAILED",
          details: msg,
        },
        { status: 502 },
      );
    }
  }

  const duplicate = existingFiles.find(
    (f) => f.Filename.toLowerCase() === cleanFilename.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json(
      {
        error: `A file named "${cleanFilename}" already exists on this job.`,
        code: "DUPLICATE_FILENAME",
        existingFile: { id: duplicate.ID, filename: duplicate.Filename },
      },
      { status: 409 },
    );
  }

  const htmlContent = buildHoursPrintHTML(report, loadStaticAssets());

  let pdfBuffer: Buffer;
  try {
    const puppeteer = await import("puppeteer");
    const browser = await puppeteer.default.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const type = req.resourceType();
        if (type === "xhr" || type === "fetch" || type === "websocket") {
          req.abort();
        } else {
          req.continue();
        }
      });
      await page.setContent(htmlContent, { waitUntil: "load", timeout: 30000 });
      await page.evaluate(() => document.fonts.ready);
      const pdfData = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      pdfBuffer = Buffer.from(pdfData);
    } finally {
      await browser.close();
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SaveHoursReport] Puppeteer failed:", msg);
    return NextResponse.json(
      { error: "PDF generation failed. Please try again." },
      { status: 500 },
    );
  }

  // Upload to SimPRO
  const base64Pdf = pdfBuffer.toString("base64");
  const uploadUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}/attachments/files/`;

  try {
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Filename: cleanFilename,
        Base64Data: base64Pdf,
      }),
      cache: "no-store",
    });

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => "");
      throw new Error(
        `SimPRO upload HTTP ${uploadRes.status}: ${text.slice(0, 300)}`,
      );
    }

    return NextResponse.json({ success: true, filename: cleanFilename });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SaveHoursReport] Upload failed:", msg);
    return NextResponse.json(
      { error: "PDF generated but upload to SimPRO failed.", details: msg },
      { status: 502 },
    );
  }
}
