"use client";
// components/reports/condition/sections/CoverSection.tsx

import React from "react";
import styles from "./CoverSection.module.css";
import EditableField from "../../shared/EditableField";
import type { ReportJobDetails } from "@/lib/reports/condition.types";

interface CoverSectionProps {
  job: ReportJobDetails;
  onChange: (field: keyof ReportJobDetails, value: string) => void;
}

const META_ROWS: { label: string; field: keyof ReportJobDetails }[] = [
  { label: "Prepared For", field: "preparedFor" },
  { label: "Prepared By", field: "preparedBy" },
  { label: "Address", field: "address" },
  { label: "Project", field: "project" },
  { label: "Date", field: "date" },
];

export default function CoverSection({ job, onChange }: CoverSectionProps) {
  return (
    <div className={styles.page}>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroNavy} />
        {job.coverPhoto && (
          <div
            className={styles.heroCoverPhoto}
            style={{ backgroundImage: `url(${job.coverPhoto})` }}
          />
        )}
        <div className={styles.heroOverlay} />
        <div className={styles.heroChevron} />

        <div className={styles.heroLogo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/ras-logo.png"
            alt="RAS Vertex Maintenance Solutions"
            className={styles.heroLogoImg}
          />
        </div>
        <div className={styles.heroWeb}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/link_white.png"
            alt="rasvertex.com.au"
            className={styles.heroWebImg}
          />
        </div>
        <div className={styles.heroCreds}>
          <div className={styles.heroCredsItem}>
            <span className={styles.heroCredsKey}>QBCC:</span>
            <span className={styles.heroCredsVal}> 1307234</span>
          </div>
          <div className={styles.heroCredsItem}>
            <span className={styles.heroCredsKey}>ABN:</span>
            <span className={styles.heroCredsVal}> 53 167 652 637</span>
          </div>
        </div>
      </div>

      {/* ── Body — pushed to page bottom ─────────────────────────────── */}
      <div className={styles.body}>
        {/*
         * Using <div> instead of <h1> to avoid globals.css h1 font-family
         * override fighting the Bebas Neue declaration. The .reportTitle
         * CSS class carries all the visual styling — no semantic h1 needed
         * inside this print-preview component.
         */}
        <div className={styles.reportTitle}>
          <EditableField
            value={job.reportType}
            onChange={(v) => onChange("reportType", v)}
            placeholder="Report Title"
            label="Report Title"
          />
        </div>

        <p className={styles.intro}>
          This report outlines the repairs and maintenance works completed,
          including any updates, adjustments, and variations from the original
          scope.
        </p>

        {/*
          Meta uses a real <table> so border-collapse works correctly
          and lines only span as wide as the content — not full page width.
        */}
        <table className={styles.meta}>
          <tbody>
            {META_ROWS.map(({ label, field }) => (
              <tr key={field} className={styles.metaRow}>
                <td className={styles.metaLabel}>{label}</td>
                <td className={styles.metaValue}>
                  <EditableField
                    value={job[field] as string}
                    onChange={(v) => onChange(field, v)}
                    placeholder={`Enter ${label.toLowerCase()}`}
                    label={label}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
