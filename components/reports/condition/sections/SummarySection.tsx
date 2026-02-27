"use client";
// components/reports/condition/sections/SummarySection.tsx

import React from "react";
import styles from "./SummarySection.module.css";
import EditableField from "../../shared/EditableField";

interface SummarySectionProps {
  comments: string;
  recommendations: string;
  onCommentsChange: (value: string) => void;
  onRecommendationsChange: (value: string) => void;
}

// Association logos from public/reports/associations/
const ASSOCIATIONS = [
  { src: "/reports/associations/communityselect.png", alt: "Community Select" },
  { src: "/reports/associations/dulux.png", alt: "Dulux" },
  { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
  { src: "/reports/associations/mpa.png", alt: "MPA" },
  { src: "/reports/associations/qbcc.png", alt: "QBCC" },
  { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
];

export default function SummarySection({
  comments,
  recommendations,
  onCommentsChange,
  onRecommendationsChange,
}: SummarySectionProps) {
  return (
    <div className={styles.page}>
      {/* ── Top bar: SUMMARY left, link_blue right ── */}
      <div className={styles.topBar}>
        <h1 className={styles.title}>Summary</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/reports/link_blue.png"
          alt="rasvertex.com.au"
          className={styles.topBarLink}
        />
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Comments:</div>
          <div className={styles.sectionText}>
            <EditableField
              value={comments}
              onChange={onCommentsChange}
              multiline
              label="Comments"
              placeholder="Enter comments about the building condition…"
            />
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionLabel}>Recommendations:</div>
          <div className={styles.sectionText}>
            <EditableField
              value={recommendations}
              onChange={onRecommendationsChange}
              multiline
              label="Recommendations"
              placeholder="Enter recommended works…"
            />
          </div>
        </div>
      </div>

      {/* ── Footer: association logos ── */}
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
