"use client";
// components/reports/condition/OptionsPanel.tsx

import React, { useId, useRef, useState, useMemo } from "react";
import styles from "./OptionsPanel.module.css";
import Button from "@/components/ui/Button";
import type {
  ImportStatus,
  ReportJobDetails,
  ReportPhoto,
  ReportSettings,
} from "@/lib/reports/condition.types";

interface OptionsPanelProps {
  settings: ReportSettings;
  photos: ReportPhoto[];
  job: ReportJobDetails;
  importStatus: ImportStatus;
  onSettings: (s: ReportSettings) => void;
  onImport: (jobNumber: string) => void;
  onCoverPhoto: (dataUrl: string | null) => void;
}

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label,
  sub,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  sub: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div
      className={`${styles.toggleRow} ${disabled ? styles.toggleRowDisabled : ""}`}
    >
      <div className={styles.toggleText}>
        <div className={styles.toggleLabel}>{label}</div>
        <div className={styles.toggleSub}>{sub}</div>
      </div>
      <label className={styles.toggle}>
        <input
          id={id}
          type="checkbox"
          className={styles.toggleInput}
          checked={checked}
          onChange={(e) => !disabled && onChange(e.target.checked)}
          disabled={disabled}
        />
        <span className={styles.toggleTrack} />
        <span className={styles.toggleThumb} />
      </label>
    </div>
  );
}

// ── Date preset helpers ───────────────────────────────────────────────────────

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

const PRESETS = [
  {
    key: "all",
    label: "All",
    resolve: () => ({ from: null as string | null, to: null as string | null }),
  },
  {
    key: "today",
    label: "Today",
    resolve: () => {
      const d = toISO(new Date());
      return { from: d, to: d };
    },
  },
  {
    key: "7d",
    label: "Last 7 days",
    resolve: () => {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: toISO(from), to: toISO(new Date()) };
    },
  },
] as const;

type PresetKey = (typeof PRESETS)[number]["key"];

