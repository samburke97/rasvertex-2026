"use client";
// components/reports/hours-breakdown/HoursBreakdownPage.tsx

import React, { useState, useCallback, useRef } from "react";
import styles from "../shared/ReportPage.module.css";
import ScheduleSection from "../condition/sections/ScheduleSection";
import HoursBreakdownOptionsPanel from "./HoursBreakdownOptionsPanel";
import HoursSaveToJobModal from "./HoursSaveToJobModal";
import Button from "@/components/ui/Button";
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

  const updateSchedule = useCallback((rows: ScheduleRow[]) => {
    setReport((prev) => ({ ...prev, schedule: rows }));
  }, []);

  // ── Import ────────────────────────────────────────────────────────────────

  const handleImport = useCallback(async (jobNumber: string) => {
    const loadId = ++currentLoadId.current;
    const isStale = () => currentLoadId.current !== loadId;

    setReport(DEFAULT_DATA);
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

    // 2. Fetch schedule
    setScheduleLoading(true);
    setImportStatus({ phase: "fetching-schedule" });
    try {
      const res = await fetch(
        `/api/simpro/jobs/${jobNumber}/schedule?companyId=0`,
      );
      if (isStale()) return;
      if (!res.ok) {
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

  const dateRangeLabel = (() => {
    if (
      !report.settings.filterByDate ||
      (!report.settings.dateFrom && !report.settings.dateTo)
    ) {
      return "All Dates";
    }
    const from = report.settings.dateFrom ?? "";
    const to = report.settings.dateTo ?? "";
    if (from && to) return `${from} – ${to}`;
    if (from) return `From ${from}`;
    return `To ${to}`;
  })();

  const scheduleHeading = [
    report.job.jobNo || null,
    report.job.customerName || null,
    dateRangeLabel,
  ]
    .filter(Boolean)
    .join("  |  ");

  return (
    <div className={styles.page}>
      {/* ── Top bar — identical structure to ConditionReportPage ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Report types
        </button>
        <div className={styles.topBarRight}>
          <span className={styles.topBarTitle}>Hours Breakdown</span>
          <span className={styles.photoCount}>
            {filteredSchedule.length} row
            {filteredSchedule.length !== 1 ? "s" : ""}
          </span>
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
            disabled={!hasReport || isExporting}
          >
            {isExporting ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
      </div>

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

        <div className={styles.canvas}>
          <div className={styles.pageLabel}>
            Hours Breakdown &middot; {filteredSchedule.length} row
            {filteredSchedule.length !== 1 ? "s" : ""}
          </div>
          <ScheduleSection
            rows={filteredSchedule}
            isLoading={scheduleLoading}
            onChange={updateSchedule}
            heading={scheduleHeading}
          />
        </div>
      </div>

      {/* ── Save to Job Modal ── */}
      {showSaveModal && (
        <HoursSaveToJobModal
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
