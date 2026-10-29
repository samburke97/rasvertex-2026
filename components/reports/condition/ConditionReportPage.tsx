"use client";
// components/reports/condition/ConditionReportPage.tsx
//
// Job Overview builder. Enter a job number: the job details, photos and
// schedule load from SimPRO (photos stream in; a job with several
// attachment folders waits for one to be picked). Left: what to include,
// the cover, the report details and the summary text. Right: the report
// itself (OverviewDocument), scaled to the column — drag the cover photo to
// reposition it, click a caption to rename a photo. Hours are edited in a
// sheet over the preview. The draft autosaves against the job number.

import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import styles from "../shared/ReportPage.module.css";
import OptionsPanel from "./OptionsPanel";
import HoursEditor from "./HoursEditor";
import OverviewDocument, { OverviewStyles, type OverviewAssets } from "./OverviewDocument";
import SaveReportModal from "../shared/SaveReportModal";
import SavedBadge from "../shared/SavedBadge";
import { compressImageDataUrl } from "@/lib/reports/compressImage";
import { streamPhotoImport } from "@/lib/reports/streamPhotoImport";
import { uploadReportPhoto, deleteReportPhoto } from "@/lib/reports/uploadPhoto";
import { ANCHOR_IMAGES, type AnchorImageKey } from "@/lib/reports/anchor.layout";
import { buildOverviewModel, DEFAULT_OVERVIEW_COVER, PAGE_W } from "@/lib/reports/overview.layout";
import {
  mapJobToReportDetails,
  filterPhotosByDateRange,
  filterScheduleByDateRange,
  DEFAULT_COVER_POS,
  type ConditionReportData,
  type CoverPos,
  type ImportStatus,
  type PhotoFolder,
  type ReportJobDetails,
  type ReportScope,
  type ReportSettings,
  type ScheduleCostCenter,
  type ScheduleImportStatus,
  type ScheduleRow,
} from "@/lib/reports/condition.types";
import type { EnrichedJob } from "@/lib/simpro/types";

const pub = (rel: string) => "/" + rel;
const ASSETS: OverviewAssets = {
  images: Object.fromEntries(Object.entries(ANCHOR_IMAGES).map(([k, rel]) => [k, pub(rel)])) as Record<AnchorImageKey, string>,
};
const DEFAULT_COVER_URL = pub(DEFAULT_OVERVIEW_COVER);

