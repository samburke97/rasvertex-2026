"use client";

import React, { useState } from "react";
import styles from "./ImportStep.module.css";
import Button from "@/components/ui/Button";
import type { ImportStatus } from "@/lib/reports/condition.types";

interface ImportStepProps {
  onImport: (jobNumber: string) => void;
  onSkip: () => void;
  status: ImportStatus;
}

export default function ImportStep({
  onImport,
  onSkip,
  status,
}: ImportStepProps) {
  const [jobNumber, setJobNumber] = useState("");

  const isLoading =
    status.phase === "fetching-job" || status.phase === "fetching-photos";

  const buttonLabel = () => {
    if (status.phase === "fetching-job") return "Loading job…";
    if (status.phase === "fetching-photos") {
      return `${status.loaded} / ${status.total} photos`;
    }
    return "Generate Report";
  };

  const handleSubmit = () => {
    if (jobNumber.trim()) onImport(jobNumber.trim());
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <label className={styles.label}>SimPRO Job Number</label>
        <div className={styles.row}>
          <input
            type="text"
            placeholder="e.g. 10737"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            className={styles.input}
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !jobNumber.trim()}
            variant="primary"
          >
            {buttonLabel()}
          </Button>
        </div>

        {status.phase === "fetching-photos" && (
          <div className={styles.progressWrap}>
            <div
              className={styles.progressBar}
              style={{
                width: `${status.total > 0 ? Math.round((status.loaded / status.total) * 100) : 0}%`,
              }}
            />
          </div>
        )}

        {status.phase === "error" && (
          <p className={styles.error}>{status.message}</p>
        )}
      </div>

      <p className={styles.skip}>
        No job number?{" "}
        <button className={styles.skipBtn} onClick={onSkip}>
          Start with a blank report
        </button>
      </p>
    </div>
  );
}
