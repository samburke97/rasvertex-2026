"use client";
// components/ui/DatePicker.tsx
//
// Custom calendar dropdown — replaces native <input type="date">, whose
// popup calendar is rendered by the OS/browser and can't be restyled by
// any website's CSS. This one is fully on-brand.

import React, { useEffect, useRef, useState } from "react";
import styles from "./DatePicker.module.css";

interface DatePickerProps {
  /** ISO "YYYY-MM-DD", or null for no selection. */
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
}

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date | null {
  const parts = s.split("-").map(Number);
  const [y, m, d] = parts;
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  return isNaN(date.getTime()) ? null : date;
}

function formatDisplay(s: string): string {
  const d = parseISO(s);
  if (!d) return "";
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DatePicker({
  value,
  onChange,
  placeholder = "Select date",
  className = "",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selectedDate = value ? parseISO(value) : null;
  const [viewMonth, setViewMonth] = useState(() => selectedDate ?? new Date());
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setViewMonth(selectedDate ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  // getDay() is Sun=0..Sat=6 — shift so Mon=0..Sun=6 (AU/ISO week start).
  const startWeekday = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO = toISO(new Date());

  const cells: (number | null)[] = [
    ...Array(startWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const selectDay = (day: number) => {
    onChange(toISO(new Date(year, month, day)));
    setOpen(false);
  };

  return (
    <div className={`${styles.wrap} ${className}`} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className={styles.triggerIcon}
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="3" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className={value ? styles.triggerValue : styles.triggerPlaceholder}>
          {value ? formatDisplay(value) : placeholder}
        </span>
      </button>

      {open && (
        <div className={styles.popover}>
          <div className={styles.header}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Previous month"
              onClick={() => setViewMonth(new Date(year, month - 1, 1))}
            >
              ‹
            </button>
            <span className={styles.monthLabel}>
              {MONTH_NAMES[month]} {year}
            </span>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Next month"
              onClick={() => setViewMonth(new Date(year, month + 1, 1))}
            >
              ›
            </button>
          </div>

          <div className={styles.weekdays}>
            {WEEKDAYS.map((w, i) => (
              <span key={i} className={styles.weekday}>
                {w}
              </span>
            ))}
          </div>

          <div className={styles.grid}>
            {cells.map((day, i) => {
              if (day === null) return <span key={i} className={styles.empty} />;
              const cellISO = toISO(new Date(year, month, day));
              const isSelected = value === cellISO;
              const isToday = cellISO === todayISO;
              return (
                <button
                  key={i}
                  type="button"
                  className={`${styles.day} ${isToday ? styles.dayToday : ""} ${isSelected ? styles.daySelected : ""}`}
                  onClick={() => selectDay(day)}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {value && (
            <button
              type="button"
              className={styles.clearBtn}
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  );
}
