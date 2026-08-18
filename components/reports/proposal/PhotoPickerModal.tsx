"use client";
// components/reports/proposal/PhotoPickerModal.tsx
//
// Shared picker used for both the cover's hero photo and each finding's
// photo slot — pick an already-imported/uploaded photo from the pool, or
// upload a new one on the spot. Selecting or uploading closes the modal.

import { useRef } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import styles from "./PhotoPickerModal.module.css";
import type { ReportPhoto } from "@/lib/reports/proposal.types";

export type PhotosImportStatus =
  | { phase: "idle" }
  | { phase: "loading"; loaded: number; total: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

interface PhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  photos: ReportPhoto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUploadFile: (file: File) => void;
  onImportFromQuote?: () => void;
  canImportFromQuote: boolean;
  importStatus: PhotosImportStatus;
}

export default function PhotoPickerModal({
  isOpen,
  onClose,
  photos,
  selectedId,
  onSelect,
  onUploadFile,
  onImportFromQuote,
  canImportFromQuote,
  importStatus,
}: PhotoPickerModalProps) {
  const uploadRef = useRef<HTMLInputElement>(null);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Choose a photo">
      <div className={styles.actions}>
        {onImportFromQuote && (
          <Button
            variant="outline"
            size="sm"
            onClick={onImportFromQuote}
            disabled={!canImportFromQuote || importStatus.phase === "loading"}
          >
            {importStatus.phase === "loading"
              ? `Importing… ${importStatus.loaded}/${importStatus.total}`
              : "Import photos from quote"}
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => uploadRef.current?.click()}>
          Upload new photo
        </Button>
        <input
          ref={uploadRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {importStatus.phase === "error" && (
        <p className={styles.hint}>{importStatus.message}</p>
      )}

      {photos.length === 0 ? (
        <p className={styles.hint}>
          No photos yet — import from the quote or upload one above.
        </p>
      ) : (
        <div className={styles.grid}>
          {photos.map((photo) => (
            <button
              key={photo.id}
              type="button"
              className={`${styles.thumb} ${photo.id === selectedId ? styles.thumbSelected : ""}`}
              onClick={() => onSelect(photo.id)}
              title={photo.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt={photo.name} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
