"use client";

import React from "react";
import Link from "next/link";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  message: string;
  createNewLink?: string;
  createNewLabel?: string;
  createNewAction?: () => void;
  className?: string;
}

export default function EmptyState({
  message,
  createNewLink,
  createNewLabel = "Create New",
  createNewAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`${styles.emptyState} ${className}`}>
      <span>{message}</span>
      {createNewLink ? (
        <Link
          href={createNewLink}
          className={styles.createNewButton}
          style={{ textDecoration: "none", cursor: "pointer" }}
          target="_blank"
          rel="noopener noreferrer"
        >
          {createNewLabel}
        </Link>
      ) : createNewAction ? (
        <button onClick={createNewAction} className={styles.createNewButton}>
          {createNewLabel}
        </button>
      ) : null}
    </div>
  );
}
