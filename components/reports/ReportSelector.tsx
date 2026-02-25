"use client";

import React, { useState } from "react";
import styles from "./ReportSelector.module.css";
import ConditionReportPage from "./condition/ConditionReportPage";

type ReportTypeId = "condition" | "anchor" | "roof" | "building";

interface ReportType {
  id: ReportTypeId;
  label: string;
  description: string;
  available: boolean;
  icon: React.ReactNode;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: "condition",
    label: "Condition Report",
    description:
      "Document building condition, defects, and recommendations with photo evidence.",
    available: true,
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
      </svg>
    ),
  },
  {
    id: "anchor",
    label: "Anchor Inspection",
    description:
      "Height safety anchor point inspection and compliance documentation.",
    available: false,
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="5" r="3" />
        <line x1="12" y1="8" x2="12" y2="21" />
        <path d="M5 15l7 6 7-6" />
      </svg>
    ),
  },
  {
    id: "roof",
    label: "Roof Inspection",
    description: "Comprehensive roof condition assessment with defect mapping.",
    available: false,
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    id: "building",
    label: "Building Inspection",
    description:
      "Full building inspection covering all structural and cosmetic elements.",
    available: false,
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
];

export default function ReportSelector() {
  const [active, setActive] = useState<ReportTypeId | null>(null);

  if (active === "condition") {
    return <ConditionReportPage onBack={() => setActive(null)} />;
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Report Builder</h1>
        <p className={styles.subtitle}>Select a report type to get started</p>
      </div>

      <div className={styles.grid}>
        {REPORT_TYPES.map((type) => (
          <button
            key={type.id}
            className={`${styles.card} ${!type.available ? styles.cardDisabled : ""}`}
            onClick={() => type.available && setActive(type.id)}
            disabled={!type.available}
          >
            {!type.available && (
              <span className={styles.comingSoon}>Coming soon</span>
            )}

            <div
              className={`${styles.iconWrap} ${type.available ? styles.iconWrapActive : ""}`}
            >
              {type.icon}
            </div>

            <div className={styles.cardBody}>
              <div className={styles.cardLabel}>{type.label}</div>
              <div className={styles.cardDesc}>{type.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
