"use client";
// components/ui/ErrorState.tsx
//
// Shared fallback UI for segment-level error.tsx boundaries — rendered
// inside MainLayout's <main>, so the sidebar/nav stay usable while this
// shows. Keeps a broken report page (say) from taking the whole app down.

import { useEffect } from "react";
import styles from "./ErrorState.module.css";

interface ErrorStateProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** What to call the thing that broke, e.g. "reports" — used in copy only. */
  area?: string;
}

export default function ErrorState({ error, reset, area }: ErrorStateProps) {
  useEffect(() => {
    console.error(`[ErrorBoundary${area ? `:${area}` : ""}]`, error);
  }, [error, area]);

  return (
    <div className={styles.wrap}>
      <div className={styles.icon}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 9v4M12 17h.01M10.29 3.86l-8.18 14.18A2 2 0 004.18 21h15.64a2 2 0 001.87-2.96L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
      </div>
      <h2 className={styles.title}>
        {area ? `This ${area} page hit an error` : "Something went wrong"}
      </h2>
      <p className={styles.subtitle}>
        Nothing else is affected — try again, or head back and re-open it.
      </p>
      <button className={styles.retryBtn} onClick={reset}>
        Try again
      </button>
    </div>
  );
}
