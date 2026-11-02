"use client";
// The findings editors shared by the proposal and the inspection reports:
// the grid of photos on the page (click to edit, drag to reorder), the tray
// of photos left off it (click to add), and the code chips.

import { useState, type ReactNode } from "react";
import styles from "./PhotoGrid.module.css";

/** Long grids show this many, then a "Show all" card. */
const COLLAPSED = 3;

const bg = (url: string) => ({ backgroundImage: url ? `url("${url}")` : "none" });

export interface GridItem {
  id: string;
  src: string;
  title: string;
}

export function PhotoGrid({
  items,
  onOpen,
  onMove,
  children,
}: {
  items: GridItem[];
  onOpen: (index: number) => void;
  onMove: (from: number, to: number) => void;
  /** Extra cells after the photos, e.g. Add. */
  children?: ReactNode;
}) {
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  const { shown, toggle, open } = useCollapse(items);
  return (
    <div className={styles.fgrid}>
      {shown.map((it, i) => (
        <button
          key={it.id}
          className={`${styles.fcell} ${drag?.from === i ? styles.fcellDragging : ""} ${drag && drag.over === i && drag.from !== i ? (drag.from < i ? styles.fcellDropAfter : styles.fcellDropBefore) : ""}`}
          style={bg(it.src)}
          title={it.title}
          onClick={() => onOpen(i)}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            setDrag({ from: i, over: i });
          }}
          onDragOver={(e) => {
            if (!drag) return;
            e.preventDefault();
            if (drag.over !== i) setDrag({ ...drag, over: i });
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (drag && drag.from !== i) onMove(drag.from, i);
            setDrag(null);
          }}
          onDragEnd={() => setDrag(null)}
        >
          <span className={styles.fnum}>{i + 1}</span>
        </button>
      ))}
      {toggle}
      {open && children}
    </div>
  );
}

/** Up to COLLAPSED items and a card to expand; short lists show in full. */
function useCollapse<T>(items: T[]) {
  const [all, setAll] = useState(false);
  const long = items.length > COLLAPSED + 1;
  const open = all || !long;
  return {
    open,
    shown: open ? items : items.slice(0, COLLAPSED),
    toggle: long ? (
      <button className={`${styles.fcell} ${styles.fadd} ${styles.fmore}`} onClick={() => setAll(!all)}>
        {all ? "Show less" : `Show all ${items.length}`}
      </button>
    ) : null,
  };
}

/** The "add a blank photo" cell at the end of a PhotoGrid. */
export function AddCell({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <button className={`${styles.fcell} ${styles.fadd}`} title={title} onClick={onClick}>
      +
    </button>
  );
}

export function PhotoTray({ items, onAdd }: { items: GridItem[]; onAdd: (index: number) => void }) {
  const { shown, toggle } = useCollapse(items);
  return (
    <div className={styles.fgrid}>
      {shown.map((it, i) => (
        <button key={it.id} className={`${styles.fcell} ${styles.fcellAdd}`} style={bg(it.src)} title={it.title} onClick={() => onAdd(i)}>
          <span className={styles.fplus}>+</span>
        </button>
      ))}
      {toggle}
    </div>
  );
}

export interface CodeOption {
  code: string;
  name: string;
  bg: string;
  fg: string;
}

/** Tap every defect in the photo; a selected chip takes its severity colour. */
export function CodeChips({ codes, on, onToggle }: { codes: CodeOption[]; on: string[]; onToggle: (code: string) => void }) {
  return (
    <div className={styles.codeGrid}>
      {codes.map((c) => {
        const sel = on.includes(c.code);
        return (
          <button
            key={c.code}
            className={`${styles.codeChip} ${sel ? styles.codeChipOn : ""}`}
            style={sel ? { background: c.bg, color: c.fg, borderColor: "transparent" } : undefined}
            title={c.name}
            onClick={() => onToggle(c.code)}
          >
            {c.code}
          </button>
        );
      })}
    </div>
  );
}
