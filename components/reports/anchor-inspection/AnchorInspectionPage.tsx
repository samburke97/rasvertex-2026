"use client";
// components/reports/anchor-inspection/AnchorInspectionPage.tsx

import React, { useState, useCallback, useRef } from "react";
import styles from "../shared/ReportPage.module.css";
import Button from "@/components/ui/Button";
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

// Format a JS Date as "5th March 2026"
function formatOrdinalDate(date: Date): string {
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = date.toLocaleDateString("en-AU", { month: "long" });
  return `${day}${suffix} ${month} ${date.getFullYear()}`;
}

// Parse en-AU date string "DD/MM/YYYY" → Date
function parseAuDate(auDate: string): Date | null {
  const parts = auDate.split("/");
  if (parts.length !== 3) return null;
  const d = new Date(
    parseInt(parts[2], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[0], 10),
  );
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
  const currentLoadId = useRef(0);

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

      // Inspection date = CompletedDate (jobData.date is en-AU "DD/MM/YYYY")
      // Next inspection = exactly 1 year later
      let inspectionDate = "";
      let nextInspectionDate = "";
      const parsed = parseAuDate(jobData.date);
      if (parsed) {
        inspectionDate = formatOrdinalDate(parsed);
        const nextYear = new Date(parsed);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        nextInspectionDate = formatOrdinalDate(nextYear);
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
          certNumber: jobData.jobNo || prev.job.certNumber,
          buildingName: jobData.siteName || prev.job.buildingName,
          inspectionDate: inspectionDate || prev.job.inspectionDate,
          nextInspectionDate: nextInspectionDate || prev.job.nextInspectionDate,
          authorisedBy: "Archer Dutch",
        },
      }));

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
          <Button variant="primary" size="sm" onClick={() => window.print()}>
            Export PDF
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
    </div>
  );
}