interface ConditionReportPageProps {
  onBack: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error" | "too-large";
const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_RETRY_MS = 5000;

const DEFAULT_SETTINGS: ReportSettings = {
  showPhotos: true,
  showDates: false,
  filterByDate: false,
  dateFrom: null,
  dateTo: null,
  photoLayout: "small",
  showSchedule: false,
  scheduleLoaded: false,
  showScheduleNotes: false,
  scheduleSections: false,
  showSummary: true,
};

const DEFAULT_REPORT: ConditionReportData = {
  job: {
    preparedFor: "",
    preparedBy: "Phil Clark",
    address: "",
    reportType: "Job Overview",
    intro:
      "This report outlines the repairs and maintenance works completed, including any updates, adjustments, and variations from the original scope.",
    project: "",
    date: new Date().toLocaleDateString("en-AU"),
    coverPhoto: null,
    siteId: "",
  },
  photos: [],
  schedule: [],
  comments:
    "A general inspection of the building was carried out. Maintenance requirements were identified and are documented within this report.",
  recommendations:
    "Carry out all identified repair works prior to application of the specified coating system. Re-inspect on completion.",
  settings: DEFAULT_SETTINGS,
};

export default function ConditionReportPage({
  onBack,
}: ConditionReportPageProps) {
  const [report, setReport] = useState<ConditionReportData>(DEFAULT_REPORT);
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    phase: "idle",
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<ScheduleImportStatus>({
    phase: "idle",
  });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedFilename, setSavedFilename] = useState<string | null>(null);
  // Attachment folders / cost centres for the current job, offered as
  // filters once known — never gate the initial import on a choice.
  const [photoFolders, setPhotoFolders] = useState<PhotoFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(
    null,
  );
  const [scheduleCostCenters, setScheduleCostCenters] = useState<
    ScheduleCostCenter[]
  >([]);
  const [selectedCostCenter, setSelectedCostCenter] =
    useState<ScheduleCostCenter | null>(null);
  const [loadedJobId, setLoadedJobId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards the job-detail + folder/cost-centre-list fetches that happen once
  // per job import.
  const currentLoadId = useRef(0);
  // Guard each resource's own fetch/stream independently, so re-scoping
  // photos to a folder doesn't cancel an in-flight schedule fetch (or vice
  // versa).
  const photoLoadId = useRef(0);
  const scheduleLoadId = useRef(0);

  const updateSettings = useCallback((s: ReportSettings) => {
    setReport((prev) => ({ ...prev, settings: s }));
  }, []);

  const updateJobField = useCallback(
    (field: keyof ReportJobDetails, value: string) => {
      setReport((prev) => ({ ...prev, job: { ...prev.job, [field]: value } }));
    },
    [],
  );

  const setCoverPos = useCallback((patch: Partial<CoverPos>) => {
    setReport((prev) => ({ ...prev, coverPos: { ...(prev.coverPos ?? DEFAULT_COVER_POS), ...patch } }));
  }, []);

  const updateCoverPhoto = useCallback(
    (dataUrl: string | null) => {
      const previous = report.job.coverPhoto;
      if (previous) deleteReportPhoto(previous);
      setReport((prev) => ({ ...prev, coverPos: { ...DEFAULT_COVER_POS } }));

      if (!dataUrl) {
        setReport((prev) => ({ ...prev, job: { ...prev.job, coverPhoto: null } }));
        return;
      }
      compressImageDataUrl(dataUrl).then(async (compressed) => {
        setReport((prev) => ({
          ...prev,
          job: { ...prev.job, coverPhoto: compressed },
        }));
        // Same reasoning as every other photo — see uploadPhoto.ts. This
        // was previously the one image left as base64 forever, in the DB
        // row and every autosave PATCH.
        const blobUrl = await uploadReportPhoto(
          compressed,
          `condition-reports/${loadedJobId || "manual"}/cover-${Date.now()}.jpg`,
        );
        setReport((prev) => ({
          ...prev,
          job: { ...prev.job, coverPhoto: blobUrl },
        }));
      });
    },
    [report.job.coverPhoto, loadedJobId],
  );

  const removePhoto = useCallback(
    (id: string) => {
      const removed = report.photos.find((p) => p.id === id);
      if (removed) deleteReportPhoto(removed.url);
      setReport((prev) => ({
        ...prev,
        photos: prev.photos.filter((p) => p.id !== id),
      }));
    },
    [report.photos],
  );

  const renamePhoto = useCallback((id: string, name: string) => {
    setReport((prev) => ({
      ...prev,
      photos: prev.photos.map((p) => (p.id !== id ? p : { ...p, name })),
    }));
  }, []);

  const updateSchedule = useCallback((rows: ScheduleRow[]) => {
    setReport((prev) => ({ ...prev, schedule: rows }));
  }, []);

  const fetchPhotos = useCallback(
    (jobNumber: string, folderId: number | null) => {
      const myGen = ++photoLoadId.current;
      const isStale = () => photoLoadId.current !== myGen;
      setReport((prev) => ({ ...prev, photos: [] }));
      setImportStatus({ phase: "fetching-photos", loaded: 0, total: 0 });
      const folderQuery = folderId != null ? `&folderId=${folderId}` : "";
      return streamPhotoImport(
        `/api/simpro/jobs/${jobNumber}/attachments?companyId=0${folderQuery}`,
        (photoId) => `condition-reports/${jobNumber}/${photoId}.jpg`,
        {
          isStale,
          onPhoto: (photo) =>
            setReport((prev) => ({ ...prev, photos: [...prev.photos, photo] })),
          onPhotoUploaded: (id, blobUrl) =>
            setReport((prev) => ({
              ...prev,
              photos: prev.photos.map((p) =>
                p.id === id ? { ...p, url: blobUrl } : p,
              ),
            })),
          onProgress: (loaded, total) =>
            setImportStatus({ phase: "fetching-photos", loaded, total }),
          onDone: () => setImportStatus({ phase: "done" }),
          onError: (message) => setImportStatus({ phase: "error", message }),
        },
      );
    },
    [],
  );

  const fetchSchedule = useCallback(
    (jobNumber: string, costCenter: ScheduleCostCenter | null) => {
      const myGen = ++scheduleLoadId.current;
      const isStale = () => scheduleLoadId.current !== myGen;
      return (async () => {
        if (isStale()) return;
        setReport((prev) => ({ ...prev, schedule: [] }));
        setScheduleStatus({ phase: "loading" });
        try {
          const scopeQuery = costCenter
            ? `&sectionId=${costCenter.sectionId}&costCentreId=${costCenter.id}`
            : "";
          const res = await fetch(
            `/api/simpro/jobs/${jobNumber}/schedule?companyId=0${scopeQuery}`,
          );
          if (isStale()) return;
          if (!res.ok) {
            if (!isStale()) {
              setReport((prev) => ({
                ...prev,
                settings: { ...prev.settings, scheduleLoaded: true },
              }));
              setScheduleStatus({ phase: "done" });
            }
            return;
          }
          const data = await res.json();
          if (isStale()) return;
          const rows: ScheduleRow[] = data.rows ?? [];
          setReport((prev) => ({
            ...prev,
            schedule: rows,
            settings: {
              ...prev.settings,
              scheduleLoaded: true,
              showSchedule: rows.length > 0,
            },
          }));
          setScheduleStatus({ phase: "done" });
        } catch {
          if (!isStale()) {
            setReport((prev) => ({
              ...prev,
              settings: { ...prev.settings, scheduleLoaded: true },
            }));
            setScheduleStatus({ phase: "done" });
          }
        }
      })();
    },
    [],
  );

  const handleImport = useCallback(
    async (jobNumber: string) => {
      const loadId = ++currentLoadId.current;
      const isStale = () => currentLoadId.current !== loadId;

      setReport({
        ...DEFAULT_REPORT,
        job: {
          ...DEFAULT_REPORT.job,
          date: new Date().toLocaleDateString("en-AU"),
        },
      });
      setSavedFilename(null);
      setSaveStatus("idle");
      setImportStatus({ phase: "fetching-job" });
      setScheduleStatus({ phase: "idle" });
      setScheduleLoading(false);
      setPhotoFolders([]);
      setSelectedFolderId(null);
      setScheduleCostCenters([]);
      setSelectedCostCenter(null);

      // Job details, attachment folders, and any saved draft only depend on
      // `jobNumber` — fire all three immediately rather than serially.
      // (.catch on folders/draft is just to avoid an unhandled-rejection
      // warning if we return early before ever awaiting them below.)
      const jobPromise = fetch(`/api/simpro/jobs/${jobNumber}?companyId=0`);
      const foldersPromise = fetch(
        `/api/simpro/jobs/${jobNumber}/attachments/folders?companyId=0`,
      ).catch(() => null);
      const draftPromise = fetch(
        `/api/condition-reports/${jobNumber}`,
      ).catch(() => null);

      // 1. Job details — required; abort the whole import on failure.
      let jobData: EnrichedJob;
      try {
        const jobRes = await jobPromise;
        if (isStale()) return;
        if (!jobRes.ok)
          throw new Error(`Job fetch failed: HTTP ${jobRes.status}`);
        jobData = await jobRes.json();
        if (isStale()) return;
      } catch (err) {
        if (isStale()) return;
        setImportStatus({
          phase: "error",
          message: err instanceof Error ? err.message : "Failed to fetch job",
        });
        return;
      }

      // The quote's description and line items, for the job summary. Loaded
      // on every import (a draft resumes with the quote as it is now) and in
      // the background — the report is usable without it.
      const loadScope = () =>
        fetch(`/api/simpro/jobs/${jobNumber}/scope`)
          .then((r) => (r.ok ? r.json() : null))
          .then((scope: ReportScope | null) => {
            if (scope && !isStale()) setReport((prev) => ({ ...prev, scope }));
          })
          .catch(() => {});

      // 1b. Resume an in-progress draft if one exists for this job number —
      // keep the tech's own work (photos, schedule, comments,
      // recommendations, settings) and only refresh the SimPRO-sourced job
      // fields, so a corrected address/date shows up without discarding
      // anything already entered. Schedule/photos are deliberately NOT
      // re-fetched here — the draft already has them, and firing those
      // fetches in parallel with the draft check would race and overwrite
      // whatever the draft branch just set.
      try {
        const draftRes = await draftPromise;
        if (isStale()) return;
        if (draftRes?.ok) {
          const { report: draft } = (await draftRes.json()) as {
            report: ConditionReportData;
          };
          if (isStale()) return;
          const fresh = mapJobToReportDetails(jobData);
          const dj = draft.job ?? fresh;
          setReport({
            ...DEFAULT_REPORT,
            ...draft,
            // Shallow-merged above like every other field, but settings is
            // itself an object — a draft saved before a new setting existed
            // (e.g. showPhotos) has it undefined, which is falsy and would
            // silently turn that feature off on resume. Backfill per-key
            // instead of trusting the draft's settings object wholesale.
            settings: { ...DEFAULT_SETTINGS, ...draft.settings },
            // SimPRO's fields refresh (a corrected address or date shows
            // up); what was typed or chosen here stays.
            job: {
              ...fresh,
              coverPhoto: dj.coverPhoto ?? null,
              intro: dj.intro || fresh.intro,
              preparedBy: dj.preparedBy || fresh.preparedBy,
              reportType:
                !dj.reportType || dj.reportType === "Building Condition Report" ? fresh.reportType : dj.reportType,
            },
          });
          setLoadedJobId(jobNumber);
          setImportStatus({ phase: "done" });
          setScheduleStatus({ phase: "done" });
          loadScope();
          return;
        }
      } catch {
        // Treat as "no draft" — fall through to a fresh import.
      }
      if (isStale()) return;

      setReport((prev) => ({
        ...prev,
        job: mapJobToReportDetails(jobData),
      }));
      loadScope();

      // Schedule loads in the background, independent of photos — the
      // report is editable while it fetches. Cost centres are fetched in
      // parallel purely to offer as a filter afterwards.
      (async () => {
        try {
          const res = await fetch(
            `/api/simpro/jobs/${jobNumber}/schedule/cost-centers?companyId=0`,
          );
          if (isStale()) return;
          if (res.ok) {
            const data = await res.json();
            const costCenters: ScheduleCostCenter[] = data.costCenters ?? [];
            if (!isStale() && costCenters.length > 1)
              setScheduleCostCenters(costCenters);
          }
        } catch {
          // Filter just won't be offered.
        }
      })();
      fetchSchedule(jobNumber, null);

      // 2. Attachment folders — optional, already in flight above. With a
      // real choice to make (more than one folder), wait for the user to
      // pick one instead of downloading every folder's photos up front.
      let folders: PhotoFolder[] = [];
      try {
        const foldersRes = await foldersPromise;
        if (isStale()) return;
        if (foldersRes?.ok) {
          const data = await foldersRes.json();
          folders = data.folders ?? [];
        }
      } catch {
        // Treat as "no folders" — fall through to importing everything.
      }
      if (isStale()) return;

      if (folders.length > 1) {
        setPhotoFolders(folders);
        setImportStatus({ phase: "idle" });
        return;
      }

      // 0 or 1 folder — nothing meaningful to choose, import everything.
      fetchPhotos(jobNumber, null);
    },
    [fetchPhotos, fetchSchedule],
  );

  // ── Autosave the draft, debounced, whenever the report changes ───────────
  // Only persist once import is fully "done". `loadedJobId` is set (for the
  // OptionsPanel's onImport callback, see below) before the job/draft fetch
  // resolves, so `report` sits at the blank DEFAULT_REPORT for a moment on
  // every load — if autosave weren't blocked here, a save could fire during
  // that window (or later, while photos are still streaming in) and PATCH a
  // blank/partial report over a real saved draft. That's exactly what wiped
  // job 10970's draft. Once importStatus reaches "done" this effect re-runs
  // (it's a dependency below) and saves the by-then-complete report.
  useEffect(() => {
    if (!loadedJobId) return;
    if (importStatus.phase !== "done") return;
    // Same guard, for the manual "Refresh from SimPRO" schedule button —
    // fetchSchedule briefly sets report.schedule to [] while it re-fetches,
    // and that shouldn't be persisted if the request is slow.
    if (scheduleStatus.phase === "loading") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    const delay =
      saveStatus === "error" || saveStatus === "too-large"
        ? AUTOSAVE_RETRY_MS
        : AUTOSAVE_DEBOUNCE_MS;
    autosaveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/condition-reports/${loadedJobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
        });
        // 413 means this exact draft can never save as-is — it needs fewer
        // photos, not another retry — so it's tracked separately from a
        // transient "error" to show an accurate, actionable status instead
        // of retrying forever with a message that implies it might resolve.
        setSaveStatus(res.ok ? "saved" : res.status === 413 ? "too-large" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, delay);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, loadedJobId, importStatus.phase, scheduleStatus.phase]);

