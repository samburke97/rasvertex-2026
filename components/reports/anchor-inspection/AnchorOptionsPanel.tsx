"use client";
// components/reports/anchor-inspection/AnchorOptionsPanel.tsx

import React, { useRef } from "react";
import styles from "../shared/OptionsPanel.module.css";
import JobImportInput from "../shared/JobImportInput";
import ToggleRow from "../shared/ToggleRow";
import Button from "@/components/ui/Button";
import DatePicker from "@/components/ui/DatePicker";
import type {
  AnchorPhotoSettings,
  PhotoFolder,
  ReportPhoto,
  Zone,
} from "@/lib/reports/anchor.types";
import type { AnchorImportStatus } from "./AnchorInspectionPage";
import type { PhotoImportStatus } from "../shared/PhotoSection";

interface AnchorOptionsPanelProps {
  zones: Zone[];
  onAddZone: () => void;
  onOpenZone: (zoneId: string) => void;
  onDeleteZone: (zoneId: string) => void;
  totalAnchors: number;
  totalPassed: number;
  importStatus: AnchorImportStatus;
  onImport: (jobNumber: string) => void;

  // Photos — entirely optional, off by default (see AnchorPhotoSettings).
  hasLoadedJob: boolean;
  photos: ReportPhoto[];
  photoSettings: AnchorPhotoSettings;
  onPhotoSettings: (s: AnchorPhotoSettings) => void;
  photoImportStatus: PhotoImportStatus;
  photoFolders: PhotoFolder[];
  selectedPhotoFolderId: number | null;
  onSelectPhotoFolder: (folderId: number | null) => void;
  onLoadPhotosFromJob: () => void;
  onUploadPhotos: (files: FileList) => void;
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

const PHOTO_LAYOUT_OPTIONS = [
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

export default function AnchorOptionsPanel({
  zones,
  onAddZone,
  onOpenZone,
  onDeleteZone,
  totalAnchors,
  totalPassed,
  importStatus,
  onImport,
  hasLoadedJob,
  photos,
  photoSettings,
  onPhotoSettings,
  photoImportStatus,
  photoFolders,
  selectedPhotoFolderId,
  onSelectPhotoFolder,
  onLoadPhotosFromJob,
  onUploadPhotos,
}: AnchorOptionsPanelProps) {
  const uploadRef = useRef<HTMLInputElement>(null);

  const hasPhotos = photos.length > 0;
  const isLoadingPhotos = photoImportStatus.phase === "fetching-photos";

  const set = (patch: Partial<AnchorPhotoSettings>) =>
    onPhotoSettings({ ...photoSettings, ...patch });

  const activePreset = detectPreset(
    photoSettings.dateFrom,
    photoSettings.dateTo,
  );
  const isActivelyFiltered =
    photoSettings.filterByDate &&
    (photoSettings.dateFrom || photoSettings.dateTo);

  const filteredCount = photoSettings.filterByDate
    ? photos.filter((p) => {
        if (!p.dateAdded) return true;
        const d = p.dateAdded.slice(0, 10);
        if (photoSettings.dateFrom && d < photoSettings.dateFrom) return false;
        if (photoSettings.dateTo && d > photoSettings.dateTo) return false;
        return true;
      }).length
    : photos.length;

  const handleUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUploadPhotos(e.target.files);
    }
    e.target.value = "";
  };

