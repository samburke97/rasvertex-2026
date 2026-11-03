"use client";
// The first step of a report builder: enter the SimPRO job number. Anything
// to choose first (e.g. building or roof) goes in as children, above the box.

import { useState, type ReactNode } from "react";
import styles from "./JobStart.module.css";

export default function JobStart({
  title,
  sub,
  loading,
  error,
  onLoad,
  action = "Load job",
  children,
}: {
  title: string;
  sub: ReactNode;
  loading?: boolean;
  error?: string | null;
  onLoad: (jobNumber: string) => void;
  action?: string;
  children?: ReactNode;
}) {
  const [job, setJob] = useState("");
  const go = () => job.trim() && !loading && onLoad(job.trim());
  return (
    <div className={styles.start}>
      <h1 className={styles.h1}>{title}</h1>
      <p className={styles.sub}>{sub}</p>
      {children}
      <div className={styles.row}>
        <div className={styles.box}>
          <span className={styles.prefix}>Job #</span>
          <input
            className={styles.input}
            value={job}
            inputMode="numeric"
            autoFocus
            onChange={(e) => setJob(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
          />
        </div>
        <button className={styles.go} onClick={go} disabled={loading || !job.trim()}>
          {loading ? "Loading…" : action}
        </button>
      </div>
      {error && <div className={styles.error}>{error}</div>}
    </div>
  );
}
