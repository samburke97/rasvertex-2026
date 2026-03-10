"use client";
// components/reports/anchor-inspection/sections/ZoneSummarySection.tsx
//
// Uses the same page chrome as SummarySection (navy Bebas Neue heading,
// RAS link top-right, association footer) but renders zone map + anchor table.

import React from "react";
import styles from "./ZoneSummarySection.module.css";
import MapLegend from "../MapLegend";
import {
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_LABELS,
  type Zone,
} from "@/lib/reports/anchor.types";

interface ZoneSummarySectionProps {
  zone: Zone;
  onEditZone?: () => void;
}

const ASSOCIATIONS = [
  { src: "/reports/associations/communityselect.png", alt: "Community Select" },
  { src: "/reports/associations/dulux.png", alt: "Dulux" },
  { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
  { src: "/reports/associations/mpa.png", alt: "MPA" },
  { src: "/reports/associations/qbcc.png", alt: "QBCC" },
  { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
];

function ZoneFooter() {
  return (
    <div className={styles.footer}>
      {ASSOCIATIONS.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={a.alt} src={a.src} alt={a.alt} className={styles.assocLogo} />
      ))}
    </div>
  );
}

export default function ZoneSummarySection({
  zone,
  onEditZone,
}: ZoneSummarySectionProps) {
  const passed = zone.anchors.filter((a) => a.result === "PASSED").length;
  const failed = zone.anchors.filter((a) => a.result === "FAILED").length;
  const activeTypes = [...new Set(zone.anchors.map((a) => a.type))];

  return (
    <div className={styles.page}>
      {/* ── Top bar — same as SummarySection ── */}
      <div className={styles.topBar}>
        <h1 className={styles.title}>{zone.name}</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/reports/link_blue.png"
          alt="rasvertex.com.au"
          className={styles.topBarLink}
        />
      </div>

      <div className={styles.body}>
        {/* ── Aerial map ── */}
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
                {zone.anchors.map((anchor) => (
                  <div
                    key={anchor.id}
                    className={styles.pin}
                    style={{
                      left: `${anchor.x}%`,
                      top: `${anchor.y}%`,
                    }}
                  >
                    <span
                      className={styles.pinLabel}
                      style={{ background: ANCHOR_TYPE_COLOURS[anchor.type] }}
                    >
                      {anchor.label}
                    </span>
                  </div>
                ))}
              </div>
              {activeTypes.length > 0 && (
                <MapLegend types={activeTypes} anchors={zone.anchors} />
              )}
            </div>
          ) : (
            <div className={styles.mapEmpty}>
              {onEditZone ? (
                <button className={styles.mapEmptyBtn} onClick={onEditZone}>
                  + Set up aerial view for {zone.name}
                </button>
              ) : (
                <span className={styles.mapEmptyText}>No aerial image</span>
              )}
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
            <div className={styles.sectionLabel}>Asset Register</div>
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
                      <td className={styles.td}>
                        {anchor.manufacturer ?? "—"}
                      </td>
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
                              : anchor.result === "FAILED"
                                ? styles.badgeFail
                                : styles.badgeNA
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

        {zone.anchors.length === 0 && (
          <div className={styles.emptyState}>
            No anchors added to this zone yet.
          </div>
        )}
      </div>

      <ZoneFooter />
    </div>
  );
}
