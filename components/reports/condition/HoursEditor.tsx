"use client";
// components/reports/condition/HoursEditor.tsx
//
// The Job Overview's hours, edited in a sheet over the preview: the same
// editable schedule table the Hours breakdown report uses (change hours and
// notes, delete rows, start named sections). The report updates live behind.

import { useEffect } from "react";
import styles from "./HoursEditor.module.css";
import ScheduleSection from "./sections/ScheduleSection";
import type { ScheduleRow } from "@/lib/reports/condition.types";

interface Props {
  rows: ScheduleRow[];
  loading: boolean;
  showNotes: boolean;
  sectioned: boolean;
  onChange: (rows: ScheduleRow[]) => void;
  onClose: () => void;
}

export default function HoursEditor({ rows, loading, showNotes, sectioned, onChange, onClose }: Props) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  return (
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label="Edit hours">
        <div className={styles.head}>
          <div className={styles.headText}>
            <span className={styles.title}>Edit hours</span>
            <span className={styles.sub}>
              {sectioned
                ? "Change hours or notes, remove rows, or mark a row to start a named section."
                : "Change hours or notes, or remove rows. Turn on “Break into sections” to group them."}
            </span>
          </div>
          <button className={styles.done} onClick={onClose}>
            Done
          </button>
        </div>
        <div className={styles.body}>
          <ScheduleSection rows={rows} isLoading={loading} onChange={onChange} heading="Hours" showNotes={showNotes} sectioned={sectioned} />
        </div>
      </div>
    </div>
  );
}
