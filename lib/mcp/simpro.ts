// lib/mcp/simpro.ts
// ─────────────────────────────────────────────────────────────────────────────
// SimPRO access for the Claude connector (app/api/mcp/route.ts).
//
// simproRead is a GET under /api/v1.0/companies/0. simproCreate is the only
// write: a POST that makes a new record (used by the job and note tools in
// lib/mcp/actions.ts). Nothing here updates or deletes. The connector uses
// MCP_SIMPRO_ACCESS_TOKEN when set and falls back to SIMPRO_ACCESS_TOKEN;
// the create tools need a key with write access.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchWithTimeout } from "@/lib/simpro/timeout";

const BASE = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const TOKEN = process.env.MCP_SIMPRO_ACCESS_TOKEN || process.env.SIMPRO_ACCESS_TOKEN;
const COMPANY = `/api/v1.0/companies/0`;

/** Longest JSON text handed back to Claude in one tool result. */
const MAX_CHARS = 60_000;

export interface SimproPage {
  path: string;
  total: number | null;
  pages: number | null;
  count: number | null;
  data: unknown;
}

/** Paths Claude may ask for: letters, digits, slashes, dashes, underscores. */
const SAFE_PATH = /^\/[A-Za-z0-9_\-/]*$/;

export function normalisePath(path: string): string {
  let p = path.trim();
  // Accept a full URL or a path that still carries the company prefix.
  p = p.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/?api\/v1\.0\/companies\/\d+/i, "");
  if (!p.startsWith("/")) p = `/${p}`;
  const [bare] = p.split("?");
  if (!SAFE_PATH.test(bare) || bare.includes("..")) {
    throw new Error(`Path not allowed: ${path}. Use a SimPRO path such as /jobs/ or /quotes/1234`);
  }
  return bare;
}

/** GET a SimPRO path with query params; returns the body and paging headers. */
export async function simproRead(
  path: string,
  query: Record<string, string | number | undefined> = {},
): Promise<SimproPage> {
  if (!BASE || !TOKEN) throw new Error("SimPRO configuration missing — check env vars");
  const bare = normalisePath(path);
  // A query written into the path ("/jobs/?Stage=Progress") counts too:
  // dropping it would answer for every record. Explicit params win.
  const inPath = Object.fromEntries(new URLSearchParams(path.split("?")[1] ?? ""));
  const qs = Object.entries({ ...inPath, ...query })
    .filter(([, v]) => v !== undefined && v !== "")
    // Encoded the same way as app/api/simpro/jobs/search (SimPRO decodes
    // %25…%25 back to its %…% wildcards).
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  const url = `${BASE}${COMPANY}${bare}${qs ? `?${qs}` : ""}`;

  let res: Response | undefined;
  for (let i = 1; i <= 4; i++) {
    res = await fetchWithTimeout(url, {
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json" },
      cache: "no-store",
    }, 20_000);
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 500 * 2 ** (i - 1)));
  }
  if (!res!.ok) {
    const body = await res!.text().catch(() => "");
    throw new Error(`SimPRO HTTP ${res!.status} for ${bare}${body ? `: ${body.slice(0, 800)}` : ""}`);
  }
  const num = (h: string) => {
    const v = res!.headers.get(h);
    return v == null ? null : Number(v);
  };
  return {
    path: `${bare}${qs ? `?${decodeURIComponent(qs)}` : ""}`,
    total: num("Result-Total"),
    pages: num("Result-Pages"),
    count: num("Result-Count"),
    data: await res!.json(),
  };
}

/** POST a new record under the company path; returns SimPRO's answer (it includes the new ID). */
export async function simproCreate<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  if (!BASE || !TOKEN) throw new Error("SimPRO configuration missing — check env vars");
  const bare = normalisePath(path);
  let res: Response | undefined;
  for (let i = 1; i <= 3; i++) {
    res = await fetchWithTimeout(`${BASE}${COMPANY}${bare}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    }, 20_000);
    // Only a rate limit is retried: SimPRO turned it away, so nothing was made.
    if (res.status !== 429) break;
    await new Promise((r) => setTimeout(r, 1000 * 2 ** (i - 1)));
  }
  if (!res!.ok) {
    const text = await res!.text().catch(() => "");
    throw new Error(`SimPRO HTTP ${res!.status} creating ${bare}${text ? `: ${text.slice(0, 800)}` : ""}`);
  }
  return (await res!.json().catch(() => ({}))) as T;
}

/** JSON for a tool result, cut short (with a note) when it is very long. */
export function toText(value: unknown): string {
  const text = JSON.stringify(value, null, 1);
  if (text.length <= MAX_CHARS) return text;
  return (
    text.slice(0, MAX_CHARS) +
    `\n\n[Cut at ${MAX_CHARS} characters of ${text.length}. Ask for fewer records (pageSize) or fewer fields (columns).]`
  );
}

/** Wraps free text as a SimPRO "contains" filter value. */
export const like = (q: string) => `%${q.replace(/[%,()]/g, " ").trim()}%`;
