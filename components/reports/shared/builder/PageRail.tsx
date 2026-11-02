"use client";
// The pages rail shared by the report builders: one row per page or
// section, click to edit it, the eye to leave it out, and (where the report
// allows) drag to reorder. Collapses to a thin strip.

import { useRef, useState } from "react";
import styles from "./BuilderChrome.module.css";

export interface RailRow {
  id: string;
  name: string;
  /** Page number, or a short mark ("C" for the cover). Blank when hidden. */
  num?: string;
  /** Left out of the report (the eye is crossed). */
  hidden?: boolean;
  /** Greyed with no eye: nothing to show, e.g. no zones for a site map. */
  absent?: boolean;
  /** Can be left out. */
  hideable?: boolean;
  /** Standard page: shows a lock. */
  locked?: boolean;
  /** Can't be dragged. */
  fixed?: boolean;
  /** Tooltip for the row. */
  title?: string;
}

interface Props {
  rows: RailRow[];
  sel: string;
  onPick: (id: string) => void;
  onToggle?: (id: string) => void;
  /** Drag to reorder; leave out where the order is fixed. */
  onReorder?: (from: string, to: string, after: boolean) => void;
}

export default function PageRail({ rows, sel, onPick, onToggle, onReorder }: Props) {
  const [open, setOpen] = useState(true);
  const drag = useRef<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; after: boolean } | null>(null);

  if (!open)
    return (
      <aside className={styles.railClosed}>
        <button className={styles.iconBtn} title="Show pages" onClick={() => setOpen(true)}>
          <RailIcon expand />
        </button>
      </aside>
    );

  return (
    <aside className={styles.rail}>
      <div className={styles.railHead}>
        <span>Pages</span>
        <button className={styles.iconBtn} title="Hide pages" onClick={() => setOpen(false)}>
          <RailIcon />
        </button>
      </div>
      <div className={styles.railList}>
        {rows.map((r) => {
          const off = r.hidden || r.absent;
          const draggable = !!onReorder && !r.fixed;
          const cls = [
            styles.row,
            sel === r.id ? styles.rowSel : "",
            off ? styles.rowHidden : "",
            drop?.id === r.id ? (drop.after ? styles.dropAfter : styles.dropBefore) : "",
          ].join(" ");
          return (
            <div
              key={r.id}
              className={cls}
              title={r.title}
              draggable={draggable}
              onClick={() => onPick(r.id)}
              onDragStart={(e) => {
                if (!draggable) return e.preventDefault();
                drag.current = r.id;
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", r.id);
              }}
              onDragOver={(e) => {
                if (!drag.current || r.fixed) return;
                e.preventDefault();
                const box = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > box.top + box.height / 2;
                if (drop?.id !== r.id || drop.after !== after) setDrop({ id: r.id, after });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag.current && onReorder) onReorder(drag.current, r.id, drop?.after ?? false);
                drag.current = null;
                setDrop(null);
              }}
              onDragEnd={() => {
                drag.current = null;
                setDrop(null);
              }}
            >
              <span className={styles.rowNum}>{off ? "" : (r.num ?? "")}</span>
              <span className={styles.rowName}>{r.name}</span>
              {r.locked && (
                <span className={styles.lock} title="Standard page">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </span>
              )}
              {r.hideable && !r.absent && onToggle && (
                <button
                  className={styles.eye}
                  title={r.hidden ? "Show page" : "Hide page"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggle(r.id);
                  }}
                >
                  <EyeIcon off={r.hidden} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

function RailIcon({ expand }: { expand?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15" />
      <path d={expand ? "m12.5 9.5 2.5 2.5-2.5 2.5" : "m15.5 9.5-2.5 2.5 2.5 2.5"} />
    </svg>
  );
}

export function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
