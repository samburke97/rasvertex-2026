"use client";
// components/reports/shared/SaveReportModal.tsx
//
// Generic "Save Report" modal used by all report types. Lets the user save
// the report as a PDF to the SimPRO Job, the SimPRO Site (visible in the
// Customer Portal), or both at once.
//
// The caller provides:
//   - saveEndpoint: which API route to POST to
//   - defaultFilename: pre-filled filename (year-based, e.g. "Anchor Inspection Report - 2026")
//   - siteId: SimPRO Site ID for this job, or "" if unavailable (disables the Site checkbox)
//   - prepareBody: function that returns the POST body (allows photo stripping etc.)
//
// Filenames are predictable-by-design (one per report type per year), so the
// backend replaces any existing same-name file rather than blocking — this
// modal never shows a "duplicate" state, only success or per-destination error.

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./SaveReportModal.module.css";
import Button from "@/components/ui/Button";

interface DestinationResult {
  success: boolean;
  error?: string;
}

interface SaveReportModalProps {
  jobId: string;
  jobNo: string;
  companyId?: number;
  siteId?: string;
  defaultFilename: string;
  saveEndpoint: string;
  /** Return the JSON body to POST. Runs just before save so it can be async. */
  prepareBody: (
    filename: string,
    companyId: number,
    destinations: { job: boolean; site: boolean },
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
  onClose: () => void;
  onSuccess: (filename: string) => void;
}

type ModalState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "error"; message: string }
  | { phase: "success"; filename: string; job: boolean; site: boolean };

export default function SaveReportModal({
  jobId,
  jobNo,
  companyId = 0,
  siteId,
  defaultFilename,
  saveEndpoint,
  prepareBody,
  onClose,
  onSuccess,
}: SaveReportModalProps) {
  const [filename, setFilename] = useState(defaultFilename);
  const hasSite = !!siteId;
  const [saveToJob, setSaveToJob] = useState(true);
  const [saveToSite, setSaveToSite] = useState(hasSite);
  const [modalState, setModalState] = useState<ModalState>({ phase: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const isSaving = modalState.phase === "saving";
  const noDestination = !saveToJob && !saveToSite;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (modalState.phase === "success") {
      const timer = setTimeout(() => {
        onSuccess(modalState.filename);
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
    if (!trimmed || noDestination) {
      if (!trimmed) inputRef.current?.focus();
      return;
    }
    setModalState({ phase: "saving" });

    const destinations = { job: saveToJob, site: saveToSite };

    try {
      const body = await prepareBody(trimmed, companyId, destinations);
      const res = await fetch(saveEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      // A payload over the platform's request-size limit (e.g. too many
      // embedded photos) never reaches our route handler — the platform
      // rejects it and returns a plain-text body, not JSON. Guard the parse
      // so that shows a clear message instead of crashing on "Unexpected
      // token" from trying to JSON.parse plain text.
      let data: { error?: string; filename?: string; job?: DestinationResult; site?: DestinationResult };
      try {
        data = await res.json();
      } catch {
        setModalState({
          phase: "error",
          message:
            res.status === 413
              ? "This report is too large to save — it likely has too many photos. Remove some photos and try again."
              : `Save failed (server returned ${res.status}). Please try again.`,
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

      const jobResult: DestinationResult | undefined = data.job;
      const siteResult: DestinationResult | undefined = data.site;
      const jobFailed = destinations.job && jobResult && !jobResult.success;
      const siteFailed = destinations.site && siteResult && !siteResult.success;

      if (jobFailed || siteFailed) {
        const parts: string[] = [];
        if (destinations.job)
          parts.push(
            jobResult?.success
              ? "Saved to Job."
              : `Job failed: ${jobResult?.error ?? "unknown error"}`,
          );
        if (destinations.site)
          parts.push(
            siteResult?.success
              ? "Saved to Site."
              : `Site failed: ${siteResult?.error ?? "unknown error"}`,
          );
        setModalState({ phase: "error", message: parts.join(" ") });
        return;
      }

      setModalState({
        phase: "success",
        filename: data.filename ?? trimmed,
        job: destinations.job,
        site: destinations.site,
      });
    } catch (err) {
      setModalState({
        phase: "error",
        message:
          err instanceof Error
            ? err.message
            : "Network error. Check your connection.",
      });
    }
  }, [filename, noDestination, saveToJob, saveToSite, prepareBody, saveEndpoint, companyId]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSaving && e.target === e.currentTarget) onClose();
  };

  const isSuccess = modalState.phase === "success";

  const successText = isSuccess
    ? modalState.job && modalState.site
      ? `"${modalState.filename}" added to Job ${jobNo} and to the Site`
      : modalState.job
        ? `"${modalState.filename}" added to Job ${jobNo}`
        : `"${modalState.filename}" added to the Site`
    : "";

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
                  fill="var(--success-400, #10b981)"
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
              {isSuccess ? "Saved" : "Save Report"}
            </h2>
            <p className={styles.subtitle}>
              {isSuccess
                ? successText
                : "Attach this report as a PDF to SimPRO"}
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
                  stroke="var(--success-400, #10b981)"
                  strokeWidth="2"
                />
                <path
                  d="M15 24l7 7 11-11"
                  stroke="var(--success-400, #10b981)"
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
                  className={`${styles.input} ${modalState.phase === "error" ? styles.inputWarn : ""}`}
                  value={filename}
                  onChange={(e) => {
                    setFilename(e.target.value);
                    if (modalState.phase === "error")
                      setModalState({ phase: "idle" });
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
            </div>

            <div className={styles.fieldWrap}>
              <label className={styles.fieldLabel}>Save to</label>
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={saveToJob}
                  onChange={(e) => setSaveToJob(e.target.checked)}
                  disabled={isSaving}
                />
                <span>Save to Job</span>
              </label>
              <label
                className={`${styles.checkRow} ${!hasSite ? styles.checkRowDisabled : ""}`}
              >
                <input
                  type="checkbox"
                  checked={saveToSite}
                  onChange={(e) => setSaveToSite(e.target.checked)}
                  disabled={isSaving || !hasSite}
                />
                <span>
                  Save to Site
                  {!hasSite && (
                    <span className={styles.checkHint}>
                      Site ID unavailable for this job
                    </span>
                  )}
                </span>
              </label>
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
              disabled={isSaving || !filename.trim() || noDestination}
            >
              {isSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
