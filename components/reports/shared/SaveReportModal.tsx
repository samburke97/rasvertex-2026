"use client";
// components/reports/shared/SaveReportModal.tsx
//
// "Save to SimPRO" for every report: the PDF goes to the job's (or the
// quote's) attachments, the site's (shown in the Customer Portal), or both.
//
// The report supplies `save`, which renders the PDF and uploads it to the
// chosen destinations, returning how each went. Filenames are predictable
// by design (one per report per year or quote), so saving again replaces
// the earlier file rather than blocking.

import React, { useState, useEffect, useRef, useCallback } from "react";
import styles from "./SaveReportModal.module.css";
import Button from "@/components/ui/Button";

export interface DestinationResult {
  success: boolean;
  error?: string;
}

export interface SaveResult {
  filename?: string;
  owner?: DestinationResult;
  site?: DestinationResult;
}

export type SaveDestinations = { owner: boolean; site: boolean };

interface SaveReportModalProps {
  /** What the report belongs to in SimPRO: a job or a quote, and its number. */
  owner: { kind: "Job" | "Quote"; no: string };
  /** SimPRO Site ID, or "" / undefined when unknown (disables Site). */
  siteId?: string;
  defaultFilename: string;
  save: (filename: string, destinations: SaveDestinations) => Promise<SaveResult>;
  onClose: () => void;
  onSuccess?: (filename: string) => void;
}

type ModalState =
  | { phase: "idle" }
  | { phase: "saving" }
  | { phase: "error"; message: string }
  | { phase: "success"; filename: string; owner: boolean; site: boolean };

/** For JSON save routes ({ filename, job, site }): POST and read the result. */
export async function postSave(endpoint: string, body: Record<string, unknown>): Promise<SaveResult> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  // A payload over the platform's size limit (too many embedded photos)
  // never reaches the route: the reply is plain text, not JSON.
  let data: { error?: string; filename?: string; job?: DestinationResult; site?: DestinationResult };
  try {
    data = await res.json();
  } catch {
    throw new Error(
      res.status === 413
        ? "This report is too large to save. It likely has too many photos; remove some and try again."
        : `Save failed (server returned ${res.status}). Please try again.`,
    );
  }
  if (!res.ok) throw new Error(data.error ?? "An unexpected error occurred.");
  return { filename: data.filename, owner: data.job, site: data.site };
}

export default function SaveReportModal({ owner, siteId, defaultFilename, save, onClose, onSuccess }: SaveReportModalProps) {
  const [filename, setFilename] = useState(defaultFilename);
  const hasSite = !!siteId;
  const [saveToOwner, setSaveToOwner] = useState(true);
  const [saveToSite, setSaveToSite] = useState(hasSite);
  const [modalState, setModalState] = useState<ModalState>({ phase: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const isSaving = modalState.phase === "saving";
  const noDestination = !saveToOwner && !saveToSite;
  const jobNo = owner.no;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    if (modalState.phase === "success") {
      const timer = setTimeout(() => {
        onSuccess?.(modalState.filename);
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
    const destinations = { owner: saveToOwner, site: saveToSite };
    try {
      const r = await save(trimmed, destinations);
      const ownerFailed = destinations.owner && !r.owner?.success;
      const siteFailed = destinations.site && !r.site?.success;
      if (ownerFailed || siteFailed) {
        const parts: string[] = [];
        if (destinations.owner)
          parts.push(r.owner?.success ? `Saved to ${owner.kind}.` : `${owner.kind} failed: ${r.owner?.error ?? "unknown error"}`);
        if (destinations.site) parts.push(r.site?.success ? "Saved to Site." : `Site failed: ${r.site?.error ?? "unknown error"}`);
        setModalState({ phase: "error", message: parts.join(" ") });
        return;
      }
      setModalState({ phase: "success", filename: r.filename ?? trimmed, owner: destinations.owner, site: destinations.site });
    } catch (err) {
      setModalState({ phase: "error", message: err instanceof Error ? err.message : "Network error. Check your connection." });
    }
  }, [filename, noDestination, saveToOwner, saveToSite, save, owner.kind]);

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSaving && e.target === e.currentTarget) onClose();
  };

  const isSuccess = modalState.phase === "success";

  const successText = isSuccess
    ? modalState.owner && modalState.site
      ? `"${modalState.filename}" added to ${owner.kind} ${jobNo} and to the Site`
      : modalState.owner
        ? `"${modalState.filename}" added to ${owner.kind} ${jobNo}`
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
                  fill="var(--green)"
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
              {isSuccess ? "Saved" : "Save to SimPRO"}
            </h2>
            <p className={styles.subtitle}>
              {isSuccess
                ? successText
                : `Attach this report as a PDF to SimPRO`}
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
                  stroke="var(--green)"
                  strokeWidth="2"
                />
                <path
                  d="M15 24l7 7 11-11"
                  stroke="var(--green)"
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
                  checked={saveToOwner}
                  onChange={(e) => setSaveToOwner(e.target.checked)}
                  disabled={isSaving}
                />
                <span>
                  Save to {owner.kind}
                  <span className={styles.checkHint}>
                    {owner.kind} {jobNo} attachments
                  </span>
                </span>
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
                  <span className={styles.checkHint}>
                    {hasSite ? "Shows in the Customer Portal" : `No site in SimPRO for this ${owner.kind.toLowerCase()}`}
                  </span>
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
