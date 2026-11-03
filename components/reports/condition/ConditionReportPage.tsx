"use client";
// components/reports/condition/ConditionReportPage.tsx
//
// Job Overview builder. Enter a job number: the job details, photos and
// schedule load from SimPRO (photos stream in; a job with several
// attachment folders waits for one to be picked). Left: the pages. Middle:
// the report itself (OverviewDocument), scaled to the column — drag the
// cover photo to reposition it, click a caption to rename a photo. Right:
// the selected page's editor. Hours are edited in a
// sheet over the preview. The draft autosaves against the job number.

import React, { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from "react";
import styles from "../shared/ReportPage.module.css";
import OptionsPanel from "./OptionsPanel";
import HoursEditor from "./HoursEditor";
import OverviewDocument, { OverviewStyles, type OverviewAssets } from "./OverviewDocument";
import SaveReportModal, { postSave } from "../shared/SaveReportModal";
import BuilderHeader, { HeaderButton } from "@/components/reports/shared/builder/BuilderHeader";
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
import { useDraftAutosave } from "@/components/reports/shared/builder/useDraftAutosave";
import { usePagePanel, SidePanel } from "@/components/reports/shared/builder/PagePanel";
import PageRail from "@/components/reports/shared/builder/PageRail";
import PanelResizer, { usePanelWidth } from "@/components/reports/shared/builder/PanelResizer";
import { usePhotoAdjust } from "@/components/reports/shared/builder/CropModal";
import JobStart from "@/components/reports/shared/builder/JobStart";
import ProjectSections, { sectionOn, setSection, type ProjectSection } from "./ProjectSections";
import { warrantyGaps } from "@/lib/reports/warranty";

const pub = (rel: string) => "/" + rel;
const ASSETS: OverviewAssets = {
  images: Object.fromEntries(Object.entries(ANCHOR_IMAGES).map(([k, rel]) => [k, pub(rel)])) as Record<AnchorImageKey, string>,
};
const DEFAULT_COVER_URL = pub(DEFAULT_OVERVIEW_COVER);

interface ConditionReportPageProps {
  onBack: () => void;
}


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

/** Pages in the rail; each sheet's data-page and each panel group's
 *  data-pages refer to these ids. */
const PAGE_ROWS = [
  { id: "cover", name: "Cover", num: "C" },
  { id: "hours", name: "Hours" },
  { id: "method", name: "Methodology" },
  { id: "photos", name: "Photos" },
  { id: "plan", name: "Maintenance plan" },
  { id: "warranty", name: "Warranty" },
];
/** Optional sections: an eye in the rail, off until switched on. */
const OPTIONAL: ProjectSection[] = ["method", "plan", "warranty"];

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
              // Hours stay off until switched on.
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

      // The quote's description, for the methodology. Loaded
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
  // Only once the import is fully done: `report` sits at the blank default
  // while a job loads, and a manual schedule refresh briefly empties
  // report.schedule. Saving then would overwrite the real draft.
  const { status: saveStatus, setStatus: setSaveStatus } = useDraftAutosave(
    loadedJobId ? `/api/condition-reports/${loadedJobId}` : null,
    report,
    { ready: importStatus.phase === "done" && scheduleStatus.phase !== "loading" },
  );

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
  const pagePanel = usePagePanel("cover");

  // A switched-on warranty must have its area, products and completion date
  // before the report is saved or downloaded; trying opens its editor.
  const warrantyGapList = useMemo(() => warrantyGaps(report.warranty, report.job.date), [report.warranty, report.job.date]);
  const [triedIncomplete, setTriedIncomplete] = useState(false);
  const guardWarranty = (fn: () => void) => () => {
    if (!warrantyGapList.length) return fn();
    setTriedIncomplete(true);
    pagePanel.pick("warranty", previewRef.current);
  };
  const photoAdjust = usePhotoAdjust(report.photos, (id, pos) =>
    setReport((prev) => ({ ...prev, photos: prev.photos.map((p) => (p.id === id ? { ...p, pos } : p)) })),
  );
  const panelWidth = usePanelWidth("ConditionReportPage-panel-width", 340);
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
      <BuilderHeader
        onBack={onBack}
        title="Job overview"
        subtitle={loadedJobId ? `Job ${loadedJobId}` : undefined}
        badges={[
          `${report.photos.length} photo${report.photos.length !== 1 ? "s" : ""}`,
          report.settings.showSchedule && filteredSchedule.length > 0 && `${model.totalHours.toFixed(2).replace(/\.00$/, "")} hours`,
          savedFilename && "Saved to SimPRO",
        ]}
        status={
          photoStatus
            ? { text: photoStatus, busy: true }
            : triedIncomplete && warrantyGapList.length
              ? { text: `Complete the warranty first. ${warrantyGapList.join(". ")}`, busy: true }
              : loadedJobId
                ? saveStatus
                : undefined
        }
      >
        <HeaderButton onClick={handleResetDraft} disabled={!loadedJobId}>
          Reload from SimPRO
        </HeaderButton>
        <HeaderButton onClick={guardWarranty(handleExportPDF)} disabled={!hasReport || isExporting}>
          {isExporting ? "Exporting…" : "Download PDF"}
        </HeaderButton>
        <HeaderButton primary onClick={guardWarranty(() => setShowSaveModal(true))} disabled={!hasReport || !loadedJobId}>
          Save to SimPRO
        </HeaderButton>
      </BuilderHeader>

      {/* ── Step 1: the job number ── */}
      {!loadedJobId ? (
        <JobStart
          title="New job overview"
          sub="Enter the job number. The job's photos, hours and scope are loaded from SimPRO, and a saved draft carries on where it left off."
          loading={importStatus.phase === "fetching-job"}
          error={importStatus.phase === "error" ? importStatus.message : null}
          onLoad={(n) => {
            setLoadedJobId(n);
            handleImport(n);
          }}
        />
      ) : (
      <div className={styles.editorBody}>
        <PageRail
          rows={PAGE_ROWS.map((r) =>
            r.id === "hours"
              ? { ...r, hideable: true, hidden: !report.settings.showSchedule }
              : OPTIONAL.includes(r.id as ProjectSection)
                ? { ...r, hideable: true, hidden: !sectionOn(report, r.id as ProjectSection) }
                : r,
          )}
          sel={pagePanel.sel}
          onPick={(id) => pagePanel.pick(id, previewRef.current)}
          onToggle={(id) =>
            id === "hours"
              ? setReport((r) => ({ ...r, settings: { ...r.settings, showSchedule: !r.settings.showSchedule } }))
              : setReport((r) => setSection(r, id as ProjectSection, !sectionOn(r, id as ProjectSection)))
          }
        />

        {/* ── Preview: the report itself, scaled to the column ── */}
        <div ref={previewRef} className={styles.canvas} onClick={pagePanel.onDocClick}>
          <OverviewStyles />
          <div style={{ zoom }}>
            <OverviewDocument
              model={model}
              assets={ASSETS}
              screen
              onCoverPointerDown={onCoverPointerDown}
              onPhotoRename={renamePhoto}
              onPhotoRemove={removePhoto}
              onPhotoAdjust={photoAdjust.adjust}
            />
          </div>
        </div>
        <PanelResizer panel={panelWidth} />
        <SidePanel panel={pagePanel} title={PAGE_ROWS.find((x) => x.id === pagePanel.sel)?.name ?? ""} width={panelWidth.w}>
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
            onCoverPhoto={updateCoverPhoto}
            coverUrl={model.coverUrl}
            coverZoom={model.coverPos.zoom}
            onCoverZoom={(z) => setCoverPos({ zoom: z })}
            onJob={updateJobField}
          />
          <ProjectSections report={report} update={setReport} />
        </SidePanel>
      </div>
      )}
      {photoAdjust.modal}

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
          owner={{ kind: "Job", no: `#${loadedJobId}` }}
          siteId={report.job.siteId}
          defaultFilename={`Job Overview - ${new Date().getFullYear()}`}
          save={async (filename, d) =>
            postSave(`/api/simpro/jobs/${loadedJobId}/save-report`, {
              filename,
              companyId: 0,
              jobId: loadedJobId,
              siteId: report.job.siteId,
              destinations: { job: d.owner, site: d.site },
              report: await reportForTransfer(),
            })
          }
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
