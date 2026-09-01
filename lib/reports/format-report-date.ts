// Compact report dates: "05.06.2026". Used on export and when seeding
// inspection dates from SimPRO so table cells stay one line and don't
// shove the page footer off the A4 box.

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatReportDate(d: Date): string {
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function fromParts(year: number, monthIndex: number, day: number): Date | null {
  if (!year || monthIndex < 0 || monthIndex > 11 || day < 1 || day > 31) {
    return null;
  }
  const d = new Date(year, monthIndex, day);
  if (
    d.getFullYear() !== year ||
    d.getMonth() !== monthIndex ||
    d.getDate() !== day
  ) {
    return null;
  }
  return d;
}

/** Parse common stored formats (ordinal prose, AU slashes, ISO, already-compact). */
export function parseReportDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s || s === "-") return null;

  let m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (m) return fromParts(+m[3], +m[2] - 1, +m[1]);

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return fromParts(+m[3], +m[2] - 1, +m[1]);

  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) return fromParts(+m[3], +m[2] - 1, +m[1]);

  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return fromParts(+m[1], +m[2] - 1, +m[3]);

  m = s.match(
    /^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})$/,
  );
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month !== undefined) return fromParts(+m[3], month, +m[1]);
  }

  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (m) {
    const month = MONTHS[m[2].toLowerCase()];
    if (month !== undefined) return fromParts(+m[3], month, +m[1]);
  }

  return null;
}

/** Normalise a stored date string for print/preview. Unparseable values pass through. */
export function formatReportDateText(
  value: string | null | undefined,
): string {
  if (value == null) return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "-") return trimmed;
  const parsed = parseReportDate(trimmed);
  return parsed ? formatReportDate(parsed) : value;
}
