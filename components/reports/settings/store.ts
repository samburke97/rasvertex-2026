// components/reports/settings/store.ts
//
// The settings being edited: loaded once, every change saved shortly after
// (as Caro and the report drafts do). A rejected save keeps the edit on
// screen and says why.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createContext, useContext } from "react";
import { defaultSettings } from "@/lib/reports/settings/defaults";
import type { ReportSettings } from "@/lib/reports/settings/types";

export type SaveState =
  | { phase: "loading" }
  | { phase: "saved" }
  | { phase: "saving" }
  | { phase: "locked" }
  | { phase: "error"; message: string; problems?: string[] };

const PASS_KEY = "rv-report-settings-passcode";

export function useSettingsStore() {
  const [s, setS] = useState<ReportSettings>(defaultSettings);
  const [save, setSave] = useState<SaveState>({ phase: "loading" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(s);

  useEffect(() => {
    let live = true;
    fetch("/api/reports/settings")
      .then((r) => r.json())
      .then((d) => {
        if (!live) return;
        if (d?.settings) {
          setS(d.settings);
          latest.current = d.settings;
        }
        setSave(d?.error ? { phase: "error", message: d.error } : { phase: "saved" });
      })
      .catch(() => live && setSave({ phase: "error", message: "Couldn't load the settings" }));
    return () => {
      live = false;
    };
  }, []);

  const push = useCallback(async () => {
    setSave({ phase: "saving" });
    try {
      const res = await fetch("/api/reports/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Settings-Passcode": sessionStorage.getItem(PASS_KEY) ?? "" },
        body: JSON.stringify({ settings: latest.current }),
      });
      if (res.status === 403) return setSave({ phase: "locked" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setSave({ phase: "error", message: d.error ?? "Couldn't save", problems: d.problems });
      setSave({ phase: "saved" });
    } catch {
      setSave({ phase: "error", message: "Couldn't save. Check your connection." });
    }
  }, []);

  /** Change the settings; saved after a short pause. */
  const set = useCallback(
    (fn: (prev: ReportSettings) => ReportSettings) => {
      setS((prev) => {
        const next = fn(prev);
        latest.current = next;
        return next;
      });
      setSave({ phase: "saving" });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(push, 700);
    },
    [push],
  );

  const unlock = useCallback(
    (code: string) => {
      sessionStorage.setItem(PASS_KEY, code);
      push();
    },
    [push],
  );

  return { s, set, save, unlock, loaded: save.phase !== "loading" };
}

export type SettingsStore = ReturnType<typeof useSettingsStore>;

export const SettingsCtx = createContext<SettingsStore | null>(null);

export function useSettings(): SettingsStore {
  const c = useContext(SettingsCtx);
  if (!c) throw new Error("useSettings outside SettingsCtx");
  return c;
}

/** Hash routes: #codes, #tags, #severity, #anchors, #types, #types/roof/tiled. */
export const go = (hash: string) => {
  window.location.hash = hash;
};
