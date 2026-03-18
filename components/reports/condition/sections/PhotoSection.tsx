"use client";
// components/reports/condition/sections/PhotoSection.tsx

import React from "react";
import styles from "./PhotoSection.module.css";
import PhotoCard from "../../shared/PhotoCard";
import type { ReportPhoto, ImportStatus } from "@/lib/reports/condition.types";

interface PhotoSectionProps {
  photos: ReportPhoto[];
  importStatus: ImportStatus;
  showDates: boolean;
  onPhotoRemove: (id: string) => void;
  onPhotoRename: (id: string, name: string) => void;
}

// ── Natural sort — handles filenames like "01 Anchor.jpg", "2 Roof.jpg" etc. ─
function naturalSort(a: string, b: string): number {
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

function getDayKey(iso: string | null | undefined): string {
  if (!iso) return "undated";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "undated";
  }
}

interface PhotoGroup {
  key: string;
  label: string | null;
  photos: ReportPhoto[];
}

function groupByDate(photos: ReportPhoto[]): PhotoGroup[] {
  const map = new Map<string, ReportPhoto[]>();
  for (const p of photos) {
    const key = getDayKey(p.dateAdded);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([key, group]) => {
    const sorted = [...group].sort((a, b) => naturalSort(a.name, b.name));
    return {
      key,
      label: key === "undated" ? null : formatGroupDate(sorted[0].dateAdded!),
      photos: sorted,
    };
  });
}

// ── Pagination constants ──────────────────────────────────────────────────────
// A4 at 96dpi: 794 x 1123px
// .photo-page padding: 2.75rem = 44px each side
// Available vertical space: 1123 - (44 * 2) = 1035px
// Grid gap: 0.875rem = 14px
// Content width: 794 - (44 * 2) = 706px
// Cell width: (706 - 14 * 2) / 3 = 226px
// Cell height: 226px thumb + 30px caption = 256px
// Row height (incl. gap below): 256 + 14 = 270px
// Date header height (incl. 1rem margin-bottom): 18 + 16 = 34px
// Group gap between groups: 2.25rem = 36px
export const PAGE_AVAILABLE_H = 1035;
export const ROW_H = 270;
export const DATE_HEADER_H = 34;
export const GROUP_GAP = 36;

export type PageItem =
  | { type: "dateHeader"; label: string }
  | { type: "photoRow"; photos: ReportPhoto[] };

export interface PreviewPage {
  items: PageItem[];
}

export function paginateGroups(
  groups: PhotoGroup[],
  showDates: boolean,
): PreviewPage[] {
  const pages: PreviewPage[] = [];
  let current: PageItem[] = [];
  let usedH = 0;

  function flush() {
    if (current.length > 0) {
      pages.push({ items: current });
      current = [];
      usedH = 0;
    }
  }

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];

    if (showDates && group.label) {
      const neededH = DATE_HEADER_H + ROW_H;
      if (usedH > 0 && usedH + neededH > PAGE_AVAILABLE_H) {
        flush();
      }
      current.push({ type: "dateHeader", label: group.label });
      usedH += DATE_HEADER_H;
    }

    const rows: ReportPhoto[][] = [];
    for (let i = 0; i < group.photos.length; i += 3) {
      rows.push(group.photos.slice(i, i + 3));
    }

    for (const row of rows) {
      if (usedH > 0 && usedH + ROW_H > PAGE_AVAILABLE_H) {
        flush();
      }
      current.push({ type: "photoRow", photos: row });
      usedH += ROW_H;
    }

    const isLastGroup = g === groups.length - 1;
    if (!isLastGroup && usedH > 0) {
      if (usedH + GROUP_GAP < PAGE_AVAILABLE_H) {
        usedH += GROUP_GAP;
      }
    }
  }

  flush();
  return pages;
}

export default function PhotoSection({
  photos,
  importStatus,
  showDates,
  onPhotoRemove,
  onPhotoRename,
}: PhotoSectionProps) {
  const isStreaming = importStatus.phase === "fetching-photos";
  const progress =
    isStreaming &&
    importStatus.phase === "fetching-photos" &&
    "loaded" in importStatus
      ? (importStatus as { phase: string; loaded: number; total: number })
      : null;

  // When not grouping by date, still sort the flat list by filename
  const sortedPhotos = showDates
    ? photos
    : [...photos].sort((a, b) => naturalSort(a.name, b.name));

  const groups: PhotoGroup[] = showDates
    ? groupByDate(photos)
    : [{ key: "all", label: null, photos: sortedPhotos }];

  const pages = paginateGroups(groups, showDates);
  const totalPages = pages.length;

  return (
    <>
      {isStreaming && progress && (
        <div className={styles.progressOuter}>
          <div
            className={styles.progressBar}
            style={{
              width: `${progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0}%`,
            }}
          />
          <span className={styles.progressLabel}>
            {progress.loaded} / {progress.total} photos loaded
          </span>
        </div>
      )}

      {photos.length === 0 && (
        <div className={styles.emptyPage}>
          <div className={styles.empty}>
            {isStreaming
              ? "Loading photos from SimPRO\u2026"
              : "No photos yet \u2014 enter a job number to load photos from SimPRO."}
          </div>
        </div>
      )}

      {photos.length > 0 &&
        pages.map((page, pageIdx) => (
          <div key={pageIdx} className={styles.page}>
            <div className={styles.pageContent}>
              {page.items.map((item, itemIdx) => {
                if (item.type === "dateHeader") {
                  return (
                    <div key={"dh-" + itemIdx} className={styles.dateHeader}>
                      <span className={styles.dateHeaderLine} />
                      <span className={styles.dateHeaderText}>
                        {item.label}
                      </span>
                      <span className={styles.dateHeaderLine} />
                    </div>
                  );
                }
                return (
                  <div key={"row-" + itemIdx} className={styles.photoRow}>
                    {item.photos.map((photo) => (
                      <div key={photo.id} className={styles.photoCell}>
                        <PhotoCard
                          photo={photo}
                          showDate={false}
                          onRemove={onPhotoRemove}
                          onRename={onPhotoRename}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Page number — bottom-right, inside page boundary */}
            <div className={styles.pageNumber}>
              {totalPages > 1
                ? `PAGE ${pageIdx + 1} / ${totalPages}`
                : `PAGE ${pageIdx + 1}`}
            </div>
          </div>
        ))}
    </>
  );
}
