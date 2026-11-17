"use client";
// components/reports/condition/OptionsPanel.tsx
//
// Job Overview builder's left panel: import, report details, cover photo,
// photos, hours and the summary text. Everything here feeds the preview.

import React, { useRef, useMemo, useState } from "react";
import styles from "../shared/OptionsPanel.module.css";
import ToggleRow from "../shared/ToggleRow";
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
import Slider from "@/components/ui/Slider";
import InfoTip from "@/components/reports/shared/builder/InfoTip";
import RichBox from "@/components/reports/shared/builder/RichBox";
import PhotoSections from "./PhotoSections";
import PhotoPickerModal, { PickerAction } from "@/components/reports/shared/builder/PhotoPickerModal";
import type { PhotoSection } from "@/lib/reports/condition.types";

interface OptionsPanelProps {
  settings: ReportSettings;
  photos: ReportPhoto[];
  job: ReportJobDetails;
  importStatus: ImportStatus;
  scheduleStatus: ScheduleImportStatus;
  onSettings: (s: ReportSettings) => void;
  photoFolders: PhotoFolder[];
  selectedFolderId: number | null;
  onSelectFolder: (folderId: number | null) => void;
  scheduleCostCenters: ScheduleCostCenter[];
  selectedCostCenter: ScheduleCostCenter | null;
  onSelectCostCenter: (costCenter: ScheduleCostCenter | null) => void;
  onRefreshSchedule: () => void;
  /** Rows loaded from SimPRO (before the date filter). */
  scheduleRows: number;
  onEditHours: () => void;
  onCoverPhoto: (dataUrl: string | null) => void;
  /** The cover in use: the uploaded photo, else the default. */
  coverUrl: string;
  coverZoom: number;
  onCoverZoom: (zoom: number) => void;
  onJob: (field: keyof ReportJobDetails, value: string) => void;
  /** Photo sections, and the one being picked on the page. */
  photoSections: PhotoSection[];
  onPhotoSections: (next: PhotoSection[]) => void;
  pickingSection: string | null;
  onPickingSection: (id: string | null) => void;
  /** Puts a photo taken off the report back on. */
  onRestorePhoto: (id: string) => void;
  /** Takes a photo off the report (it stays in the library). */
  onRemovePhoto: (id: string) => void;
  onUploadPhotos: (files: File[]) => void;
  /** Deletes an uploaded photo from the library. */
  onDeletePhoto: (id: string) => void;
  /** Fetches the job's SimPRO photos again, adding any new ones. */
  onReloadPhotos?: () => void;
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
  { key: "large", label: "Large", sub: "2 across, 6 per page" },
  { key: "medium", label: "Medium", sub: "3 across, 12 per page" },
  { key: "small", label: "Small", sub: "4 across, 24 per page" },
] as const;

// Report details shown on the cover. The site, client, project and date
// come from SimPRO and refresh on reload; the rest stay as typed.
const DETAIL_FIELDS: { key: keyof ReportJobDetails; label: string }[] = [
  { key: "reportType", label: "Report title" },
  { key: "site", label: "Site name" },
  { key: "preparedFor", label: "Prepared for" },
  { key: "project", label: "Project" },
  { key: "date", label: "Date" },
  { key: "preparedBy", label: "Prepared by" },
];

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

/** The intro field is plain text; older drafts saved rich text. */

// ── Component ─────────────────────────────────────────────────────────────────

