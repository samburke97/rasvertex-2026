"use client";
// Click a page in the preview to bring up its settings, as in the proposal:
// pages carry data-panel="<group>", the side panel's groups carry
// data-panel-group="<group>". The clicked page's group scrolls into view and
// stays marked (data-sel) until another page is clicked. An element that
// also carries data-panel-field="<field>" puts the cursor in the panel's
// matching data-panel-field input.

import { useRef, type MouseEvent } from "react";

export function usePageToPanel() {
  const panelRef = useRef<HTMLDivElement>(null);
  const onDocClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    // Controls on the page (caption inputs, remove buttons) act on their own.
    if (t.closest("input, textarea, button, select, a, [contenteditable]")) return;
    const src = t.closest<HTMLElement>("[data-panel]");
    const group = src?.dataset.panel;
    const field = t.closest<HTMLElement>("[data-panel-field]")?.dataset.panelField;
    const panel = panelRef.current;
    if (!group || !panel) return;
    const el = panel.querySelector<HTMLElement>(`[data-panel-group="${group}"]`);
    if (!el) return;
    panel.querySelectorAll("[data-panel-group][data-sel]").forEach((x) => x.removeAttribute("data-sel"));
    el.setAttribute("data-sel", "1");
    const input = field ? el.querySelector<HTMLElement>(`[data-panel-field="${field}"] :is(input, textarea)`) : null;
    if (input) {
      input.scrollIntoView({ block: "center" });
      input.focus();
    } else el.scrollIntoView({ block: "start" });
  };
  return { panelRef, onDocClick };
}
