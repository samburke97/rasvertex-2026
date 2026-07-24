// lib/simpro/timeout.ts
//
// Shared timeout for every SimPRO fetch wrapper in the app. Without this,
// a slow/hanging SimPRO API leaves a request open until the platform's own
// function timeout kills it (Vercel: up to 300s) — which is what makes a
// SimPRO slowdown look like "the site is broken" rather than a fast,
// visible error the UI can show and recover from.

export const SIMPRO_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = SIMPRO_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`SimPRO request timed out after ${timeoutMs}ms: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
