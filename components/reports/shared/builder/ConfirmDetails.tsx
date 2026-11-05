"use client";
// components/reports/shared/builder/ConfirmDetails.tsx
//
// Step 2 of a report builder, as the proposal's Quote step: the job is
// loaded, so check what goes on the cover and pick the photos while they
// load, then open the report.

import type { ReactNode } from "react";
import styles from "./ConfirmDetails.module.css";

export interface DetailField {
  key: string;
  label: string;
  value: string;
  /** Text box (default), multi-line, a choice, or shown only. */
  kind?: "text" | "long" | "select" | "fixed";
  options?: { value: string; label: string }[];
}

export default function ConfirmDetails({
  title,
  sub,
  fields,
  onField,
  photos,
  onBack,
  onOpen,
  openLabel = "Open report",
}: {
  title: string;
  sub: ReactNode;
  fields: DetailField[];
  onField: (key: string, value: string) => void;
  /** The photo folder row, if the report has photos. */
  photos?: {
    folders: { id: string; name: string }[];
    current: string;
    onFolder: (id: string) => void;
    status: string;
    busy: boolean;
  };
  onBack: () => void;
  onOpen: () => void;
  openLabel?: string;
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.col}>
        <div>
          <h1 className={styles.h1}>{title}</h1>
          <p className={styles.sub}>{sub}</p>
        </div>

        <div className={styles.card}>
          {fields.map((f) => (
            <label key={f.key} className={`${styles.row} ${f.kind === "long" ? styles.rowTop : ""}`}>
              <span>{f.label}</span>
              {f.kind === "fixed" ? (
                <span className={styles.fixed}>{f.value || "—"}</span>
              ) : f.kind === "long" ? (
                <textarea className={styles.input} rows={3} value={f.value} onChange={(e) => onField(f.key, e.target.value)} />
              ) : f.kind === "select" ? (
                <select className={styles.input} value={f.value} onChange={(e) => onField(f.key, e.target.value)}>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input className={styles.input} value={f.value} onChange={(e) => onField(f.key, e.target.value)} />
              )}
            </label>
          ))}
          {photos && (
            <div className={`${styles.row} ${styles.rowTop}`}>
              <span>Photos</span>
              <div>
                {photos.folders.length > 0 && (
                  <div className={styles.chips}>
                    {[{ id: "all", name: "All photos" }, ...photos.folders].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        disabled={photos.busy && photos.current !== f.id}
                        className={`${styles.chip} ${photos.current === f.id ? styles.chipOn : ""}`}
                        onClick={() => photos.current !== f.id && photos.onFolder(f.id)}
                      >
                        {f.name}
                      </button>
                    ))}
                  </div>
                )}
                <span className={styles.hint} style={photos.folders.length ? undefined : { marginTop: 6 }}>
                  {photos.status}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.back} onClick={onBack}>
            ← Change job
          </button>
          <button type="button" className={styles.open} onClick={onOpen}>
            {openLabel}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
