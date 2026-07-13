"use client";
// components/reports/condition/sections/ScheduleSection.tsx

import React, { useState, useCallback } from "react";
import styles from "./ScheduleSection.module.css";
import type { ScheduleRow } from "@/lib/reports/condition.types";
import { formatScheduleDate } from "@/lib/reports/condition.types";
import { ASSOCIATIONS } from "@/lib/reports/constants";

interface ScheduleSectionProps {
  rows: ScheduleRow[];
  isLoading: boolean;
  onChange: (rows: ScheduleRow[]) => void;
  /** Optional custom heading. When provided, replaces "Hours Schedule" text
   *  and the extending rule is hidden. Used by the Hours Breakdown report. */
  heading?: string;
  /** Show the optional Notes column (e.g. photo reference, work location). */
  showNotes?: boolean;
  /** Break the table into named sections (per-row toggle) with per-section subtotals. */
  sectioned?: boolean;
}

// Pagination — must match condition.print.ts
const ROWS_PER_FIRST_PAGE = 25;
const ROWS_PER_CONTINUATION = 28;

// Rows are taller when the Notes column is active (room to write on the
// printed page), so fewer of them fit per page — must match condition.print.ts
const ROWS_PER_FIRST_PAGE_NOTES = 18;
const ROWS_PER_CONTINUATION_NOTES = 20;

const DEFAULT_SECTION_TITLE = "New Section";

// ── Section items ────────────────────────────────────────────────────────────
// When sectioned, the flat row list is expanded into header/row/subtotal
// items so pagination, rendering and print output can all walk one sequence.

type ScheduleItem =
  | { kind: "header"; sectionId: string; title: string; synthetic: boolean }
  | { kind: "row"; row: ScheduleRow }
  | { kind: "subtotal"; sectionId: string; title: string; hours: number };

const DEFAULT_LEADING_SECTION_TITLE = "Section 1";

// Once any row has a named break, every row must belong to a named section —
// including the rows before the first break. Those get an auto-named header
// (editable, but not removable on its own — it only disappears once every
// explicit break elsewhere is removed too).
function buildScheduleItems(
  rows: ScheduleRow[],
  sectioned: boolean,
): ScheduleItem[] {
  if (!sectioned) return rows.map((row) => ({ kind: "row", row }));

  const hasAnyBreak = rows.some((r) => r.sectionTitle);

  const items: ScheduleItem[] = [];
  let sectionId: string | null = null;
  let title = "";
  let hours = 0;
  let inSection = false;

  const flush = () => {
    if (inSection) {
      items.push({ kind: "subtotal", sectionId: sectionId!, title, hours });
    }
  };

  rows.forEach((row, idx) => {
    const isImplicitLeadingHeader =
      idx === 0 && hasAnyBreak && !row.sectionTitle;

    if (row.sectionTitle || isImplicitLeadingHeader) {
      flush();
      sectionId = row.id;
      title = row.sectionTitle || DEFAULT_LEADING_SECTION_TITLE;
      hours = 0;
      inSection = true;
      items.push({
        kind: "header",
        sectionId: row.id,
        title,
        synthetic: isImplicitLeadingHeader,
      });
    }
    items.push({ kind: "row", row });
    if (inSection) hours += row.actualHours;
  });
  flush();
  return items;
}

// Groups items into pages of `perFirst` / `perCont` slots. Header/row/subtotal
// items all count as one slot (they render at the same row height). Every new
// section starts on a fresh page (unless it's already the first item on one).
function paginateScheduleItems(
  items: ScheduleItem[],
  perFirst: number,
  perCont: number,
): ScheduleItem[][] {
  const pages: ScheduleItem[][] = [];
  let current: ScheduleItem[] = [];
  let limit = perFirst;

  for (const item of items) {
    const startsNewSection = item.kind === "header" && current.length > 0;
    if (current.length >= limit || startsNewSection) {
      pages.push(current);
      current = [];
      limit = perCont;
    }
    current.push(item);
  }
  pages.push(current);
  return pages;
}

// ── Editable cell ─────────────────────────────────────────────────────────────

