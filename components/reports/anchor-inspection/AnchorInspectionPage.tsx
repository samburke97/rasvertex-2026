"use client";
// components/reports/anchor-inspection/AnchorInspectionPage.tsx

import React, { useState, useCallback } from "react";
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

interface AnchorInspectionPageProps {
  onBack: () => void;
}

type View = "editor" | "zone-map";

export default function AnchorInspectionPage({
  onBack,
}: AnchorInspectionPageProps) {
  const [report, setReport] = useState<AnchorReportData>(DEFAULT_ANCHOR_REPORT);
  const [activeZoneId, setActiveZoneId] = useState<string | null>(null);
  const [view, setView] = useState<View>("editor");
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);

  // ── Job detail handlers ────────────────────────────────────────────────
  const updateJob = useCallback(
    (field: keyof AnchorReportJob, value: string | null) => {
      setReport((prev) => ({ ...prev, job: { ...prev.job, [field]: value } }));
    },
    [],
  );

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

  // ── Export handler (placeholder) ───────────────────────────────────────
  const handleExport = useCallback(() => {
    window.print();
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
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Report types
        </button>
        <div className={styles.topActions}>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            Export PDF
          </Button>
        </div>
      </div>

      <div className={styles.layout}>
        {/* ── Left panel: options ── */}
        <AnchorOptionsPanel
          job={report.job}
          zones={report.zones}
          onUpdateJob={updateJob}
          onAddZone={addZone}
          onOpenZone={openZoneMap}
          onDeleteZone={deleteZone}
          totalAnchors={totalAnchors}
          totalPassed={totalPassed}
        />

        {/* ── Right panel: live preview ── */}
        <div className={styles.previewPane}>
          <div className={styles.previewInner}>
            {/* Cover page */}
            <AnchorCoverSection job={report.job} onUpdate={updateJob} />

            {/* Zone summary pages */}
            {report.zones.map((zone) => (
              <ZoneSummarySection
                key={zone.id}
                zone={zone}
                onEditZone={() => openZoneMap(zone.id)}
              />
            ))}

            {/* Empty state */}
            {report.zones.length === 0 && (
              <div className={styles.emptyZones}>
                <div className={styles.emptyZonesIcon}>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                    <line x1="9" y1="3" x2="9" y2="18" />
                    <line x1="15" y1="6" x2="15" y2="21" />
                  </svg>
                </div>
                <p className={styles.emptyZonesTitle}>No zones added yet</p>
                <p className={styles.emptyZonesSub}>
                  Add a zone to begin placing anchors on the map
                </p>
                <Button variant="primary" size="sm" onClick={addZone}>
                  + Add First Zone
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
