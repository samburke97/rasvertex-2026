"use client";
// components/reports/anchor-inspection/AnchorInspectionPage.tsx

import React, { useState, useCallback, useRef } from "react";
import styles from "../shared/ReportPage.module.css";
import { buildAnchorPrintHTML } from "@/lib/reports/anchor.print";
import Button from "@/components/ui/Button";
import SaveToJobModal from "../shared/SaveToJobModal";
import AnchorOptionsPanel from "./AnchorOptionsPanel";
import ZoneMapEditor from "./ZoneMapEditor";
import AnchorCoverSection from "./sections/AnchorCoverSection";
import ZoneSummarySection from "./sections/ZoneSummarySection";
import CertificationSection from "./sections/CertificationSection";
import SummarySignoffSection from "./sections/SummarySignoffSection";
import {
  DEFAULT_ANCHOR_REPORT,
  generateId,
  type AnchorReportData,
  type AnchorReportJob,
  type Zone,
} from "@/lib/reports/anchor.types";
import type { EnrichedJob } from "@/lib/simpro/types";

interface AnchorInspectionPageProps {
  onBack: () => void;
}

type View = "editor" | "zone-map";

export type AnchorImportStatus =
  | { phase: "idle" }
  | { phase: "fetching-job" }
  | { phase: "done" }
  | { phase: "error"; message: string };

// "11th March 2026" from a Date
function formatOrdinalDate(d: Date): string {
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleDateString("en-AU", { month: "long" });
  return `${day}${suffix} ${month} ${d.getFullYear()}`;
}

// Parse en-AU "DD/MM/YYYY" → Date
function parseAuDate(s: string): Date | null {
  const p = s.split("/");
  if (p.length !== 3) return null;
  const d = new Date(+p[2], +p[1] - 1, +p[0]);
  return isNaN(d.getTime()) ? null : d;
}

