// lib/reports/settings/useReportSettings.ts
//
// The current report settings in the browser, for starting a report. Falls
// back to the defaults if they can't be loaded, so a report can always start.

"use client";

import { useEffect, useState } from "react";
import { defaultSettings } from "./defaults";
import type { ReportSettings } from "./types";

let cache: ReportSettings | null = null;

export function useReportSettings(): ReportSettings {
  const [s, setS] = useState<ReportSettings>(() => cache ?? defaultSettings());
  useEffect(() => {
    let live = true;
    fetch("/api/reports/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live && d?.settings) {
          cache = d.settings;
          setS(d.settings);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return s;
}

/** Fetch once, outside React (export routes don't need it: drafts carry a snapshot). */
export async function fetchReportSettings(): Promise<ReportSettings> {
  try {
    const r = await fetch("/api/reports/settings");
    const d = r.ok ? await r.json() : null;
    return d?.settings ?? defaultSettings();
  } catch {
    return defaultSettings();
  }
}
