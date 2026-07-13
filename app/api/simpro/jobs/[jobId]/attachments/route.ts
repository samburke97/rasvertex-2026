// app/api/simpro/jobs/[jobId]/attachments/route.ts
// Changes from original:
//   - photo event now includes dateAdded (ISO string from SimPRO's DateAdded field)
//   - fixed: removed duplicate controller.close() calls before early returns
//            (finally block handles close in all cases)
//   - rate-limit handling: lower concurrency, retry on 429 with exponential
//     backoff, respect Retry-After header. Prevents SimPRO from rejecting
//     downloads on jobs with many attachments.

import { NextRequest, NextResponse } from "next/server";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 1000;
const PER_WORKER_DELAY_MS = 100;

interface SimproAttachmentListItem {
  ID: string;
  Filename: string;
  Folder?: { ID: number; Name: string } | null;
}

interface SimproAttachmentDetail {
  ID: string;
  Filename: string;
  Folder?: { ID: number; Name: string } | null;
  Public?: boolean;
  Email?: boolean;
  MimeType?: string;
  FileSizeBytes?: number;
  DateAdded?: string;
  AddedBy?: { ID: number; Name: string; Type: string; TypeId: number } | null;
  Base64Data?: string;
}

class SimproRateLimitError extends Error {
  constructor(public retryAfterMs: number) {
    super("SimPRO rate limit (429)");
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function simproFetch<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const retryAfterMs = retryAfter
        ? Math.max(parseInt(retryAfter, 10) * 1000, 1000)
        : 0;
      throw new SimproRateLimitError(retryAfterMs);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `HTTP ${res.status} ${res.statusText}${body ? `: ${body}` : ""}`,
      );
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

async function simproFetchWithRetry<T>(url: string): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await simproFetch<T>(url);
    } catch (err) {
      if (err instanceof SimproRateLimitError && attempt < MAX_RETRIES) {
        const backoff =
          err.retryAfterMs > 0
            ? err.retryAfterMs
            : BASE_BACKOFF_MS * Math.pow(2, attempt) +
              Math.floor(Math.random() * 250);
        attempt++;
        await sleep(backoff);
        continue;
      }
      throw err;
    }
  }
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;
  const { searchParams } = new URL(request.url);
  const companyId = parseInt(searchParams.get("companyId") || "0", 10);
  const folderIdParam = searchParams.get("folderId");
  const folderId =
    folderIdParam && folderIdParam !== "all" ? parseInt(folderIdParam, 10) : null;

  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      {
        success: false,
        error: "SimPRO configuration missing.",
        code: "CONFIGURATION_MISSING",
      },
      { status: 500 },
    );
  }

  if (!jobId || jobId === "undefined" || jobId.trim() === "") {
    return NextResponse.json(
      { success: false, error: "Invalid job ID.", code: "INVALID_JOB_ID" },
      { status: 400 },
    );
  }

  const parsedJobId = parseInt(jobId, 10);
  if (isNaN(parsedJobId) || parsedJobId <= 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Job ID must be a positive integer.",
        code: "INVALID_JOB_ID_FORMAT",
      },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          // client disconnected
        }
      };

      try {
        const listUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}/attachments/files/?pageSize=250&columns=ID,Filename,Folder`;

        let attachmentsList: SimproAttachmentListItem[];
        try {
          attachmentsList =
            await simproFetchWithRetry<SimproAttachmentListItem[]>(listUrl);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("404")) {
            send("error", {
              code: "JOB_NOT_FOUND",
              message: `Job ${parsedJobId} not found in SimPRO.`,
            });
          } else if (msg.includes("401") || msg.includes("403")) {
            send("error", {
              code: "AUTH_FAILED",
              message: "SimPRO authentication failed.",
            });
          } else {
            send("error", {
              code: "LIST_FETCH_FAILED",
              message: "Failed to fetch attachment list.",
              details: msg,
            });
          }
          return; // finally will close the controller
        }

        const imageExtensions =
          /\.(jpg|jpeg|png|gif|webp|bmp|tiff|heic|heif)$/i;
        const candidates = attachmentsList.filter(
          (a) =>
            imageExtensions.test(a.Filename) &&
            (folderId == null || a.Folder?.ID === folderId),
        );

        send("start", { total: candidates.length, jobId: parsedJobId });

        if (candidates.length === 0) {
          send("done", { total: 0, loaded: 0, failed: 0 });
          return; // finally will close the controller
        }

        let loaded = 0;
        let failed = 0;
        let index = 0;

        async function worker() {
          while (index < candidates.length) {
            const i = index++;
            const att = candidates[i];
            const detailUrl = `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${parsedJobId}/attachments/files/${att.ID}?display=Base64`;

            try {
              const detail =
                await simproFetchWithRetry<SimproAttachmentDetail>(detailUrl);
              if (detail.MimeType?.startsWith("image/") && detail.Base64Data) {
                send("photo", {
                  id: `simpro_${detail.ID}`,
                  name: detail.Filename,
                  url: `data:${detail.MimeType};base64,${detail.Base64Data}`,
                  size: detail.FileSizeBytes ?? 0,
                  dateAdded: detail.DateAdded ?? null,
                  index: i,
                });
                loaded++;
              }
            } catch (err) {
              failed++;
              console.warn(
                `[SimPRO] Attachment ${att.ID} (${att.Filename}) failed:`,
                err instanceof Error ? err.message : err,
              );
            }

            send("progress", { loaded, failed, total: candidates.length });

            if (PER_WORKER_DELAY_MS > 0) {
              await sleep(PER_WORKER_DELAY_MS);
            }
          }
        }

        await Promise.all(Array.from({ length: CONCURRENCY }, worker));
        send("done", { total: candidates.length, loaded, failed });
      } catch (err) {
        send("error", {
          code: "UNEXPECTED",
          message:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
