"use client";
// components/reports/hours-breakdown/HoursBreakdownPage.tsx

import React, { useState, useCallback, useRef, useLayoutEffect } from "react";
import styles from "../shared/ReportPage.module.css";
import { OverviewStyles } from "../condition/OverviewDocument";
import HoursDocument, { HOURS_CSS, type HoursEdit } from "./HoursDocument";
import HoursCell from "./HoursCell";
import { buildHoursModel } from "@/lib/reports/hours.layout";
import { PAGE_W } from "@/lib/reports/overview.layout";
import HoursBreakdownOptionsPanel from "./HoursBreakdownOptionsPanel";
import SaveReportModal, { postSave } from "../shared/SaveReportModal";
import BuilderHeader, { HeaderButton } from "@/components/reports/shared/builder/BuilderHeader";
import {
  filterScheduleByDateRange,
  type ScheduleRow,
} from "@/lib/reports/condition.types";
import type {
  HoursBreakdownData,
  HoursBreakdownSettings,
  HoursImportStatus,
} from "@/lib/reports/hours.types";
import type { EnrichedJob } from "@/lib/simpro/types";

interface Props {
  onBack: () => void;
}

const DEFAULT_DATA: HoursBreakdownData = {
  job: {
    jobNo: "",
    siteAddress: "",
    customerName: "",
    date: new Date().toLocaleDateString("en-AU"),
  },
  schedule: [],
  settings: {
    filterByDate: false,
    dateFrom: null,
    dateTo: null,
  },
};

