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

export default function SummarySection({
  comments,
  recommendations,
  onCommentsChange,
  onRecommendationsChange,
}: SummarySectionProps) {
  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <div className={styles.heroTitle}>Summary</div>
      </div>

      <div className={styles.body}>
        <div className={styles.block}>
          <div className={styles.blockLabel}>Comments</div>
          <div className={styles.blockText}>
            <EditableField
              value={comments}
              onChange={onCommentsChange}
              multiline
              label="Comments"
              placeholder="Enter comments about the building condition…"
            />
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.block}>
          <div className={styles.blockLabel}>Recommendations</div>
          <div className={styles.blockText}>
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

      <div className={styles.footer}>
        <span>
          RAS-VERTEX Maintenance Solutions · QBCC 1307234 · ABN 53 167 652 637 ·
          rasvertex.com.au
        </span>
        <span>
          Smart Strata · Ebix · Trades Monitor · Pegasus · Haymes Paint
        </span>
      </div>
    </div>
  );
}
