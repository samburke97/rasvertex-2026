"use client";
// components/reports/shared/SaveToJobModal.tsx
//
// Generic "Save to Job" modal used by all report types.
// The caller provides:
//   - saveEndpoint: which API route to POST to
//   - defaultFilename: pre-filled filename
//   - prepareBody: function that returns the POST body (allows photo stripping etc.)

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./SaveToJobModal.module.css";
import Button from "@/components/ui/Button";

interface SaveToJobModalProps {
  jobId: string;
  jobNo: string;
  companyId?: number;
  defaultFilename: string;
  saveEndpoint: string;
  /** Return the JSON body to POST. Runs just before save so it can be async. */
  prepareBody: (filename: string, companyId: number) => Record<string, unknown>;
  onClose: () => void;
  onSuccess: (filename: string) => void;
}

type ModalState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "duplicate"; existingFilename: string }
  | { phase: "error"; message: string }
  | { phase: "success"; filename: string };

export default function SaveToJobModal({
  jobId,
  jobNo,
  companyId = 0,
  defaultFilename,
  saveEndpoint,
  prepareBody,
  onClose,
  onSuccess,
}: SaveToJobModalProps) {
  const [filename, setFilename] = useState(defaultFilename);
  const [modalState, setModalState] = useState<ModalState>({ phase: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const isSaving = modalState.phase === "saving";

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (modalState.phase === "success") {
      const timer = setTimeout(() => {
        onSuccess(
          (modalState as { phase: "success"; filename: string }).filename,
        );
        onClose();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [modalState, onClose, onSuccess]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSaving) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSaving, onClose]);

  const handleSave = useCallback(async () => {
    const trimmed = filename.trim();
    if (!trimmed) {
      inputRef.current?.focus();
      return;
    }
    setModalState({ phase: "saving" });

    try {
      const body = prepareBody(trimmed, companyId);
      const res = await fetch(saveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 409) {
        setModalState({
          phase: "duplicate",
          existingFilename: data.existingFile?.filename ?? trimmed + ".pdf",
        });
        return;
      }
      if (!res.ok) {
        setModalState({
          phase: "error",
          message: data.error ?? "An unexpected error occurred.",
        });
        return;
      }
      setModalState({ phase: "success", filename: data.filename });
    } catch (err) {
      setModalState({
        phase: "error",
        message:
          err instanceof Error
            ? err.message
            : "Network error. Check your connection.",
      });
    }
  }, [filename, prepareBody, saveEndpoint, companyId]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSaving && e.target === e.currentTarget) onClose();
  };

  const isSuccess = modalState.phase === "success";

  return (
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerIcon}>
            {isSuccess ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle
                  cx="10"
                  cy="10"
                  r="10"
                  fill="var(--primary-400, #10b981)"
                />
                <path
                  d="M6 10l3 3 5-5"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M3 17V6l7-3 7 3v11H3z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
                <rect
                  x="7.5"
                  y="10"
                  width="5"
                  height="7"
                  rx="0.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
              </svg>
            )}
          </div>
          <div>
            <h2 className={styles.title} id="modal-title">
              {isSuccess ? "Saved to Job" : "Save to Job"}
            </h2>
            <p className={styles.subtitle}>
              {isSuccess
                ? `"${(modalState as { phase: "success"; filename: string }).filename}" added to job ${jobNo}`
                : `Attach this report as a PDF to SimPRO job ${jobNo}`}
            </p>
          </div>
          {!isSaving && !isSuccess && (
            <button
              className={styles.closeBtn}
              onClick={onClose}
              aria-label="Close"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4l8 8"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Success */}
        {isSuccess && (
          <div className={styles.successBody}>
            <div className={styles.successTick}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                <circle
                  cx="24"
                  cy="24"
                  r="22"
                  stroke="var(--primary-400, #10b981)"
                  strokeWidth="2"
                />
                <path
                  d="M15 24l7 7 11-11"
                  stroke="var(--primary-400, #10b981)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className={styles.successText}>Closing…</p>
          </div>
        )}

        {/* Form */}
        {!isSuccess && (
          <div className={styles.body}>
            {modalState.phase === "duplicate" && (
              <div className={`${styles.banner} ${styles.bannerWarn}`}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={styles.bannerIcon}
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <line
                    x1="8"
                    y1="5"
                    x2="8"
                    y2="8.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="8" cy="11" r="0.75" fill="currentColor" />
                </svg>
                <div>
                  <strong>File already exists:</strong>{" "}
                  <span className={styles.existingName}>
                    "{modalState.existingFilename}"
                  </span>
                  <br />
                  <span className={styles.bannerHint}>
                    Rename below and try again.
                  </span>
                </div>
              </div>
            )}
            {modalState.phase === "error" && (
              <div className={`${styles.banner} ${styles.bannerError}`}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={styles.bannerIcon}
                >
                  <circle
                    cx="8"
                    cy="8"
                    r="7"
                    stroke="currentColor"
                    strokeWidth="1.4"
                  />
                  <line
                    x1="8"
                    y1="4.5"
                    x2="8"
                    y2="9"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
                </svg>
                <span>{modalState.message}</span>
              </div>
            )}

            <div className={styles.fieldWrap}>
              <label className={styles.fieldLabel}>Filename</label>
              <div className={styles.inputRow}>
                <input
                  ref={inputRef}
                  type="text"
                  className={`${styles.input} ${modalState.phase === "duplicate" || modalState.phase === "error" ? styles.inputWarn : ""}`}
                  value={filename}
                  onChange={(e) => {
                    setFilename(e.target.value);
                    if (
                      modalState.phase === "duplicate" ||
                      modalState.phase === "error"
                    ) {
                      setModalState({ phase: "idle" });
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !isSaving) handleSave();
                  }}
                  disabled={isSaving}
                  placeholder={defaultFilename}
                  maxLength={200}
                  spellCheck={false}
                  autoComplete="off"
                />
                <span className={styles.ext}>.pdf</span>
              </div>
              <p className={styles.hint}>
                The PDF will be attached to SimPRO job {jobNo}
              </p>
            </div>

            {isSaving && (
              <div className={styles.savingRow}>
                <div className={styles.spinner} />
                <span className={styles.savingText}>
                  Generating PDF and uploading to SimPRO…
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!isSuccess && (
          <div className={styles.footer}>
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={isSaving || !filename.trim()}
            >
              {isSaving ? "Saving…" : "Save to Job"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
