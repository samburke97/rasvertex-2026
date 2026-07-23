"use client";
// components/reports/anchor-inspection/AnchorOptionsPanel.tsx

import React from "react";
import styles from "../shared/OptionsPanel.module.css";
import JobImportInput from "../shared/JobImportInput";
import type { Zone } from "@/lib/reports/anchor.types";
import type { AnchorImportStatus } from "./AnchorInspectionPage";

interface AnchorOptionsPanelProps {
  zones: Zone[];
  onAddZone: () => void;
  onOpenZone: (zoneId: string) => void;
  onDeleteZone: (zoneId: string) => void;
  totalAnchors: number;
  totalPassed: number;
  importStatus: AnchorImportStatus;
  onImport: (jobNumber: string) => void;
}

export default function AnchorOptionsPanel({
  zones,
  onAddZone,
  onOpenZone,
  onDeleteZone,
  totalAnchors,
  totalPassed,
  importStatus,
  onImport,
}: AnchorOptionsPanelProps) {
  return (
    <aside className={styles.panel}>
      {/* ── Job Number ───────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabel}>Job Number</div>
        <JobImportInput
          onImport={onImport}
          importStatus={importStatus}
          placeholder="e.g. 10737"
        />
      </div>

      {/* ── Zones ────────────────────────────────────────────────────────── */}
      <div className={styles.group}>
        <div className={styles.groupLabelRow}>
          <span className={styles.groupLabel}>Zones</span>
          {totalAnchors > 0 && (
            <span className={styles.zoneStats}>
              {totalPassed}/{totalAnchors} passed
            </span>
          )}
        </div>

        <button className={styles.addZoneBtn} onClick={onAddZone}>
          + Add Zone
        </button>

        {zones.length > 0 && (
          <div className={styles.zoneList}>
            {zones.map((zone) => (
              <div key={zone.id} className={styles.zoneRow}>
                <button
                  className={styles.zoneMain}
                  onClick={() => onOpenZone(zone.id)}
                >
                  <div className={styles.zoneThumb}>
                    {zone.mapImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={zone.mapImageUrl}
                        alt={zone.name}
                        className={styles.zoneThumbImg}
                      />
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                      </svg>
                    )}
                  </div>
                  <div className={styles.zoneInfo}>
                    <span className={styles.zoneName}>{zone.name}</span>
                    <span className={styles.zoneCount}>
                      {zone.anchors.length} anchor
                      {zone.anchors.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className={styles.zoneChevron}
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                <button
                  className={styles.zoneDelete}
                  onClick={() => onDeleteZone(zone.id)}
                  title="Delete zone"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
