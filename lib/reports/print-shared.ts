// lib/reports/print-shared.ts
//
// Common building blocks shared by every *.print.ts HTML/PDF builder
// (condition.print.ts, anchor.print.ts, hours.print.ts). All three render
// via the same Puppeteer pipeline (lib/server/pdf-utils.ts) and share a lot
// of the same visual language — this is the single source of truth for the
// parts that are genuinely identical across them (brand colour, fonts, the
// association-logo footer, the asset-injection type), so those can't drift
// out of sync the way hand-copied CSS did before.
//
// Per-report page-shell CSS (page dimensions, break mechanics, table
// layout) intentionally stays in each file — those differ in real, mostly
// deliberate ways (see the PDF architecture review), and unifying them is a
// separate design decision, not a refactor.

import type { ReportAssets } from "@/lib/server/pdf-utils";

export type { ReportAssets };

// ── Brand tokens ─────────────────────────────────────────────────────────────

export const BRAND_NAVY = "#0d1c45";
export const FONT_DISPLAY = "'Bebas Neue', Arial, sans-serif";
export const FONT_BODY = "'Inter', Arial, sans-serif";

/**
 * Font-face CSS for the print HTML — self-hosted (base64-embedded via
 * `assets`, see loadReportAssets()) rather than a Google Fonts <link>.
 * Puppeteer previously had to fetch fonts.googleapis.com over the network
 * on every PDF render; on Vercel that's one more thing that can time out
 * or fail mid-render for no reason the report content controls. This has
 * zero outbound requests, same as every other asset in the PDF pipeline.
 */
export function buildPrintFontFaceCSS(assets: ReportAssets): string {
  return `
    @font-face {
      font-family: 'Bebas Neue';
      src: url(${assets.bebasNeueFont}) format('woff2');
      font-weight: 400;
      font-style: normal;
    }
    @font-face {
      font-family: 'Inter';
      src: url(${assets.interFont}) format('woff2');
      font-weight: 100 900;
      font-style: normal;
    }
    @font-face {
      font-family: 'Caveat';
      src: url(${assets.caveatFont}) format('woff2');
      font-weight: 500 600;
      font-style: normal;
    }
  `;
}

export const PRINT_RESET_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; font-family: ${FONT_BODY}; }
`;

// ── Static assets ─────────────────────────────────────────────────────────────
// Browser path: omit — relative /public paths resolve normally.
// Puppeteer path: pass loadReportAssets() so headless Chrome needs zero
// outbound requests and images always appear in the rendered PDF.

export const DEFAULT_PRINT_ASSETS: ReportAssets = {
  rasLogo: "/reports/ras-logo.png",
  linkWhite: "/reports/link_white.png",
  linkBlue: "/reports/link_blue.png",
  signature: "/reports/signature.png",
  heightSafety: "/images/height-safety.png",
  conditionBg: "/images/backgrounds/condition-bg.jpeg",
  bebasNeueFont: "/fonts/bebas-neue.woff2",
  interFont: "/fonts/inter.woff2",
  caveatFont: "/fonts/caveat.woff2",
  associations: {
    communitySelect: "/reports/associations/communityselect.png",
    dulux: "/reports/associations/dulux.png",
    haymes: "/reports/associations/haymes.svg",
    mpa: "/reports/associations/mpa.png",
    qbcc: "/reports/associations/qbcc.png",
    smartStrata: "/reports/associations/smartstrata.png",
  },
  proposal: {
    logoFull: "/reports/proposal/logo-full.png",
    workCover: "/reports/proposal/work-cover.svg",
    dulux: "/reports/proposal/dulux.svg",
    iconPlus: "/reports/proposal/icon-plus.svg",
    iconCross: "/reports/proposal/icon-cross.svg",
    navLogo: "/ras.png",
    footerLogos: "/reports/proposal/footer.png",
    workCoverCert: "/reports/proposal/certs/work-cover.png",
    publicLiabilityCert: "/reports/proposal/certs/public-liability.png",
    teamCaroline: "/reports/proposal/assets/people-caro.jpg",
    projectMooloolaba: "/reports/proposal/assets/project-1.jpeg",
    projectAlexandraHeadland: "/reports/proposal/assets/project-2.jpeg",
    projectRoofMembrane: "/reports/proposal/assets/nav-waterproofing.png",
    whyPrep1: "/reports/proposal/assets/nav-maintenance.png",
    whyPrep2: "/reports/proposal/assets/nav-painting.png",
    supportWashDown: "/reports/proposal/assets/nav-cleaning.png",
    supportInspection: "/reports/proposal/assets/nav-height.png",
    supportTouchUp: "/reports/proposal/assets/rope-access.png",
    serviceCleaning: "/reports/proposal/assets/nav-cleaning.png",
    serviceWindowCleaning: "/reports/proposal/assets/rope-access.png",
    serviceHeightSafety: "/reports/proposal/assets/nav-height.png",
    serviceWaterproofing: "/reports/proposal/assets/nav-waterproofing.png",
    serviceMaintenance: "/reports/proposal/assets/nav-maintenance.png",
  },
};

function esc(str: string | number | null | undefined): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The RAS Vertex / association-partner logo row shown in every page footer.
 * Pass `className` if the caller styles each logo via a class selector
 * (anchor.print.ts's `.assoc-logo`) rather than a `.footer img` descendant
 * selector (condition.print.ts / hours.print.ts).
 */
export function buildAssocLogosHTML(
  assets: ReportAssets,
  className?: string,
): string {
  const logos = [
    { src: assets.associations.communitySelect, alt: "Community Select" },
    { src: assets.associations.dulux, alt: "Dulux" },
    { src: assets.associations.haymes, alt: "Haymes Paint" },
    { src: assets.associations.mpa, alt: "MPA" },
    { src: assets.associations.qbcc, alt: "QBCC" },
    { src: assets.associations.smartStrata, alt: "Smart Strata" },
  ];
  const cls = className ? ` class="${esc(className)}"` : "";
  return logos
    .map((l) => `<img src="${esc(l.src)}" alt="${esc(l.alt)}"${cls} />`)
    .join("");
}

/** Shared footer-logo image sizing — identical across every report's footer. */
export const ASSOC_LOGO_CSS = `
  height: 36px;
  width: auto;
  max-width: 80px;
  object-fit: contain;
  display: block;
  opacity: 0.85;
`;
