// lib/auth/users.ts
// ─────────────────────────────────────────────────────────────────────────────
// Staff accounts for the app login, in Neon (same raw-SQL convention as
// lib/crm/store.ts). Passwords are hashed with Node's built-in scrypt — no
// native module to build on Vercel.
//
// Add or reset a user with: npx tsx scripts/staff-user.ts
//
// ── Migration — run once in the Neon SQL Editor (the script also does it) ──
// CREATE TABLE IF NOT EXISTS staff_users (
//   email          TEXT PRIMARY KEY,
//   name           TEXT NOT NULL,
//   password_hash  TEXT NOT NULL,
//   active         BOOLEAN NOT NULL DEFAULT TRUE,
//   created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//   last_login_at  TIMESTAMPTZ
// );
// ─────────────────────────────────────────────────────────────────────────────

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";

function sql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

const N = 16384, R = 8, P = 1, LEN = 64;

function scrypt(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [algo, , , , saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password, Buffer.from(saltB64, "base64"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Compared against when the email isn't found, so a wrong email takes as
// long as a wrong password.
let dummyHash: Promise<string> | null = null;

export async function verifyLogin(email: string, password: string): Promise<{ email: string; name: string } | null> {
  const e = email.trim().toLowerCase();
  const rows = (await sql()`
    SELECT email, name, password_hash FROM staff_users WHERE email = ${e} AND active = TRUE
  `) as { email: string; name: string; password_hash: string }[];
  const user = rows[0];
  if (!user) {
    dummyHash ??= hashPassword("not-a-real-password");
    await checkPassword(password, await dummyHash);
    return null;
  }
  if (!(await checkPassword(password, user.password_hash))) return null;
  await sql()`UPDATE staff_users SET last_login_at = NOW() WHERE email = ${e}`;
  return { email: user.email, name: user.name };
}

export async function ensureTable(): Promise<void> {
  await sql()`
    CREATE TABLE IF NOT EXISTS staff_users (
      email          TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      password_hash  TEXT NOT NULL,
      active         BOOLEAN NOT NULL DEFAULT TRUE,
      created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at  TIMESTAMPTZ
    )`;
}

export async function upsertUser(email: string, name: string, password: string): Promise<void> {
  const hash = await hashPassword(password);
  await sql()`
    INSERT INTO staff_users (email, name, password_hash, active)
    VALUES (${email.trim().toLowerCase()}, ${name.trim()}, ${hash}, TRUE)
    ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, password_hash = EXCLUDED.password_hash, active = TRUE`;
}

export async function setActive(email: string, active: boolean): Promise<number> {
  const rows = await sql()`
    UPDATE staff_users SET active = ${active} WHERE email = ${email.trim().toLowerCase()} RETURNING email`;
  return rows.length;
}

export async function listUsers() {
  return sql()`SELECT email, name, active, last_login_at FROM staff_users ORDER BY name`;
}
