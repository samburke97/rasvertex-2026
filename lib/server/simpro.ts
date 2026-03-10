// lib/server/simpro.ts
// Shared SimPRO API utilities for server-side route handlers.

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

export function getSimproConfig() {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    throw new Error("SimPRO configuration missing");
  }
  return { baseUrl: SIMPRO_BASE_URL, token: SIMPRO_ACCESS_TOKEN };
}

export async function simproFetch<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const { token } = getSimproConfig();
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`SimPRO HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ── Duplicate filename check ──────────────────────────────────────────────────

interface SimproAttachment {
  ID: string | number;
  Filename: string;
}

export async function checkDuplicateAttachment(
  companyId: number,
  jobId: number,
  filename: string,
): Promise<SimproAttachment | null> {
  const { baseUrl } = getSimproConfig();
  const listUrl = `${baseUrl}/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/files/?pageSize=250`;
  try {
    const files = await simproFetch<SimproAttachment[]>(listUrl);
    return (
      files.find((f) => f.Filename.toLowerCase() === filename.toLowerCase()) ??
      null
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 404 just means no attachments yet — not an error
    if (msg.includes("404")) return null;
    throw err;
  }
}

// ── Upload PDF to job ─────────────────────────────────────────────────────────

export async function uploadPDFToJob(
  companyId: number,
  jobId: number,
  filename: string,
  pdfBuffer: Buffer,
): Promise<unknown> {
  const { baseUrl } = getSimproConfig();
  const uploadUrl = `${baseUrl}/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/files/`;
  return simproFetch(uploadUrl, {
    method: "POST",
    body: JSON.stringify({
      Filename: filename,
      Base64Data: pdfBuffer.toString("base64"),
      Public: false,
      Email: false,
    }),
  });
}
