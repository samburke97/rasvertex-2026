"use client";

import { useState } from "react";
import styles from "./ReportSelector.module.css";

const MOCK_REPORTS = [
  {
    name: "Condition Report",
    file: "CR-2026-014.pdf",
    date: "26 Feb 2026",
  },
  {
    name: "Anchor Inspection",
    file: "AI-2026-009.pdf",
    date: "18 Feb 2026",
  },
];

export default function PreviouslySent() {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.dropdownWrap}>
      <button className={styles.dropdownTrigger} onClick={() => setOpen(!open)}>
        Previously Sent
      </button>

      {open && (
        <div className={styles.dropdownMenu}>
          <div className={styles.dropdownTitle}>Previously Sent</div>

          {MOCK_REPORTS.map((report, i) => (
            <div key={i} className={styles.dropdownItem}>
              <div className={styles.dropdownItemName}>{report.name}</div>
              <div className={styles.dropdownMeta}>
                {report.file} • {report.date}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