export default function HoursBreakdownPage({ onBack }: Props) {
  const [report, setReport] = useState<HoursBreakdownData>(DEFAULT_DATA);
  const [importStatus, setImportStatus] = useState<HoursImportStatus>({
    phase: "idle",
  });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedFilename, setSavedFilename] = useState<string | null>(null);
  const [loadedJobId, setLoadedJobId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const currentLoadId = useRef(0);

  // The pages are 1280 wide, scaled to the column.
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

  // ── Field updates ─────────────────────────────────────────────────────────

  const updateSettings = useCallback(
    (patch: Partial<HoursBreakdownSettings>) => {
      setReport((prev) => ({
        ...prev,
        settings: { ...prev.settings, ...patch },
      }));
    },
    [],
  );


  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = useCallback(async (jobNumber: string) => {
    const loadId = ++currentLoadId.current;
    const isStale = () => currentLoadId.current !== loadId;

    setReport(DEFAULT_DATA);
    setSavedFilename(null);
    setImportStatus({ phase: "fetching-job" });
    setScheduleLoading(false);

    // Job and schedule only depend on `jobNumber`, not on each other's
    // results — fire both immediately instead of waiting for the job to
    // finish before even starting the schedule request.
    const schedulePromise = fetch(
      `/api/simpro/jobs/${jobNumber}/schedule?companyId=0`,
    ).catch(() => null);

    // 1. Fetch job details
    try {
      const jobRes = await fetch(`/api/simpro/jobs/${jobNumber}?companyId=0`);
      if (isStale()) return;
      if (!jobRes.ok)
        throw new Error(`Job fetch failed: HTTP ${jobRes.status}`);
      const jobData: EnrichedJob = await jobRes.json();
      if (isStale()) return;

      setReport((prev) => ({
        ...prev,
        job: {
          jobNo: `#${jobNumber}`,
          siteAddress: jobData.siteAddress ?? "",
          customerName: jobData.clientName ?? "",
          date: jobData.date ?? prev.job.date,
        },
      }));
    } catch (err) {
      if (isStale()) return;
      setImportStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to fetch job",
      });
      return;
    }

    // 2. Schedule — already in flight above, just await the response now.
    setScheduleLoading(true);
    setImportStatus({ phase: "fetching-schedule" });
    try {
      const res = await schedulePromise;
      if (isStale()) return;
      if (!res?.ok) {
        setScheduleLoading(false);
        setImportStatus({ phase: "done" });
        return;
      }
      const data = await res.json();
      if (isStale()) return;
      const rows: ScheduleRow[] = data.rows ?? [];
      setReport((prev) => ({ ...prev, schedule: rows }));
      setImportStatus({ phase: "done" });
    } catch {
      if (!isStale()) setImportStatus({ phase: "done" });
    } finally {
      if (!isStale()) setScheduleLoading(false);
    }
  }, []);

  // ── Export PDF ────────────────────────────────────────────────────────────

  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const filename = report.job.jobNo
        ? `Hours Breakdown ${report.job.jobNo}`
        : "Hours Breakdown";

      const res = await fetch("/api/reports/export-hours-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, report }),
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
      console.error("[ExportHoursPDF]", err);
      alert(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [report]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const filteredSchedule = report.settings.filterByDate
    ? filterScheduleByDateRange(
        report.schedule,
        report.settings.dateFrom,
        report.settings.dateTo,
      )
    : report.schedule;

  const hasReport = report.schedule.length > 0 || !!report.job.jobNo;
  const model = buildHoursModel(report);

  // Rows are edited in place on the preview.
  const edit: HoursEdit = {
    Cell: HoursCell,
    onRow: (id, patch) =>
      setReport((prev) => ({ ...prev, schedule: prev.schedule.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
    onRemove: (id) => setReport((prev) => ({ ...prev, schedule: prev.schedule.filter((r) => r.id !== id) })),
    onAdd: () =>
      setReport((prev) => {
        const last = filteredSchedule[filteredSchedule.length - 1];
        const row: ScheduleRow = {
          id: `manual_${Date.now()}`,
          employeeId: 0,
          employeeName: "",
          date: last?.date ?? new Date().toISOString().slice(0, 10),
          scheduledHours: 0,
          actualHours: 0,
          note: "",
          start: "",
          finish: "",
        };
        return { ...prev, schedule: [...prev.schedule, row] };
      }),
  };


  return (
    <div className={styles.page}>
      <BuilderHeader
        onBack={onBack}
        title="Hours breakdown"
        subtitle={loadedJobId ? `Job ${loadedJobId}` : undefined}
        badges={[`${filteredSchedule.length} row${filteredSchedule.length !== 1 ? "s" : ""}`, savedFilename && "Saved to SimPRO"]}
      >
        <HeaderButton onClick={handleExportPDF} disabled={!hasReport || isExporting}>
          {isExporting ? "Exporting…" : "Download PDF"}
        </HeaderButton>
        <HeaderButton primary onClick={() => setShowSaveModal(true)} disabled={!hasReport || !loadedJobId}>
          Save to SimPRO
        </HeaderButton>
      </BuilderHeader>

      {/* ── Body ── */}
      <div className={styles.editorBody}>
        <HoursBreakdownOptionsPanel
          settings={report.settings}
          rowCount={report.schedule.length}
          filteredCount={filteredSchedule.length}
          importStatus={importStatus}
          onSettings={updateSettings}
          onImport={(jobNumber) => {
            setLoadedJobId(jobNumber);
            handleImport(jobNumber);
          }}
        />

        <div ref={previewRef} className={styles.canvas}>
          <OverviewStyles />
          <style dangerouslySetInnerHTML={{ __html: HOURS_CSS }} />
          {scheduleLoading ? (
            <div className={styles.pageLabel}>Loading hours from SimPRO…</div>
          ) : loadedJobId ? (
            <div style={{ zoom }}>
              <HoursDocument model={model} screen edit={edit} />
            </div>
          ) : (
            <div className={styles.pageLabel}>Load a job to see its hours.</div>
          )}
        </div>
      </div>

      {/* ── Save to Job Modal ── */}
      {showSaveModal && (
        <SaveReportModal
          owner={{ kind: "Job", no: `#${loadedJobId}` }}
          defaultFilename={`Hours Breakdown ${loadedJobId}`}
          save={(filename, d) =>
            postSave(`/api/simpro/jobs/${loadedJobId}/save-hours-report`, {
              filename,
              companyId: 0,
              destinations: { job: d.owner, site: d.site },
              report,
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
