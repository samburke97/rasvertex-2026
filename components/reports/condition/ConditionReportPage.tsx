"use client";
// components/reports/condition/ConditionReportPage.tsx

import React, { useState, useCallback } from "react";
import styles from "./ConditionReportPage.module.css";
import CoverSection from "./sections/CoverSection";
import PhotoSection from "./sections/PhotoSection";
import SummarySection from "./sections/SummarySection";
import OptionsPanel from "./OptionsPanel";
import Button from "@/components/ui/Button";
import { inferTemplatesFromPhotos } from "@/lib/reports/condition.templates";
import { buildPrintHTML } from "@/lib/reports/condition.print";
import {
  mapJobToReportDetails,
  filterPhotosByDateRange,
  type ConditionReportData,
  type ImportStatus,
  type ReportJobDetails,
  type ReportPhoto,
  type ReportSettings,
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

  // ── Photo SSE stream ──────────────────────────────────────────────────────
  // API sends named SSE events: event: photo|progress|start|done|error
  // Photo payload fields: { id, name, url, size, dateAdded }  (flat, not nested)
  const fetchPhotos = useCallback(async (jobId: string) => {
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
          if (!frame.trim()) continue;

          // Parse named SSE frame: extract event name and data line
          const lines = frame.split("\n");
          let eventName = "message";
          let dataLine = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            if (line.startsWith("data: ")) dataLine = line.slice(6).trim();
          }
          if (!dataLine) continue;

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataLine);
          } catch {
            continue;
          }

          switch (eventName) {
            case "start":
              setImportStatus({
                phase: "fetching-photos",
                loaded: 0,
                total: payload.total as number,
              });
              break;

            case "photo":
              // Photo fields are flat on payload: id, name, url, size, dateAdded
              setReport((prev) => ({
                ...prev,
                photos: [
                  ...prev.photos,
                  {
                    id: payload.id as string,
                    name: payload.name as string,
                    url: payload.url as string,
                    size: payload.size as number,
                    dateAdded: (payload.dateAdded as string) ?? null,
                  },
                ],
              }));
              break;

            case "progress":
              setImportStatus({
                phase: "fetching-photos",
                loaded: payload.loaded as number,
                total: payload.total as number,
              });
              break;

            case "done":
              setImportStatus({ phase: "idle" });
              break;

            case "error":
              setImportStatus({
                phase: "error",
                message: (payload.message as string) || "Failed to load photos",
              });
              break;
          }
        }
      }

      // Stream ended cleanly — ensure we're back to idle
      setImportStatus((prev) =>
        prev.phase === "fetching-photos" ? { phase: "idle" } : prev,
      );
    } catch (err) {
      console.error("Photo fetch error:", err);
      setImportStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to load photos",
      });
    }
  }, []);

  // ── Main import handler — fetches job details THEN photos ─────────────────
  const handleImport = useCallback(
    async (jobNumber: string) => {
      // Step 1: fetch job details to populate cover fields
      setImportStatus({ phase: "fetching-job" });
      try {
        const res = await fetch(`/api/simpro/jobs/${jobNumber}?companyId=0`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        const enrichedJob: EnrichedJob = await res.json();
        const jobDetails = mapJobToReportDetails(enrichedJob);

        // Populate cover fields — preserve any user edits to coverPhoto
        setReport((prev) => ({
          ...prev,
          job: {
            ...jobDetails,
            coverPhoto: prev.job.coverPhoto, // keep existing cover photo if set
          },
        }));
      } catch (err) {
        console.error("Job fetch error:", err);
        setImportStatus({
          phase: "error",
          message:
            err instanceof Error
              ? `Job details failed: ${err.message}`
              : "Failed to load job details",
        });
        return; // don't attempt photo fetch if job fetch failed
      }

      // Step 2: fetch photos via SSE stream
      await fetchPhotos(jobNumber);
    },
    [fetchPhotos],
  );

  // ── Report field updates ──────────────────────────────────────────────────
  const updateJobField = useCallback(
    (field: keyof ReportJobDetails, value: string) => {
      setReport((prev) => ({
        ...prev,
        job: { ...prev.job, [field]: value },
      }));
    },
    [],
  );

  const updateSettings = useCallback((patch: Partial<ReportSettings>) => {
    setReport((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const updateCoverPhoto = useCallback((url: string | null) => {
    setReport((prev) => ({
      ...prev,
      job: { ...prev.job, coverPhoto: url },
    }));
  }, []);

  const addPhotos = useCallback((photos: ReportPhoto[]) => {
    setReport((prev) => ({
      ...prev,
      photos: [...prev.photos, ...photos],
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
      photos: prev.photos.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
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
