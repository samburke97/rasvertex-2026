"use client";
// components/reports/shared/SavedBadge.tsx
// "Saved" pill shown in the report builder top bar after a successful save.
// Was hand-duplicated identically across all three report *Page.tsx files.

import styles from "./ReportPage.module.css";

export default function SavedBadge() {
  return (
    <span className={styles.savedBadge}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <circle cx="6" cy="6" r="6" fill="var(--success-400, #10b981)" />
        <path
          d="M3.5 6l2 2 3-3"
          stroke="#fff"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Saved
    </span>
  );
}
