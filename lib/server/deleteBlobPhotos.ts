// lib/server/deleteBlobPhotos.ts
// Cleans up Blob-hosted photos that are no longer referenced by any report.
//
// Uploads use addRandomSuffix (see app/api/reports/photo-upload/route.ts),
// so nothing ever overwrites a prior blob for the same photo — every upload
// is a brand-new file. Nothing was deleting the old ones: reloading a job
// from SimPRO, or removing a single photo while editing, silently orphaned
// whatever was in Blob storage before. This is the other half of that fix —
// call it wherever a report (or a specific photo) stops referencing a blob.
import { del } from "@vercel/blob";

export async function deleteBlobPhotos(
  urls: (string | null | undefined)[],
): Promise<void> {
  const blobUrls = urls.filter(
    (u): u is string => !!u && u.startsWith("http"),
  );
  if (blobUrls.length === 0) return;
  await Promise.all(
    blobUrls.map((url) =>
      del(url).catch((err) => {
        console.error("[deleteBlobPhotos]", url, err);
      }),
    ),
  );
}
