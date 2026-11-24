"use client";
// components/reports/shared/builder/PhotoPickerModal.tsx
//
// Choosing photos in a pop-up, for every report builder: optional filter
// chips, a chip per SimPRO folder when the photos span several, then a grid. One photo (click uses it) or several (click adds or
// removes, numbered in the order chosen). A search box narrows the photos
// by file name. Esc or the backdrop closes it.
// Same shell as CropModal.

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./PhotoPickerModal.module.css";
import SearchBox, { matches } from "./SearchBox";

export interface PickerPhoto {
  id: string;
  src: string;
  title?: string;
  /** Shows a × to delete it (e.g. an upload). */
  removable?: boolean;
  /** Its SimPRO folder: with photos in two or more, the picker offers a
   *  chip per folder to browse by. */
  folder?: string | null;
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

/** A button beside the title (headAction): Upload, Reload from SimPRO… */
export function PickerAction({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={styles.action} {...props}>
      {children}
    </button>
  );
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
  numbered = true,
  foot,
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
  /** Multi: number the chosen photos in the order chosen. */
  numbered?: boolean;
  /** Multi: the footer's note, in place of the count. */
  foot?: string;
}) {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  // Folders, in the order they first appear; "" = no folder (uploads).
  const folders = [...new Set(photos.map((p) => p.folder ?? ""))];
  const byFolder = folders.length > 1;
  const [folder, setFolder] = useState<string | null>(null);
  const inFolder = byFolder && folder !== null ? photos.filter((p) => (p.folder ?? "") === folder) : photos;
  const shown = words.length ? inFolder.filter((p) => matches(p.title ?? "", query)) : inFolder;
  const count = (f: string) => photos.filter((p) => (p.folder ?? "") === f).length;

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
        <SearchBox autoFocus value={query} onChange={setQuery} placeholder="Search by file name" />
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
        {byFolder && (
          <div className={styles.chips}>
            <button className={`${styles.filter} ${folder === null ? styles.filterOn : ""}`} onClick={() => setFolder(null)}>
              All folders · {photos.length}
            </button>
            {folders.map((f) => (
              <button key={f} className={`${styles.filter} ${folder === f ? styles.filterOn : ""}`} onClick={() => setFolder(f)}>
                <span className={styles.dot} />
                {f || "No folder"} · {count(f)}
              </button>
            ))}
          </div>
        )}
        <div className={styles.body}>
          {shown.length ? (
            <div className={styles.grid}>
              {shown.map((p) => {
                const at = selected.indexOf(p.id);
                return (
                  <div
                    key={p.id}
                    className={`${styles.cell} ${at >= 0 ? styles.cellOn : ""}`}
                    style={{ backgroundImage: `url("${p.src}")` }}
                    title={p.title}
                    onClick={() => onPick(p.id)}
                  >
                    {multi && numbered && at >= 0 && <span className={styles.no}>{at + 1}</span>}
                    {multi && !numbered && at >= 0 && <span className={styles.tick}>✓</span>}
                    {p.title && <span className={`${styles.name} ${words.length ? styles.nameOn : ""}`}>{p.title}</span>}
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
            <span className={styles.empty}>{photos.length && words.length ? `No photos named “${query.trim()}”.` : empty}</span>
          )}
        </div>
        {multi && (
          <div className={styles.foot}>
            <span>{foot ?? (selected.length ? `${selected.length} chosen, in the order shown` : "Click photos to add them")}</span>
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
