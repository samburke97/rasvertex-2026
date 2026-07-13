"use client";
// components/reports/condition/OptionsPanel.tsx

import React, { useRef, useState, useMemo, useEffect } from "react";
import styles from "../shared/OptionsPanel.module.css";
import ToggleRow from "../shared/ToggleRow";
import JobImportInput from "../shared/JobImportInput";
import Button from "@/components/ui/Button";
import type {
  ImportStatus,
  ReportJobDetails,
  ReportPhoto,
  ReportSettings,
  ScheduleCostCenter,
  ScheduleImportStatus,
} from "@/lib/reports/condition.types";

interface OptionsPanelProps {
  settings: ReportSettings;
  photos: ReportPhoto[];
  job: ReportJobDetails;
  importStatus: ImportStatus;
  scheduleStatus: ScheduleImportStatus;
  onSettings: (s: ReportSettings) => void;
  onImport: (jobNumber: string) => void;
  onConfirmFolder: (folderId: number | null) => void;
  onConfirmCostCenter: (costCenter: ScheduleCostCenter | null) => void;
  onCoverPhoto: (dataUrl: string | null) => void;
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

// ── Photo layout options ──────────────────────────────────────────────────────

const PHOTO_LAYOUTS = [
  { key: "large", label: "Large", sub: "4 per page" },
  { key: "medium", label: "Medium", sub: "6 per page" },
  { key: "small", label: "Small", sub: "9 per page" },
] as const;

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
  scheduleStatus,
  onSettings,
  onImport,
  onConfirmFolder,
  onConfirmCostCenter,
  onCoverPhoto,
}: OptionsPanelProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(
    null,
  );
  const [selectedCostCenter, setSelectedCostCenter] =
    useState<ScheduleCostCenter | null>(null);

  const folderChoices =
    importStatus.phase === "choosing-folder" ? importStatus.folders : null;

  // Reset back to "All photos" each time a fresh folder list arrives.
  useEffect(() => {
    if (folderChoices) setSelectedFolderId(null);
  }, [folderChoices]);

  const costCenterChoices =
    scheduleStatus.phase === "choosing-cost-center"
      ? scheduleStatus.costCenters
      : null;

  // Reset back to "All hours" each time a fresh cost centre list arrives.
  useEffect(() => {
    if (costCenterChoices) setSelectedCostCenter(null);
  }, [costCenterChoices]);

  const isLoading =
    importStatus.phase === "fetching-job" ||
    importStatus.phase === "fetching-photos" ||
    importStatus.phase === "fetching-schedule";

  const hasPhotos = photos.length > 0;

  const progressPct =
    importStatus.phase === "fetching-photos" && importStatus.total > 0
      ? Math.round((importStatus.loaded / importStatus.total) * 100)
      : null;

  const set = (patch: Partial<ReportSettings>) =>
    onSettings({ ...settings, ...patch });

  const activePreset = detectPreset(settings.dateFrom, settings.dateTo);
  const isActivelyFiltered =
    settings.filterByDate && (settings.dateFrom || settings.dateTo);

  const filteredCount = useMemo(() => {
    if (!settings.filterByDate) return photos.length;
    return photos.filter((p) => {
      if (!p.dateAdded) return true;
      const d = p.dateAdded.slice(0, 10);
      if (settings.dateFrom && d < settings.dateFrom) return false;
      if (settings.dateTo && d > settings.dateTo) return false;
      return true;
    }).length;
  }, [photos, settings.filterByDate, settings.dateFrom, settings.dateTo]);

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
      {/* ── Import ───────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Import</div>
        <JobImportInput onImport={onImport} importStatus={importStatus} />
        {importStatus.phase === "fetching-photos" && progressPct !== null && (
          <div className={styles.progressWrap}>
            <div
              className={styles.progressBar}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        )}

        {folderChoices && (
          <div className={styles.folderPicker}>
            <div className={styles.subLabel}>
              This job has {folderChoices.length} attachment folder
              {folderChoices.length !== 1 ? "s" : ""} — choose what to import
            </div>
            <div className={styles.presetRow}>
              <button
                className={`${styles.presetBtn} ${selectedFolderId === null ? styles.presetBtnActive : ""}`}
                onClick={() => setSelectedFolderId(null)}
              >
                All photos
              </button>
              {folderChoices.map((f) => (
                <button
                  key={f.id}
                  className={`${styles.presetBtn} ${selectedFolderId === f.id ? styles.presetBtnActive : ""}`}
                  onClick={() => setSelectedFolderId(f.id)}
                >
                  {f.name}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConfirmFolder(selectedFolderId)}
            >
              Import photos
            </Button>
          </div>
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

        <div className={styles.subLabel}>Grid size</div>
        <div className={styles.presetRow}>
          {PHOTO_LAYOUTS.map((l) => (
            <button
              key={l.key}
              className={`${styles.presetBtn} ${settings.photoLayout === l.key ? styles.presetBtnActive : ""}`}
              onClick={() => set({ photoLayout: l.key })}
              disabled={!hasPhotos}
              title={l.sub}
            >
              {l.label}
            </button>
          ))}
        </div>

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

        {costCenterChoices && (
          <div className={styles.folderPicker}>
            <div className={styles.subLabel}>
              This job has {costCenterChoices.length} cost centres — choose
              which hours to import
            </div>
            <div className={styles.presetRow}>
              <button
                className={`${styles.presetBtn} ${selectedCostCenter === null ? styles.presetBtnActive : ""}`}
                onClick={() => setSelectedCostCenter(null)}
              >
                All hours
              </button>
              {costCenterChoices.map((cc) => (
                <button
                  key={cc.id}
                  className={`${styles.presetBtn} ${selectedCostCenter?.id === cc.id ? styles.presetBtnActive : ""}`}
                  onClick={() => setSelectedCostCenter(cc)}
                >
                  {cc.name}
                </button>
              ))}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onConfirmCostCenter(selectedCostCenter)}
            >
              Import hours
            </Button>
          </div>
        )}

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
          <>
            <ToggleRow
              label="Show notes column"
              sub="Reference a photo or note where hours were worked"
              checked={settings.showScheduleNotes}
              onChange={(v) => set({ showScheduleNotes: v })}
            />

            <ToggleRow
              label="Break into sections"
              sub="Mark rows in the table to start named sections, each with its own subtotal"
              checked={settings.scheduleSections}
              onChange={(v) => set({ scheduleSections: v })}
            />

            <p className={styles.scheduleSub}>
              Schedule uses the same date filter as photos above.
            </p>
          </>
        )}
      </div>
    </aside>
  );
}