function detectPreset(
  from: string | null,
  to: string | null,
): PresetKey | "custom" {
  if (!from && !to) return "all";
  for (const p of PRESETS) {
    if (p.key === "all") continue;
    const r = p.resolve();
    if (r.from === from && r.to === to) return p.key;
  }
  return "custom";
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OptionsPanel({
  settings,
  photos,
  job,
  importStatus,
  onSettings,
  onImport,
  onCoverPhoto,
}: OptionsPanelProps) {
  const [jobNumber, setJobNumber] = useState("");
  const coverInputRef = useRef<HTMLInputElement>(null);

  const isLoading =
    importStatus.phase === "fetching-job" ||
    importStatus.phase === "fetching-photos" ||
    importStatus.phase === "fetching-schedule";

  const hasPhotos = photos.length > 0;

  const progressPct =
    importStatus.phase === "fetching-photos" && importStatus.total > 0
      ? Math.round((importStatus.loaded / importStatus.total) * 100)
      : 0;

  const set = (patch: Partial<ReportSettings>) =>
    onSettings({ ...settings, ...patch });

  const handleSubmit = () => {
    if (jobNumber.trim()) onImport(jobNumber.trim());
  };

  const activePreset = detectPreset(settings.dateFrom, settings.dateTo);

  const filteredCount = useMemo(() => {
    if (!settings.filterByDate || (!settings.dateFrom && !settings.dateTo))
      return photos.length;
    return photos.filter((p) => {
      if (!p.dateAdded) return true;
      const day = p.dateAdded.slice(0, 10);
      if (settings.dateFrom && day < settings.dateFrom) return false;
      if (settings.dateTo && day > settings.dateTo) return false;
      return true;
    }).length;
  }, [photos, settings.filterByDate, settings.dateFrom, settings.dateTo]);

  const isActivelyFiltered =
    settings.filterByDate && (!!settings.dateFrom || !!settings.dateTo);

  // ── Cover photo handler ─────────────────────────────────────────────────
  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") onCoverPhoto(result);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <aside className={styles.panel}>
      {/* ── Job Number ───────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Job Number</div>
        <div className={styles.jobRow}>
          <input
            type="text"
            placeholder="e.g. 10737"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={styles.jobInput}
            disabled={isLoading}
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading || !jobNumber.trim()}
          >
            {isLoading ? "Loading…" : "Load"}
          </Button>
        </div>

        {/* Progress bar */}
        {importStatus.phase === "fetching-photos" && (
          <div className={styles.progressOuter}>
            <div
              className={styles.progressBar}
              style={{ width: `${progressPct}%` }}
            />
            <span className={styles.progressLabel}>
              {importStatus.loaded} / {importStatus.total} photos
            </span>
          </div>
        )}
        {importStatus.phase === "fetching-schedule" && (
          <div className={styles.progressOuter}>
            <div
              className={styles.progressBar}
              style={{ width: "100%", opacity: 0.5 }}
            />
            <span className={styles.progressLabel}>Loading schedule…</span>
          </div>
        )}
        {importStatus.phase === "error" && (
          <div className={styles.errorMsg}>{importStatus.message}</div>
        )}
      </div>

      {/* ── Cover Photo ──────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Cover Photo</div>
        {job.coverPhoto ? (
          <div className={styles.coverPhotoPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.coverPhoto}
              alt="Cover photo preview"
              className={styles.coverPhotoThumb}
            />
            <div className={styles.coverPhotoActions}>
              <button
                className={styles.coverPhotoChange}
                onClick={() => coverInputRef.current?.click()}
              >
                Change
              </button>
              <button
                className={styles.coverPhotoRemove}
                onClick={() => onCoverPhoto(null)}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <button
            className={styles.coverPhotoUpload}
            onClick={() => coverInputRef.current?.click()}
          >
            <span className={styles.coverPhotoUploadIcon}>↑</span>
            <span className={styles.coverPhotoUploadText}>Upload photo</span>
            <span className={styles.coverPhotoUploadSub}>
              JPG, PNG — shown behind cover design
            </span>
          </button>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.hiddenInput}
          onChange={handleCoverPhotoChange}
        />
      </div>

      {/* ── Photos ───────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Photos</div>

        <ToggleRow
          label="Show dates"
          sub={
            hasPhotos
              ? "Print capture date under each photo"
              : "Load photos first"
          }
          checked={settings.showDates}
          onChange={(v) => set({ showDates: v })}
          disabled={!hasPhotos}
        />

        <ToggleRow
          label="Filter by date"
          sub={
            isActivelyFiltered
              ? `Showing ${filteredCount} of ${photos.length}`
              : "Show all dates"
          }
          checked={settings.filterByDate}
          onChange={(v) => set({ filterByDate: v })}
          disabled={!hasPhotos}
        />

        {settings.filterByDate && (
          <div className={styles.presetRow}>
            {PRESETS.map((p) => (
              <button
                key={p.key}
                className={`${styles.presetBtn} ${activePreset === p.key ? styles.presetBtnActive : ""}`}
                onClick={() => {
                  const r = p.resolve();
                  set({ dateFrom: r.from, dateTo: r.to });
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        {settings.filterByDate && (
          <div className={styles.dateRange}>
            <input
              type="date"
              className={styles.dateInput}
              value={settings.dateFrom ?? ""}
              onChange={(e) => set({ dateFrom: e.target.value || null })}
            />
            <span className={styles.dateSep}>—</span>
            <input
              type="date"
              className={styles.dateInput}
              value={settings.dateTo ?? ""}
              onChange={(e) => set({ dateTo: e.target.value || null })}
            />
          </div>
        )}
      </div>

      {/* ── Schedule ─────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Schedule</div>

        <ToggleRow
          label="Include schedule"
          sub={
            settings.scheduleLoaded
              ? "Schedule page will appear in PDF"
              : "Load a job to fetch schedule data"
          }
          checked={settings.showSchedule}
          onChange={(v) => set({ showSchedule: v })}
          disabled={!settings.scheduleLoaded}
        />

        {settings.showSchedule && settings.scheduleLoaded && (
          <p className={styles.scheduleSub}>
            Schedule uses the same date filter as photos above.
          </p>
        )}
      </div>
    </aside>
  );
}
