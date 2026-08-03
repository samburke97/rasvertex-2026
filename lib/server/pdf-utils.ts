import path from "path";
import fs from "fs";

// ── Static asset loader ───────────────────────────────────────────────────────

export interface ReportAssets {
  rasLogo: string;
  linkWhite: string;
  linkBlue: string;
  signature: string;
  heightSafety: string;
  bebasNeueFont: string;
  interFont: string;
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
      ".woff2": "font/woff2",
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
    signature: readPublicAsBase64("reports/signature.png"),
    heightSafety: readPublicAsBase64("images/height-safety.png"),
    bebasNeueFont: readPublicAsBase64("fonts/bebas-neue.woff2"),
    interFont: readPublicAsBase64("fonts/inter.woff2"),
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
//
// Vercel's serverless functions run in a stripped-down environment that's
// missing the system libraries (libnss3, libatk, fontconfig, etc.) a normal
// downloaded Chromium needs, and often doesn't correctly bundle the
// `puppeteer` package's separately-downloaded browser binary into the
// deployed function at all — so the full `puppeteer` package that works
// perfectly in local dev silently fails to launch a browser in production.
// `@sparticuz/chromium` is a Chromium build compiled specifically for
// Lambda/Vercel's runtime, paired with `puppeteer-core` (no bundled
// browser). Local dev keeps using plain `puppeteer` (already downloaded,
// simpler, faster) since it has none of these constraints.
const IS_VERCEL = !!process.env.VERCEL;

// `puppeteer`'s Browser class wraps/re-exports `puppeteer-core`'s at
// runtime, but TS can't unify the two independently-imported module's
// types structurally (generic methods like page.evaluate() end up with
// unmergeable overload sets) — puppeteer-core's type is used as the single
// return type for both branches since that's what the Vercel path needs.
async function launchBrowser(): Promise<import("puppeteer-core").Browser> {
  if (IS_VERCEL) {
    const [{ default: chromium }, puppeteerCore] = await Promise.all([
      import("@sparticuz/chromium"),
      import("puppeteer-core"),
    ]);
    return puppeteerCore.default.launch({
      headless: true,
      args: [
        ...chromium.args,
        "--disable-dev-shm-usage",
        "--font-render-hinting=none",
      ],
      executablePath: await chromium.executablePath(),
    });
  }

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
  return browser as unknown as import("puppeteer-core").Browser;
}

// Launching Chromium is by far the most expensive part of a render — multiple
// seconds, worse on Vercel's Lambda-based @sparticuz/chromium. Closing the
// browser after every single render (the old behaviour) throws that cost
// away and pays it again on the very next request, even when it's the same
// warm server/container seconds later. Caching the launch and only closing
// the per-request `page` means only the first render after a cold start
// (or after a crash) pays for a full browser launch.
let _browserPromise: Promise<import("puppeteer-core").Browser> | null = null;

async function getBrowser(): Promise<import("puppeteer-core").Browser> {
  if (_browserPromise) {
    const browser = await _browserPromise;
    if (browser.isConnected()) return browser;
    _browserPromise = null; // crashed/disconnected — fall through and relaunch
  }
  const promise = launchBrowser();
  _browserPromise = promise;
  try {
    return await promise;
  } catch (err) {
    // Launch failed — don't leave a rejected promise cached for next call.
    if (_browserPromise === promise) _browserPromise = null;
    throw err;
  }
}

export async function renderPDF(htmlContent: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
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
    await page.close();
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
