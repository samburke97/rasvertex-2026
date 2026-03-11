"use client";
// components/reports/hours-breakdown/HoursBreakdownOptionsPanel.tsx

import React from "react";
import styles from "../shared/OptionsPanel.module.css";
import ToggleRow from "../shared/ToggleRow";
import JobImportInput from "../shared/JobImportInput";
import type {
  HoursBreakdownSettings,
  HoursImportStatus,
} from "@/lib/reports/hours.types";

interface Props {
  settings: HoursBreakdownSettings;
  rowCount: number;
  filteredCount: number;
  importStatus: HoursImportStatus;
  onSettings: (patch: Partial<HoursBreakdownSettings>) => void;
  onImport: (jobNumber: string) => void;
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
    key: "7d",
    label: "Last 7 days",
    resolve: () => {
      const from = new Date();
      from.setDate(from.getDate() - 6);
      return { from: toISO(from), to: toISO(new Date()) };
    },
  },
  {
    key: "30d",
    label: "Last 30 days",
    resolve: () => {
      const from = new Date();
      from.setDate(from.getDate() - 29);
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

export default function HoursBreakdownOptionsPanel({
  settings,
  rowCount,
  filteredCount,
  importStatus,
  onSettings,
  onImport,
}: Props) {
  const set = (patch: Partial<HoursBreakdownSettings>) => onSettings(patch);

  const activePreset = detectPreset(settings.dateFrom, settings.dateTo);
  const isActivelyFiltered =
    settings.filterByDate && (settings.dateFrom || settings.dateTo);

  return (
    <aside className={styles.panel}>
      {/* ── Import ── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Import</div>
        <JobImportInput onImport={onImport} importStatus={importStatus} />
      </div>

      {/* ── Date filter ── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Date Filter</div>

        <ToggleRow
          label="Filter by date"
          sub={
            isActivelyFiltered
              ? `Showing ${filteredCount} of ${rowCount} rows`
              : "Show all dates"
          }
          checked={settings.filterByDate}
          onChange={(v) => set({ filterByDate: v })}
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

        {isActivelyFiltered && (
          <p className={`${styles.filterCount} ${styles.filterCountActive}`}>
            {filteredCount} row{filteredCount !== 1 ? "s" : ""} in range
          </p>
        )}
      </div>
    </aside>
  );
}
