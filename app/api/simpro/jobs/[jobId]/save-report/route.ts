// app/api/simpro/jobs/[jobId]/save-report/route.ts

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  buildPrintHTML,
  type StaticAssets,
} from "@/lib/reports/condition.print";
import type { ConditionReportData } from "@/lib/reports/condition.types";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

interface SimproAttachmentListItem {
  ID: number;
  Filename: string;
}

// ── Static asset loader ───────────────────────────────────────────────────────
// Reads files from the /public directory and returns them as base64 data URIs.
// Results are cached in module scope so the filesystem is only read once per
// server process lifetime — not on every PDF request.

let cachedAssets: StaticAssets | null = null;

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
  } catch (err) {
    // If an asset is missing, log a warning and fall back to the relative path
    // so the PDF still generates (image will be absent, but no crash).
    console.warn(
      `[SaveReport] Could not read public asset: ${relativePath}`,
      err,
    );
    return `/${relativePath}`;
  }
}

function loadStaticAssets(): StaticAssets {
  if (cachedAssets) return cachedAssets;

  cachedAssets = {
    rasLogo: readPublicAsBase64("reports/ras-logo.png"),
    linkWhite: readPublicAsBase64("reports/link_white.png"),
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

// ── SimPRO fetch helper ───────────────────────────────────────────────────────

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

// ── Route handler ─────────────────────────────────────────────────────────────

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
    report?: ConditionReportData;
    photoData?: Record<string, string>;
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

  const { filename, report, photoData = {}, companyId = 0 } = body;

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

  // ── Duplicate check ───────────────────────────────────────────────────────
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

  // ── Rebuild report with base64 photos injected back in ────────────────────
  const pdfReport: ConditionReportData = {
    ...report,
    photos: report.photos.map((p) => ({
      ...p,
      url: photoData[p.id] ?? p.url ?? "",
    })),
  };

  // ── Load static assets as base64 data URIs ────────────────────────────────
  // Puppeteer runs headless with no knowledge of your Next.js server, so
  // relative paths like /reports/ras-logo.png resolve to nothing.
  // We read each file from /public once (cached), embed them as data URIs,
  // and pass them into buildPrintHTML — making the HTML fully self-contained.
  const staticAssets = loadStaticAssets();

  const htmlContent = buildPrintHTML(pdfReport, staticAssets);

  // ── Generate PDF via Puppeteer ────────────────────────────────────────────
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

      // All images are inline base64 — block outbound requests to keep it fast
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const type = req.resourceType();
        if (type === "xhr" || type === "fetch" || type === "websocket") {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.setContent(htmlContent, {
        waitUntil: "load",
        timeout: 30000,
      });

      // Wait for fonts
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
    console.error("[SaveReport] Puppeteer failed:", msg);
    return NextResponse.json(
      {
        error: "PDF generation failed. Please try again.",
        code: "PDF_GENERATION_FAILED",
        details: msg,
      },
      { status: 500 },
    );
  }

  // ── Upload to SimPRO ──────────────────────────────────────────────────────
  const base64Data = pdfBuffer.toString("base64");
  const uploadUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}/attachments/files/`;

  let uploadedAttachment: unknown;
  try {
    uploadedAttachment = await simproFetch(uploadUrl, {
      method: "POST",
      body: JSON.stringify({
        Filename: cleanFilename,
        Base64Data: base64Data,
        Public: false,
        Email: false,
      }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[SaveReport] SimPRO upload failed:", msg);
    return NextResponse.json(
      {
        error: "Failed to upload PDF to SimPRO.",
        code: "UPLOAD_FAILED",
        details: msg,
      },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { success: true, filename: cleanFilename, attachment: uploadedAttachment },
    { status: 201 },
  );
}
