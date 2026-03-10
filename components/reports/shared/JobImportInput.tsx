"use client";
// components/reports/shared/JobImportInput.tsx
// Job number input + Load button + status message.
// Used in all three report options panels.

import React, { useState } from "react";
import styles from "./JobImportInput.module.css";

interface ImportStatus {
  phase: string;
  message?: string;
}

interface JobImportInputProps {
  onImport: (jobNumber: string) => void;
  importStatus: ImportStatus;
  placeholder?: string;
}

export default function JobImportInput({
  onImport,
  importStatus,
  placeholder = "Job number",
}: JobImportInputProps) {
  const [jobNumber, setJobNumber] = useState("");

  const isLoading =
    importStatus.phase === "fetching-job" ||
    importStatus.phase === "fetching-schedule";

  const handleSubmit = () => {
    if (jobNumber.trim()) onImport(jobNumber.trim());
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <input
          type="text"
          className={styles.input}
          placeholder={placeholder}
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
          {isLoading ? "…" : "Load"}
        </button>
      </div>
      {importStatus.phase === "error" && (
        <p className={styles.error}>
          {importStatus.message ?? "Failed to load job."}
        </p>
      )}
      {importStatus.phase === "done" && (
        <p className={styles.success}>✓ Schedule loaded</p>
      )}
    </div>
  );
}
