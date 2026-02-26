"use client";
// components/reports/condition/sections/CoverSection.tsx
// Renders as the actual PDF cover page — full A4 width, hero banner, meta table.
// Every text field is inline-editable via the Grammarly-style EditableField.

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
  { label: "Report Type", field: "reportType" },
  { label: "Project", field: "project" },
  { label: "Date", field: "date" },
];

export default function CoverSection({ job, onChange }: CoverSectionProps) {
  return (
    <div className={styles.page}>
      {/* ── Hero ── */}
      <div className={styles.hero}>
        <div className={styles.heroLogo}>
          <div className={styles.heroLogoName}>RAS VERTEX</div>
          <div className={styles.heroLogoSub}>
            Maintenance Solutions · Sunshine Coast
          </div>
        </div>

        <div className={styles.heroWeb}>rasvertex.com.au</div>

        <div className={styles.heroCreds}>
          <div className={styles.heroCredsItem}>
            QBCC: <span>1307234</span>
          </div>
          <div className={styles.heroCredsItem}>
            ABN: <span>53 167 652 637</span>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* Report title — editable */}
        <h1 className={styles.reportTitle}>
          <EditableField
            value={job.reportType}
            onChange={(v) => onChange("reportType", v)}
            placeholder="Report Type"
            label="Report Type"
          />
        </h1>

        <p className={styles.intro}>
          This report documents the condition of the building and identifies
          maintenance requirements, defects, and recommended remediation works.
        </p>

        {/* Meta table */}
        <dl className={styles.meta}>
          {META_ROWS.map(({ label, field }) => (
            <div key={field} className={styles.metaRow}>
              <dt className={styles.metaLabel}>{label}</dt>
              <dd className={styles.metaValue}>
                <EditableField
                  value={job[field]}
                  onChange={(v) => onChange(field, v)}
                  placeholder={`Enter ${label.toLowerCase()}`}
                  label={label}
                />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
