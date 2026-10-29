"use client";
// components/reports/condition/OptionsPanel.tsx
//
// Job Overview builder's left panel: import, report details, cover photo,
// photos, hours and the summary text. Everything here feeds the preview.

import React, { useRef, useMemo } from "react";
import styles from "../shared/OptionsPanel.module.css";
import ToggleRow from "../shared/ToggleRow";
import JobImportInput from "../shared/JobImportInput";
import DatePicker from "@/components/ui/DatePicker";
import DocEditor from "@/components/workspace/DocEditor";
import type {
  ImportStatus,
  PhotoFolder,
  ReportJobDetails,
  ReportPhoto,
  ReportScope,
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
  onRefreshSchedule: () => void;
  /** Rows loaded from SimPRO (before the date filter). */
  scheduleRows: number;
  onEditHours: () => void;
  /** The quote's description and line items; null until loaded. */
  scope: ReportScope | null;
  onCoverPhoto: (dataUrl: string | null) => void;
  /** The cover in use: the uploaded photo, else the default. */
  coverUrl: string;
  coverZoom: number;
  onCoverZoom: (zoom: number) => void;
  onJob: (field: keyof ReportJobDetails, value: string) => void;
  comments: string;
  onComments: (v: string) => void;
  recommendations: string;
  onRecommendations: (v: string) => void;
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
function plainIntro(v: string): string {
  if (!v.trim().startsWith("<")) return v;
  return v
    .replace(/<\/(p|li|h2|h3)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{2,}/g, "\n")
    .trim();
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
  onRefreshSchedule,
  scheduleRows,
  onEditHours,
  scope,
  onCoverPhoto,
  coverUrl,
  coverZoom,
  onCoverZoom,
  onJob,
  comments,
  onComments,
  recommendations,
  onRecommendations,
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

      {/* ── Report details ───────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Report details</div>
        {DETAIL_FIELDS.map((f) => (
          <label key={f.key} className={styles.field}>
            <span className={styles.subLabel}>{f.label}</span>
            <input
              className={styles.input}
              value={(job[f.key] as string | undefined) ?? ""}
              onChange={(e) => onJob(f.key, e.target.value)}
            />
          </label>
        ))}
        <label className={styles.field}>
          <span className={styles.subLabel}>Introduction</span>
          <textarea
            className={styles.textarea}
            rows={4}
            // Older drafts hold rich text here; the cover shows plain text.
            value={plainIntro(job.intro)}
            onChange={(e) => onJob("intro", e.target.value)}
          />
        </label>
      </div>

      {/* ── Cover photo ──────────────────────────────────────────────────── */}
      <div className={styles.group}>
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
        <input
          type="range"
          min={1}
          max={3}
          step={0.05}
          value={coverZoom}
          onChange={(e) => onCoverZoom(Number(e.target.value))}
          className={styles.range}
        />
        <div className={styles.subLabel}>Drag the photo on the cover preview to reposition it.</div>
      </div>

      {/* ── Photos ───────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Photos</div>

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
      <div className={styles.group}>
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

      {/* ── Summary ──────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Summary</div>
        <ToggleRow
          label="Include job summary"
          sub="Scope of works, with comments and recommendations"
          checked={settings.showSummary}
          onChange={(v) => set({ showSummary: v })}
        />
        {settings.showSummary && (
          <>
            <ToggleRow
              label="Quote description"
              sub={
                !scope
                  ? "Load a job to fetch its quote"
                  : !scope.description
                    ? "No description on the quote or job"
                    : scope.quoteId
                      ? `From quote #${scope.quoteId}`
                      : "No quote found — using the job’s description"
              }
              checked={settings.showScope !== false}
              onChange={(v) => set({ showScope: v })}
              disabled={!scope?.description}
            />
            <ToggleRow
              label="Line items"
              sub={
                !scope
                  ? "Load a job to fetch its quote"
                  : scope.items.length
                    ? `${scope.items.length} item${scope.items.length === 1 ? "" : "s"} from the quote, without prices`
                    : "No line items on the quote"
              }
              checked={settings.showScopeItems !== false}
              onChange={(v) => set({ showScopeItems: v })}
              disabled={!scope?.items.length}
            />
            <div className={styles.subLabel}>Comments</div>
            <div className={styles.editorBox}>
              <DocEditor value={comments} onChange={onComments} />
            </div>
            <div className={styles.subLabel}>Recommendations</div>
            <div className={styles.editorBox}>
              <DocEditor value={recommendations} onChange={onRecommendations} />
            </div>
            <div className={styles.subLabel}>Type / for headings, lists and checklists. Leave one empty to leave it out.</div>
          </>
        )}
      </div>
    </aside>
  );
}
