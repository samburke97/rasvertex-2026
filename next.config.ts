/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework in responses — trivial hardening, no
  // functional effect.
  poweredByHeader: false,

  // @sparticuz/chromium's Chromium binary is read from disk at runtime via
  // fs, not required as a JS module — Next's automatic file tracing for
  // serverless functions can miss it, silently shipping a function that
  // can't find its browser binary in production. Explicitly include it for
  // every route that calls renderPDF() (lib/server/pdf-utils.ts).
  outputFileTracingIncludes: {
    "/api/reports/export-pdf": ["./node_modules/@sparticuz/chromium/**/*"],
    "/api/reports/export-hours-pdf": [
      "./node_modules/@sparticuz/chromium/**/*",
    ],
    "/api/reports/export-anchor-pdf": [
      "./node_modules/@sparticuz/chromium/**/*",
    ],
    "/api/simpro/jobs/[jobId]/save-report": [
      "./node_modules/@sparticuz/chromium/**/*",
    ],
    "/api/simpro/jobs/[jobId]/save-anchor-report": [
      "./node_modules/@sparticuz/chromium/**/*",
    ],
  },

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
        pathname: "/because-frank/**",
      },
      {
        protocol: "https",
        hostname: "platform-lookaside.fbsbx.com",
        pathname: "/**",
      },
    ],
  },

  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  },

  // Baseline security headers. Deliberately not adding a Content-Security-
  // Policy here — this app embeds Google Maps JS/Static Maps, Google Fonts,
  // Cloudinary/Facebook images, and Vercel Analytics; a CSP needs every one
  // of those origins correctly allowlisted or it silently breaks them, and
  // that audit hasn't been done. These headers are metadata-only — they
  // don't restrict what the page can load, so there's no such risk here.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
