"use client";
// The items a builder page holds (a Job overview's variations, findings),
// one row each: number, title and a line of detail. Clicking a row opens
// that item's own editor in the panel (ItemBack returns to the list).
// Clicking the item on the page does the same (PagePanel: data-item).

import styles from "./ItemList.module.css";

export interface ListItem {
  id: string;
  title: string;
  /** Shown when the title is empty, e.g. "Variation 2". */
  fallback: string;
  /** Under the title: hours, photos, "Left off the report". */
  meta?: string;
  /** Faded: left off the report. */
  muted?: boolean;
}

export default function ItemList({ items, onOpen }: { items: ListItem[]; onOpen: (id: string) => void }) {
  return (
    <div className={styles.list}>
      {items.map((it, i) => (
        <button key={it.id} className={`${styles.item} ${it.muted ? styles.muted : ""}`} onClick={() => onOpen(it.id)}>
          <span className={styles.no}>{String(i + 1).padStart(2, "0")}</span>
          <span className={styles.text}>
            <span className={`${styles.title} ${it.title.trim() ? "" : styles.untitled}`}>{it.title.trim() || it.fallback}</span>
            {it.meta && <span className={styles.meta}>{it.meta}</span>}
          </span>
          <svg className={styles.chev} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </button>
      ))}
    </div>
  );
}

/** Above an item's editor: back to the page's list. */
export function ItemBack({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className={styles.back} onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="m15 6-6 6 6 6" />
      </svg>
      {label}
    </button>
  );
}
