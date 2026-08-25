import path from "path";
import fs from "fs";

// ── Static asset loader ───────────────────────────────────────────────────────

export interface ReportAssets {
  rasLogo: string;
  linkWhite: string;
  linkBlue: string;
  signature: string;
  heightSafety: string;
  conditionBg: string;
  bebasNeueFont: string;
  interFont: string;
  // caveatFont falls back to a plain (non-existent) path until the real
  // Caveat.woff2 is supplied — see proposal.print.ts's font-face fallback.
  caveatFont: string;
  associations: {
    communitySelect: string;
    dulux: string;
    haymes: string;
    mpa: string;
    qbcc: string;
    smartStrata: string;
  };
  proposal: {
    // logoFull and photo* fall back to a plain path until real files are
    // supplied (raster images can't be captured from a chat upload the way
    // the SVGs below were — see proposal.print.ts for the placeholder
    // treatment used until then).
    logoFull: string;
    workCover: string;
    dulux: string;
    iconPlus: string;
    iconCross: string;
    // Same lockup as the app's own top-left nav (public/ras.png) — used in
    // the proposal's page header.
    navLogo: string;
    // Association-logo strip (Community Select/Dulux/Haymes/MPA/QBCC/Smart
    // Strata) used in the proposal's repeating page footer.
    footerLogos: string;
    // Full-page certificate scans appended at the end of the proposal.
    workCoverCert: string;
    publicLiabilityCert: string;
    // Real crew/site photos for the fixed company sections (Team,
    // Why Our Prep Is Different, Recent Projects, Support Plans).
    teamCaroline: string;
    projectMooloolaba: string;
    projectAlexandraHeadland: string;
    projectRoofMembrane: string;
    whyPrep1: string;
    whyPrep2: string;
    supportWashDown: string;
    supportInspection: string;
    supportTouchUp: string;
    serviceCleaning: string;
    serviceWindowCleaning: string;
    serviceHeightSafety: string;
    serviceWaterproofing: string;
    serviceMaintenance: string;
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
    conditionBg: readPublicAsBase64("images/backgrounds/condition-bg.jpeg"),
    bebasNeueFont: readPublicAsBase64("fonts/bebas-neue.woff2"),
    interFont: readPublicAsBase64("fonts/inter.woff2"),
    caveatFont: readPublicAsBase64("fonts/caveat.woff2"),
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
    proposal: {
      logoFull: readPublicAsBase64("reports/proposal/logo-full.png"),
      workCover: readPublicAsBase64("reports/proposal/work-cover.svg"),
      dulux: readPublicAsBase64("reports/proposal/dulux.svg"),
      iconPlus: readPublicAsBase64("reports/proposal/icon-plus.svg"),
      iconCross: readPublicAsBase64("reports/proposal/icon-cross.svg"),
      navLogo: readPublicAsBase64("ras.png"),
      footerLogos: readPublicAsBase64("reports/proposal/footer.png"),
      workCoverCert: readPublicAsBase64("reports/proposal/certs/work-cover.png"),
      publicLiabilityCert: readPublicAsBase64(
        "reports/proposal/certs/public-liability.png",
      ),
      teamCaroline: readPublicAsBase64("reports/proposal/assets/people-caro.jpg"),
      projectMooloolaba: readPublicAsBase64("reports/proposal/assets/project-1.jpeg"),
      projectAlexandraHeadland: readPublicAsBase64(
        "reports/proposal/assets/project-2.jpeg",
      ),
      projectRoofMembrane: readPublicAsBase64(
        "reports/proposal/assets/nav-waterproofing.png",
      ),
      whyPrep1: readPublicAsBase64("reports/proposal/assets/nav-maintenance.png"),
      whyPrep2: readPublicAsBase64("reports/proposal/assets/nav-painting.png"),
      supportWashDown: readPublicAsBase64("reports/proposal/assets/nav-cleaning.png"),
      supportInspection: readPublicAsBase64("reports/proposal/assets/nav-height.png"),
      supportTouchUp: readPublicAsBase64("reports/proposal/assets/rope-access.png"),
      serviceCleaning: readPublicAsBase64("reports/proposal/assets/nav-cleaning.png"),
      serviceWindowCleaning: readPublicAsBase64("reports/proposal/assets/rope-access.png"),
      serviceHeightSafety: readPublicAsBase64("reports/proposal/assets/nav-height.png"),
      serviceWaterproofing: readPublicAsBase64(
        "reports/proposal/assets/nav-waterproofing.png",
      ),
      serviceMaintenance: readPublicAsBase64(
        "reports/proposal/assets/nav-maintenance.png",
      ),
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

export interface RenderPDFOptions {
  // In CSS units (e.g. "64px") — reserves space for headerTemplate/
  // footerTemplate content. Reports that draw their own in-content
  // header/footer (condition/anchor/hours) leave this at 0 (the default).
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  // Puppeteer repeats these on every physical page and substitutes
  // <span class="pageNumber">/<span class="totalPages"> — the only
  // reliable way to get real per-page numbers into a printed PDF (Chromium
  // doesn't support CSS Paged Media's counter(page) for this). Must be
  // fully self-contained HTML with inline styles — external stylesheets
  // don't apply inside header/footer frames.
  headerTemplate?: string;
  footerTemplate?: string;
}

export async function renderPDF(
  htmlContent: string,
  options?: RenderPDFOptions,
): Promise<Buffer> {
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

    const hasHeaderFooter = !!(options?.headerTemplate || options?.footerTemplate);

    const pdfData = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: options?.margin?.top ?? 0,
        right: options?.margin?.right ?? 0,
        bottom: options?.margin?.bottom ?? 0,
        left: options?.margin?.left ?? 0,
      },
      displayHeaderFooter: hasHeaderFooter,
      headerTemplate: options?.headerTemplate ?? "<div></div>",
      footerTemplate: options?.footerTemplate ?? "<div></div>",
    });

    return Buffer.from(pdfData);
  } finally {
    await page.close();
  }
}

// ── PDF download response ─────────────────────────────────────────────────────

// Vercel Functions cap both request AND response bodies at 4.5MB for a
// buffered (non-streaming) response — same limit that forced photos onto
// Blob storage, just on the way out instead of the way in. A photo-heavy
// report's finished PDF (compressed photos re-embedded at full count) can
// easily clear that on its own even though the export request going in is
// now tiny. Streaming the response is Vercel's own documented bypass — see
// https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions.
// Chunked rather than one big enqueue() so it's genuinely incremental, not
// just technically a stream wrapping one buffered blob.
const STREAM_CHUNK_BYTES = 1_000_000;

export function pdfDownloadResponse(
  buffer: Buffer,
  filename: string,
): Response {
  const clean = filename.trim().replace(/\.pdf$/i, "") + ".pdf";
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < buffer.length; offset += STREAM_CHUNK_BYTES) {
        controller.enqueue(
          new Uint8Array(buffer.subarray(offset, offset + STREAM_CHUNK_BYTES)),
        );
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${clean}"`,
    },
  });
}
