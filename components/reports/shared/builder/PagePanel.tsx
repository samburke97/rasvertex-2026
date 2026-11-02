"use client";
// Page-by-page editing for the builders whose settings live in one options
// panel (anchor, condition), laid out like the proposal: pages on the left,
// the preview, and on the right only the settings for the selected page.
//
// Sheets carry data-page="<id>"; the panel's groups carry
// data-pages="<id> <id>…" (the pages they edit). Clicking a sheet selects its
// page; an element with data-panel-field="<field>" also puts the cursor in
// the panel's matching data-panel-field input.

import { useRef, useState, type MouseEvent, type ReactNode } from "react";
import styles from "./BuilderChrome.module.css";

export function usePagePanel(initial: string) {
  const [sel, setSel] = useState(initial);
  const panelRef = useRef<HTMLElement>(null);

  const focusField = (field: string) =>
    requestAnimationFrame(() => {
      const input = panelRef.current?.querySelector<HTMLElement>(`[data-panel-field="${field}"] :is(input, textarea, .tiptap)`);
      input?.scrollIntoView({ block: "center" });
      input?.focus();
    });

  const onDocClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement;
    // Controls on the page (caption inputs, remove buttons) act on their own.
    if (t.closest("input, textarea, button, select, a, [contenteditable]")) return;
    const page = t.closest<HTMLElement>("[data-page]")?.dataset.page;
    if (!page) return;
    setSel(page);
    const field = t.closest<HTMLElement>("[data-panel-field]")?.dataset.panelField;
    if (field) focusField(field);
    else if (panelRef.current) panelRef.current.scrollTop = 0;
  };

  /** From the rail: select the page and bring its first sheet into view. */
  const pick = (id: string, preview: HTMLElement | null) => {
    setSel(id);
    preview?.querySelector(`[data-page="${id}"]`)?.scrollIntoView({ block: "start" });
  };

  return { sel, pick, onDocClick, panelRef };
}

/** The right-hand panel: the selected page's name, then its settings only. */
export function SidePanel({
  panel,
  title,
  width,
  children,
}: {
  panel: ReturnType<typeof usePagePanel>;
  title: string;
  width: number;
  children: ReactNode;
}) {
  const { sel } = panel;
  return (
    <aside ref={panel.panelRef} className={styles.side} style={{ width }} data-psel={sel}>
      <style>{`[data-psel="${sel}"] [data-pages]:not([data-pages~="${sel}"]){display:none}`}</style>
      <div className={styles.sideHead}>{title}</div>
      <div className={styles.sideBody}>{children}</div>
    </aside>
  );
}
