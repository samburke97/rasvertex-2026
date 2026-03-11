"use client";
// components/reports/anchor-inspection/sections/AnchorCoverSection.tsx

import React from "react";
import styles from "./AnchorCoverSection.module.css";
import EditableField from "../../shared/EditableField";
import type { AnchorReportJob } from "@/lib/reports/anchor.types";
import { ASSOCIATIONS } from "@/lib/reports/constants";

interface AnchorCoverSectionProps {
  job: AnchorReportJob;
  onUpdate: (field: keyof AnchorReportJob, value: string | null) => void;
}

const META_ROWS: { label: string; field: keyof AnchorReportJob }[] = [
  { label: "Prepared For", field: "preparedFor" },
  { label: "Prepared By", field: "preparedBy" },
  { label: "Address", field: "address" },
  { label: "Date", field: "date" },
];

export default function AnchorCoverSection({
  job,
  onUpdate,
}: AnchorCoverSectionProps) {
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
        <div className={styles.titleGroup}>
          <div className={styles.reportTitle}>
            <EditableField
              value={job.reportType}
              onChange={(v) => onUpdate("reportType", v)}
              placeholder="Report Title"
              label="Report Title"
            />
          </div>
        </div>

        <div className={styles.metaWrap}>
          <table className={styles.meta}>
            <tbody>
              {META_ROWS.map(({ label, field }) => (
                <tr key={field} className={styles.metaRow}>
                  <td className={styles.metaLabel}>{label}:</td>
                  <td className={styles.metaValue}>
                    <EditableField
                      value={(job[field] as string) ?? ""}
                      onChange={(v) => onUpdate(field, v)}
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

      {/* ── Footer ── */}
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
  );
}
