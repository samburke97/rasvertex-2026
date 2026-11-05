"use client";
// The first step of a report builder: enter the SimPRO job (or, with
// quotes, quote) number. Anything to choose first (e.g. building or roof)
// goes in as children, above the box.

import { useState, type ReactNode } from "react";
import styles from "./JobStart.module.css";

export type SimproSource = "job" | "quote";

/** The SimPRO API route for a job or a quote. */
export const simproBase = (source: SimproSource | undefined, id: string) =>
  source === "quote" ? `/api/simpro/quotes/${id}` : `/api/simpro/jobs/${id}`;

/** A job or quote as the builders load it (EnrichedJob). */
export const simproRecordUrl = (source: SimproSource | undefined, id: string) =>
  source === "quote" ? `/api/simpro/quotes/${id}?as=job` : `/api/simpro/jobs/${id}`;

export default function JobStart({
  title,
  sub,
  loading,
  error,
  onLoad,
  action = "Load job",
  children,
  quotes,
}: {
  title: string;
  sub: ReactNode;
  loading?: boolean;
  error?: string | null;
  onLoad: (number: string, source: SimproSource) => void;
  action?: string;
  children?: ReactNode;
  /** Offer a Job / Quote switch. */
  quotes?: boolean;
}) {
  const [job, setJob] = useState("");
  const [source, setSource] = useState<SimproSource>("job");
  const go = () => job.trim() && !loading && onLoad(job.trim().replace(/^[#QJ]/i, ""), source);
  return (
    <div className={styles.start}>
      <h1 className={styles.h1}>{title}</h1>
      <p className={styles.sub}>{sub}</p>
      {children}
      {quotes && (
        <div className={styles.source} role="radiogroup" aria-label="Load from">
          {(["job", "quote"] as const).map((k) => (
            <button key={k} role="radio" aria-checked={source === k} className={source === k ? styles.sourceOn : ""} onClick={() => setSource(k)}>
              {k === "job" ? "Job" : "Quote"}
            </button>
          ))}
        </div>
      )}
      <div className={styles.row}>
        <div className={styles.box}>
          <span className={styles.prefix}>{source === "quote" ? "Quote #" : "Job #"}</span>
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
