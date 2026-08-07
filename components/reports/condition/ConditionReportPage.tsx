"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import styles from "../shared/ReportPage.module.css";
import CoverSection from "../shared/CoverSection";
import RichTextEditor from "../shared/RichTextEditor";
import PhotoSection from "../shared/PhotoSection";
import ScheduleSection from "./sections/ScheduleSection";
import SummarySection from "./sections/SummarySection";
import OptionsPanel from "./OptionsPanel";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import SaveReportModal from "../shared/SaveReportModal";
import SavedBadge from "../shared/SavedBadge";
import { compressImageDataUrl } from "@/lib/reports/compressImage";
import {
  mapJobToReportDetails,
  filterPhotosByDateRange,
  filterScheduleByDateRange,
  type ConditionReportData,
  type ImportStatus,
  type PhotoFolder,
  type ReportJobDetails,
  type ReportPhoto,
  type ReportSettings,
  type ScheduleCostCenter,
  type ScheduleImportStatus,
  type ScheduleRow,
} from "@/lib/reports/condition.types";
import type { EnrichedJob } from "@/lib/simpro/types";

interface ConditionReportPageProps {
  onBack: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
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
    reportType: "Building Condition Report",
    intro:
      "This report outlines the repairs and maintenance works completed, including any updates, adjustments, and variations from the original scope.",
    project: "",
    date: new Date().toLocaleDateString("en-AU"),
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

