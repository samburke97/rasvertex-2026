"use client";
// components/reports/hours-breakdown/sections/HoursBreakdownSection.tsx
//
// Same layout as ScheduleSection but:
//   - Page title is "HOURS BREAKDOWN"
//   - No "HOURS SCHEDULE" subheading or the extending rule
//   - Heading is just the plain Bebas Neue title, flush left

import React, { useState, useCallback } from "react";
import styles from "./HoursBreakdownSection.module.css";
import type { ScheduleRow } from "@/lib/reports/condition.types";
import { formatScheduleDate } from "@/lib/reports/condition.types";

interface Props {
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
    <span className={styles.cellDisplay} onClick={() => setEditing(true)}>
      {label}
    </span>
  );
}

// ── Table component ───────────────────────────────────────────────────────────

function BreakdownTable({
  rows,
  onDelete,
  onEdit,
  isFirstPage,
}: {
  rows: ScheduleRow[];
  onDelete: (id: string) => void;
  onEdit: (id: string, field: keyof ScheduleRow, value: string) => void;
  isFirstPage: boolean;
}) {
  const totalHours = rows.reduce((sum, r) => sum + (r.actualHours || 0), 0);

  return (
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
        {rows.length === 0 ? (
          <tr>
            <td className={styles.emptyCell} colSpan={4}>
              No rows — add rows below or import a job
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.id} className={styles.dataRow}>
              <td className={styles.td}>
                <EditableCell
                  value={row.date}
                  displayValue={formatScheduleDate(row.date)}
                  onChange={(v) => onEdit(row.id, "date", v)}
                />
              </td>
              <td className={styles.td}>
                <EditableCell
                  value={row.employeeName}
                  onChange={(v) => onEdit(row.id, "employeeName", v)}
                />
              </td>
              <td className={styles.tdNum}>
                <EditableCell
                  value={row.actualHours}
                  type="number"
                  onChange={(v) => onEdit(row.id, "actualHours", v)}
                />
              </td>
              <td className={styles.tdAction}>
                <button
                  className={styles.deleteBtn}
                  onClick={() => onDelete(row.id)}
                  title="Remove row"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4h6v2" />
                  </svg>
                </button>
              </td>
            </tr>
          ))
        )}
      </tbody>
      {isFirstPage && rows.length > 0 && (
        <tfoot>
          <tr className={styles.totalsRow}>
            <td className={styles.totalsLabel} colSpan={2}>
              Total
            </td>
            <td className={styles.totalsCell}>{totalHours.toFixed(2)}</td>
            <td />
          </tr>
        </tfoot>
      )}
    </table>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HoursBreakdownSection({
  rows,
  isLoading,
  onChange,
}: Props) {
  const addRow = useCallback(() => {
    const newRow: ScheduleRow = {
      id: Math.random().toString(36).slice(2, 9),
      employeeId: 0,
      employeeName: "",
      date: new Date().toISOString().slice(0, 10),
      scheduledHours: 0,
      actualHours: 0,
      note: "",
    };
    onChange([...rows, newRow]);
  }, [rows, onChange]);

  const deleteRow = useCallback(
    (id: string) => onChange(rows.filter((r) => r.id !== id)),
    [rows, onChange],
  );

  const editRow = useCallback(
    (id: string, field: keyof ScheduleRow, value: string) => {
      onChange(
        rows.map((r) =>
          r.id !== id
            ? r
            : {
                ...r,
                [field]:
                  field === "actualHours" || field === "scheduledHours"
                    ? parseFloat(value) || 0
                    : value,
              },
        ),
      );
    },
    [rows, onChange],
  );

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.title}>Hours Breakdown</div>
        </div>
        <div className={styles.body}>
          <p className={styles.loading}>Loading schedule data…</p>
        </div>
      </div>
    );
  }

  // Paginate
  const firstPage = rows.slice(0, ROWS_PER_FIRST_PAGE);
  const rest = rows.slice(ROWS_PER_FIRST_PAGE);
  const continuationPages: ScheduleRow[][] = [];
  for (let i = 0; i < rest.length; i += ROWS_PER_CONTINUATION) {
    continuationPages.push(rest.slice(i, i + ROWS_PER_CONTINUATION));
  }

  return (
    <>
      {/* ── First page ── */}
      <div className={styles.page}>
        <div className={styles.topBar}>
          <div className={styles.title}>Hours Breakdown</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/reports/link_blue.png"
            alt="rasvertex.com.au"
            className={styles.topBarLink}
          />
        </div>
        <div className={styles.body}>
          <div className={styles.tableWrap}>
            <BreakdownTable
              rows={firstPage}
              onDelete={deleteRow}
              onEdit={editRow}
              isFirstPage={true}
            />
            {rows.length <= ROWS_PER_FIRST_PAGE && (
              <button className={styles.addRow} onClick={addRow}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add row
              </button>
            )}
          </div>
        </div>
        <div className={styles.footer}>
          {ASSOCIATIONS.map((a) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={a.alt}
              src={a.src}
              alt={a.alt}
              className={styles.assocLogo}
            />
          ))}
        </div>
      </div>

      {/* ── Continuation pages ── */}
      {continuationPages.map((pageRows, idx) => (
        <div key={idx} className={styles.page}>
          <div className={styles.body} style={{ paddingTop: "2.75rem" }}>
            <div className={styles.tableWrap}>
              <BreakdownTable
                rows={pageRows}
                onDelete={deleteRow}
                onEdit={editRow}
                isFirstPage={false}
              />
              {idx === continuationPages.length - 1 && (
                <button className={styles.addRow} onClick={addRow}>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add row
                </button>
              )}
            </div>
          </div>
          <div className={styles.footer}>
            {ASSOCIATIONS.map((a) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={a.alt}
                src={a.src}
                alt={a.alt}
                className={styles.assocLogo}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
