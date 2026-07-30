"use client";
// components/reports/shared/PhotoSection.tsx
//
// Shared "supporting photos" section — used by both the Condition Report
// and the Anchor Inspection report. Pagination/grouping logic lives in
// lib/reports/photos.ts (also used by each report's *.print.ts PDF
// builder), so this component only handles layout/rendering.

import React from "react";
import styles from "./PhotoSection.module.css";
import PhotoCard from "./PhotoCard";
import {
  PHOTO_LAYOUTS,
  buildPhotoPages,
  type ReportPhoto,
  type PhotoLayout,
  type PhotoPageItem,
} from "@/lib/reports/photos";

// A report-type-agnostic import status — each report has its own richer
// ImportStatus union with report-specific phases (e.g. "fetching-job"),
// but this component only ever needs to know whether photos are streaming
// in right now, so it accepts anything with at least that phase.
export type PhotoImportStatus =
  | { phase: "fetching-photos"; loaded: number; total: number }
  | { phase: string };

interface PhotoSectionProps {
  photos: ReportPhoto[];
  importStatus: PhotoImportStatus;
  awaitingFolderChoice?: boolean;
  showDates: boolean;
  layout: PhotoLayout;
  onPhotoRemove: (id: string) => void;
  onPhotoRename: (id: string, name: string) => void;
  /** Shown in the empty state before any photos are loaded — customise per
   *  report (e.g. condition report mentions SimPRO import, anchor mentions
   *  upload). Defaults to a generic message. */
  emptyMessage?: string;
}

export default function PhotoSection({
  photos,
  importStatus,
  awaitingFolderChoice = false,
  showDates,
  layout,
  onPhotoRemove,
  onPhotoRename,
  emptyMessage,
}: PhotoSectionProps) {
  const isStreaming = importStatus.phase === "fetching-photos";
  const progress =
    isStreaming &&
    importStatus.phase === "fetching-photos" &&
    "loaded" in importStatus
      ? (importStatus as { phase: string; loaded: number; total: number })
      : null;

  const { columns, aspectRatio } = PHOTO_LAYOUTS[layout] ?? PHOTO_LAYOUTS.small;

  const pages = buildPhotoPages(photos, showDates, layout);
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
              : awaitingFolderChoice
                ? "Choose a folder in the sidebar to import photos."
                : (emptyMessage ??
                  "No photos yet \u2014 enter a job number to load photos from SimPRO.")}
          </div>
        </div>
      )}

      {photos.length > 0 &&
        pages.map((page, pageIdx) => (
          <div key={pageIdx} className={styles.page}>
            <div className={styles.pageContent}>
              {page.map((item: PhotoPageItem, itemIdx: number) => {
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
                  <div
                    key={"row-" + itemIdx}
                    className={styles.photoRow}
                    style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                  >
                    {item.photos.map((photo) => (
                      <div key={photo.id} className={styles.photoCell}>
                        <PhotoCard
                          photo={photo}
                          showDate={false}
                          aspectRatio={aspectRatio}
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
