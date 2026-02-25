"use client";

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
    <div className={styles.card}>
      <div className={styles.heroBar}>
        <span className={styles.heroTitle}>Summary</span>
      </div>

      <div className={styles.body}>
        <div className={styles.block}>
          <div className={styles.blockLabel}>Comments</div>
          <div className={styles.blockText}>
            <EditableField
              value={comments}
              onChange={onCommentsChange}
              multiline
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
              placeholder="Enter recommended works…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
