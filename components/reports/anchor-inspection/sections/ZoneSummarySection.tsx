"use client";
// components/reports/anchor-inspection/sections/ZoneSummarySection.tsx

import React from "react";
import styles from "./ZoneSummarySection.module.css";
import MapLegend from "../MapLegend";
import {
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_LABELS,
  type AnchorType,
  type Zone,
} from "@/lib/reports/anchor.types";

interface ZoneSummarySectionProps {
  zone: Zone;
  onEditZone: () => void;
}

export default function ZoneSummarySection({
  zone,
  onEditZone,
}: ZoneSummarySectionProps) {
  const activeTypes = [
    ...new Set(zone.anchors.map((a) => a.type)),
  ] as AnchorType[];

  const passed = zone.anchors.filter((a) => a.result === "PASSED").length;
  const failed = zone.anchors.filter((a) => a.result === "FAILED").length;

  return (
    <div className={styles.page}>
      {/* ── Page header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.brandMark}>
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <span className={styles.orgName}>Australian Asset Compliance</span>
        </div>
        <div className={styles.pageHeaderRight}>
          <span className={styles.sectionLabel}>Layout Plan</span>
          <h2 className={styles.sectionTitle}>{zone.name}</h2>
        </div>
      </div>

      {/* ── Map image with pins ── */}
      <div className={styles.mapSection}>
        {zone.mapImageUrl ? (
          <div className={styles.mapWrap}>
            <div className={styles.mapCanvas}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zone.mapImageUrl}
                alt={zone.name}
                className={styles.mapImg}
              />
              {/* Render all anchor pins on the printed view */}
              {zone.anchors.map((anchor) => (
                <div
                  key={anchor.id}
                  className={styles.pin}
                  style={{
                    left: `${anchor.x}%`,
                    top: `${anchor.y}%`,
                    background: ANCHOR_TYPE_COLOURS[anchor.type],
                  }}
                >
                  <span className={styles.pinLabel}>{anchor.label}</span>
                </div>
              ))}
            </div>

            {/* Legend */}
            {activeTypes.length > 0 && (
              <MapLegend types={activeTypes} anchors={zone.anchors} />
            )}
          </div>
        ) : (
          <div className={styles.mapEmpty}>
            <button className={styles.mapEmptyBtn} onClick={onEditZone}>
              + Set up aerial view for {zone.name}
            </button>
          </div>
        )}
      </div>

      {/* ── Stats banner ── */}
      {zone.anchors.length > 0 && (
        <div className={styles.statsBanner}>
          <div className={styles.statItem}>
            <span className={styles.statVal}>{zone.anchors.length}</span>
            <span className={styles.statKey}>Total Assets</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={`${styles.statVal} ${styles.statPass}`}>
              {passed}
            </span>
            <span className={styles.statKey}>Passed</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span
              className={`${styles.statVal} ${failed > 0 ? styles.statFail : ""}`}
            >
              {failed}
            </span>
            <span className={styles.statKey}>Failed</span>
          </div>
        </div>
      )}

      {/* ── Asset register table ── */}
      {zone.anchors.length > 0 && (
        <div className={styles.tableSection}>
          <div className={styles.tableSectionLabel}>Asset Register</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {[
                    "Asset No.",
                    "Description",
                    "Model",
                    "Manufacturer",
                    "Commission",
                    "Major Service",
                    "Inspection",
                    "Pass/Fail",
                    "Next Inspection",
                  ].map((h) => (
                    <th key={h} className={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zone.anchors.map((anchor, i) => (
                  <tr
                    key={anchor.id}
                    className={`${styles.tr} ${i % 2 === 0 ? styles.trEven : ""}`}
                  >
                    <td className={styles.td}>
                      <div className={styles.assetLabel}>
                        <span
                          className={styles.labelDot}
                          style={{
                            background: ANCHOR_TYPE_COLOURS[anchor.type],
                          }}
                        />
                        {anchor.label}
                      </div>
                    </td>
                    <td className={styles.td}>
                      {ANCHOR_TYPE_LABELS[anchor.type]}
                    </td>
                    <td className={styles.tdMono}>{anchor.model ?? "—"}</td>
                    <td className={styles.td}>{anchor.manufacturer ?? "—"}</td>
                    <td className={styles.td}>
                      {anchor.commissionDate ?? "—"}
                    </td>
                    <td className={styles.td}>
                      {anchor.majorServiceDate ?? "—"}
                    </td>
                    <td className={styles.td}>{anchor.inspectionDate}</td>
                    <td className={styles.td}>
                      <span
                        className={`${styles.badge} ${
                          anchor.result === "PASSED"
                            ? styles.badgePass
                            : styles.badgeFail
                        }`}
                      >
                        {anchor.result}
                      </span>
                    </td>
                    <td className={styles.td}>{anchor.nextInspection}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit overlay button (screen only) */}
      <button className={styles.editBtn} onClick={onEditZone}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
        Edit Zone
      </button>

      {/* ── Footer ── */}
      <div className={styles.footer}>
        <span className={styles.footerText}>
          1800 870 081 | info@australianassetcompliance.com.au
        </span>
      </div>
    </div>
  );
}
