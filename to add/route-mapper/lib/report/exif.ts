// lib/report/exif.ts
// Extracts date-taken from image EXIF data.
// Falls back to SimPRO's DateAdded if EXIF is unavailable (common for screenshots/exports).

export interface PhotoDateInfo {
  dateTaken: Date | null; // from EXIF — most accurate
  dateAdded: Date | null; // from SimPRO API
  displayDate: Date | null; // whichever is most reliable
  source: "exif" | "simproDateAdded" | "unknown";
}

/**
 * Extract EXIF date from a base64 image string.
 * Returns null if EXIF data isn't present (e.g. screenshots, exported images).
 */
export async function extractExifDate(
  base64Data: string,
  mimeType: string = "image/jpeg",
): Promise<Date | null> {
  try {
    // exifr works in both Node and browser — import dynamically to avoid
    // issues with Vercel's edge/serverless bundling
    const exifr = await import("exifr");

    // Convert base64 to a Buffer for server-side parsing
    const buffer = Buffer.from(base64Data, "base64");

    const exif = await exifr.parse(buffer, {
      pick: ["DateTimeOriginal", "DateTimeDigitized", "DateTime"],
    });

    if (!exif) return null;

    // Priority: when the photo was actually taken > when it was digitised > file date
    const raw =
      exif.DateTimeOriginal ?? exif.DateTimeDigitized ?? exif.DateTime;

    if (!raw) return null;

    // exifr returns JS Date objects directly
    if (raw instanceof Date) return raw;

    // Fallback: parse EXIF string format "YYYY:MM:DD HH:MM:SS"
    if (typeof raw === "string") {
      const normalised = raw.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3");
      const date = new Date(normalised);
      return isNaN(date.getTime()) ? null : date;
    }

    return null;
  } catch {
    // EXIF parsing failure is non-fatal — just return null
    return null;
  }
}

/**
 * Resolve the best available date for a photo given its base64 data
 * and the DateAdded string from the SimPRO API.
 */
export async function resolvePhotoDate(
  base64Data: string | undefined,
  simproDateAdded: string | undefined,
  mimeType: string = "image/jpeg",
): Promise<PhotoDateInfo> {
  const dateAdded = simproDateAdded ? new Date(simproDateAdded) : null;
  const invalidDateAdded =
    dateAdded && isNaN(dateAdded.getTime()) ? null : dateAdded;

  if (!base64Data) {
    return {
      dateTaken: null,
      dateAdded: invalidDateAdded,
      displayDate: invalidDateAdded,
      source: invalidDateAdded ? "simproDateAdded" : "unknown",
    };
  }

  const dateTaken = await extractExifDate(base64Data, mimeType);

  if (dateTaken) {
    return {
      dateTaken,
      dateAdded: invalidDateAdded,
      displayDate: dateTaken,
      source: "exif",
    };
  }

  return {
    dateTaken: null,
    dateAdded: invalidDateAdded,
    displayDate: invalidDateAdded,
    source: invalidDateAdded ? "simproDateAdded" : "unknown",
  };
}

/**
 * Group an array of photos by their display date (day precision).
 * Photos with no date are collected under a "Undated" group at the end.
 */
export function groupPhotosByDate<T extends { displayDate: Date | null }>(
  photos: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const photo of photos) {
    const key = photo.displayDate
      ? formatDateKey(photo.displayDate)
      : "Undated";

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(photo);
  }

  return groups;
}

/**
 * Format a date as a readable group heading, e.g. "14 February 2026"
 */
export function formatDateHeading(date: Date | null): string {
  if (!date) return "Undated";
  return date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Sortable date key — YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}