  // Discards the saved draft for the current job and re-imports everything
  // fresh from SimPRO — the self-serve fix for a draft that got stuck with
  // stale/missing photos (e.g. one saved mid-import before this was guarded
  // against), without needing direct database access to clear it.
  const handleResetDraft = useCallback(async () => {
    if (!loadedJobId) return;
    if (
      !window.confirm(
        "Discard the saved draft and reload this job fresh from SimPRO? Any comments or recommendations typed here will be lost — photos and schedule will be re-fetched.",
      )
    )
      return;
    try {
      await fetch(`/api/condition-reports/${loadedJobId}`, {
        method: "DELETE",
      });
    } catch {
      // Even if the delete fails, re-importing below will just overwrite
      // the stale draft on the next autosave — not a blocker either way.
    }
    handleImport(loadedJobId);
  }, [loadedJobId, handleImport]);

  const selectFolder = useCallback(
    (folderId: number | null) => {
      setSelectedFolderId(folderId);
      if (loadedJobId) fetchPhotos(loadedJobId, folderId);
    },
    [loadedJobId, fetchPhotos],
  );

  const selectCostCenter = useCallback(
    (costCenter: ScheduleCostCenter | null) => {
      setSelectedCostCenter(costCenter);
      if (loadedJobId) fetchSchedule(loadedJobId, costCenter);
    },
    [loadedJobId, fetchSchedule],
  );

