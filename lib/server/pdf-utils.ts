import path from "path";
import fs from "fs";

// ── Static asset loader ───────────────────────────────────────────────────────

export interface ReportAssets {
  rasLogo: string;
  linkWhite: string;
  linkBlue: string;
  associations: {
    communitySelect: string;
    dulux: string;
    haymes: string;
    mpa: string;
    qbcc: string;
    smartStrata: string;
  };
}

function readPublicAsBase64(relativePath: string): string {
  const fullPath = path.join(process.cwd(), "public", relativePath);
  try {
    const buffer = fs.readFileSync(fullPath);
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".svg": "image/svg+xml",
      ".webp": "image/webp",
    };
    const mime =
      mimeTypes[path.extname(relativePath).toLowerCase()] ?? "image/png";
    return `data:${mime};base64,${buffer.toString("base64")}`;
  } catch {
    return `/${relativePath}`;
  }
}

let _cachedAssets: ReportAssets | null = null;

export function loadReportAssets(): ReportAssets {
  if (_cachedAssets) return _cachedAssets;
  _cachedAssets = {
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
  return _cachedAssets;
}

// ── Puppeteer PDF runner ──────────────────────────────────────────────────────

export async function renderPDF(htmlContent: string): Promise<Buffer> {
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

    return Buffer.from(pdfData);
  } finally {
    await browser.close();
  }
}

// ── PDF download response ─────────────────────────────────────────────────────

export function pdfDownloadResponse(
  buffer: Buffer,
  filename: string,
): Response {
  const clean = filename.trim().replace(/\.pdf$/i, "") + ".pdf";
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${clean}"`,
      "Content-Length": buffer.length.toString(),
    },
  });
}
