"use client";
// Autosave for every report builder: PATCHes the draft to its route
// (lib/reports/drafts.ts) a moment after each change.
//
// `ready` must stay false while the draft is incomplete: during a load, while
// photos are still importing (they sit on large data: URLs until uploaded),
// or while a refresh has blanked part of it. Saving then would write a
// partial draft over the real one, which is how job 10970's condition
// report draft was lost.

import { useEffect, useRef, useState } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error" | "too-large";

const RETRY_MS = 5000;

export function useDraftAutosave(
  url: string | null,
  data: unknown,
  { ready, delay = 1500, onSaved }: { ready: boolean; delay?: number; onSaved?: () => void },
) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const statusRef = useRef(status);
  statusRef.current = status;
  const onSavedRef = useRef(onSaved);
  onSavedRef.current = onSaved;

  useEffect(() => {
    if (!url || !ready) return;
    const failed = statusRef.current === "error" || statusRef.current === "too-large";
    const timer = setTimeout(
      async () => {
        setStatus("saving");
        try {
          const res = await fetch(url, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          if (res.ok) onSavedRef.current?.();
          // 413: this draft can never save as-is (too many photos), so it's
          // shown as its own status rather than retried as an error.
          setStatus(res.ok ? "saved" : res.status === 413 ? "too-large" : "error");
        } catch {
          setStatus("error");
        }
      },
      failed ? RETRY_MS : delay,
    );
    return () => clearTimeout(timer);
  }, [url, data, ready, delay]);

  return { status, setStatus };
}
