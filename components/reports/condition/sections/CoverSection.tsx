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

const ASSOCIATIONS = [
  { src: "/reports/associations/communityselect.png", alt: "Community Select" },
  { src: "/reports/associations/dulux.png", alt: "Dulux" },
  { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
  { src: "/reports/associations/mpa.png", alt: "MPA" },
  { src: "/reports/associations/qbcc.png", alt: "QBCC" },
  { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
];

export default function CoverSection({ job, onChange }: CoverSectionProps) {
  return (
    <div className={styles.page}>
      {/* ── Hero ───────────────────────────────────────────────────── */}
      <div className={styles.hero}>
        <div className={styles.heroNavy} />
        {job.coverPhoto && (
          <div
            className={styles.heroCoverPhoto}
            style={{ backgroundImage: `url(${job.coverPhoto})` }}
          />
        )}
        <div className={styles.heroOverlay} />
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
      </div>

      {/* ── White body ─────────────────────────────────────────────── */}
      <div className={styles.body}>
        {/* Title + description — centred vertically in space above meta */}
        <div className={styles.titleGroup}>
          <div className={styles.reportTitle}>
            <EditableField
              value={job.reportType}
              onChange={(v) => onChange("reportType", v)}
              placeholder="Report Title"
              label="Report Title"
            />
          </div>
          <div className={styles.intro}>
            <EditableField
              value={job.intro}
              onChange={(v) => onChange("intro", v)}
              placeholder="Enter report description…"
              label="Report Description"
              multiline
            />
          </div>
        </div>

        {/* Meta fields — shrink-wrapped table, tight labels to values */}
        <div className={styles.metaWrap}>
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

        {/* Footer — identical to SummarySection */}
        <div className={styles.footer}>
          {ASSOCIATIONS.map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.alt}
              src={a.src}
              alt={a.alt}
              className={styles.assocLogo}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
