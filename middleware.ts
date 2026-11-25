// middleware.ts
// ─────────────────────────────────────────────────────────────────────────────
// Staff login wall. Every page and API route needs a valid session cookie
// (lib/auth/session.ts) except the ones below, which outside callers use:
//
//   /login, /api/auth/login      the sign-in itself
//   /api/mcp                     Claude connector — checks MCP_SECRET itself
//   /api/webhooks/*              SimPRO and Resend webhooks
//   /api/outreach/unsubscribe    unsubscribe links in outreach emails
//   CRON_PATHS                   Vercel cron jobs (see vercel.json). With
//                                CRON_SECRET set, Vercel sends it as a bearer
//                                token and only that is accepted; without it,
//                                the vercel-cron user agent is let through.
//
// Pages without a session go to /login?next=…; API calls get a 401.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { isActive } from "@/lib/auth/active";

const PUBLIC_PREFIXES = ["/login", "/api/auth/login", "/api/mcp", "/api/webhooks/", "/api/outreach/unsubscribe"];

const CRON_PATHS = [
  "/api/admin/unlocked-schedules",
  "/api/deposit-notifications/check",
  "/api/outreach/scan",
  "/api/checkin/sync",
  "/api/recertifications/notify-due-soon",
  "/api/caro/run",
];

function isCron(req: NextRequest): boolean {
  if (!CRON_PATHS.includes(req.nextUrl.pathname)) return false;
  const secret = process.env.CRON_SECRET;
  if (secret) return req.headers.get("authorization") === `Bearer ${secret}`;
  return (req.headers.get("user-agent") ?? "").startsWith("vercel-cron");
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p.endsWith("/") ? p : `${p}/`))) {
    return NextResponse.next();
  }
  if (isCron(req)) return NextResponse.next();

  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (session && (await isActive(session.email))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own assets and files in /public.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/|images/|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)"],
};
