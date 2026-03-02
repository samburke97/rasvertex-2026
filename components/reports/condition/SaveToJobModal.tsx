"use client";
// components/reports/condition/SaveToJobModal.tsx

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./SaveToJobModal.module.css";
import Button from "@/components/ui/Button";
import type { ConditionReportData } from "@/lib/reports/condition.types";

interface SaveToJobModalProps {
  jobId: string;
  jobNo: string;
  companyId?: number;
  report: ConditionReportData;
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
  report,
  onClose,
  onSuccess,
}: SaveToJobModalProps) {
  const defaultName = `Building Condition Report ${jobNo}`;
  const [filename, setFilename] = useState(defaultName);
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
      // ── Build a lean payload ─────────────────────────────────────────────
      // Strip base64 urls out of the report (can be 50-100MB for 100 photos).
      // Send them separately as a flat id→dataURL map.
      // The server rebuilds the full report before passing to Puppeteer.
      const photoData: Record<string, string> = {};
      const strippedReport: ConditionReportData = {
        ...report,
        photos: report.photos.map((p) => {
          if (p.url) photoData[p.id] = p.url; // stash base64
          return { ...p, url: "" }; // strip from report
        }),
      };

      const res = await fetch(`/api/simpro/jobs/${jobId}/save-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: trimmed,
          report: strippedReport,
          photoData,
          companyId,
        }),
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
  }, [filename, report, jobId, companyId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isSaving) handleSave();
  };

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
                  d="M17 13v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
                <polyline
                  points="13 7 10 4 7 7"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <line
                  x1="10"
                  y1="4"
                  x2="10"
                  y2="13"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
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
                  <path
                    d="M5.5 5.5l5 5M10.5 5.5l-5 5"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
                <div>{modalState.message}</div>
              </div>
            )}

            <div className={styles.field}>
              <label className={styles.label} htmlFor="report-filename">
                File name
              </label>
              <div className={styles.inputWrap}>
                <input
                  id="report-filename"
                  ref={inputRef}
                  type="text"
                  className={`${styles.input} ${modalState.phase === "duplicate" ? styles.inputWarn : ""}`}
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
                  onKeyDown={handleKeyDown}
                  disabled={isSaving}
                  placeholder="Building Condition Report #10737"
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
