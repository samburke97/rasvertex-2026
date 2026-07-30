"use client";
// components/reports/condition/OptionsPanel.tsx

import React, { useRef, useMemo } from "react";
import styles from "../shared/OptionsPanel.module.css";
import ToggleRow from "../shared/ToggleRow";
import JobImportInput from "../shared/JobImportInput";
import DatePicker from "@/components/ui/DatePicker";
import type {
  ImportStatus,
  PhotoFolder,
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
  photoFolders: PhotoFolder[];
  selectedFolderId: number | null;
  onSelectFolder: (folderId: number | null) => void;
  scheduleCostCenters: ScheduleCostCenter[];
  selectedCostCenter: ScheduleCostCenter | null;
  onSelectCostCenter: (costCenter: ScheduleCostCenter | null) => void;
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
  photoFolders,
  selectedFolderId,
  onSelectFolder,
  scheduleCostCenters,
  selectedCostCenter,
  onSelectCostCenter,
  onCoverPhoto,
}: OptionsPanelProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);

  const hasPhotos = photos.length > 0;
  const canFilterByDate = hasPhotos || settings.scheduleLoaded;

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

        {photoFolders.length > 0 && (
          <>
            <div className={styles.subLabel}>Folder</div>
            <div className={styles.presetRow}>
              <button
                className={`${styles.presetBtn} ${selectedFolderId === null ? styles.presetBtnActive : ""}`}
                onClick={() => onSelectFolder(null)}
                disabled={importStatus.phase === "fetching-photos"}
              >
                All photos
              </button>
              {photoFolders.map((f) => (
                <button
                  key={f.id}
                  className={`${styles.presetBtn} ${selectedFolderId === f.id ? styles.presetBtnActive : ""}`}
                  onClick={() => onSelectFolder(f.id)}
                  disabled={importStatus.phase === "fetching-photos"}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </>
        )}

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
              ? hasPhotos
                ? `Showing ${filteredCount} of ${photos.length}`
                : "Filtering schedule by date"
              : canFilterByDate
                ? "Show all dates"
                : "Load photos or a schedule first"
          }
          checked={settings.filterByDate}
          onChange={(v) => set({ filterByDate: v })}
          disabled={!canFilterByDate}
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
            <div className={styles.dateField}>
              <label className={styles.dateFieldLabel}>From</label>
              <DatePicker
                value={settings.dateFrom}
                onChange={(v) => set({ dateFrom: v })}
              />
            </div>
            <div className={styles.dateField}>
              <label className={styles.dateFieldLabel}>To</label>
              <DatePicker
                value={settings.dateTo}
                onChange={(v) => set({ dateTo: v })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Schedule ─────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Schedule</div>

        {scheduleCostCenters.length > 0 && (
          <>
            <div className={styles.subLabel}>Cost centre</div>
            <div className={styles.presetRow}>
              <button
                className={`${styles.presetBtn} ${selectedCostCenter === null ? styles.presetBtnActive : ""}`}
                onClick={() => onSelectCostCenter(null)}
                disabled={scheduleStatus.phase === "loading"}
              >
                All hours
              </button>
              {scheduleCostCenters.map((cc) => (
                <button
                  key={cc.id}
                  className={`${styles.presetBtn} ${selectedCostCenter?.id === cc.id ? styles.presetBtnActive : ""}`}
                  onClick={() => onSelectCostCenter(cc)}
                  disabled={scheduleStatus.phase === "loading"}
                >
                  {cc.name}
                </button>
              ))}
            </div>
          </>
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
