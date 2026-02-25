"use client";

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
    <div className={styles.card}>
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <div className={styles.logoName}>RAS VERTEX</div>
          <div className={styles.logoSub}>
            Maintenance Solutions · Sunshine Coast
          </div>
        </div>
        <div className={styles.heroCreds}>
          <span>QBCC: 1307234</span>
          <span>ABN: 53 167 652 637</span>
        </div>
      </div>

      <div className={styles.body}>
        {/* The cover title uses reportType as the headline */}
        <h2 className={styles.title}>
          <EditableField
            value={job.reportType}
            onChange={(v) => onChange("reportType", v)}
            placeholder="Report type"
          />
        </h2>
        <p className={styles.intro}>
          This report documents the condition of the building and identifies
          maintenance requirements, defects, and recommended remediation works.
        </p>
        <dl className={styles.meta}>
          {META_ROWS.map(({ label, field }) => (
            <React.Fragment key={field}>
              <dt>{label}</dt>
              <dd>
                <EditableField
                  value={job[field]}
                  onChange={(v) => onChange(field, v)}
                  placeholder={label}
                />
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}
