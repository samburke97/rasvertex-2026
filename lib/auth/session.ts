// lib/auth/session.ts
// ─────────────────────────────────────────────────────────────────────────────
// Signed session cookie for the staff login. Uses Web Crypto only, so the
// same code runs in middleware (Edge) and in route handlers (Node).
//
// Token: base64url(JSON {e: email, n: name, x: expiry seconds}) + "." +
//        base64url(HMAC-SHA256 of that, keyed with AUTH_SECRET)
// ─────────────────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = "rv_session";
export const SESSION_DAYS = 30;

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

export async function signSession(email: string, name: string): Promise<string> {
  const k = await key("sign");
  if (!k) throw new Error("AUTH_SECRET is not set (needs 32+ characters)");
  const expires = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
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
