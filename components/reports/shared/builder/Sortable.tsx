"use client";
// components/reports/shared/builder/Sortable.tsx
//
// Drag to reorder, for every list in the report builders: a row is dragged
// by its grip (so its fields stay usable), and a line shows where it lands.
//
//   const sort = useSortable((from, to) => set(moveItem(items, from, to)));
//   <div {...sort.row(i)} className={sort.cls(i)}><Grip {...sort.grip(i)} />…</div>

import { useState, type DragEvent } from "react";
import styles from "./Sortable.module.css";

/** A copy of the list with one item moved. */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

export function useSortable(onMove: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<{ i: number; after: boolean } | null>(null);
  const end = () => {
    setDrag(null);
    setOver(null);
  };
  return {
    dragging: drag,
    /** Spread on the grip: starts the drag, with the whole row as its image. */
    grip: (i: number) => ({
      draggable: true,
      onDragStart: (e: DragEvent<HTMLElement>) => {
        setDrag(i);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(i));
        const row = e.currentTarget.closest("[data-sort-row]");
        if (row) e.dataTransfer.setDragImage(row, 16, 18);
      },
      onDragEnd: end,
    }),
    /** Spread on the row: where the dragged one would land. */
    row: (i: number) => ({
      "data-sort-row": "",
      onDragOver: (e: DragEvent<HTMLElement>) => {
        if (drag == null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const r = e.currentTarget.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        if (over?.i !== i || over.after !== after) setOver({ i, after });
      },
      onDrop: (e: DragEvent<HTMLElement>) => {
        e.preventDefault();
        if (drag != null && over) {
          let to = over.i + (over.after ? 1 : 0);
          if (to > drag) to--;
          if (to !== drag) onMove(drag, to);
        }
        end();
      },
    }),
    /** The row's class while dragging: faded, or a line above or below. */
    cls: (i: number) =>
      [
        styles.row,
        drag === i ? styles.dragging : "",
        drag != null && over?.i === i ? (over.after ? styles.dropAfter : styles.dropBefore) : "",
      ].join(" "),
  };
}

/** The ⋮⋮ handle a row is dragged by. */
export function Grip(props: ReturnType<ReturnType<typeof useSortable>["grip"]>) {
  return (
    <span className={styles.grip} title="Drag to reorder" aria-label="Drag to reorder" {...props}>
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor" aria-hidden="true">
        <circle cx="2.5" cy="3" r="1.4" />
        <circle cx="7.5" cy="3" r="1.4" />
        <circle cx="2.5" cy="8" r="1.4" />
        <circle cx="7.5" cy="8" r="1.4" />
        <circle cx="2.5" cy="13" r="1.4" />
        <circle cx="7.5" cy="13" r="1.4" />
      </svg>
    </span>
  );
}
