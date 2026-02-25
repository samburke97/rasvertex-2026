"use client";

import React, { useState, useCallback } from "react";
import styles from "./ConditionReportPage.module.css";
import ImportStep from "./steps/ImportStep";
import CoverSection from "./sections/CoverSection";
import PhotoSection from "./sections/PhotoSection";
import SummarySection from "./sections/SummarySection";
import Button from "@/components/ui/Button";
import { inferTemplatesFromPhotos } from "@/lib/reports/condition.templates";
import { buildPrintHTML } from "@/lib/reports/condition.print";
import {
  mapJobToReportDetails,
  type ConditionReportData,
  type ImportStatus,
  type ReportJobDetails,
  type ReportPhoto,
  type SimproJobResponse,
} from "@/lib/reports/condition.types";

interface ConditionReportPageProps {
  onBack: () => void;
}

type View = "import" | "editor";

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
};

export default function ConditionReportPage({
  onBack,
}: ConditionReportPageProps) {
  const [view, setView] = useState<View>("import");
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
      const data: SimproJobResponse = await res.json();
      const jobDetails = mapJobToReportDetails(data);
      setReport((prev) => ({ ...prev, job: jobDetails }));
    } catch (err) {
      console.warn("[ConditionReport] Job details fetch failed:", err);
      // Non-fatal — all fields are click-to-edit
    }
  }, []);

  // ── Import: switch to editor immediately, then load in background ─────────
  const handleImport = useCallback(
    (jobNumber: string) => {
      setReport((prev) => ({ ...prev, photos: [] }));
      setImportStatus({ phase: "fetching-job" });
      setView("editor"); // Show editor straight away so photos stream in visibly

      // Fire both in parallel — job details is fast, photos take time
      fetchJobDetails(jobNumber);
      fetchPhotos(jobNumber);
    },
    [fetchJobDetails, fetchPhotos],
  );

  // ── Report mutations ──────────────────────────────────────────────────────
  const updateJobField = (field: keyof ReportJobDetails, value: string) =>
    setReport((prev) => ({ ...prev, job: { ...prev.job, [field]: value } }));

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

  // ── Print ─────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(buildPrintHTML(report));
    win.document.close();
    setTimeout(() => win.print(), 800);
  };

  return (
    <div className={styles.page}>
      <div className={styles.topBar}>
        <button
          className={styles.backBtn}
          onClick={view === "editor" ? () => setView("import") : onBack}
        >
          ← {view === "editor" ? "Back to import" : "Report types"}
        </button>
        {view === "editor" && (
          <div className={styles.topBarRight}>
            <span className={styles.photoCount}>
              {report.photos.length} photo
              {report.photos.length !== 1 ? "s" : ""}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePrint}
              disabled={report.photos.length === 0}
            >
              Export PDF
            </Button>
          </div>
        )}
      </div>

      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>Condition Report</h1>
        {view === "editor" && (
          <p className={styles.pageHint}>Click any field to edit</p>
        )}
      </div>

      {view === "import" ? (
        <ImportStep
          onImport={handleImport}
          onSkip={() => setView("editor")}
          status={importStatus}
        />
      ) : (
        <div className={styles.sections}>
          <section>
            <div className={styles.sectionLabel}>Cover Page</div>
            <CoverSection job={report.job} onChange={updateJobField} />
          </section>

          <section>
            <PhotoSection
              photos={report.photos}
              importStatus={importStatus}
              onPhotosAdded={addPhotos}
              onPhotoRemove={removePhoto}
              onPhotoRename={renamePhoto}
            />
          </section>

          <section>
            <div className={styles.sectionLabel}>Summary Page</div>
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
          </section>
        </div>
      )}
    </div>
  );
}
