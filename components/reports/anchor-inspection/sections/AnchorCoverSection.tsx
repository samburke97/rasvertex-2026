"use client";
// components/reports/anchor-inspection/sections/AnchorCoverSection.tsx

import React from "react";
import styles from "./AnchorCoverSection.module.css";
import type { AnchorReportJob } from "@/lib/reports/anchor.types";

interface AnchorCoverSectionProps {
  job: AnchorReportJob;
  onUpdate: (field: keyof AnchorReportJob, value: string | null) => void;
}

export default function AnchorCoverSection({
  job,
  onUpdate,
}: AnchorCoverSectionProps) {
  return (
    <div className={styles.page}>
      {/* Cover photo / hero */}
      <div className={styles.hero}>
        {job.coverPhoto && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={job.coverPhoto} alt="Cover" className={styles.heroImg} />
        )}
        <div className={styles.heroOverlay} />
      </div>

      {/* Content block */}
      <div className={styles.body}>
        {/* Brand strip */}
        <div className={styles.brandStrip}>
          <div className={styles.brandLogo}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <span className={styles.brandName}>Australian Asset Compliance</span>
        </div>

        {/* Report title */}
        <div className={styles.titleBlock}>
          <h1
            className={styles.clientName}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) =>
              onUpdate("preparedFor", e.currentTarget.textContent ?? "")
            }
            data-placeholder="Client Name"
          >
            {job.preparedFor || ""}
          </h1>
          <p
            className={styles.reportType}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) =>
              onUpdate("reportType", e.currentTarget.textContent ?? "")
            }
          >
            {job.reportType}
          </p>
        </div>

        {/* Meta table */}
        <table className={styles.metaTable}>
          <tbody>
            {[
              {
                label: "Prepared For",
                value: job.preparedFor,
                field: "preparedFor" as const,
              },
              {
                label: "Prepared By",
                value: job.preparedBy,
                field: "preparedBy" as const,
              },
              {
                label: "Address",
                value: job.address,
                field: "address" as const,
              },
              { label: "Date", value: job.date, field: "date" as const },
            ].map(({ label, value, field }) => (
              <tr key={field} className={styles.metaRow}>
                <td className={styles.metaLabel}>{label}:</td>
                <td
                  className={styles.metaValue}
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) =>
                    onUpdate(field, e.currentTarget.textContent ?? "")
                  }
                  data-placeholder={`Enter ${label.toLowerCase()}`}
                >
                  {value || ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer band */}
      <div className={styles.footer}>
        <span className={styles.footerText}>
          1800 870 081 | info@australianassetcompliance.com.au
        </span>
        <span className={styles.footerPage}>Page 1</span>
      </div>
    </div>
  );
}
