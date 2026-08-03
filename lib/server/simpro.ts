// lib/server/simpro.ts
// Shared SimPRO API utilities for server-side route handlers.

import { fetchWithTimeout } from "@/lib/simpro/timeout";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

export function getSimproConfig() {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    throw new Error("SimPRO configuration missing");
  }
  return { baseUrl: SIMPRO_BASE_URL, token: SIMPRO_ACCESS_TOKEN };
}

// PDF uploads carry a multi-MB base64 body — the shared 10s SIMPRO_TIMEOUT_MS
// (fine for lightweight list/delete calls) isn't enough time to transfer and
// have SimPRO process a full report attachment.
const SIMPRO_UPLOAD_TIMEOUT_MS = 60_000;

export async function simproFetch<T>(
  url: string,
  options?: RequestInit,
  timeoutMs?: number,
): Promise<T> {
  const { token } = getSimproConfig();
  const res = await fetchWithTimeout(
    url,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
      cache: "no-store",
    },
    timeoutMs,
  );
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

async function findAttachmentByFilename(
  listUrl: string,
  filename: string,
): Promise<SimproAttachment | null> {
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

export async function checkDuplicateAttachment(
  companyId: number,
  jobId: number,
  filename: string,
): Promise<SimproAttachment | null> {
  const { baseUrl } = getSimproConfig();
  const listUrl = `${baseUrl}/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/files/?pageSize=250`;
  return findAttachmentByFilename(listUrl, filename);
}

export async function checkDuplicateSiteAttachment(
  companyId: number,
  siteId: number,
  filename: string,
): Promise<SimproAttachment | null> {
  const { baseUrl } = getSimproConfig();
  const listUrl = `${baseUrl}/api/v1.0/companies/${companyId}/sites/${siteId}/attachments/files/?pageSize=250`;
  return findAttachmentByFilename(listUrl, filename);
}

// ── Upload PDF to job / site ────────────────────────────────────────────────────

export async function uploadPDFToJob(
  companyId: number,
  jobId: number,
  filename: string,
  pdfBuffer: Buffer,
): Promise<unknown> {
  const { baseUrl } = getSimproConfig();
  const uploadUrl = `${baseUrl}/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/files/`;
  return simproFetch(
    uploadUrl,
    {
      method: "POST",
      body: JSON.stringify({
        Filename: filename,
        Base64Data: pdfBuffer.toString("base64"),
        Public: false,
        Email: false,
      }),
    },
    SIMPRO_UPLOAD_TIMEOUT_MS,
  );
}

export async function uploadPDFToSite(
  companyId: number,
  siteId: number,
  filename: string,
  pdfBuffer: Buffer,
): Promise<unknown> {
  const { baseUrl } = getSimproConfig();
  const uploadUrl = `${baseUrl}/api/v1.0/companies/${companyId}/sites/${siteId}/attachments/files/`;
  return simproFetch(
    uploadUrl,
    {
      method: "POST",
      body: JSON.stringify({
        Filename: filename,
        Base64Data: pdfBuffer.toString("base64"),
        Public: true,
      }),
    },
    SIMPRO_UPLOAD_TIMEOUT_MS,
  );
}

async function deleteAttachment(url: string): Promise<void> {
  const { token } = getSimproConfig();
  const res = await fetchWithTimeout(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  // 404 just means it's already gone — fine, that's the end state we want.
  if (!res.ok && res.status !== 404) {
    const body = await res.text().catch(() => "");
    throw new Error(`SimPRO HTTP ${res.status}: ${body.slice(0, 300)}`);
  }
}

// ── Save (upload, replacing any same-name file) ─────────────────────────────────
// Filenames here are predictable-by-design (e.g. "Anchor Inspection Report -
// 2026"), so a second save in the same year is a deliberate re-save, not an
// accidental collision — replace in place rather than blocking the user.

export async function saveJobAttachment(
  companyId: number,
  jobId: number,
  filename: string,
  pdfBuffer: Buffer,
): Promise<unknown> {
  const { baseUrl } = getSimproConfig();
  const existing = await checkDuplicateAttachment(companyId, jobId, filename);
  if (existing) {
    await deleteAttachment(
      `${baseUrl}/api/v1.0/companies/${companyId}/jobs/${jobId}/attachments/files/${existing.ID}`,
    );
  }
  return uploadPDFToJob(companyId, jobId, filename, pdfBuffer);
}

export async function saveSiteAttachment(
  companyId: number,
  siteId: number,
  filename: string,
  pdfBuffer: Buffer,
): Promise<unknown> {
  const { baseUrl } = getSimproConfig();
  const existing = await checkDuplicateSiteAttachment(
    companyId,
    siteId,
    filename,
  );
  if (existing) {
    await deleteAttachment(
      `${baseUrl}/api/v1.0/companies/${companyId}/sites/${siteId}/attachments/files/${existing.ID}`,
    );
  }
  return uploadPDFToSite(companyId, siteId, filename, pdfBuffer);
}

// ── Fan out a save to whichever destinations were requested ────────────────────
// Job and site uploads are fully independent — run them concurrently so
// checking both boxes doesn't take twice as long as checking one.

export interface SaveDestinationResult {
  success: boolean;
  error?: string;
}

export interface SaveDestinationsResult {
  job?: SaveDestinationResult;
  site?: SaveDestinationResult;
}

export async function saveReportToDestinations(
  companyId: number,
  jobId: number,
  siteId: string | undefined,
  destinations: { job?: boolean; site?: boolean },
  filename: string,
  pdfBuffer: Buffer,
  logPrefix: string,
): Promise<SaveDestinationsResult> {
  const jobPromise = destinations.job
    ? saveJobAttachment(companyId, jobId, filename, pdfBuffer)
        .then((): SaveDestinationResult => ({ success: true }))
        .catch((err): SaveDestinationResult => {
          console.error(`${logPrefix} Job upload failed:`, err);
          return { success: false, error: "Failed to upload PDF to job." };
        })
    : Promise.resolve(undefined);

  const parsedSiteId = siteId ? parseInt(siteId, 10) : NaN;
  const sitePromise = !destinations.site
    ? Promise.resolve(undefined)
    : !siteId || isNaN(parsedSiteId) || parsedSiteId <= 0
      ? Promise.resolve<SaveDestinationResult>({
          success: false,
          error: "Site ID unavailable for this job.",
        })
      : saveSiteAttachment(companyId, parsedSiteId, filename, pdfBuffer)
          .then((): SaveDestinationResult => ({ success: true }))
          .catch((err): SaveDestinationResult => {
            console.error(`${logPrefix} Site upload failed:`, err);
            return { success: false, error: "Failed to upload PDF to site." };
          });

  const [job, site] = await Promise.all([jobPromise, sitePromise]);
  return { job, site };
}
