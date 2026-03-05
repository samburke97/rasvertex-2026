"use client";
// components/reports/anchor-inspection/AnchorOptionsPanel.tsx

import React, { useRef } from "react";
import styles from "./AnchorOptionsPanel.module.css";
import type { AnchorReportJob, Zone } from "@/lib/reports/anchor.types";

interface AnchorOptionsPanelProps {
  job: AnchorReportJob;
  zones: Zone[];
  onUpdateJob: (field: keyof AnchorReportJob, value: string | null) => void;
  onAddZone: () => void;
  onOpenZone: (zoneId: string) => void;
  onDeleteZone: (zoneId: string) => void;
  totalAnchors: number;
  totalPassed: number;
}

function FieldRow({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className={styles.fieldRow}>
      <label className={styles.fieldLabel}>{label}</label>
      <input
        className={styles.fieldInput}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

export default function AnchorOptionsPanel({
  job,
  zones,
  onUpdateJob,
  onAddZone,
  onOpenZone,
  onDeleteZone,
  totalAnchors,
  totalPassed,
}: AnchorOptionsPanelProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) =>
      onUpdateJob("coverPhoto", ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className={styles.panel}>
      {/* ── Stats strip ── */}
      {totalAnchors > 0 && (
        <div className={styles.statsStrip}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totalAnchors}</span>
            <span className={styles.statLabel}>Assets</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span className={`${styles.statValue} ${styles.statPass}`}>
              {totalPassed}
            </span>
            <span className={styles.statLabel}>Passed</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.stat}>
            <span
              className={`${styles.statValue} ${
                totalAnchors - totalPassed > 0 ? styles.statFail : ""
              }`}
            >
              {totalAnchors - totalPassed}
            </span>
            <span className={styles.statLabel}>Failed</span>
          </div>
        </div>
      )}

      <div className={styles.scroll}>
        {/* ── Report Details ── */}
        <div className={styles.group}>
          <div className={styles.groupLabel}>Report Details</div>

          <FieldRow
            label="Prepared For"
            value={job.preparedFor}
            placeholder="Client name"
            onChange={(v) => onUpdateJob("preparedFor", v)}
          />
          <FieldRow
            label="Prepared By"
            value={job.preparedBy}
            placeholder="Inspector name"
            onChange={(v) => onUpdateJob("preparedBy", v)}
          />
          <FieldRow
            label="Address"
            value={job.address}
            placeholder="Site address"
            onChange={(v) => onUpdateJob("address", v)}
          />
          <FieldRow
            label="Date"
            value={job.date}
            placeholder="Inspection date"
            onChange={(v) => onUpdateJob("date", v)}
          />
        </div>

        {/* ── Cover Photo ── */}
        <div className={styles.group}>
          <div className={styles.groupLabel}>Cover Photo</div>
          {job.coverPhoto ? (
            <div className={styles.coverPreview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={job.coverPhoto}
                alt="Cover"
                className={styles.coverThumb}
              />
              <div className={styles.coverActions}>
                <button
                  className={styles.coverBtn}
                  onClick={() => coverInputRef.current?.click()}
                >
                  Change
                </button>
                <button
                  className={`${styles.coverBtn} ${styles.coverBtnRemove}`}
                  onClick={() => onUpdateJob("coverPhoto", null)}
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.uploadBtn}
              onClick={() => coverInputRef.current?.click()}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>Upload cover photo</span>
            </button>
          )}
          <input
            ref={coverInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className={styles.hiddenInput}
            onChange={handleCoverPhotoChange}
          />
        </div>

        {/* ── Zones ── */}
        <div className={styles.group}>
          <div className={styles.groupLabelRow}>
            <span className={styles.groupLabel}>Zones</span>
            <button className={styles.addZoneBtn} onClick={onAddZone}>
              + Add Zone
            </button>
          </div>

          {zones.length === 0 ? (
            <p className={styles.noZones}>
              No zones yet — add a zone to start placing anchors
            </p>
          ) : (
            <div className={styles.zoneList}>
              {zones.map((zone) => (
                <div key={zone.id} className={styles.zoneCard}>
                  <button
                    className={styles.zoneCardMain}
                    onClick={() => onOpenZone(zone.id)}
                  >
                    <div className={styles.zoneMapThumb}>
                      {zone.mapImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={zone.mapImageUrl}
                          alt={zone.name}
                          className={styles.zoneThumbImg}
                        />
                      ) : (
                        <svg
                          width="16"
                          height="16"
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
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={styles.zoneChevron}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </button>
                  <button
                    className={styles.zoneDelete}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        confirm(
                          `Delete zone "${zone.name}" and all its anchors?`,
                        )
                      ) {
                        onDeleteZone(zone.id);
                      }
                    }}
                    title="Delete zone"
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
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
      </div>
    </div>
  );
}
