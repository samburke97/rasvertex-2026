"use client";

import React from "react";
import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
  steps: string[];
  currentStep: number;
}

export default function ProgressBar({ steps, currentStep }: ProgressBarProps) {
  return (
    <div className={styles.progressBarContainer}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div
            key={index}
            className={`${styles.step} ${isActive ? styles.active : ""} ${
              isCompleted ? styles.completed : ""
            }`}
          >
            <div
              className={`${styles.bar} ${
                isActive || isCompleted ? styles.activeBar : ""
              }`}
            />
          </div>
        );
      })}
    </div>
  );
}
