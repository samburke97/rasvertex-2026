"use client";
// components/reports/condition/sections/ScheduleSection.tsx

import React, { useState, useCallback } from "react";
import styles from "./ScheduleSection.module.css";
import type { ScheduleRow } from "@/lib/reports/condition.types";
import { formatScheduleDate } from "@/lib/reports/condition.types";

interface ScheduleSectionProps {
  rows: ScheduleRow[];
  isLoading: boolean;
  onChange: (rows: ScheduleRow[]) => void;
}

const ASSOCIATIONS = [
  { src: "/reports/associations/communityselect.png", alt: "Community Select" },
  { src: "/reports/associations/dulux.png", alt: "Dulux" },
  { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
  { src: "/reports/associations/mpa.png", alt: "MPA" },
  { src: "/reports/associations/qbcc.png", alt: "QBCC" },
  { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
];

// Pagination — must match condition.print.ts
const ROWS_PER_FIRST_PAGE = 16;
const ROWS_PER_CONTINUATION = 22;

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  displayValue,
  type = "text",
  onChange,
}: {
  value: string | number;
  displayValue?: string;
  type?: "text" | "number";
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const commit = () => {
    setEditing(false);
    onChange(draft);
  };

  if (editing) {
    return (
      <input
        className={styles.cellInput}
        type={type}
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        step={type === "number" ? "0.25" : undefined}
        min={type === "number" ? "0" : undefined}
      />
    );
  }

  const label =
    displayValue ??
    (type === "number"
      ? Number(value) > 0
        ? Number(value).toFixed(2)
        : "—"
      : String(value) || "—");

  return (
    <span
      className={styles.cellDisplay}
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      title="Click to edit"
    >
      {label}
    </span>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────

function ScheduleFooter() {
  return (
    <div className={styles.footer}>
      {ASSOCIATIONS.map((a) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={a.alt} src={a.src} alt={a.alt} className={styles.assocLogo} />
      ))}
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function ScheduleTable({
  rows,
  showTotals,
  totalHours,
  onUpdate,
  onDelete,
  onAdd,
}: {
  rows: ScheduleRow[];
  showTotals: boolean;
  totalHours: number;
  onUpdate: (id: string, patch: Partial<ScheduleRow>) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
}) {
  return (
    <>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Date</th>
            <th className={styles.th}>Employee</th>
            <th className={styles.thNum}>Hours</th>
            <th className={styles.thAction} />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className={styles.emptyCell}>
                No schedule data — enter a job number to load.
              </td>
            </tr>
          )}
          {rows.map((row) => (
            <tr key={row.id} className={styles.dataRow}>
              <td className={styles.td}>
                {/* Display formatted date to match PDF; edit raw ISO value */}
                <EditableCell
                  value={row.date}
                  displayValue={formatScheduleDate(row.date)}
                  onChange={(v) => onUpdate(row.id, { date: v })}
                />
              </td>
              <td className={styles.td}>
                <EditableCell
                  value={row.employeeName}
                  onChange={(v) => onUpdate(row.id, { employeeName: v })}
                />
              </td>
              <td className={styles.tdNum}>
                <EditableCell
                  value={row.actualHours}
                  type="number"
                  onChange={(v) =>
                    onUpdate(row.id, { actualHours: parseFloat(v) || 0 })
                  }
                />
              </td>
              <td className={styles.tdAction}>
                <button
                  className={styles.deleteBtn}
                  onClick={() => onDelete(row.id)}
                  title="Remove row"
                  aria-label="Remove row"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2 3.5h10M5.5 3.5V2.5a1 1 0 011-1h1a1 1 0 011 1v1M6 6v4M8 6v4M3 3.5l.7 7.3a1 1 0 001 .9h4.6a1 1 0 001-.9L11 3.5"
                      stroke="currentColor"
                      strokeWidth="1.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        {showTotals && rows.length > 0 && (
          <tfoot>
            <tr className={styles.totalsRow}>
              <td className={styles.totalsLabel}>Total</td>
              <td className={styles.td} />
              <td className={styles.totalsCell}>
                {totalHours > 0 ? totalHours.toFixed(2) : "—"}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>
      {onAdd && (
        <button className={styles.addRow} onClick={onAdd}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M6 1v10M1 6h10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Add row
        </button>
      )}
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function ScheduleSection({
  rows,
  isLoading,
  onChange,
}: ScheduleSectionProps) {
  const updateRow = useCallback(
    (id: string, patch: Partial<ScheduleRow>) => {
      onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    },
    [rows, onChange],
  );

  const deleteRow = useCallback(
    (id: string) => {
      onChange(rows.filter((r) => r.id !== id));
    },
    [rows, onChange],
  );

  const addRow = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    const newRow: ScheduleRow = {
      id: `manual_${Date.now()}`,
      employeeId: 0,
      employeeName: "",
      date: today,
      scheduledHours: 0,
      actualHours: 0,
      note: "",
    };
    onChange([...rows, newRow]);
  }, [rows, onChange]);

  const totalHours = rows.reduce((s, r) => s + r.actualHours, 0);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <h1 className={styles.title}>Schedule</h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/link_blue.png"
            alt="rasvertex.com.au"
            className={styles.topBarLink}
          />
        </div>
        <div className={styles.body}>
          <div className={styles.stateWrap}>
            <div className={styles.spinner} />
            <span className={styles.stateText}>
              Loading schedule from SimPRO…
            </span>
          </div>
        </div>
        <ScheduleFooter />
      </div>
    );
  }

  // ── Paginate rows ─────────────────────────────────────────────────────────
  const pages: ScheduleRow[][] = [];
  if (rows.length <= ROWS_PER_FIRST_PAGE) {
    pages.push(rows);
  } else {
    pages.push(rows.slice(0, ROWS_PER_FIRST_PAGE));
    let offset = ROWS_PER_FIRST_PAGE;
    while (offset < rows.length) {
      pages.push(rows.slice(offset, offset + ROWS_PER_CONTINUATION));
      offset += ROWS_PER_CONTINUATION;
    }
  }

  return (
    <>
      {pages.map((pageRows, pageIdx) => {
        const isFirst = pageIdx === 0;
        const isLast = pageIdx === pages.length - 1;

        return (
          <div key={pageIdx} className={styles.page}>
            {isFirst && (
              <div className={styles.topBar}>
                <h1 className={styles.title}>Schedule</h1>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/reports/link_blue.png"
                  alt="rasvertex.com.au"
                  className={styles.topBarLink}
                />
              </div>
            )}

            <div className={styles.body}>
              {isFirst && (
                <div className={styles.heading}>
                  <div className={styles.headingTitle}>Hours Schedule</div>
                  <div className={styles.headingRule} />
                </div>
              )}

              <ScheduleTable
                rows={pageRows}
                showTotals={isLast}
                totalHours={totalHours}
                onUpdate={updateRow}
                onDelete={deleteRow}
                onAdd={isLast ? addRow : undefined}
              />
            </div>

            <ScheduleFooter />
          </div>
        );
      })}
    </>
  );
}
