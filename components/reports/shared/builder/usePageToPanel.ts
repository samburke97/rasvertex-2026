"use client";
// Click a page in the preview to bring up its settings, as in the proposal:
// pages carry data-panel="<group>", the side panel's groups carry
// data-panel-group="<group>". The clicked page's group scrolls into view and
// stays marked (data-sel) until another page is clicked.

import { useRef, type MouseEvent } from "react";

export function usePageToPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const onDocClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    // Controls on the page (caption inputs, remove buttons) act on their own.
    if (t.closest("input, textarea, button, select, a, [contenteditable]")) return;
    const group = t.closest<HTMLElement>("[data-panel]")?.dataset.panel;
    const panel = panelRef.current;
    if (!group || !panel) return;
    const el = panel.querySelector<HTMLElement>(`[data-panel-group="${group}"]`);
    if (!el) return;
    panel.querySelectorAll("[data-panel-group][data-sel]").forEach((x) => x.removeAttribute("data-sel"));
    el.setAttribute("data-sel", "1");
    el.scrollIntoView({ block: "start" });
  };
  return { panelRef, onDocClick };
}
