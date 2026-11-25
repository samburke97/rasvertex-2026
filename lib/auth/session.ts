// lib/auth/session.ts
// ─────────────────────────────────────────────────────────────────────────────
// Signed session cookie for the staff login. Uses Web Crypto only, so the
// same code runs in middleware (Edge) and in route handlers (Node).
//
// Token: base64url(JSON {e: email, n: name, x: expiry seconds}) + "." +
//        base64url(HMAC-SHA256 of that, keyed with AUTH_SECRET)
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "rv_session";
/** "Remember me" ticked: signed in on this device for 90 days. */
export const SESSION_DAYS = 90;
/** Not ticked: the cookie goes when the browser closes, and the token dies after 12 hours anyway. */
export const SHORT_SESSION_HOURS = 12;

export interface Session {
  email: string;
  name: string;
  expires: number; // unix seconds
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(usage: "sign" | "verify"): Promise<CryptoKey | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) return null;
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

export async function signSession(email: string, name: string, remember = true): Promise<string> {
  const k = await key("sign");
  if (!k) throw new Error("AUTH_SECRET is not set (needs 32+ characters)");
  const life = remember ? SESSION_DAYS * 86400 : SHORT_SESSION_HOURS * 3600;
  const expires = Math.floor(Date.now() / 1000) + life;
  const body = b64url(enc.encode(JSON.stringify({ e: email, n: name, x: expires })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const k = await key("verify");
    if (!k) return null;
    const ok = await crypto.subtle.verify("HMAC", k, fromB64url(sig), enc.encode(body));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(body)));
    if (typeof data.e !== "string" || typeof data.x !== "number") return null;
    if (data.x < Date.now() / 1000) return null;
    return { email: data.e, name: typeof data.n === "string" ? data.n : "", expires: data.x };
  } catch {
    return null;
  }
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 86400,
};

/** Cookie for a fresh sign-in: without "Remember me" it has no maxAge, so the browser drops it on close. */
export function loginCookieOptions(remember: boolean) {
  if (remember) return cookieOptions;
  const { maxAge: _drop, ...rest } = cookieOptions;
  return rest;
}
