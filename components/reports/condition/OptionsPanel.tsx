"use client";
// components/reports/condition/OptionsPanel.tsx

import React, { useId, useState, useMemo } from "react";
import styles from "./OptionsPanel.module.css";
import Button from "@/components/ui/Button";
import type {
  ImportStatus,
  ReportPhoto,
  ReportSettings,
} from "@/lib/reports/condition.types";

interface OptionsPanelProps {
  settings: ReportSettings;
  photos: ReportPhoto[];
  importStatus: ImportStatus;
  onSettings: (s: ReportSettings) => void;
  onImport: (jobNumber: string) => void;
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
  importStatus,
  onSettings,
  onImport,
}: OptionsPanelProps) {
  const [jobNumber, setJobNumber] = useState("");

  const isLoading =
    importStatus.phase === "fetching-job" ||
    importStatus.phase === "fetching-photos";
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

  // Live count of photos passing the current filter
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
            {isLoading ? "…" : "Load"}
          </Button>
        </div>

        {importStatus.phase === "fetching-photos" && (
          <>
            <div className={styles.progressWrap}>
              <div
                className={styles.progressBar}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className={styles.hint}>
              {importStatus.loaded} / {importStatus.total} photos
            </span>
          </>
        )}
        {importStatus.phase === "fetching-job" && (
          <span className={styles.hint}>Loading job details…</span>
        )}
        {importStatus.phase === "error" && (
          <span className={styles.error}>{importStatus.message}</span>
        )}
      </div>

      {/* ── Photos ───────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Photos</div>

        {/* Show dates */}
        <ToggleRow
          label="Show dates"
          sub={hasPhotos ? "Group photos by upload date" : "Load a job first"}
          checked={settings.showDates}
          disabled={!hasPhotos}
          onChange={(v) => {
            if (!v) {
              // turning off show dates resets everything
              set({
                showDates: false,
                filterByDate: false,
                dateFrom: null,
                dateTo: null,
              });
            } else {
              set({ showDates: true });
            }
          }}
        />

        {/* Filter by date — only visible once showDates is on */}
        {settings.showDates && (
          <ToggleRow
            label="Filter by date"
            sub="Show photos from a date range"
            checked={settings.filterByDate}
            disabled={!hasPhotos}
            onChange={(v) => {
              if (!v)
                set({ filterByDate: false, dateFrom: null, dateTo: null });
              else set({ filterByDate: true });
            }}
          />
        )}

        {/* Date filter controls — only when filterByDate is on */}
        {settings.showDates && settings.filterByDate && (
          <div className={styles.filterSection}>
            {/* Preset buttons — use our Button component */}
            <div className={styles.presetRow}>
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  variant={activePreset === p.key ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => {
                    const { from, to } = p.resolve();
                    set({ dateFrom: from, dateTo: to });
                  }}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Manual date pickers */}
            <div className={styles.dateInputs}>
              <div className={styles.dateRow}>
                <span className={styles.dateRowLabel}>From</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={settings.dateFrom ?? ""}
                  onChange={(e) => set({ dateFrom: e.target.value || null })}
                />
              </div>
              <div className={styles.dateRow}>
                <span className={styles.dateRowLabel}>To</span>
                <input
                  type="date"
                  className={styles.dateInput}
                  value={settings.dateTo ?? ""}
                  onChange={(e) => set({ dateTo: e.target.value || null })}
                />
              </div>
            </div>

            {/* Count — same size/weight as everything else, green when filtered */}
            <p
              className={`${styles.filterCount} ${isActivelyFiltered ? styles.filterCountActive : ""}`}
            >
              {filteredCount} of {photos.length} photos shown
            </p>
          </div>
        )}
      </div>
    </aside>
  );
}
