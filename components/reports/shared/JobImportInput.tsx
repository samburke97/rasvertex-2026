"use client";
// components/reports/shared/JobImportInput.tsx

import React, { useState } from "react";
import styles from "./JobImportInput.module.css";

interface ImportStatus {
  phase: string;
  message?: string;
  loaded?: number;
  total?: number;
}

interface JobImportInputProps {
  /** With quotes, a quote is passed as "Q" + its number. */
  onImport: (jobNumber: string) => void;
  importStatus: ImportStatus;
  placeholder?: string;
  /** Offer a Job / Quote switch. */
  quotes?: boolean;
}

/** "Q11234" → a quote; anything else a job. */
export function readSource(v: string): { source: "job" | "quote"; id: string } {
  const t = v.trim().replace(/^#/, "");
  return /^q/i.test(t) ? { source: "quote", id: t.slice(1).trim() } : { source: "job", id: t.replace(/^j/i, "") };
}

export default function JobImportInput({
  onImport,
  importStatus,
  placeholder = "Job number",
  quotes,
}: JobImportInputProps) {
  const [jobNumber, setJobNumber] = useState("");
  const [source, setSource] = useState<"job" | "quote">("job");

  const isLoading =
    importStatus.phase === "fetching-job" ||
    importStatus.phase === "fetching-schedule" ||
    importStatus.phase === "fetching-photos";

  const isDone = importStatus.phase === "done";
  const isError = importStatus.phase === "error";

  const handleSubmit = () => {
    const id = readSource(jobNumber).id;
    if (id) onImport(source === "quote" || readSource(jobNumber).source === "quote" ? `Q${id}` : id);
  };

  return (
    <div className={styles.wrap}>
      {quotes && (
        <div className={styles.source} role="radiogroup" aria-label="Load from">
          {(["job", "quote"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={source === k} className={source === k ? styles.sourceOn : ""} onClick={() => setSource(k)}>
              {k === "job" ? "Job" : "Quote"}
            </button>
          ))}
        </div>
      )}
      <div className={styles.row}>
        <input
          type="text"
          className={`${styles.input} ${isDone ? styles.inputDone : ""} ${isError ? styles.inputError : ""}`}
          placeholder={quotes && source === "quote" ? "Quote number" : placeholder}
          value={jobNumber}
          onChange={(e) => setJobNumber(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          disabled={isLoading}
        />
        <button
          className={styles.btn}
          onClick={handleSubmit}
          disabled={isLoading || !jobNumber.trim()}
        >
          {isLoading ? <span className={styles.spinner} /> : "Load"}
        </button>
      </div>
    </div>
  );
}
