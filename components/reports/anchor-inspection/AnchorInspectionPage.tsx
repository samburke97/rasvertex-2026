"use client";
// components/reports/anchor-inspection/AnchorInspectionPage.tsx

import React, { useState, useCallback, useRef } from "react";
import styles from "../shared/ReportPage.module.css";
import Button from "@/components/ui/Button";
import AnchorOptionsPanel from "./AnchorOptionsPanel";
import ZoneMapEditor from "./ZoneMapEditor";
import CoverSection from "../shared/CoverSection";
import ZoneSummarySection from "./sections/ZoneSummarySection";
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

      setReport((prev) => ({
        ...prev,
        job: {
          ...prev.job,
          preparedFor: jobData.preparedFor || prev.job.preparedFor,
          address: jobData.siteAddress || prev.job.address,
          date: jobData.date || prev.job.date,
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
      mapCenter: null,
      mapZoom: null,
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
  }, []);

  const handleZoneSave = useCallback((updatedZone: Zone) => {
    setReport((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === updatedZone.id ? updatedZone : z)),
    }));
    setView("editor");
    setEditingZoneId(null);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────
  const totalAnchors = report.zones.reduce(
    (sum, z) => sum + z.anchors.length,
    0,
  );
  const totalPassed = report.zones.reduce(
    (sum, z) => sum + z.anchors.filter((a) => a.status === "pass").length,
    0,
  );

  // ── Zone map view ──────────────────────────────────────────────────────
  if (view === "zone-map" && editingZoneId) {
    const zone = report.zones.find((z) => z.id === editingZoneId);
    if (zone) {
      return (
        <ZoneMapEditor
          zone={zone}
          onSave={handleZoneSave}
          onBack={() => {
            setView("editor");
            setEditingZoneId(null);
          }}
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
          <CoverSection
            coverPhoto={report.job.coverPhoto}
            reportType={report.job.reportType}
            onReportTypeChange={(v) => updateJob("reportType", v)}
            metaRows={[
              {
                label: "Prepared For",
                value: report.job.preparedFor,
                onChange: (v) => updateJob("preparedFor", v),
              },
              {
                label: "Prepared By",
                value: report.job.preparedBy,
                onChange: (v) => updateJob("preparedBy", v),
              },
              {
                label: "Address",
                value: report.job.address,
                onChange: (v) => updateJob("address", v),
              },
              {
                label: "Date",
                value: report.job.date,
                onChange: (v) => updateJob("date", v),
              },
            ]}
          />

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
        </div>
      </div>
    </div>
  );
}