  const removePhoto = useCallback((id: string) => {
    setReport((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== id),
    }));
  }, []);

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
      return (async () => {
        if (isStale()) return;
        setReport((prev) => ({ ...prev, photos: [] }));
        setImportStatus({ phase: "fetching-photos", loaded: 0, total: 0 });
        try {
          const folderQuery = folderId != null ? `&folderId=${folderId}` : "";
          const response = await fetch(
            `/api/simpro/jobs/${jobNumber}/attachments?companyId=0${folderQuery}`,
          );
          if (isStale()) return;
          if (!response.ok || !response.body)
            throw new Error("Stream connect failed");

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            if (isStale()) {
              reader.cancel();
              return;
            }
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split("\n\n");
            buffer = frames.pop() ?? "";

            for (const frame of frames) {
              if (isStale()) {
                reader.cancel();
                return;
              }
              const eventMatch = frame.match(/^event:\s*(.+)$/m);
              const dataMatch = frame.match(/^data:\s*(.+)$/m);
              if (!eventMatch || !dataMatch) continue;
              const event = eventMatch[1].trim();
              let payload: Record<string, unknown>;
              try {
                payload = JSON.parse(dataMatch[1]);
              } catch {
                continue;
              }

              if (event === "photo") {
                const compressedUrl = await compressImageDataUrl(
                  String(payload.url),
                );
                if (isStale()) {
                  reader.cancel();
                  return;
                }
                const photo: ReportPhoto = {
                  id: String(payload.id),
                  name: String(payload.name),
                  url: compressedUrl,
                  size: Number(payload.size) || 0,
                  dateAdded: payload.dateAdded
                    ? String(payload.dateAdded)
                    : null,
                };
                setReport((prev) => ({
                  ...prev,
                  photos: [...prev.photos, photo],
                }));
              } else if (event === "progress") {
                if (!isStale())
                  setImportStatus({
                    phase: "fetching-photos",
                    loaded: Number(payload.loaded) || 0,
                    total: Number(payload.total) || 0,
                  });
              } else if (event === "done") {
                if (!isStale()) setImportStatus({ phase: "done" });
              } else if (event === "error") {
                if (!isStale())
                  setImportStatus({
                    phase: "error",
                    message: String(payload.message ?? "Photo import failed"),
                  });
              }
            }
          }
        } catch (err) {
          if (isStale()) return;
          setImportStatus({
            phase: "error",
            message: err instanceof Error ? err.message : "Photo import failed",
          });
        }
      })();
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
          setReport({
            ...DEFAULT_REPORT,
            ...draft,
            // Shallow-merged above like every other field, but settings is
            // itself an object — a draft saved before a new setting existed
            // (e.g. showPhotos) has it undefined, which is falsy and would
            // silently turn that feature off on resume. Backfill per-key
            // instead of trusting the draft's settings object wholesale.
            settings: { ...DEFAULT_SETTINGS, ...draft.settings },
            job: mapJobToReportDetails(jobData),
          });
          setLoadedJobId(jobNumber);
          setImportStatus({ phase: "done" });
          setScheduleStatus({ phase: "done" });
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
  // Never persist while photos are still streaming in — every arriving
  // photo triggers a `report` change, so without this guard a save could
  // fire (and get resumed from later) with only a handful of photos loaded,
  // or none at all. Once importStatus leaves "fetching-photos" this effect
  // re-runs (it's a dependency below) and saves the by-then-complete report.
  useEffect(() => {
    if (!loadedJobId) return;
    if (importStatus.phase === "fetching-photos") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    const delay =
      saveStatus === "error" ? AUTOSAVE_RETRY_MS : AUTOSAVE_DEBOUNCE_MS;
    autosaveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/condition-reports/${loadedJobId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, delay);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, loadedJobId, importStatus.phase]);

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

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      // Apply the same date filter to photos and schedule that the on-screen
      // preview uses, so the PDF only contains what the user is seeing.
      // When photos are excluded entirely, skip them here too — no point
      // uploading potentially many MB of images the PDF won't render.
      const photosToExport = !report.settings.showPhotos
        ? []
        : report.settings.filterByDate
          ? filterPhotosByDateRange(
              report.photos,
              report.settings.dateFrom,
              report.settings.dateTo,
            )
          : report.photos;

      const scheduleToExport = report.settings.filterByDate
        ? filterScheduleByDateRange(
            report.schedule,
            report.settings.dateFrom,
            report.settings.dateTo,
          )
        : report.schedule;

      // Self-healing safety net (mirrors AnchorInspectionPage) — recompresses
      // whatever is in state right before it leaves the browser, so a photo
      // from before compression was added doesn't need a manual re-import
      // to export cleanly. Cheap when already small.
      const photoData: Record<string, string> = {};
      await Promise.all(
        photosToExport.map(async (p) => {
          if (p.url) photoData[p.id] = await compressImageDataUrl(p.url);
        }),
      );
      const strippedReport: ConditionReportData = {
        ...report,
        photos: photosToExport.map((p) => ({ ...p, url: "" })),
        schedule: scheduleToExport,
      };

      const filename = report.job.project
        ? `Condition Report - ${report.job.project}`
        : "Condition Report";

      const res = await fetch("/api/reports/export-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, report: strippedReport, photoData }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename + ".pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ExportPDF]", err);
      alert(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [report]);

  const hasReport = report.photos.length > 0 || !!report.job.preparedFor;

  // Photos are deliberately deferred (see handleImport) while the user picks
  // a folder from more than one option.
  const awaitingFolderChoice =
    importStatus.phase === "idle" && photoFolders.length > 0;

  const filteredPhotos = report.settings.filterByDate
    ? filterPhotosByDateRange(
        report.photos,
        report.settings.dateFrom,
        report.settings.dateTo,
      )
    : report.photos;

  const filteredSchedule = report.settings.filterByDate
    ? filterScheduleByDateRange(
        report.schedule,
        report.settings.dateFrom,
        report.settings.dateTo,
      )
    : report.schedule;

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <IconButton
          variant="secondary"
          size="sm"
          onClick={onBack}
          aria-label="Back to report types"
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/utility-outline/back.svg" alt="" width={18} height={18} />
          }
        />
        <div className={styles.topBarRight}>
          <span className={styles.topBarTitle}>Condition Report</span>
          <span className={styles.badge}>
            {report.photos.length} photo{report.photos.length !== 1 ? "s" : ""}
          </span>
          {report.settings.showSchedule && (
            <span className={styles.badge}>
              {filteredSchedule.length} schedule row
              {filteredSchedule.length !== 1 ? "s" : ""}
            </span>
          )}
          {savedFilename && <SavedBadge />}
          {loadedJobId && saveStatus !== "idle" && (
            <span
              className={`${styles.draftStatus} ${
                saveStatus === "error" ? styles.draftStatusError : ""
              }`}
            >
              {saveStatus === "saving"
                ? "Saving draft…"
                : saveStatus === "error"
                  ? "Draft save failed — retrying"
                  : "Draft saved"}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetDraft}
            disabled={!loadedJobId}
          >
            Reload from SimPRO
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSaveModal(true)}
            disabled={!hasReport || !loadedJobId}
          >
            Save
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPDF}
            disabled={!hasReport || isExporting}
          >
            {isExporting ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className={styles.editorBody}>
        <OptionsPanel
          settings={report.settings}
          photos={report.photos}
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
        />

        <div className={styles.canvas}>
          <div className={styles.pageLabel}>Cover Page</div>
          <CoverSection
            reportType={report.job.reportType}
            onReportTypeChange={(v) => updateJobField("reportType", v)}
            metaRows={[
              {
                label: "Prepared For",
                value: report.job.preparedFor,
                onChange: (v) => updateJobField("preparedFor", v),
              },
              {
                label: "Prepared By",
                value: report.job.preparedBy,
                onChange: (v) => updateJobField("preparedBy", v),
              },
              {
                label: "Address",
                value: report.job.address,
                onChange: (v) => updateJobField("address", v),
              },
              {
                label: "Project",
                value: report.job.project,
                onChange: (v) => updateJobField("project", v),
              },
              {
                label: "Date",
                value: report.job.date,
                onChange: (v) => updateJobField("date", v),
              },
            ]}
            intro={
              <RichTextEditor
                value={report.job.intro}
                onChange={(v) => updateJobField("intro", v)}
                placeholder="Enter report description…"
                label="Report Description"
              />
            }
          />

          {report.settings.showPhotos && (
            <>
              <div className={styles.pageLabel}>
                Photos &middot; {filteredPhotos.length} image
                {filteredPhotos.length !== 1 ? "s" : ""}
              </div>
              <PhotoSection
                photos={filteredPhotos}
                importStatus={importStatus}
                awaitingFolderChoice={awaitingFolderChoice}
                showDates={report.settings.showDates}
                layout={report.settings.photoLayout}
                onPhotoRemove={removePhoto}
                onPhotoRename={renamePhoto}
              />
            </>
          )}

          {report.settings.showSchedule && (
            <>
              <div className={styles.pageLabel}>
                Schedule &middot; {filteredSchedule.length} row
                {filteredSchedule.length !== 1 ? "s" : ""}
              </div>
              <ScheduleSection
                rows={filteredSchedule}
                isLoading={scheduleLoading}
                onChange={updateSchedule}
                showNotes={report.settings.showScheduleNotes}
                sectioned={report.settings.scheduleSections}
              />
            </>
          )}

          {report.settings.showSummary && (
            <>
              <div className={styles.pageLabel}>Summary Page</div>
              <SummarySection
                comments={report.comments}
                recommendations={report.recommendations}
                onCommentsChange={(v) =>
                  setReport((prev) => ({ ...prev, comments: v }))
                }
                onRecommendationsChange={(v) =>
                  setReport((prev) => ({ ...prev, recommendations: v }))
                }
              />
            </>
          )}
        </div>
      </div>

      {/* Save Report Modal */}
      {showSaveModal && (
        <SaveReportModal
          jobId={loadedJobId}
          jobNo={`#${loadedJobId}`}
          companyId={0}
          siteId={report.job.siteId}
          defaultFilename={`Condition Report - ${new Date().getFullYear()}`}
          saveEndpoint={`/api/simpro/jobs/${loadedJobId}/save-report`}
          prepareBody={async (filename, companyId, destinations) => {
            // Apply the same date filter so the saved PDF matches the preview.
            // When photos are excluded entirely, skip them here too — no
            // point uploading images the PDF won't render.
            const photosToSave = !report.settings.showPhotos
              ? []
              : report.settings.filterByDate
                ? filterPhotosByDateRange(
                    report.photos,
                    report.settings.dateFrom,
                    report.settings.dateTo,
                  )
                : report.photos;

            const scheduleToSave = report.settings.filterByDate
              ? filterScheduleByDateRange(
                  report.schedule,
                  report.settings.dateFrom,
                  report.settings.dateTo,
                )
              : report.schedule;

            // Self-healing safety net — see handleExportPDF above.
            const compressedPhotos = await Promise.all(
              photosToSave.map(async ({ id, name, url, size, dateAdded }) => ({
                id,
                name,
                url: await compressImageDataUrl(url),
                size,
                dateAdded,
              })),
            );

            return {
              filename,
              companyId,
              jobId: loadedJobId,
              siteId: report.job.siteId,
              destinations,
              report: {
                ...report,
                photos: compressedPhotos,
                schedule: scheduleToSave,
              },
            };
          }}
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
