// lib/reports/photos.ts
//
// "Supporting photos" data model + date-grouping/pagination logic shared by
// every report type that has a photo section (Condition Report's
// PhotoSection.tsx, and the Anchor Inspection report's photo section).
// Centralizing this here means the pagination math — which page a given
// photo lands on, in both the live preview and the printed PDF — only has
// to be got right in one place instead of hand-copied per report type.

export interface ReportPhoto {
  id: string;
  name: string;
  url: string;
  size: number;
  dateAdded?: string | null;
}

// ── Attachment folders (SimPRO job attachments, grouped) ────────────────────

export interface PhotoFolder {
  id: number;
  name: string;
}

/** Photo grid density: large = 4/page, medium = 6/page, small = 9/page. */
export type PhotoLayout = "large" | "medium" | "small";

// Content width is fixed (706px on an A4 page), so column count sets the
// thumbnail width. large/small use square thumbs, sized so whole rows fit
// the 1035px page exactly; medium uses a mild landscape crop so 3 rows fill
// the page exactly with no leftover gap.
export const PHOTO_LAYOUTS: Record<
  PhotoLayout,
  { columns: number; rowH: number; aspectRatio: string }
> = {
  large: { columns: 2, rowH: 390, aspectRatio: "1 / 1" },
  medium: { columns: 2, rowH: 345, aspectRatio: "346 / 301" },
  small: { columns: 3, rowH: 270, aspectRatio: "1 / 1" },
};

// A4 at 96dpi: 794 x 1123px. Page padding 2.75rem = 44px each side.
// Available vertical space: 1123 - (44 * 2) = 1035px.
// Date header height (incl. 1rem margin-bottom): 18 + 16 = 34px.
// Group gap between date groups: 2.25rem = 36px.
export const PAGE_AVAILABLE_H = 1035;
export const DATE_HEADER_H = 34;
export const GROUP_GAP = 36;

export function filterPhotosByDateRange(
  photos: ReportPhoto[],
  dateFrom: string | null,
  dateTo: string | null,
): ReportPhoto[] {
  if (!dateFrom && !dateTo) return photos;
  return photos.filter((p) => {
    if (!p.dateAdded) return true;
    const day = p.dateAdded.slice(0, 10);
    if (dateFrom && day < dateFrom) return false;
    if (dateTo && day > dateTo) return false;
    return true;
  });
}

// Natural sort — handles filenames like "01 Anchor.jpg", "2 Roof.jpg" etc.
export function naturalSort(a: string, b: string): number {
  const chunkify = (s: string) => s.split(/(\d+)/).filter(Boolean);
  const ca = chunkify(a);
  const cb = chunkify(b);
  for (let i = 0; i < Math.max(ca.length, cb.length); i++) {
    const x = ca[i] ?? "";
    const y = cb[i] ?? "";
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
      const diff = parseInt(x, 10) - parseInt(y, 10);
      if (diff !== 0) return diff;
    } else {
      const r = x.localeCompare(y);
      if (r !== 0) return r;
    }
  }
  return 0;
}

export function stripExt(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

function getDayKey(iso: string | null | undefined): string {
  if (!iso) return "undated";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "undated";
  }
}

function formatGroupDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export interface PhotoGroup {
  key: string;
  label: string | null;
  photos: ReportPhoto[];
}

export function groupPhotosByDate(photos: ReportPhoto[]): PhotoGroup[] {
  const map = new Map<string, ReportPhoto[]>();
  for (const p of photos) {
    const key = getDayKey(p.dateAdded);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, group]) => {
      const sorted = [...group].sort((a, b) => naturalSort(a.name, b.name));
      return {
        key,
        label:
          key === "undated" ? null : formatGroupDate(sorted[0].dateAdded!),
        photos: sorted,
      };
    });
}

export type PhotoPageItem =
  | { type: "dateHeader"; label: string }
  | { type: "photoRow"; photos: ReportPhoto[] };

export function paginatePhotoGroups(
  groups: PhotoGroup[],
  showDates: boolean,
  layout: PhotoLayout,
): PhotoPageItem[][] {
  const { columns, rowH } = PHOTO_LAYOUTS[layout] ?? PHOTO_LAYOUTS.small;
  const pages: PhotoPageItem[][] = [];
  let current: PhotoPageItem[] = [];
  let usedH = 0;

  function flush() {
    if (current.length > 0) {
      pages.push(current);
      current = [];
      usedH = 0;
    }
  }

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];

    if (showDates && group.label) {
      const neededH = DATE_HEADER_H + rowH;
      if (usedH > 0 && usedH + neededH > PAGE_AVAILABLE_H) flush();
      current.push({ type: "dateHeader", label: group.label });
      usedH += DATE_HEADER_H;
    }

    const rows: ReportPhoto[][] = [];
    for (let i = 0; i < group.photos.length; i += columns) {
      rows.push(group.photos.slice(i, i + columns));
    }
    for (const row of rows) {
      if (usedH > 0 && usedH + rowH > PAGE_AVAILABLE_H) flush();
      current.push({ type: "photoRow", photos: row });
      usedH += rowH;
    }

    const isLastGroup = g === groups.length - 1;
    if (!isLastGroup && usedH > 0 && usedH + GROUP_GAP < PAGE_AVAILABLE_H) {
      usedH += GROUP_GAP;
    }
  }

  flush();
  return pages;
}

/** Sorted/grouped photo pages, ready to paginate — shared by the live
 *  preview (React) and the print/PDF HTML builders. */
export function buildPhotoPages(
  photos: ReportPhoto[],
  showDates: boolean,
  layout: PhotoLayout,
): PhotoPageItem[][] {
  const flatSorted = [...photos].sort((a, b) => naturalSort(a.name, b.name));
  const groups = showDates
    ? groupPhotosByDate(photos)
    : [{ key: "all", label: null, photos: flatSorted }];
  return paginatePhotoGroups(groups, showDates, layout);
}
