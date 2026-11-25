// lib/auth/active.ts
// ─────────────────────────────────────────────────────────────────────────────
// Is a signed-in staff member still allowed in? The session cookie lasts 30
// days, so middleware asks this on each request: disabling someone
// (npm run staff -- disable) locks them out within a minute, not at expiry.
// Edge-safe (Neon over HTTP, no Node APIs). Answers are kept for a minute
// per server instance so pages don't each wait on the database.
// ─────────────────────────────────────────────────────────────────────────────

import { neon } from "@neondatabase/serverless";

const TTL_MS = 60_000;
const cache = new Map<string, { active: boolean; at: number }>();

export async function isActive(email: string): Promise<boolean> {
  const hit = cache.get(email);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.active;
  const url = process.env.DATABASE_URL;
  if (!url) return true;
  try {
    const rows = await neon(url)`SELECT active FROM staff_users WHERE email = ${email}`;
    const active = rows[0]?.active === true;
    cache.set(email, { active, at: Date.now() });
    return active;
  } catch (err) {
    // A database blip mustn't lock the whole team out: the last answer
    // stands, or (none yet) the signed cookie is trusted.
    console.error("[Auth] active check failed:", err);
    return hit?.active ?? true;
  }
}
