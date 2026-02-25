"use client";

import React, { useRef } from "react";
import styles from "./PhotoSection.module.css";
import PhotoCard from "../../shared/PhotoCard";
import Button from "@/components/ui/Button";
import type { ReportPhoto, ImportStatus } from "@/lib/reports/condition.types";

interface PhotoSectionProps {
  photos: ReportPhoto[];
  importStatus: ImportStatus;
  onPhotosAdded: (photos: ReportPhoto[]) => void;
  onPhotoRemove: (id: string) => void;
  onPhotoRename: (id: string, name: string) => void;
}

export default function PhotoSection({
  photos,
  importStatus,
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

  return (
    <div className={styles.section}>
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

      {/* Streaming progress bar */}
      {isStreaming && progress && (
        <div className={styles.progressWrap}>
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

      {photos.length === 0 ? (
        <div className={styles.empty}>
          {isStreaming
            ? "Loading photos from SimPRO…"
            : "No photos yet — import a job or upload files above."}
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.grid}>
            {photos.map((photo, i) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                index={i + 1}
                onRemove={onPhotoRemove}
                onRename={onPhotoRename}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
