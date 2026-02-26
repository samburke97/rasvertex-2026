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

// ── Date helpers ──────────────────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

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

  let photoIndex = 0;

  return (
    <div className={styles.page}>
      <div className={styles.section}>
        {/* Header */}
        <div className={styles.header}>
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

        {/* Progress bar while streaming */}
        {isStreaming && progress && (
          <div className={styles.progressWrap}>
            <div
              className={styles.progressBar}
              style={{
                width: `${
                  progress.total > 0
                    ? Math.round((progress.loaded / progress.total) * 100)
                    : 0
                }%`,
              }}
            />
            <span className={styles.progressLabel}>
              {progress.loaded} / {progress.total} photos loaded
            </span>
          </div>
        )}

        {/* Empty state */}
        {photos.length === 0 ? (
          <div className={styles.empty}>
            {isStreaming
              ? "Loading photos from SimPRO…"
              : "No photos yet — enter a job number or upload files."}
          </div>
        ) : (
          <div className={styles.groupsWrap}>
            {groups.map((group) => {
              return (
                <div key={group.key} className={styles.group}>
                  {/* Date header */}
                  {showDates && (
                    <div className={styles.dateHeader}>
                      <span className={styles.dateHeaderLine} />
                      <span className={styles.dateHeaderText}>
                        {group.label ?? "Date unknown"}
                      </span>
                      <span className={styles.dateHeaderLine} />
                    </div>
                  )}

                  {/* Photo grid */}
                  <div className={styles.grid}>
                    {group.photos.map((photo) => {
                      photoIndex++;
                      const idx = photoIndex;
                      return (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                          index={idx}
                          onRemove={onPhotoRemove}
                          onRename={onPhotoRename}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
