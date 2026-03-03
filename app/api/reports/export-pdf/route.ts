// app/api/reports/export-pdf/route.ts
//
// Generates a PDF from report data and returns it directly as a download.
// Same Puppeteer logic as save-report — just skips the SimPRO upload step.

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  buildPrintHTML,
  type StaticAssets,
} from "@/lib/reports/condition.print";
import type { ConditionReportData } from "@/lib/reports/condition.types";

// ── Static asset loader (same as save-report route) ──────────────────────────

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
  } catch {
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

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  let body: {
    filename?: string;
    report?: ConditionReportData;
    photoData?: Record<string, string>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { filename = "report", report, photoData = {} } = body;

  if (!report) {
    return NextResponse.json(
      { error: "report data is required" },
      { status: 400 },
    );
  }

  // Rebuild report with base64 photos injected back in
  const pdfReport: ConditionReportData = {
    ...report,
    photos: report.photos.map((p) => ({
      ...p,
      url: photoData[p.id] ?? p.url ?? "",
    })),
  };

  const htmlContent = buildPrintHTML(pdfReport, loadStaticAssets());

  // Generate PDF via Puppeteer
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
    console.error("[ExportPDF] Puppeteer failed:", msg);
    return NextResponse.json(
      { error: "PDF generation failed." },
      { status: 500 },
    );
  }

  const cleanFilename = filename.trim().replace(/\.pdf$/i, "") + ".pdf";

  // Return PDF bytes directly — browser triggers download automatically
  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${cleanFilename}"`,
      "Content-Length": pdfBuffer.length.toString(),
    },
  });
}
