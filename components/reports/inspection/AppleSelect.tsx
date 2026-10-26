"use client";
// components/reports/inspection/AppleSelect.tsx
// macOS-style pop-up button: shows the current choice with an up/down
// chevron; opens a frosted menu with a checkmark beside the selected item
// and a blue highlight that follows the pointer or arrow keys.

import { useEffect, useRef, useState } from "react";
import styles from "./AppleSelect.module.css";

export interface AppleOption {
  value: string;
  label: string;
  detail?: string;
}

interface Props {
  value: string;
  options: AppleOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function AppleSelect({ value, options, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    setHi(Math.max(0, options.findIndex((o) => o.value === value)));
    const close = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open, options, value]);

  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") setHi((h) => Math.min(options.length - 1, h + 1));
    else if (e.key === "ArrowUp") setHi((h) => Math.max(0, h - 1));
    else if (e.key === "Enter" || e.key === " ") pick(options[hi].value);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={root} className={styles.wrap}>
      <button
        type="button"
        className={`${styles.button} ${open ? styles.buttonOpen : ""}`}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={styles.value}>
          {current?.label}
          {current?.detail && <span className={styles.detail}>{current.detail}</span>}
        </span>
        <svg className={styles.chevron} width="10" height="14" viewBox="0 0 10 14" fill="none">
          <path d="M2 5l3-3 3 3M2 9l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className={styles.menu} role="listbox">
          {options.map((o, i) => (
            <div
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              className={`${styles.item} ${i === hi ? styles.itemHi : ""}`}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.value)}
            >
              <span className={styles.check}>
                {o.value === value && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6.5l2.5 2.5L10 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className={styles.itemLabel}>{o.label}</span>
              {o.detail && <span className={styles.itemDetail}>{o.detail}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
