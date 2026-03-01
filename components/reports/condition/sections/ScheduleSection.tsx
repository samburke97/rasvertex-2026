"use client";
// components/reports/condition/sections/ScheduleSection.tsx

import React, { useState, useCallback } from "react";
import styles from "./ScheduleSection.module.css";
import type { ScheduleRow } from "@/lib/reports/condition.types";

interface ScheduleSectionProps {
  rows: ScheduleRow[];
  isLoading: boolean;
  onChange: (rows: ScheduleRow[]) => void;
}

// Association logos — identical to SummarySection / CoverSection
const ASSOCIATIONS = [
  { src: "/reports/associations/communityselect.png", alt: "Community Select" },
  { src: "/reports/associations/dulux.png", alt: "Dulux" },
  { src: "/reports/associations/haymes.svg", alt: "Haymes Paint" },
  { src: "/reports/associations/mpa.png", alt: "MPA" },
  { src: "/reports/associations/qbcc.png", alt: "QBCC" },
  { src: "/reports/associations/smartstrata.png", alt: "Smart Strata" },
];

// ── Editable cell (local — no shared component needed) ───────────────────────

function EditableCell({
  value,
  type = "text",
  onChange,
}: {
  value: string | number;
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

  return (
    <span
      className={styles.cellDisplay}
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      title="Click to edit"
    >
      {type === "number"
        ? Number(value) > 0
          ? Number(value).toFixed(2)
          : "—"
        : value || "—"}
    </span>
  );
}

// ── Totals row ────────────────────────────────────────────────────────────────

function TotalsRow({ rows }: { rows: ScheduleRow[] }) {
  const totalScheduled = rows.reduce((s, r) => s + r.scheduledHours, 0);
  const totalActual = rows.reduce((s, r) => s + r.actualHours, 0);
  return (
    <tr className={styles.totalsRow}>
      <td colSpan={2} className={styles.totalsLabel}>
        Totals
      </td>
      <td className={styles.totalsCell}>
        {totalScheduled > 0 ? totalScheduled.toFixed(2) : "—"}
      </td>
      <td className={styles.totalsCell}>
        {totalActual > 0 ? totalActual.toFixed(2) : "—"}
      </td>
      <td />
      <td />
    </tr>
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

  // ── Loading state ───────────────────────────────────────────────────────
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
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Top bar: SCHEDULE left, link_blue right ── */}
      <div className={styles.topBar}>
        <h1 className={styles.title}>Schedule</h1>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/reports/link_blue.png"
          alt="rasvertex.com.au"
          className={styles.topBarLink}
        />
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* Section heading with rule */}
        <div className={styles.heading}>
          <div className={styles.headingTitle}>Hours Schedule</div>
          <div className={styles.headingRule} />
        </div>

        {/* Table */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>Employee</th>
                <th className={styles.thNum}>Scheduled Hrs</th>
                <th className={styles.thNum}>Actual Hrs</th>
                <th className={styles.th}>Note</th>
                <th className={styles.thAction} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className={styles.emptyCell}>
                    No schedule data — enter a job number to load, or add rows
                    manually.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className={styles.dataRow}>
                  <td className={styles.td}>
                    <EditableCell
                      value={row.date}
                      onChange={(v) => updateRow(row.id, { date: v })}
                    />
                  </td>
                  <td className={styles.td}>
                    <EditableCell
                      value={row.employeeName}
                      onChange={(v) => updateRow(row.id, { employeeName: v })}
                    />
                  </td>
                  <td className={styles.tdNum}>
                    <EditableCell
                      value={row.scheduledHours}
                      type="number"
                      onChange={(v) =>
                        updateRow(row.id, {
                          scheduledHours: parseFloat(v) || 0,
                        })
                      }
                    />
                  </td>
                  <td className={styles.tdNum}>
                    <EditableCell
                      value={row.actualHours}
                      type="number"
                      onChange={(v) =>
                        updateRow(row.id, { actualHours: parseFloat(v) || 0 })
                      }
                    />
                  </td>
                  <td className={styles.tdNote}>
                    <EditableCell
                      value={row.note}
                      onChange={(v) => updateRow(row.id, { note: v })}
                    />
                  </td>
                  <td className={styles.tdAction}>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => deleteRow(row.id)}
                      title="Remove row"
                      aria-label="Remove row"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                      >
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
            {rows.length > 0 && (
              <tfoot>
                <TotalsRow rows={rows} />
              </tfoot>
            )}
          </table>
        </div>

        {/* Add row */}
        <button className={styles.addRow} onClick={addRow}>
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
      </div>

      {/* ── Footer: association logos ── */}
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
  );
}
