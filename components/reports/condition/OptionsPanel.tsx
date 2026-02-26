"use client";
// components/reports/condition/OptionsPanel.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Left sidebar panel. Contains:
//   1. Job Number — triggers SimPRO import inline (no separate screen)
//   2. Display toggles (Show dates, etc.)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useId, useState } from "react";
import styles from "./OptionsPanel.module.css";
import type {
  ImportStatus,
  ReportSettings,
} from "@/lib/reports/condition.types";

interface OptionsPanelProps {
  settings: ReportSettings;
  importStatus: ImportStatus;
  onSettings: (s: ReportSettings) => void;
  onImport: (jobNumber: string) => void;
}

interface ToggleRowProps {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleRow({ label, sub, checked, onChange }: ToggleRowProps) {
  const id = useId();
  return (
    <div className={styles.toggleRow}>
      <div>
        <div className={styles.toggleLabel}>{label}</div>
        {sub && <div className={styles.toggleSub}>{sub}</div>}
      </div>
      <label className={styles.toggle}>
        <input
          id={id}
          type="checkbox"
          className={styles.toggleInput}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.toggleTrack} />
        <span className={styles.toggleThumb} />
      </label>
    </div>
  );
}

export default function OptionsPanel({
  settings,
  importStatus,
  onSettings,
  onImport,
}: OptionsPanelProps) {
  const [jobNumber, setJobNumber] = useState("");

  const isLoading =
    importStatus.phase === "fetching-job" ||
    importStatus.phase === "fetching-photos";

  const handleSubmit = () => {
    if (jobNumber.trim()) onImport(jobNumber.trim());
  };

  const progressPct =
    importStatus.phase === "fetching-photos" && importStatus.total > 0
      ? Math.round((importStatus.loaded / importStatus.total) * 100)
      : 0;

  const set = (patch: Partial<ReportSettings>) =>
    onSettings({ ...settings, ...patch });

  return (
    <aside className={styles.panel}>
      {/* ── Job Number ── */}
      <div className={styles.jobGroup}>
        <div className={styles.jobLabel}>Job Number</div>
        <div className={styles.jobInputRow}>
          <input
            type="text"
            placeholder="e.g. 10737"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={styles.jobInput}
            disabled={isLoading}
          />
          <button
            className={styles.jobBtn}
            onClick={handleSubmit}
            disabled={isLoading || !jobNumber.trim()}
            type="button"
          >
            {isLoading ? "…" : "Load"}
          </button>
        </div>

        {/* Progress */}
        {importStatus.phase === "fetching-photos" && (
          <>
            <div className={styles.progressWrap}>
              <div
                className={styles.progressBar}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className={styles.progressLabel}>
              {importStatus.loaded} / {importStatus.total} photos
            </span>
          </>
        )}

        {importStatus.phase === "fetching-job" && (
          <span className={styles.progressLabel}>Loading job details…</span>
        )}

        {importStatus.phase === "error" && (
          <span className={styles.jobError}>{importStatus.message}</span>
        )}
      </div>

      {/* ── Photos toggles ── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Photos</div>
        <ToggleRow
          label="Show dates"
          sub="Upload date above each group"
          checked={settings.showDates}
          onChange={(v) => set({ showDates: v })}
        />
      </div>
    </aside>
  );
}
