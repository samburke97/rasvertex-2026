"use client";
// components/reports/shared/builder/PhotoPickerModal.tsx
//
// Choosing photos in a pop-up, for every report builder: optional folder
// chips, then a grid. One photo (click uses it) or several (click adds or
// removes, numbered in the order chosen). Esc or the backdrop closes it.
// Same shell as CropModal.

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./PhotoPickerModal.module.css";

export interface PickerPhoto {
  id: string;
  src: string;
  title?: string;
  /** Shows a × to delete it (e.g. an upload). */
  removable?: boolean;
}

export interface PickerFilter {
  id: string;
  name: string;
  /** Not loaded or switched off: drawn dashed. */
  off?: boolean;
  /** A small dot before the name (e.g. a SimPRO folder). */
  dot?: boolean;
  hint?: string;
}

export default function PhotoPickerModal({
  title,
  subtitle,
  photos,
  selected,
  multi = false,
  onPick,
  onClose,
  filters,
  activeFilter,
  onFilter,
  headAction,
  onRemove,
  empty = "No photos here.",
}: {
  title: string;
  subtitle?: string;
  photos: PickerPhoto[];
  /** Chosen photo ids; with multi, in the order chosen. */
  selected: string[];
  multi?: boolean;
  /** Single: use this photo. Multi: add or remove it. */
  onPick: (id: string) => void;
  onClose: () => void;
  filters?: PickerFilter[];
  activeFilter?: string;
  onFilter?: (id: string) => void;
  /** Beside the title, e.g. "Reload from SimPRO". */
  headAction?: ReactNode;
  onRemove?: (id: string) => void;
  empty?: string;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className={styles.back} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-label={title}>
        <div className={styles.head}>
          <div>
            <b>{title}</b>
            {subtitle && <small>{subtitle}</small>}
          </div>
          {headAction}
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {filters && filters.length > 0 && (
          <div className={styles.chips}>
            {filters.map((f) => (
              <button
                key={f.id}
                className={`${styles.filter} ${activeFilter === f.id ? styles.filterOn : ""} ${f.off ? styles.filterOff : ""}`}
                title={f.hint}
                onClick={() => onFilter?.(f.id)}
              >
                {f.dot && <span className={styles.dot} />}
                {f.name}
              </button>
            ))}
          </div>
        )}
        <div className={styles.body}>
          {photos.length ? (
            <div className={styles.grid}>
              {photos.map((p) => {
                const at = selected.indexOf(p.id);
                return (
                  <div
                    key={p.id}
                    className={`${styles.cell} ${at >= 0 ? styles.cellOn : ""}`}
                    style={{ backgroundImage: `url("${p.src}")` }}
                    title={p.title}
                    onClick={() => onPick(p.id)}
                  >
                    {multi && at >= 0 && <span className={styles.no}>{at + 1}</span>}
                    {p.removable && onRemove && (
                      <button
                        className={styles.remove}
                        title="Delete this photo"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(p.id);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <span className={styles.empty}>{empty}</span>
          )}
        </div>
        {multi && (
          <div className={styles.foot}>
            <span>{selected.length ? `${selected.length} chosen, in the order shown` : "Click photos to add them"}</span>
            <button className={styles.done} onClick={onClose}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
