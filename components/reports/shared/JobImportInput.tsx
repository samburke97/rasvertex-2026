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
    importStatus.phase === "fetching-schedule" ||
    importStatus.phase === "fetching-photos";

  const isDone = importStatus.phase === "done";
  const isError = importStatus.phase === "error";

  const handleSubmit = () => {
    if (jobNumber.trim()) onImport(jobNumber.trim());
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.row}>
        <input
          type="text"
          className={`${styles.input} ${isDone ? styles.inputDone : ""} ${isError ? styles.inputError : ""}`}
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
          {isLoading ? <span className={styles.spinner} /> : "Load"}
        </button>
      </div>
    </div>
  );
}