export default function OptionsPanel({
  settings,
  photos,
  job,
  importStatus,
  scheduleStatus,
  onSettings,
  photoFolders,
  selectedFolderId,
  onSelectFolder,
  scheduleCostCenters,
  selectedCostCenter,
  onSelectCostCenter,
  onRefreshSchedule,
  scheduleRows,
  onEditHours,
  onCoverPhoto,
  coverUrl,
  coverZoom,
  onCoverZoom,
  onJob,
  photoSections,
  onPhotoSections,
  pickingSection,
  onPickingSection,
  onRestorePhoto,
  onRemovePhoto,
  onUploadPhotos,
  onDeletePhoto,
  onReloadPhotos,
}: OptionsPanelProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  // The photo library pop-up, and which photos it shows.
  const [library, setLibrary] = useState(false);
  const [libFilter, setLibFilter] = useState("all");
  const loadingPhotos = importStatus.phase === "fetching-photos";
  const hasPhotos = photos.length > 0;
  // Taken off the report: still in the library, to add back.
  const offPhotos = photos.filter((p) => p.off);
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
      {/* The job or quote is chosen on the start screen (JobStart); here,
          only how the photo import is going. */}
      {importStatus.phase === "fetching-photos" && progressPct !== null && (
        <div className={styles.group} data-pages="cover">
          <div className={styles.subLabel}>Loading photos from SimPRO…</div>
          <div className={styles.progressWrap}>
            <div className={styles.progressBar} style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      )}

      {/* ── Report details ───────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="cover">
        <div className={styles.groupLabel}>Report details</div>
        {DETAIL_FIELDS.map((f) => (
          <label key={f.key} className={styles.field} data-panel-field={f.key}>
            <span className={styles.subLabel}>{f.label}</span>
            <input
              className={styles.input}
              value={(job[f.key] as string | undefined) ?? ""}
              onChange={(e) => onJob(f.key, e.target.value)}
            />
          </label>
        ))}
        <div className={styles.field} data-panel-field="intro">
          <span className={styles.subLabel}>Introduction</span>
          <RichBox value={job.intro} onChange={(v) => onJob("intro", v)} />
        </div>
      </div>

      {/* ── Cover photo ──────────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="cover">
        <div className={styles.groupLabel}>Cover photo</div>
        <div className={styles.coverPhotoPreview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="Cover" className={styles.coverPhotoThumb} />
          <div className={styles.coverPhotoActions}>
            <button className={styles.coverPhotoChange} onClick={() => coverInputRef.current?.click()}>
              Upload photo
            </button>
            {job.coverPhoto && (
              <button className={styles.coverPhotoRemove} onClick={() => onCoverPhoto(null)}>
                Use default
              </button>
            )}
          </div>
        </div>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={styles.hiddenInput}
          onChange={handleCoverPhotoChange}
        />
        <div className={styles.subLabel}>Zoom · {Math.round(coverZoom * 100)}%</div>
        <Slider
          min={1}
          max={3}
          step={0.05}
          value={coverZoom}
          onChange={onCoverZoom}
          className={styles.range}
        />
        <div className={styles.subLabel}>Drag the photo on the cover preview to reposition it.</div>
      </div>

      {/* ── Photos ───────────────────────────────────────────────────────── */}
      <div className={styles.group} data-pages="photos">
        <div className={styles.groupLabel}>Photos</div>

        {/* The library: every photo from SimPRO and every upload; the ones
            ticked are on the report. */}
        <div className={styles.libraryRow}>
          <button className={styles.btn} onClick={() => setLibrary(true)}>
            Photo library · {photos.length}
          </button>
          <button className={styles.btn} onClick={() => uploadRef.current?.click()}>
            Upload photos
          </button>
        </div>
        {offPhotos.length > 0 && <div className={styles.subLabel}>{offPhotos.length} not on the report. Open the library to add them back.</div>}
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          multiple
          className={styles.hiddenInput}
          onChange={(e) => {
            onUploadPhotos([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        {library && (
          <PhotoPickerModal
            multi
            numbered={false}
            title="Photo library"
            subtitle="Ticked photos are on the report. Click one to add it or take it off."
            photos={photos
              .filter((p) => (libFilter === "on" ? !p.off : libFilter === "off" ? p.off : libFilter === "uploads" ? p.uploaded : true))
              .map((p) => ({ id: p.id, src: p.url, title: p.name, removable: p.uploaded }))}
            selected={photos.filter((p) => !p.off).map((p) => p.id)}
            onPick={(id) => (photos.find((p) => p.id === id)?.off ? onRestorePhoto(id) : onRemovePhoto(id))}
            onRemove={(id) => confirm("Delete this uploaded photo?") && onDeletePhoto(id)}
            onClose={() => setLibrary(false)}
            filters={[
              { id: "all", name: `All · ${photos.length}` },
              { id: "on", name: `On the report · ${photos.length - offPhotos.length}` },
              ...(offPhotos.length ? [{ id: "off", name: `Not on the report · ${offPhotos.length}` }] : []),
              ...(photos.some((p) => p.uploaded) ? [{ id: "uploads", name: "Uploads" }] : []),
            ]}
            activeFilter={libFilter}
            onFilter={setLibFilter}
            headAction={
              <>
                <PickerAction onClick={() => uploadRef.current?.click()}>Upload</PickerAction>
                {onReloadPhotos && (
                  <PickerAction disabled={loadingPhotos} onClick={onReloadPhotos} title="Fetch the job's photos from SimPRO again, adding any new ones">
                    {loadingPhotos ? "Loading…" : "↻ Reload from SimPRO"}
                  </PickerAction>
                )}
              </>
            }
            foot={`${photos.length - offPhotos.length} of ${photos.length} on the report`}
            empty={loadingPhotos ? "Loading photos from SimPRO…" : "No photos here. Reload from SimPRO, or upload some."}
          />
        )}

        <ToggleRow
          label="Include photos"
          sub={
            hasPhotos
              ? "Photo pages will appear in PDF"
              : "Load a job to fetch photos"
          }
          checked={settings.showPhotos}
          onChange={(v) => set({ showPhotos: v })}
          disabled={!hasPhotos}
        />

        {settings.showPhotos && photoFolders.length > 0 && (
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

        {settings.showPhotos && (
          <>
            <ToggleRow
              label="Group by day"
              sub={
                hasPhotos
                  ? "A heading for each day photos were taken"
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

            {hasPhotos && (
              <PhotoSections sections={photoSections} onChange={onPhotoSections} picking={pickingSection} onPicking={onPickingSection} />
            )}

          </>
        )}

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
      <div className={styles.group} data-pages="hours">
        <div className={styles.groupLabelRow}>
          <div className={styles.groupLabel}>Hours</div>
          {settings.scheduleLoaded && (
            <button
              type="button"
              className={styles.presetBtn}
              onClick={onRefreshSchedule}
              disabled={scheduleStatus.phase === "loading"}
            >
              {scheduleStatus.phase === "loading" ? "Refreshing…" : "Refresh"}
            </button>
          )}
        </div>

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
          label="Include hours schedule"
          sub={
            !settings.scheduleLoaded
              ? "Load a job to fetch schedule data"
              : scheduleRows
                ? `${scheduleRows} schedule row${scheduleRows === 1 ? "" : "s"} from SimPRO`
                : "No hours scheduled on this job"
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
              label="Hours up to today"
              sub="Leave out days scheduled after today, so future work isn't counted"
              checked={settings.hoursToToday !== false}
              onChange={(v) => set({ hoursToToday: v })}
            />

            <ToggleRow
              label="Show start and finish times"
              sub="When each person started and finished, from SimPRO"
              checked={!!settings.showScheduleTimes}
              onChange={(v) => set({ showScheduleTimes: v })}
            />

            <ToggleRow
              label="Break into sections"
              sub="Mark rows in the table to start named sections, each with its own subtotal"
              checked={settings.scheduleSections}
              onChange={(v) => set({ scheduleSections: v })}
            />

            <button className={styles.btn} onClick={onEditHours} disabled={!scheduleRows}>
              Edit hours
            </button>

            <p className={styles.scheduleSub}>
              Hours use the same date filter as photos above.
            </p>
          </>
        )}
      </div>

    </aside>
  );
}