export default function AnchorInspectionPage({
  onBack,
}: AnchorInspectionPageProps) {
  const [report, setReport] = useState<AnchorReportData>(DEFAULT_ANCHOR_REPORT);
  const [view, setView] = useState<View>("editor");
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<AnchorImportStatus>({
    phase: "idle",
  });
  const [loadedJobId, setLoadedJobId] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedFilename, setSavedFilename] = useState<string | null>(null);
  const currentLoadId = useRef(0);
  const [isExporting, setIsExporting] = useState(false);

  // ── Export PDF — builds clean print HTML via anchor.print.ts ──────────────
  const handleExport = useCallback(() => {
    setIsExporting(true);

    const html = buildAnchorPrintHTML(report);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");

    if (!win) {
      URL.revokeObjectURL(url);
      setIsExporting(false);
      return;
    }

    win.onload = () => {
      setTimeout(() => {
        win.print();
        win.close();
        URL.revokeObjectURL(url);
        setIsExporting(false);
      }, 800);
    };
    // Fallback in case onload doesn't fire
    setTimeout(() => {
      URL.revokeObjectURL(url);
      setIsExporting(false);
    }, 8000);
  }, [report]);

  // ── Job detail handlers ────────────────────────────────────────────────
  const updateJob = useCallback(
    (field: keyof AnchorReportJob, value: string | null) => {
      setReport((prev) => ({ ...prev, job: { ...prev.job, [field]: value } }));
    },
    [],
  );

  // ── Load job from SimPRO ───────────────────────────────────────────────
  const handleImport = useCallback(async (jobNumber: string) => {
    const loadId = ++currentLoadId.current;
    const isStale = () => currentLoadId.current !== loadId;

    setImportStatus({ phase: "fetching-job" });

    try {
      const jobRes = await fetch(`/api/simpro/jobs/${jobNumber}?companyId=0`);
      if (isStale()) return;
      if (!jobRes.ok)
        throw new Error(`Job fetch failed: HTTP ${jobRes.status}`);

      const jobData: EnrichedJob = await jobRes.json();
      if (isStale()) return;

      // Inspection date = job completed date; next = +1 year
      let inspectionDate = "";
      let nextInspectionDate = "";
      const d = parseAuDate(jobData.date);
      if (d) {
        inspectionDate = formatOrdinalDate(d);
        const ny = new Date(d);
        ny.setFullYear(ny.getFullYear() + 1);
        nextInspectionDate = formatOrdinalDate(ny);
      }

      setReport((prev) => ({
        ...prev,
        job: {
          ...prev.job,
          // Cover page
          preparedFor: jobData.preparedFor || prev.job.preparedFor,
          address: jobData.siteAddress || prev.job.address,
          date: jobData.date || prev.job.date,
          // Certification page
          certNumber: jobData.jobNo?.replace(/^#/, "") || prev.job.certNumber,
          buildingName: jobData.siteName || prev.job.buildingName,
          inspectionDate: inspectionDate || prev.job.inspectionDate,
          nextInspectionDate: nextInspectionDate || prev.job.nextInspectionDate,
          authorisedBy: "Archer Dutch",
        },
      }));

      setLoadedJobId(jobNumber);
      setImportStatus({ phase: "done" });
    } catch (err) {
      if (isStale()) return;
      setImportStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to fetch job",
      });
    }
  }, []);

  // ── Zone handlers ──────────────────────────────────────────────────────
  const addZone = useCallback(() => {
    const newZone: Zone = {
      id: generateId(),
      name: `Zone ${report.zones.length + 1}`,
      mapImageUrl: null,
      anchors: [],
    };
    setReport((prev) => ({ ...prev, zones: [...prev.zones, newZone] }));
  }, [report.zones.length]);

  const openZoneMap = useCallback((zoneId: string) => {
    setEditingZoneId(zoneId);
    setView("zone-map");
  }, []);

  const deleteZone = useCallback((zoneId: string) => {
    setReport((prev) => ({
      ...prev,
      zones: prev.zones.filter((z) => z.id !== zoneId),
    }));
    setView("editor");
    setEditingZoneId(null);
  }, []);

  const handleZoneUpdate = useCallback((updatedZone: Zone) => {
    setReport((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === updatedZone.id ? updatedZone : z)),
    }));
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────
  const totalAnchors = report.zones.reduce(
    (sum, z) => sum + z.anchors.length,
    0,
  );
  const totalPassed = report.zones.reduce(
    (sum, z) => sum + z.anchors.filter((a) => a.result === "PASSED").length,
    0,
  );

  // ── Zone map view ──────────────────────────────────────────────────────
  if (view === "zone-map" && editingZoneId) {
    const zone = report.zones.find((z) => z.id === editingZoneId);
    if (zone) {
      return (
        <ZoneMapEditor
          zone={zone}
          jobAddress={report.job.address}
          onUpdate={handleZoneUpdate}
          onBack={() => {
            setView("editor");
            setEditingZoneId(null);
          }}
          onDelete={() => deleteZone(editingZoneId)}
        />
      );
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Report types
        </button>
        <div className={styles.topBarRight}>
          <span className={styles.topBarTitle}>Anchor Inspection</span>
          <span className={styles.badge}>
            {report.zones.length} zone{report.zones.length !== 1 ? "s" : ""}
          </span>
          {totalAnchors > 0 && (
            <span className={styles.badge}>
              {totalAnchors} anchor{totalAnchors !== 1 ? "s" : ""}
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
            disabled={!loadedJobId}
          >
            Save to Job
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.editorBody}>
        <AnchorOptionsPanel
          job={report.job}
          zones={report.zones}
          onUpdateJob={updateJob}
          onAddZone={addZone}
          onOpenZone={openZoneMap}
          onDeleteZone={deleteZone}
          totalAnchors={totalAnchors}
          totalPassed={totalPassed}
          importStatus={importStatus}
          onImport={handleImport}
        />

        {/* ── Canvas ── */}
        <div className={styles.canvas}>
          <div className={styles.pageLabel}>Cover Page</div>
          <AnchorCoverSection job={report.job} onUpdate={updateJob} />

          {report.zones.length > 0 && (
            <>
              <div className={styles.pageLabel}>
                Zones &middot; {report.zones.length} zone
                {report.zones.length !== 1 ? "s" : ""}
              </div>
              {report.zones.map((zone) => (
                <ZoneSummarySection
                  key={zone.id}
                  zone={zone}
                  onEditZone={() => openZoneMap(zone.id)}
                />
              ))}
            </>
          )}

          <div className={styles.pageLabel}>Certification</div>
          <CertificationSection
            job={report.job}
            zones={report.zones}
            onUpdate={updateJob}
          />

          <div className={styles.pageLabel}>Summary &amp; Sign-off</div>
          <SummarySignoffSection />
        </div>
      </div>

      {/* Save to Job Modal */}
      {showSaveModal && (
        <SaveToJobModal
          jobId={loadedJobId}
          jobNo={`#${loadedJobId}`}
          companyId={0}
          defaultFilename={`Anchor Inspection Report - ${report.job.address || "Draft"}`}
          saveEndpoint={`/api/simpro/jobs/${loadedJobId}/save-anchor-report`}
          prepareBody={(filename, companyId) => ({
            filename,
            companyId,
            report,
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
