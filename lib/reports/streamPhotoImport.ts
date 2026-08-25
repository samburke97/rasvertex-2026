// lib/reports/streamPhotoImport.ts
// Shared SSE photo-import pipeline for every report type that pulls photos
// from a SimPRO attachments stream (Condition, Anchor Inspection, Proposal —
// see each page's fetchPhotos/fetchQuotePhotos). Previously this ~80-line
// SSE-parse + compress + upload sequence was copy-pasted per report type;
// centralising it means the Blob-upload fix (and any future fix to this
// pipeline) only has to happen once.
//
// Each photo is handed to the caller (onPhoto) the moment it's compressed —
// same as before Blob uploads existed, so photos still appear on screen at
// full speed. The Blob upload then runs in the background, several at a
// time (see uploadQueue.ts), and onPhotoUploaded fires once that specific
// photo's upload resolves so the caller can swap its data: URL for the
// Blob URL. onDone only fires once every queued upload has settled — the
// caller should treat "done" as the signal that it's finally safe to
// autosave, since until then some photos may still be sitting on their
// (large) compressed data: URL rather than a small Blob URL.

import { compressImageDataUrl } from "./compressImage";
import { createUploadQueue } from "./uploadQueue";
import { uploadReportPhoto } from "./uploadPhoto";
import type { ReportPhoto } from "./photos";

export interface StreamPhotoImportCallbacks {
  /** A photo has been compressed and is ready to render. */
  onPhoto: (photo: ReportPhoto) => void;
  /** That photo's background Blob upload has finished — swap in the URL. */
  onPhotoUploaded: (id: string, blobUrl: string) => void;
  onProgress: (loaded: number, total: number) => void;
  /** Fires once the stream has ended AND every queued upload has settled. */
  onDone: () => void;
  onError: (message: string) => void;
  /** True once a newer call has superseded this one — stop touching state. */
  isStale: () => boolean;
}

const UPLOAD_CONCURRENCY = 6;

/**
 * Streams photos from an SSE attachments endpoint (see e.g.
 * app/api/simpro/jobs/[jobId]/attachments/route.ts), compressing each one
 * and uploading it to Blob storage in the background.
 *
 * @param sseUrl The SSE endpoint to stream photo events from.
 * @param blobPathname Given a photo id, returns its Blob storage pathname.
 */
export async function streamPhotoImport(
  sseUrl: string,
  blobPathname: (photoId: string) => string,
  callbacks: StreamPhotoImportCallbacks,
): Promise<void> {
  const { onPhoto, onPhotoUploaded, onProgress, onDone, onError, isStale } =
    callbacks;
  const scheduleUpload = createUploadQueue(UPLOAD_CONCURRENCY);
  const pendingUploads: Promise<void>[] = [];

  try {
    const response = await fetch(sseUrl);
    if (isStale()) return;
    if (!response.ok || !response.body)
      throw new Error("Stream connect failed");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      if (isStale()) {
        reader.cancel();
        return;
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (isStale()) {
          reader.cancel();
          return;
        }
        const eventMatch = frame.match(/^event:\s*(.+)$/m);
        const dataMatch = frame.match(/^data:\s*(.+)$/m);
        if (!eventMatch || !dataMatch) continue;
        const event = eventMatch[1].trim();
        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(dataMatch[1]);
        } catch {
          continue;
        }

        if (event === "photo") {
          const compressedUrl = await compressImageDataUrl(
            String(payload.url),
          );
          if (isStale()) {
            reader.cancel();
            return;
          }
          const photoId = String(payload.id);
          onPhoto({
            id: photoId,
            name: String(payload.name),
            url: compressedUrl,
            size: Number(payload.size) || 0,
            dateAdded: payload.dateAdded ? String(payload.dateAdded) : null,
          });

          pendingUploads.push(
            scheduleUpload(() =>
              uploadReportPhoto(compressedUrl, blobPathname(photoId)),
            ).then((blobUrl) => {
              if (!isStale()) onPhotoUploaded(photoId, blobUrl);
            }),
          );
        } else if (event === "progress") {
          if (!isStale())
            onProgress(Number(payload.loaded) || 0, Number(payload.total) || 0);
        } else if (event === "done") {
          await Promise.all(pendingUploads);
          if (!isStale()) onDone();
        } else if (event === "error") {
          if (!isStale())
            onError(String(payload.message ?? "Photo import failed"));
        }
      }
    }
  } catch (err) {
    if (isStale()) return;
    onError(err instanceof Error ? err.message : "Photo import failed");
  }
}
