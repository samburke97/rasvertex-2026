"use client";
// components/reports/condition/ConditionReportPage.tsx

import React, { useState, useCallback, useRef } from "react";
import styles from "./ConditionReportPage.module.css";
import CoverSection from "./sections/CoverSection";
import PhotoSection from "./sections/PhotoSection";
import ScheduleSection from "./sections/ScheduleSection";
import SummarySection from "./sections/SummarySection";
import OptionsPanel from "./OptionsPanel";
import Button from "@/components/ui/Button";
import SaveToJobModal from "./SaveToJobModal";
import { buildPrintHTML } from "@/lib/reports/condition.print";
import {
  mapJobToReportDetails,
  filterPhotosByDateRange,
  filterScheduleByDateRange,
  type ConditionReportData,
  type ImportStatus,
  type ReportJobDetails,
  type ReportPhoto,
  type ReportSettings,
  type ScheduleRow,
} from "@/lib/reports/condition.types";
import type { EnrichedJob } from "@/lib/simpro/types";

interface ConditionReportPageProps {
  onBack: () => void;
}

const DEFAULT_SETTINGS: ReportSettings = {
  showDates: false,
  filterByDate: false,
  dateFrom: null,
  dateTo: null,
  showSchedule: false,
  scheduleLoaded: false,
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
    coverPhoto: null,
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
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedFilename, setSavedFilename] = useState<string | null>(null);
  const [loadedJobId, setLoadedJobId] = useState<string>("");
  const currentLoadId = useRef(0);

  const updateSettings = useCallback((s: ReportSettings) => {
    setReport((prev) => ({ ...prev, settings: s }));
  }, []);

  const updateJobField = useCallback(
    (field: keyof ReportJobDetails, value: string) => {
      setReport((prev) => ({ ...prev, job: { ...prev.job, [field]: value } }));
    },
    [],
  );

  const updateCoverPhoto = useCallback((dataUrl: string | null) => {
    setReport((prev) => ({
      ...prev,
      job: { ...prev.job, coverPhoto: dataUrl },
    }));
  }, []);

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

  const handleImport = useCallback(async (jobNumber: string) => {
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
    setImportStatus({ phase: "fetching-job" });
    setScheduleLoading(false);

    // 1. Fetch job details
    try {
      const jobRes = await fetch(`/api/simpro/jobs/${jobNumber}?companyId=0`);
      if (isStale()) return;
      if (!jobRes.ok)
        throw new Error(`Job fetch failed: HTTP ${jobRes.status}`);
      const jobData: EnrichedJob = await jobRes.json();
      if (isStale()) return;
      setReport((prev) => ({ ...prev, job: mapJobToReportDetails(jobData) }));
    } catch (err) {
      if (isStale()) return;
      setImportStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to fetch job",
      });
      return;
    }

    // 2. Photos + schedule in parallel
    await Promise.all([
      // Photos via SSE
      (async () => {
        if (isStale()) return;
        setImportStatus({ phase: "fetching-photos", loaded: 0, total: 0 });
        try {
          const response = await fetch(
            `/api/simpro/jobs/${jobNumber}/attachments?companyId=0`,
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
                const photo: ReportPhoto = {
                  id: String(payload.id),
                  name: String(payload.name),
                  url: String(payload.url),
                  size: Number(payload.size) || 0,
                  dateAdded: payload.dateAdded
                    ? String(payload.dateAdded)
                    : null,
                };
                if (!isStale())
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
      })(),

      // Schedule (silent)
      (async () => {
        if (isStale()) return;
        try {
          const res = await fetch(
            `/api/simpro/jobs/${jobNumber}/schedule?companyId=0`,
          );
          if (isStale()) return;
          if (!res.ok) {
            if (!isStale())
              setReport((prev) => ({
                ...prev,
                settings: { ...prev.settings, scheduleLoaded: true },
              }));
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
        } catch {
          if (!isStale())
            setReport((prev) => ({
              ...prev,
              settings: { ...prev.settings, scheduleLoaded: true },
            }));
        }
      })(),
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Export PDF — opens print dialog (instant, browser already has everything)
  const handleExportPDF = useCallback(() => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPrintHTML(report));
    win.document.close();
    setTimeout(() => win.print(), 800);
  }, [report]);

  const hasReport = report.photos.length > 0 || !!report.job.preparedFor;

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
        <button className={styles.backBtn} onClick={onBack}>
          ← Report types
        </button>
        <div className={styles.topBarRight}>
          <span className={styles.topBarTitle}>Condition Report</span>
          <span className={styles.photoCount}>
            {report.photos.length} photo{report.photos.length !== 1 ? "s" : ""}
          </span>
          {report.settings.showSchedule && (
            <span className={styles.photoCount}>
              {filteredSchedule.length} schedule row
              {filteredSchedule.length !== 1 ? "s" : ""}
            </span>
          )}
          {savedFilename && (
            <span className={styles.savedBadge}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle
                  cx="6"
                  cy="6"
                  r="6"
                  fill="var(--primary-400, #10b981)"
                />
                <path
                  d="M3.5 6l2 2 3-3"
                  stroke="#fff"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Saved
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSaveModal(true)}
            disabled={!hasReport || !loadedJobId}
          >
            Save to Job
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExportPDF}
            disabled={!hasReport}
          >
            Export PDF
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className={styles.editorBody}>
        <OptionsPanel
          settings={report.settings}
          photos={report.photos}
          job={report.job}
          importStatus={importStatus}
          onSettings={updateSettings}
          onImport={(jobNumber) => {
            setLoadedJobId(jobNumber);
            handleImport(jobNumber);
          }}
          onCoverPhoto={updateCoverPhoto}
        />

        <div className={styles.canvas}>
          <div className={styles.pageLabel}>Cover Page</div>
          <CoverSection job={report.job} onChange={updateJobField} />

          <div className={styles.pageLabel}>
            Photos &middot; {filteredPhotos.length} image
            {filteredPhotos.length !== 1 ? "s" : ""}
          </div>
          <PhotoSection
            photos={filteredPhotos}
            importStatus={importStatus}
            showDates={report.settings.showDates}
            onPhotoRemove={removePhoto}
            onPhotoRename={renamePhoto}
          />

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
              />
            </>
          )}

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
        </div>
      </div>

      {/* Save to Job Modal */}
      {showSaveModal && (
        <SaveToJobModal
          jobId={loadedJobId}
          jobNo={`#${loadedJobId}`}
          companyId={0}
          report={report}
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
