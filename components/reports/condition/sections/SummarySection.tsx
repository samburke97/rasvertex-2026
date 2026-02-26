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

// Partner association logos — 6 images in one row
const PARTNERS = [
  { src: "/reports/partners/smart-strata.png", alt: "Smart Strata" },
  { src: "/reports/partners/ebix.png", alt: "Ebix" },
  { src: "/reports/partners/trades-monitor.png", alt: "Trades Monitor" },
  { src: "/reports/partners/pegasus.png", alt: "Pegasus" },
  { src: "/reports/partners/community-select.png", alt: "Community Select" },
  { src: "/reports/partners/haymes.png", alt: "Haymes Paint" },
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
        {/* Comments */}
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

        {/* Recommendations */}
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

      {/* ── Footer: partner logos in one row ── */}
      <div className={styles.footer}>
        {PARTNERS.map((p) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={p.alt}
            src={p.src}
            alt={p.alt}
            className={styles.partnerLogo}
          />
        ))}
      </div>
    </div>
  );
}