function EditableCell({
  value,
  displayValue,
  type = "text",
  onChange,
  displayClassName,
  inputClassName,
}: {
  value: string | number;
  displayValue?: string;
  type?: "text" | "number";
  onChange: (v: string) => void;
  displayClassName?: string;
  inputClassName?: string;
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
        className={inputClassName ?? styles.cellInput}
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
      className={displayClassName ?? styles.cellDisplay}
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

// ── Section header row ──────────────────────────────────────────────────────

function SectionHeaderRow({
  title,
  colCount,
  synthetic,
  onRename,
  onRemove,
}: {
  title: string;
  colCount: number;
  synthetic: boolean;
  onRename: (v: string) => void;
  onRemove: () => void;
}) {
  return (
    <tr className={styles.sectionRow}>
      <td className={styles.sectionCell} colSpan={colCount}>
        <EditableCell
          value={title}
          displayValue={title || "Untitled section"}
          onChange={onRename}
          displayClassName={styles.sectionCellDisplay}
          inputClassName={styles.sectionCellInput}
        />
        {!synthetic && (
          <button
            className={styles.sectionRemoveBtn}
            onClick={onRemove}
            title="Remove section break"
            aria-label="Remove section break"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
              <path
                d="M2.5 2.5l7 7M9.5 2.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </td>
    </tr>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function ScheduleTable({
  items,
  showTotals,
  showNotes,
  sectioned,
  totalHours,
  onUpdate,
  onDelete,
  onAdd,
  onToggleSection,
  onRenameSection,
}: {
  items: ScheduleItem[];
  showTotals: boolean;
  showNotes: boolean;
  sectioned: boolean;
  totalHours: number;
  onUpdate: (id: string, patch: Partial<ScheduleRow>) => void;
  onDelete: (id: string) => void;
  onAdd?: () => void;
  onToggleSection: (id: string, current: string | undefined) => void;
  onRenameSection: (id: string, title: string) => void;
}) {
  const colCount = showNotes ? 5 : 4;
  const actionThClass = sectioned ? styles.thActionWide : styles.thAction;
  const actionTdClass = sectioned ? styles.tdActionWide : styles.tdAction;
  // Without a Notes column to soak up the remaining width, Date/Employee/Hours
  // get wider shares so Hours doesn't get stranded far from Employee.
  const thEvenClass = showNotes ? styles.thEven : styles.thEvenWide;
  const tdEvenClass = showNotes ? styles.tdEven : styles.tdEvenWide;
  const thNumClass = showNotes ? styles.thNum : styles.thNumWide;
  const tdNumClass = showNotes ? styles.tdNum : styles.tdNumWide;

  // Rows that currently start a section — including the synthetic leading
  // one, which can only be renamed (not removed) while it's implicit.
  const sectionStarts = new Map<string, boolean>();
  for (const item of items) {
    if (item.kind === "header") sectionStarts.set(item.sectionId, item.synthetic);
  }

  return (
    <>
      <table
        className={`${styles.table} ${showNotes ? styles.tableTall : ""}`}
      >
        <thead>
          <tr>
            <th className={thEvenClass}>Date</th>
            <th className={thEvenClass}>Employee</th>
            <th className={thNumClass}>Hours</th>
            {showNotes && <th className={styles.thNote}>Notes</th>}
            <th className={actionThClass} />
          </tr>
        </thead>
        <tbody>
          {items.length === 0 && (
            <tr>
              <td colSpan={colCount} className={styles.emptyCell}>
                No schedule data — enter a job number to load.
              </td>
            </tr>
          )}
          {items.map((item) => {
            if (item.kind === "header") {
              return (
                <SectionHeaderRow
                  key={`h-${item.sectionId}`}
                  title={item.title}
                  colCount={colCount}
                  synthetic={item.synthetic}
                  onRename={(v) => onRenameSection(item.sectionId, v)}
                  onRemove={() => onToggleSection(item.sectionId, item.title)}
                />
              );
            }

            if (item.kind === "subtotal") {
              return (
                <tr key={`s-${item.sectionId}`} className={styles.totalsRow}>
                  <td className={styles.totalsLabel}>
                    {(item.title || "Section") + " subtotal"}
                  </td>
                  <td className={styles.td} />
                  <td className={styles.totalsCell}>
                    {item.hours > 0 ? item.hours.toFixed(2) : "—"}
                  </td>
                  {showNotes && <td className={styles.td} />}
                  <td />
                </tr>
              );
            }

            const row = item.row;
            const startsSynthetic = sectionStarts.get(row.id);
            const isSectionStart = startsSynthetic !== undefined;
            const isLockedStart = startsSynthetic === true;
            return (
              <tr key={row.id} className={styles.dataRow}>
                <td className={tdEvenClass}>
                  <EditableCell
                    value={row.date}
                    displayValue={formatScheduleDate(row.date)}
                    onChange={(v) => onUpdate(row.id, { date: v })}
                  />
                </td>
                <td className={tdEvenClass}>
                  <EditableCell
                    value={row.employeeName}
                    onChange={(v) => onUpdate(row.id, { employeeName: v })}
                  />
                </td>
                <td className={tdNumClass}>
                  <EditableCell
                    value={row.actualHours}
                    type="number"
                    onChange={(v) =>
                      onUpdate(row.id, { actualHours: parseFloat(v) || 0 })
                    }
                  />
                </td>
                {showNotes && (
                  <td className={styles.tdNote}>
                    <EditableCell
                      value={row.note}
                      displayValue={row.note}
                      onChange={(v) => onUpdate(row.id, { note: v })}
                    />
                  </td>
                )}
                <td className={actionTdClass}>
                  <div className={styles.actionGroup}>
                    {sectioned && (
                      <button
                        className={`${styles.sectionToggleBtn} ${
                          isSectionStart ? styles.sectionToggleBtnActive : ""
                        }`}
                        onClick={() =>
                          isLockedStart
                            ? undefined
                            : onToggleSection(row.id, row.sectionTitle)
                        }
                        disabled={isLockedStart}
                        title={
                          isLockedStart
                            ? "Every section needs a name while another section break exists"
                            : isSectionStart
                              ? "Remove section break"
                              : "Start a new section here"
                        }
                        aria-label={
                          isLockedStart
                            ? "Every section needs a name while another section break exists"
                            : isSectionStart
                              ? "Remove section break"
                              : "Start a new section here"
                        }
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path
                            d="M3 1v10M3 2h6.5L8 4.5 9.5 7H3"
                            stroke="currentColor"
                            strokeWidth="1.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    )}
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
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        {showTotals && items.length > 0 && (
          <tfoot>
            <tr className={styles.totalsRow}>
              <td className={styles.totalsLabel}>Total</td>
              <td className={styles.td} />
              <td className={styles.totalsCell}>
                {totalHours > 0 ? totalHours.toFixed(2) : "—"}
              </td>
              {showNotes && <td className={styles.td} />}
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
  heading,
  showNotes = false,
  sectioned = false,
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

  const toggleSection = useCallback(
    (id: string, current: string | undefined) => {
      updateRow(id, { sectionTitle: current ? "" : DEFAULT_SECTION_TITLE });
    },
    [updateRow],
  );

  const renameSection = useCallback(
    (id: string, title: string) => {
      updateRow(id, { sectionTitle: title });
    },
    [updateRow],
  );

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

  // ── Build items + paginate ───────────────────────────────────────────────
  const rowsPerFirstPage = showNotes
    ? ROWS_PER_FIRST_PAGE_NOTES
    : ROWS_PER_FIRST_PAGE;
  const rowsPerContinuation = showNotes
    ? ROWS_PER_CONTINUATION_NOTES
    : ROWS_PER_CONTINUATION;

  const items = buildScheduleItems(rows, sectioned);
  const pages = paginateScheduleItems(
    items,
    rowsPerFirstPage,
    rowsPerContinuation,
  );

  return (
    <>
      {pages.map((pageItems, pageIdx) => {
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
                  <div className={styles.headingTitle}>
                    {heading ?? "Hours Schedule"}
                  </div>
                  {/* Only show the extending rule when using the default heading */}
                  {!heading && <div className={styles.headingRule} />}
                </div>
              )}

              <ScheduleTable
                items={pageItems}
                showTotals={isLast}
                showNotes={showNotes}
                sectioned={sectioned}
                totalHours={totalHours}
                onUpdate={updateRow}
                onDelete={deleteRow}
                onAdd={isLast ? addRow : undefined}
                onToggleSection={toggleSection}
                onRenameSection={renameSection}
              />
            </div>

            <ScheduleFooter />
          </div>
        );
      })}
    </>
  );
}
