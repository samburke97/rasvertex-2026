// lib/report/pdf.ts
// Puppeteer wrapper optimised for Vercel — uses chromium-min which streams
// the browser binary at runtime rather than bundling it (stays under size limit)

import puppeteer, { Browser } from "puppeteer-core";

// Chromium is loaded lazily so we only pay the cost when actually generating a PDF
let chromium: typeof import("@sparticuz/chromium-min") | null = null;

async function getChromium() {
  if (!chromium) {
    chromium = await import("@sparticuz/chromium-min");
  }
  return chromium;
}

export interface PdfOptions {
  format?: "A4" | "Letter";
  margin?: {
    top?: string;
    right?: string;
    bottom?: string;
    left?: string;
  };
  printBackground?: boolean;
}

const DEFAULT_OPTIONS: PdfOptions = {
  format: "A4",
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
  printBackground: true,
};

export async function generatePdfFromHtml(
  html: string,
  options: PdfOptions = {},
): Promise<Buffer> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  let browser: Browser | null = null;

  try {
    const isVercel = process.env.VERCEL === "1";

    if (isVercel) {
      // Production: use the streamed chromium binary
      const chrome = await getChromium();

      // The remote executable URL — chromium-min downloads this at runtime
      const executablePath = await chrome.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar",
      );

      browser = await puppeteer.launch({
        args: chrome.args,
        defaultViewport: chrome.defaultViewport,
        executablePath,
        headless: chrome.headless,
      });
    } else {
      // Local dev: use whatever Chrome/Chromium is installed on the machine
      const localChromePaths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // macOS
        "/usr/bin/google-chrome", // Linux
        "/usr/bin/chromium-browser", // Linux alt
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", // Windows
        "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      ];

      // puppeteer-core won't find Chrome automatically — we must supply the path
      const { execSync } = await import("child_process");
      let executablePath = "";

      for (const p of localChromePaths) {
        try {
          const { existsSync } = await import("fs");
          if (existsSync(p)) {
            executablePath = p;
            break;
          }
        } catch {
          // keep trying
        }
      }

      if (!executablePath) {
        // Last resort: try `which google-chrome`
        try {
          executablePath = execSync("which google-chrome || which chromium")
            .toString()
            .trim();
        } catch {
          throw new Error(
            "No Chrome/Chromium found locally. Install Google Chrome or set CHROME_PATH env var.",
          );
        }
      }

      browser = await puppeteer.launch({
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath,
        headless: true,
      });
    }

    const page = await browser.newPage();

    // Set A4 viewport so layout matches print output
    await page.setViewport({ width: 794, height: 1123 });

    // Load the HTML — using setContent is faster than navigation
    await page.setContent(html, {
      waitUntil: "networkidle0", // wait for fonts/images to settle
      timeout: 30000,
    });

    // Give any CSS animations/transitions a moment to complete
    await page.evaluate(
      () => new Promise((resolve) => setTimeout(resolve, 500)),
    );

    const pdf = await page.pdf({
      format: mergedOptions.format,
      margin: mergedOptions.margin,
      printBackground: mergedOptions.printBackground,
    });

    return Buffer.from(pdf);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