  // What leaves the browser for the PDF: only what the report shows (same
  // date filter as the preview), and any image still held as a data: URL
  // recompressed first — a self-healing net for drafts from before photos
  // went to Blob storage. Blob URLs pass straight through.
  const reportForTransfer = useCallback(async (): Promise<ConditionReportData> => {
    const s = report.settings;
    const photos = !s.showPhotos
      ? []
      : s.filterByDate
        ? filterPhotosByDateRange(report.photos, s.dateFrom, s.dateTo)
        : report.photos;
    const schedule = s.filterByDate ? filterScheduleByDateRange(report.schedule, s.dateFrom, s.dateTo) : report.schedule;
    const shrink = (url: string) => (url.startsWith("data:") ? compressImageDataUrl(url) : Promise.resolve(url));
    return {
      ...report,
      job: { ...report.job, coverPhoto: report.job.coverPhoto ? await shrink(report.job.coverPhoto) : null },
      photos: await Promise.all(photos.map(async (p) => ({ ...p, url: await shrink(p.url) }))),
      schedule,
    };
  }, [report]);

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const filename = report.job.site || report.job.project
        ? `Job Overview - ${report.job.site || report.job.project}`
        : "Job Overview";
      const res = await fetch("/api/reports/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, report: await reportForTransfer() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename + ".pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ExportPDF]", err);
      alert(err instanceof Error ? err.message : "Export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [report, reportForTransfer]);

  const hasReport = report.photos.length > 0 || !!report.job.preparedFor;

  // Photos are deliberately deferred (see handleImport) while the user picks
  // a folder from more than one option.
  const awaitingFolderChoice = importStatus.phase === "idle" && photoFolders.length > 0;

  const filteredSchedule = report.settings.filterByDate
    ? filterScheduleByDateRange(report.schedule, report.settings.dateFrom, report.settings.dateTo)
    : report.schedule;

  // ── The document ───────────────────────────────────────────────────────
  const model = useMemo(() => buildOverviewModel(report, DEFAULT_COVER_URL), [report]);
  const [hoursOpen, setHoursOpen] = useState(false);

  // Drag the cover photo in the preview to move its focal point.
  const onCoverPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      e.preventDefault();
      const box = e.currentTarget.getBoundingClientRect();
      const start = { cx: e.clientX, cy: e.clientY, ...model.coverPos };
      const clamp = (v: number) => Math.min(100, Math.max(0, v));
      const move = (ev: PointerEvent) => {
        // Dragging right moves the photo right, i.e. the focal point left.
        const dx = ((ev.clientX - start.cx) / box.width) * 100 * 1.5;
        const dy = ((ev.clientY - start.cy) / box.height) * 100 * 1.5;
        setCoverPos({
          x: Math.round(clamp(start.x - dx / start.zoom) * 10) / 10,
          y: Math.round(clamp(start.y - dy / start.zoom) * 10) / 10,
        });
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [model.coverPos, setCoverPos],
  );

  // ── Preview zoom (fixed 1280px pages, scaled to the column) ────────────
  const previewRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(0.5);
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const fit = () => {
      const z = Math.max(0.15, Math.min(0.75, (el.clientWidth - 64) / PAGE_W));
      setZoom((prev) => (Math.abs(prev - z) > 0.003 ? z : prev));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const photoStatus =
    importStatus.phase === "fetching-photos"
      ? `Loading photos${importStatus.total ? ` · ${importStatus.loaded} of ${importStatus.total}` : "…"}`
      : awaitingFolderChoice
        ? "Pick a photo folder to load photos"
        : scheduleStatus.phase === "loading"
          ? "Loading schedule…"
          : null;

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.back} onClick={onBack} aria-label="Back to report types">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className={styles.topBarRight}>
          <span className={styles.topBarTitle}>Job overview</span>
          <span className={styles.badge}>
            {report.photos.length} photo{report.photos.length !== 1 ? "s" : ""}
          </span>
          {report.settings.showSchedule && filteredSchedule.length > 0 && (
            <span className={styles.badge}>{model.totalHours.toFixed(2).replace(/\.00$/, "")} hours</span>
          )}
          {photoStatus && <span className={styles.draftStatus}>{photoStatus}</span>}
          {savedFilename && <SavedBadge />}
          {loadedJobId && saveStatus !== "idle" && !photoStatus && (
            <span
              className={`${styles.draftStatus} ${
                saveStatus === "error" || saveStatus === "too-large" ? styles.draftStatusError : ""
              }`}
            >
              {saveStatus === "saving"
                ? "Saving draft…"
                : saveStatus === "error"
                  ? "Draft save failed — retrying"
                  : saveStatus === "too-large"
                    ? "Too many photos to save — remove some to continue"
                    : "Draft saved"}
            </span>
          )}
          <button className={styles.topBtn} onClick={handleResetDraft} disabled={!loadedJobId}>
            Reload from SimPRO
          </button>
          <button className={styles.topBtn} onClick={() => setShowSaveModal(true)} disabled={!hasReport || !loadedJobId}>
            Save
          </button>
          <button className={styles.topBtnPrimary} onClick={handleExportPDF} disabled={!hasReport || isExporting}>
            {isExporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.editorBody}>
        <OptionsPanel
          settings={report.settings}
          photos={report.photos}
          job={report.job}
          importStatus={importStatus}
          scheduleStatus={scheduleStatus}
          onSettings={updateSettings}
          onImport={(jobNumber) => {
            setLoadedJobId(jobNumber);
            handleImport(jobNumber);
          }}
          photoFolders={photoFolders}
          selectedFolderId={selectedFolderId}
          onSelectFolder={selectFolder}
          scheduleCostCenters={scheduleCostCenters}
          selectedCostCenter={selectedCostCenter}
          onSelectCostCenter={selectCostCenter}
          onRefreshSchedule={() => fetchSchedule(loadedJobId, selectedCostCenter)}
          scheduleRows={report.schedule.length}
          onEditHours={() => setHoursOpen(true)}
          scope={report.scope ?? null}
          onCoverPhoto={updateCoverPhoto}
          coverUrl={model.coverUrl}
          coverZoom={model.coverPos.zoom}
          onCoverZoom={(z) => setCoverPos({ zoom: z })}
          onJob={updateJobField}
          comments={report.comments}
          onComments={(v) => setReport((prev) => ({ ...prev, comments: v }))}
          recommendations={report.recommendations}
          onRecommendations={(v) => setReport((prev) => ({ ...prev, recommendations: v }))}
        />

        {/* ── Preview: the report itself, scaled to the column ── */}
        <div ref={previewRef} className={styles.canvas}>
          <OverviewStyles />
          <div style={{ zoom }}>
            <OverviewDocument
              model={model}
              assets={ASSETS}
              screen
              onCoverPointerDown={onCoverPointerDown}
              onPhotoRename={renamePhoto}
              onPhotoRemove={removePhoto}
            />
          </div>
        </div>
      </div>

      {hoursOpen && (
        <HoursEditor
          rows={report.schedule}
          loading={scheduleLoading || scheduleStatus.phase === "loading"}
          showNotes={report.settings.showScheduleNotes}
          sectioned={report.settings.scheduleSections}
          onChange={updateSchedule}
          onClose={() => setHoursOpen(false)}
        />
      )}

      {/* Save Report Modal */}
      {showSaveModal && (
        <SaveReportModal
          jobId={loadedJobId}
          jobNo={`#${loadedJobId}`}
          companyId={0}
          siteId={report.job.siteId}
          defaultFilename={`Job Overview - ${new Date().getFullYear()}`}
          saveEndpoint={`/api/simpro/jobs/${loadedJobId}/save-report`}
          prepareBody={async (filename, companyId, destinations) => ({
            filename,
            companyId,
            jobId: loadedJobId,
            siteId: report.job.siteId,
            destinations,
            report: await reportForTransfer(),
          })}
          onClose={() => setShowSaveModal(false)}
          onSuccess={(filename) => {
            setSavedFilename(filename);
            setShowSaveModal(false);
          }}
        />
      )}
    </div>
  );
}
