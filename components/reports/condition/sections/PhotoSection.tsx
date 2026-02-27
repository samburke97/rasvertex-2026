"use client";
// components/reports/condition/sections/PhotoSection.tsx

import React, { useRef } from "react";
import styles from "./PhotoSection.module.css";
import PhotoCard from "../../shared/PhotoCard";
import Button from "@/components/ui/Button";
import type { ReportPhoto, ImportStatus } from "@/lib/reports/condition.types";

interface PhotoSectionProps {
  photos: ReportPhoto[];
  importStatus: ImportStatus;
  showDates: boolean;
  onPhotosAdded: (photos: ReportPhoto[]) => void;
  onPhotoRemove: (id: string) => void;
  onPhotoRename: (id: string, name: string) => void;
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
  return Array.from(map.entries()).map(([key, group]) => ({
    key,
    label: key === "undated" ? null : formatGroupDate(group[0].dateAdded!),
    photos: group,
  }));
}

// Pagination constants — must exactly match print CSS
// A4 at 96dpi: 794 x 1123px
// print .photo-section padding: 2.75rem = 44px each side
// Available vertical space: 1123 - (44 * 2) = 1035px
// Grid: 3 cols, gap 0.875rem = 14px
// Content width: 794 - (44 * 2) = 706px
// Cell width: (706 - 14 * 2) / 3 = 226px
// Cell height: 226px thumb (square) + 30px caption = 256px
// Row height (incl. gap): 256 + 14 = 270px
// Date header (incl. margin-bottom 1rem): 18 + 16 = 34px
// Group gap: 2.25rem = 36px
const PAGE_AVAILABLE_H = 1035;
const ROW_H = 270;
const DATE_HEADER_H = 34;
const GROUP_GAP = 36;

type PageItem =
  | { type: "dateHeader"; label: string }
  | { type: "photoRow"; photos: ReportPhoto[] };

interface PreviewPage {
  items: PageItem[];
}

function paginateGroups(
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

  function tryAdd(item: PageItem, h: number) {
    if (usedH > 0 && usedH + h > PAGE_AVAILABLE_H) {
      flush();
    }
    current.push(item);
    usedH += h;
  }

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];

    if (showDates && group.label) {
      // Never orphan a header — require header + at least one row to fit
      if (usedH > 0 && usedH + DATE_HEADER_H + ROW_H > PAGE_AVAILABLE_H) {
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
      tryAdd({ type: "photoRow", photos: row }, ROW_H);
    }

    const isLastGroup = g === groups.length - 1;
    if (!isLastGroup && usedH > 0 && usedH < PAGE_AVAILABLE_H) {
      usedH += GROUP_GAP;
    }
  }

  flush();
  return pages;
}

export default function PhotoSection({
  photos,
  importStatus,
  showDates,
  onPhotosAdded,
  onPhotoRemove,
  onPhotoRename,
}: PhotoSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/"),
    );
    if (!files.length) return;
    const newPhotos: ReportPhoto[] = [];
    let processed = 0;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newPhotos.push({
          id: Math.random().toString(36).slice(2),
          name: file.name,
          url: ev.target?.result as string,
          size: file.size,
          dateAdded: null,
        });
        processed++;
        if (processed === files.length) onPhotosAdded(newPhotos);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const isStreaming = importStatus.phase === "fetching-photos";
  const progress = isStreaming ? importStatus : null;

  const groups: PhotoGroup[] = showDates
    ? groupByDate(photos)
    : [{ key: "all", label: null, photos }];

  const pages = paginateGroups(groups, showDates);

  // Global photo index counter — incremented across all pages
  let photoIndex = 0;

  return (
    <>
      {/* Editor-only header bar — not rendered in PDF */}
      <div className={styles.headerBar}>
        <div className={styles.headerLeft}>
          <span className={styles.label}>Photos</span>
          <span className={styles.count}>{photos.length}</span>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          + Upload
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </div>

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
              : "No photos yet \u2014 enter a job number or upload files."}
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
                    {item.photos.map((photo) => {
                      photoIndex++;
                      const idx = photoIndex;
                      return (
                        <div key={photo.id} className={styles.photoCell}>
                          <PhotoCard
                            photo={photo}
                            index={idx}
                            showDate={false}
                            onRemove={onPhotoRemove}
                            onRename={onPhotoRename}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </>
  );
}
