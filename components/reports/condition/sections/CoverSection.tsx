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
         * override fighting the Bebas Neue declaration.
         */}
        <div className={styles.reportTitle}>
          <EditableField
            value={job.reportType}
            onChange={(v) => onChange("reportType", v)}
            placeholder="Report Title"
            label="Report Title"
          />
        </div>

        {/*
         * Intro paragraph — was a static <p>, now an EditableField so users
         * can customise the description text that appears under the title.
         * Uses multiline so Enter creates new lines, matching PDF output.
         * print: .cover-intro { ... }  ←→  styles.intro wrapper
         */}
        <div className={styles.intro}>
          <EditableField
            value={job.intro}
            onChange={(v) => onChange("intro", v)}
            placeholder="Enter report description…"
            label="Report Description"
            multiline
          />
        </div>

        {/*
         * Meta table — real <table> so border-collapse works correctly and
         * lines only span as wide as the content, matching print output.
         * Labels now include a colon suffix and the right-padding is tighter
         * so values sit closer to their labels.
         */}
        <table className={styles.meta}>
          <tbody>
            {META_ROWS.map(({ label, field }) => (
              <tr key={field} className={styles.metaRow}>
                <td className={styles.metaLabel}>{label}:</td>
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
