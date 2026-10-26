"use client";
// components/reports/anchor-inspection/AnchorOptionsPanel.tsx

import React, { useRef } from "react";
import styles from "../shared/OptionsPanel.module.css";
import JobImportInput from "../shared/JobImportInput";
import ToggleRow from "../shared/ToggleRow";
import DatePicker from "@/components/ui/DatePicker";
import DocEditor from "@/components/workspace/DocEditor";
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

  // Cover photo — the default height-safety photo until one is uploaded.
  coverUrl: string;
  hasCustomCover: boolean;
  coverBusy: boolean;
  coverZoom: number;
  onUploadCover: (file: File) => void;
  onResetCover: () => void;
  onCoverZoom: (zoom: number) => void;

  comments: string;
  onComments: (v: string) => void;
  technicianNotes: string;
  onTechnicianNotes: (v: string) => void;
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
  coverUrl,
  hasCustomCover,
  coverBusy,
  coverZoom,
  onUploadCover,
  onResetCover,
  onCoverZoom,
  comments,
  onComments,
  technicianNotes,
  onTechnicianNotes,
}: AnchorOptionsPanelProps) {
  const uploadRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

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
        <div className={styles.groupLabel}>Job number</div>
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
          + Add zone
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

      {/* ── Cover photo ──────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Cover photo</div>
        <input
          ref={coverRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.hiddenInput}
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onUploadCover(f);
          }}
        />
        <div className={styles.coverPhotoPreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="Cover" className={styles.coverPhotoThumb} />
          <div className={styles.coverPhotoActions}>
            <button
              className={styles.coverPhotoChange}
              onClick={() => coverRef.current?.click()}
              disabled={coverBusy}
            >
              {coverBusy ? "Uploading…" : "Upload photo"}
            </button>
            {hasCustomCover && (
              <button className={styles.coverPhotoRemove} onClick={onResetCover}>
                Use default
              </button>
            )}
          </div>
        </div>
        <div className={styles.subLabel}>Zoom · {Math.round(coverZoom * 100)}%</div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={coverZoom}
          onChange={(e) => onCoverZoom(Number(e.target.value))}
          className={styles.range}
        />
        <div className={styles.subLabel}>
          Drag the photo on the cover preview to reposition it.
        </div>
      </div>

      {/* ── Technician notes (under the asset register) ─────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Technician notes</div>
        <div className={styles.editorBox}>
          <DocEditor value={technicianNotes} onChange={onTechnicianNotes} />
        </div>
        <div className={styles.subLabel}>
          Type / for headings, lists and checklists. Shown under the asset register.
        </div>
      </div>

      {/* ── Certification comments ───────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Certification comments</div>
        <textarea
          value={comments}
          onChange={(e) => onComments(e.target.value)}
          rows={3}
          placeholder="Optional — shown under Please note"
          className={styles.textarea}
        />
      </div>

      {/* ── Supporting Photos — optional, off by default ────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabelRow}>
          <span className={styles.groupLabel}>Supporting photos</span>
        </div>

        <ToggleRow
          label="Add photos"
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
            <button className={styles.btn} onClick={() => uploadRef.current?.click()}>
              Upload photos
            </button>

            {hasLoadedJob && (
              <button className={styles.btn} onClick={onLoadPhotosFromJob} disabled={isLoadingPhotos}>
                {isLoadingPhotos ? "Loading…" : "Pull from job"}
              </button>
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
