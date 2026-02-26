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
    project: "",
    date: new Date().toLocaleDateString("en-AU"),
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
  const fetchPhotos = useCallback(async (jobId: string) => {
    setImportStatus({ phase: "fetching-photos", loaded: 0, total: 0 });
    const incoming: ReportPhoto[] = [];

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
          let eventName = "message";
          let dataLine = "";
          for (const line of frame.split("\n")) {
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

          if (eventName === "start") {
            setImportStatus({
              phase: "fetching-photos",
              loaded: 0,
              total: payload.total as number,
            });
          } else if (eventName === "photo") {
            const photo: ReportPhoto = {
              id: payload.id as string,
              name: payload.name as string,
              url: payload.url as string,
              size: payload.size as number,
              dateAdded: (payload.dateAdded as string | null) ?? null,
            };
            incoming.push(photo);
            setReport((prev) => ({ ...prev, photos: [...prev.photos, photo] }));
          } else if (eventName === "progress") {
            setImportStatus({
              phase: "fetching-photos",
              loaded: payload.loaded as number,
              total: payload.total as number,
            });
          } else if (eventName === "done") {
            const { comments, recommendations } =
              inferTemplatesFromPhotos(incoming);
            setReport((prev) => ({
              ...prev,
              comments: comments.join("\n\n"),
              recommendations: recommendations.join("\n\n"),
            }));
            setImportStatus({ phase: "done" });
          } else if (eventName === "error") {
            setImportStatus({
              phase: "error",
              message: (payload.message as string) || "Failed to load photos",
            });
          }
        }
      }
    } catch (err) {
      setImportStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to fetch photos",
      });
    }
  }, []);

  // ── Job details fetch ─────────────────────────────────────────────────────
  const fetchJobDetails = useCallback(async (jobId: string) => {
    try {
      const res = await fetch(`/api/simpro/jobs/${jobId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const enrichedJob: EnrichedJob = await res.json();
      setReport((prev) => ({
        ...prev,
        job: mapJobToReportDetails(enrichedJob),
      }));
    } catch (err) {
      console.warn("[ConditionReport] Job details fetch failed:", err);
    }
  }, []);

  // ── Import ────────────────────────────────────────────────────────────────
  const handleImport = useCallback(
    (jobNumber: string) => {
      setReport((prev) => ({ ...prev, photos: [] }));
      setImportStatus({ phase: "fetching-job" });
      fetchJobDetails(jobNumber);
      fetchPhotos(jobNumber);
    },
    [fetchJobDetails, fetchPhotos],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const updateJobField = (field: keyof ReportJobDetails, value: string) =>
    setReport((prev) => ({ ...prev, job: { ...prev.job, [field]: value } }));

  const updateSettings = (settings: ReportSettings) =>
    setReport((prev) => ({ ...prev, settings }));

  const addPhotos = (photos: ReportPhoto[]) =>
    setReport((prev) => ({ ...prev, photos: [...prev.photos, ...photos] }));

  const removePhoto = (id: string) =>
    setReport((prev) => ({
      ...prev,
      photos: prev.photos.filter((p) => p.id !== id),
    }));

  const renamePhoto = (id: string, name: string) =>
    setReport((prev) => ({
      ...prev,
      photos: prev.photos.map((p) => (p.id === id ? { ...p, name } : p)),
    }));

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

  const isFiltered = filteredPhotos.length !== report.photos.length;

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
          importStatus={importStatus}
          onSettings={updateSettings}
          onImport={handleImport}
        />

        <div className={styles.canvas}>
          <div className={styles.pageLabel}>Cover Page</div>
          <CoverSection job={report.job} onChange={updateJobField} />

          <div className={styles.pageLabel}>
            Photos · {filteredPhotos.length} image
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
