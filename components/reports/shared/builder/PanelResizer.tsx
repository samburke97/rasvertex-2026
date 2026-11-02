"use client";
// The right-hand editing panel's width: a drag handle on its left edge,
// remembered per builder. Double-click resets it.

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import styles from "./BuilderChrome.module.css";

const MIN = 300;
const MAX = 760;

export function usePanelWidth(storageKey: string, initial = 340) {
  const [w, setW] = useState(initial);
  useEffect(() => {
    const saved = Number(localStorage.getItem(storageKey));
    if (saved >= MIN && saved <= MAX) setW(saved);
  }, [storageKey]);
  const start = (e: ReactPointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = w;
    let last = w0;
    const move = (ev: PointerEvent) => {
      last = Math.max(MIN, Math.min(MAX, w0 + (x0 - ev.clientX)));
      setW(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      localStorage.setItem(storageKey, String(last));
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const reset = () => {
    setW(initial);
    localStorage.setItem(storageKey, String(initial));
  };
  return { w, start, reset };
}

export default function PanelResizer({ panel }: { panel: ReturnType<typeof usePanelWidth> }) {
  return (
    <div
      className={styles.resizer}
      onPointerDown={panel.start}
      onDoubleClick={panel.reset}
      title="Drag to resize the panel. Double-click to reset."
    />
  );
}
