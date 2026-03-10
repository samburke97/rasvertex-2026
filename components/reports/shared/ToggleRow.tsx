"use client";
// components/reports/shared/ToggleRow.tsx
// Reusable toggle switch row used in all report options panels.

import React, { useId } from "react";
import styles from "./ToggleRow.module.css";

interface ToggleRowProps {
  label: string;
  sub?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

export default function ToggleRow({
  label,
  sub,
  checked,
  onChange,
  disabled = false,
}: ToggleRowProps) {
  const id = useId();
  return (
    <div className={`${styles.row} ${disabled ? styles.rowDisabled : ""}`}>
      <div className={styles.text}>
        <span className={styles.label}>{label}</span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </div>
      <label className={styles.toggle}>
        <input
          id={id}
          type="checkbox"
          className={styles.input}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={styles.track} />
        <span className={styles.thumb} />
      </label>
    </div>
  );
}
