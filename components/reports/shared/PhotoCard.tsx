"use client";
// components/reports/shared/PhotoCard.tsx

import React, { useState } from "react";
import styles from "./PhotoCard.module.css";
import type { ReportPhoto } from "@/lib/reports/condition.types";

interface PhotoCardProps {
  photo: ReportPhoto;
  showDate?: boolean;
  /** CSS aspect-ratio value for the thumbnail (e.g. "1 / 1"). Defaults to square. */
  aspectRatio?: string;
  onRemove: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export default function PhotoCard({
  photo,
  showDate = false,
  aspectRatio,
  onRemove,
  onRename,
}: PhotoCardProps) {
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(photo.name.replace(/\.[^/.]+$/, ""));

  const commitRename = () => {
    const ext = photo.name.includes(".")
      ? "." + photo.name.split(".").pop()
      : "";
    onRename(
      photo.id,
      (draft.trim() || photo.name.replace(/\.[^/.]+$/, "")) + ext,
    );
    setEditingName(false);
  };

  const displayName = photo.name.replace(/\.[^/.]+$/, "");

  const formattedDate =
    showDate && photo.dateAdded
      ? new Date(photo.dateAdded).toLocaleDateString("en-AU", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : null;

  return (
    <div className={styles.card}>
      <div
        className={styles.thumb}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.url} alt={displayName} />
        <button
          className={styles.removeBtn}
          onClick={() => onRemove(photo.id)}
          aria-label="Remove photo"
        >
          ×
        </button>
      </div>

      {editingName ? (
        <input
          autoFocus
          className={styles.nameInput}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setEditingName(false);
          }}
        />
      ) : (
        <p
          className={styles.name}
          onClick={() => {
            setDraft(displayName);
            setEditingName(true);
          }}
          title="Click to rename"
        >
          {displayName}
        </p>
      )}

      {formattedDate && <p className={styles.date}>{formattedDate}</p>}
    </div>
  );
}
