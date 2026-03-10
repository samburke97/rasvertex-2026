"use client";
// components/reports/anchor-inspection/AnchorInspectionPage.tsx

import React, { useState, useCallback, useRef } from "react";
import styles from "./AnchorInspectionPage.module.css";
import Button from "@/components/ui/Button";
import AnchorOptionsPanel from "./AnchorOptionsPanel";
import ZoneMapEditor from "./ZoneMapEditor";
import AnchorCoverSection from "./sections/AnchorCoverSection";
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
    const id = generateId();
    const newZone: Zone = {
      id,
      name: `Zone ${report.zones.length + 1}`,
      mapImageUrl: null,
      anchors: [],
    };
    setReport((prev) => ({ ...prev, zones: [...prev.zones, newZone] }));
    setEditingZoneId(id);
    setView("zone-map");
  }, [report.zones.length]);

  const updateZone = useCallback((updated: Zone) => {
    setReport((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === updated.id ? updated : z)),
    }));
  }, []);

  const deleteZone = useCallback((zoneId: string) => {
    setReport((prev) => ({
      ...prev,
      zones: prev.zones.filter((z) => z.id !== zoneId),
    }));
    setEditingZoneId(null);
    setView("editor");
  }, []);

  const openZoneMap = useCallback((zoneId: string) => {
    setEditingZoneId(zoneId);
    setView("zone-map");
  }, []);

  const closeZoneMap = useCallback(() => {
    setEditingZoneId(null);
    setView("editor");
  }, []);

  const totalAnchors = report.zones.reduce(
    (sum, z) => sum + z.anchors.length,
    0,
  );
  const totalPassed = report.zones.reduce(
    (sum, z) => sum + z.anchors.filter((a) => a.result === "PASSED").length,
    0,
  );

  // ── Zone-map editing view ──────────────────────────────────────────────
  if (view === "zone-map" && editingZoneId) {
    const zone = report.zones.find((z) => z.id === editingZoneId);
    if (!zone) return null;
    return (
      <ZoneMapEditor
        zone={zone}
        jobAddress={report.job.address}
        onUpdate={updateZone}
        onBack={closeZoneMap}
        onDelete={() => deleteZone(editingZoneId)}
      />
    );
  }

  // ── Main editor view ───────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* ── Top bar — same as ConditionReportPage ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Report types
        </button>
        <div className={styles.topMeta}>
          <span className={styles.photoCount}>
            {report.zones.length} zone{report.zones.length !== 1 ? "s" : ""}
          </span>
          {totalAnchors > 0 && (
            <span className={styles.photoCount}>
              {totalAnchors} anchor{totalAnchors !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className={styles.topActions}>
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

        {/* ── Canvas — same as ConditionReportPage ── */}
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
        </div>
      </div>
    </div>
  );
}
