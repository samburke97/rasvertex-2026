// app/api/reports/export-hours-pdf/route.ts
//
// Generates a PDF from Hours Breakdown report data and returns it as a download.
// Same Puppeteer pattern as export-pdf — just uses buildHoursPrintHTML instead.

import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import {
  buildHoursPrintHTML,
  type HoursStaticAssets,
} from "@/lib/reports/hours.print";
import type { HoursBreakdownData } from "@/lib/reports/hours.types";

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

export async function POST(request: NextRequest) {
  let body: { filename?: string; report?: HoursBreakdownData };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { filename = "Hours Breakdown", report } = body;

  if (!report) {
    return NextResponse.json(
      { error: "report data is required" },
      { status: 400 },
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
    console.error("[ExportHoursPDF] Puppeteer failed:", msg);
    return NextResponse.json(
      { error: "PDF generation failed." },
      { status: 500 },
    );
  }

  const cleanFilename = filename.trim().replace(/\.pdf$/i, "") + ".pdf";

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${cleanFilename}"`,
      "Content-Length": pdfBuffer.length.toString(),
    },
  });
}