  return (
    <aside className={styles.panel}>
      {/* ── Job Number ───────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Job Number</div>
        <JobImportInput
          onImport={onImport}
          importStatus={importStatus}
          placeholder="e.g. 10737"
        />
      </div>

      {/* ── Zones ────────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabelRow}>
          <span className={styles.groupLabel}>Zones</span>
          {totalAnchors > 0 && (
            <span className={styles.zoneStats}>
              {totalPassed}/{totalAnchors} passed
            </span>
          )}
        </div>

        <button className={styles.addZoneBtn} onClick={onAddZone}>
          + Add Zone
        </button>

        {zones.length > 0 && (
          <div className={styles.zoneList}>
            {zones.map((zone) => (
              <div key={zone.id} className={styles.zoneRow}>
                <button
                  className={styles.zoneMain}
                  onClick={() => onOpenZone(zone.id)}
                >
                  <div className={styles.zoneThumb}>
                    {zone.mapImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={zone.mapImageUrl}
                        alt={zone.name}
                        className={styles.zoneThumbImg}
                      />
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.zoneInfo}>
                    <span className={styles.zoneName}>{zone.name}</span>
                    <span className={styles.zoneCount}>
                      {zone.anchors.length} anchor
                      {zone.anchors.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={styles.zoneChevron}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button
                  className={styles.zoneDelete}
                  onClick={() => onDeleteZone(zone.id)}
                  title="Delete zone"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Supporting Photos — optional, off by default ────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabelRow}>
          <span className={styles.groupLabel}>Supporting Photos</span>
        </div>

        <ToggleRow
          label="Add Photos"
          sub={
            photoSettings.enabled
              ? "Photos page will appear in the report"
              : "Optional — attach supporting photos to this report"
          }
          checked={photoSettings.enabled}
          onChange={(v) => set({ enabled: v })}
        />

        {photoSettings.enabled && (
          <>
            <input
              ref={uploadRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className={styles.hiddenInput}
              onChange={handleUploadChange}
            />
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={() => uploadRef.current?.click()}
            >
              Upload Photos
            </Button>

            {hasLoadedJob && (
              <Button
                variant="secondary"
                size="sm"
                fullWidth
                onClick={onLoadPhotosFromJob}
                disabled={isLoadingPhotos}
              >
                {isLoadingPhotos ? "Loading…" : "Pull From Job"}
              </Button>
            )}

            {photoFolders.length > 0 && (
              <>
                <div className={styles.subLabel}>Folder</div>
                <div className={styles.presetRow}>
                  <button
                    className={`${styles.presetBtn} ${selectedPhotoFolderId === null ? styles.presetBtnActive : ""}`}
                    onClick={() => onSelectPhotoFolder(null)}
                    disabled={isLoadingPhotos}
                  >
                    All photos
                  </button>
                  {photoFolders.map((f) => (
                    <button
                      key={f.id}
                      className={`${styles.presetBtn} ${selectedPhotoFolderId === f.id ? styles.presetBtnActive : ""}`}
                      onClick={() => onSelectPhotoFolder(f.id)}
                      disabled={isLoadingPhotos}
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
                  : "Add photos first"
              }
              checked={photoSettings.showDates}
              onChange={(v) => set({ showDates: v })}
              disabled={!hasPhotos}
            />

            <div className={styles.subLabel}>Grid size</div>
            <div className={styles.presetRow}>
              {PHOTO_LAYOUT_OPTIONS.map((l) => (
                <button
                  key={l.key}
                  className={`${styles.presetBtn} ${photoSettings.photoLayout === l.key ? styles.presetBtnActive : ""}`}
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
                  : hasPhotos
                    ? "Show all dates"
                    : "Add photos first"
              }
              checked={photoSettings.filterByDate}
              onChange={(v) => set({ filterByDate: v })}
              disabled={!hasPhotos}
            />

            {photoSettings.filterByDate && (
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

            {photoSettings.filterByDate && (
              <div className={styles.dateRange}>
                <div className={styles.dateField}>
                  <label className={styles.dateFieldLabel}>From</label>
                  <DatePicker
                    value={photoSettings.dateFrom}
                    onChange={(v) => set({ dateFrom: v })}
                  />
                </div>
                <div className={styles.dateField}>
                  <label className={styles.dateFieldLabel}>To</label>
                  <DatePicker
                    value={photoSettings.dateTo}
                    onChange={(v) => set({ dateTo: v })}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
