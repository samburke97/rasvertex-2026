"use client";
// components/reports/condition/ConditionReportPage.tsx

import React, { useState, useCallback } from "react";
import styles from "./ConditionReportPage.module.css";
import CoverSection from "./sections/CoverSection";
import PhotoSection from "./sections/PhotoSection";
import ScheduleSection from "./sections/ScheduleSection";
import SummarySection from "./sections/SummarySection";
import OptionsPanel from "./OptionsPanel";
import Button from "@/components/ui/Button";
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

  // ── Settings helper ───────────────────────────────────────────────────────
  const updateSettings = useCallback((s: ReportSettings) => {
    setReport((prev) => ({ ...prev, settings: s }));
  }, []);

  // ── Field updates ─────────────────────────────────────────────────────────
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

  // ── Photo handlers ────────────────────────────────────────────────────────
  const addPhotos = useCallback((photos: ReportPhoto[]) => {
    setReport((prev) => ({ ...prev, photos: [...prev.photos, ...photos] }));
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

  // ── Schedule handler ──────────────────────────────────────────────────────
  const updateSchedule = useCallback((rows: ScheduleRow[]) => {
    setReport((prev) => ({ ...prev, schedule: rows }));
  }, []);

  // ── Fetch schedule ────────────────────────────────────────────────────────
  const fetchSchedule = useCallback(
    async (jobId: string) => {
      setScheduleLoading(true);
      setImportStatus({ phase: "fetching-schedule" });
      try {
        const params = new URLSearchParams({ companyId: "0" });
        if (report.settings.dateFrom)
          params.set("dateFrom", report.settings.dateFrom);
        if (report.settings.dateTo)
          params.set("dateTo", report.settings.dateTo);

        const res = await fetch(`/api/simpro/jobs/${jobId}/schedule?${params}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        setReport((prev) => ({
          ...prev,
          schedule: data.rows ?? [],
          settings: {
            ...prev.settings,
            scheduleLoaded: true,
            showSchedule: true,
          },
        }));
      } catch (err) {
        console.error("[Schedule] fetch failed:", err);
        // Non-fatal — photos still loaded fine; just flag schedule unavailable
        setReport((prev) => ({
          ...prev,
          settings: {
            ...prev.settings,
            scheduleLoaded: false,
            showSchedule: false,
          },
        }));
      } finally {
        setScheduleLoading(false);
        setImportStatus({ phase: "done" });
      }
    },
    [report.settings.dateFrom, report.settings.dateTo],
  );

  // ── Schedule fetch (silent — runs alongside photos) ───────────────────────
  const fetchScheduleSilent = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/simpro/jobs/${jobId}/schedule?companyId=0`);

      // Always mark scheduleLoaded=true so the toggle is never permanently
      // disabled — even if the response is an error or returns no rows.
      if (!res.ok) {
        setReport((prev) => ({
          ...prev,
          settings: { ...prev.settings, scheduleLoaded: true },
        }));
        return;
      }

      const data = await res.json();
      const rows: ScheduleRow[] = data.rows ?? [];

      setReport((prev) => ({
        ...prev,
        schedule: rows,
        settings: {
          ...prev.settings,
          scheduleLoaded: true,
          // Auto-enable the toggle only when rows were actually returned
          showSchedule: rows.length > 0,
        },
      }));
    } catch {
      // Network / parse error — still unblock the toggle so the user can
      // manually add rows or retry via the explicit fetch button.
      setReport((prev) => ({
        ...prev,
        settings: { ...prev.settings, scheduleLoaded: true },
      }));
    }
  }, []);

  // ── Main import (job + photos + schedule in parallel) ─────────────────────
  const handleImport = useCallback(
    async (jobNumber: string) => {
      // 1. Fetch job details
      setImportStatus({ phase: "fetching-job" });
      try {
        const jobRes = await fetch(`/api/simpro/jobs/${jobNumber}?companyId=0`);
        if (!jobRes.ok)
          throw new Error(`Job fetch failed: HTTP ${jobRes.status}`);
        const jobData: EnrichedJob = await jobRes.json();
        setReport((prev) => ({
          ...prev,
          job: mapJobToReportDetails(jobData),
        }));
      } catch (err) {
        setImportStatus({
          phase: "error",
          message: err instanceof Error ? err.message : "Failed to fetch job",
        });
        return;
      }

      // 2. Fetch photos (SSE stream) + schedule in parallel
      // Photos use SSE — we kick it off first, then schedule fires concurrently
      const photoPromise = fetchPhotosSSE(jobNumber);
      const schedulePromise = fetchScheduleSilent(jobNumber);
      await Promise.all([photoPromise, schedulePromise]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // ── Photos SSE ────────────────────────────────────────────────────────────
  const fetchPhotosSSE = useCallback(async (jobId: string) => {
    setImportStatus({ phase: "fetching-photos", loaded: 0, total: 0 });
    try {
      const response = await fetch(
        `/api/simpro/jobs/${jobId}/attachments?companyId=0`,
      );
      if (!response.ok || !response.body)
        throw new Error("Stream connect failed");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
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
              dateAdded: payload.dateAdded ? String(payload.dateAdded) : null,
            };
            setReport((prev) => ({ ...prev, photos: [...prev.photos, photo] }));
          } else if (event === "progress") {
            setImportStatus({
              phase: "fetching-photos",
              loaded: Number(payload.loaded) || 0,
              total: Number(payload.total) || 0,
            });
          } else if (event === "done") {
            setImportStatus({ phase: "done" });
          } else if (event === "error") {
            setImportStatus({
              phase: "error",
              message: String(payload.message ?? "Photo import failed"),
            });
          }
        }
      }
    } catch (err) {
      setImportStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Photo import failed",
      });
    }
  }, []);

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPrintHTML(report));
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  // ── Derived ───────────────────────────────────────────────────────────────
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
          <Button variant="secondary" size="sm" onClick={handleExport}>
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
          onImport={handleImport}
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
            onPhotosAdded={addPhotos}
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
    </div>
  );
}
