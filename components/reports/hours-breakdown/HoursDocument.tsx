// components/reports/hours-breakdown/HoursDocument.tsx
//
// The Hours breakdown report: a title and one-line description, the Job
// overview's hours table, and the company and job number in the footer, on
// 1280 × 1810 pages. The builder previews it (with every cell editable in
// place) and the PDF route prints it.

import { useState } from "react";
import { clock, hourCols } from "@/components/reports/condition/OverviewDocument";
import { formatHours, pad, scheduleDate } from "@/lib/reports/overview.layout";
import { normTime, type HoursModel } from "@/lib/reports/hours.layout";
import type { ScheduleRow } from "@/lib/reports/condition.types";

/** Preview only: editing the rows in place. */
export interface HoursEdit {
  onRow: (id: string, patch: Partial<ScheduleRow>) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

export const HOURS_CSS = `
.hb-foot{position:absolute;left:96px;right:96px;bottom:52px;display:flex;justify-content:space-between;gap:24px;font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
.hb-foot span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hb-edit .ar-tr{position:relative}
.hb-cell{display:block;min-width:0;margin:0 -8px;padding:4px 8px;border-radius:8px;cursor:text;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.hb-cell:hover{background:rgba(62,127,176,.08)}
.hb-cell.ar-r{text-align:right}
.hb-input{width:calc(100% + 16px);margin:0 -8px;padding:4px 8px;font:inherit;color:inherit;letter-spacing:inherit;border:0;border-radius:8px;outline:2px solid #3e7fb0;background:#fff}
.hb-input.ar-r{text-align:right}
.hb-del{position:absolute;right:-56px;top:50%;transform:translateY(-50%);width:40px;height:40px;border:0;border-radius:10px;background:transparent;color:var(--ink-35);font-size:28px;line-height:1;cursor:pointer;opacity:0}
.hb-edit .ar-tr:hover .hb-del{opacity:1}
.hb-del:hover{background:rgba(168,58,58,.1);color:#a83a3a}
.hb-add{margin-top:24px;height:56px;border:2px dashed rgba(23,23,26,.14);border-radius:12px;background:transparent;font:inherit;font-size:20px;color:var(--ink-55);cursor:pointer}
.hb-add:hover{border-color:#3e7fb0;color:#2f6a94}
`;

/** A cell that shows its text and turns into a box when clicked. */
function Cell({ value, show, type = "text", right, onSave }: { value: string; show: string; type?: "text" | "date" | "number"; right?: boolean; onSave?: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  if (!onSave) return <span className={right ? "ar-r" : undefined}>{show}</span>;
  if (!editing)
    return (
      <span className={`hb-cell${right ? " ar-r" : ""}`} title="Click to edit" onClick={() => setEditing(true)}>
        {show || "—"}
      </span>
    );
  const done = (v: string) => {
    setEditing(false);
    if (v !== value) onSave(v);
  };
  return (
    <input
      className={`hb-input${right ? " ar-r" : ""}`}
      type={type}
      step={type === "number" ? "0.25" : undefined}
      autoFocus
      defaultValue={value}
      onBlur={(e) => done(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}

export default function HoursDocument({ model, screen, edit }: { model: HoursModel; screen?: boolean; edit?: HoursEdit }) {
  const { times } = model;
  const cols = hourCols(false, times);
  const n = model.pages.length;
  return (
    <div className={`ar jo${screen ? " ar--screen" : ""}${edit ? " hb-edit" : ""}`}>
      {model.pages.map((items, i) => (
        <div key={i} className="ar-sheet">
          <section className="ar-page">
            {i === 0 && (
              <>
                <h2 className="ar-h2">Hours breakdown</h2>
                <p className="ar-lede" style={{ margin: "20px 0 56px" }}>
                  {model.lede}
                </p>
              </>
            )}
            <div className="ar-table">
              <div className={`ar-thead ${cols}`}>
                <span>Date</span>
                <span>Team member</span>
                {times && (
                  <>
                    <span>Start</span>
                    <span>Finish</span>
                  </>
                )}
                <span className="ar-r">Hours</span>
              </div>
              {items.map((it, j) =>
                it.kind === "row" ? (
                  <div key={it.id} className={`ar-tr jo-tr ${cols}`}>
                    <Cell value={it.date} show={scheduleDate(it.date)} type="date" onSave={edit && ((v) => v && edit.onRow(it.id, { date: v }))} />
                    <Cell value={it.name} show={it.name} onSave={edit && ((v) => edit.onRow(it.id, { employeeName: v.trim() }))} />
                    {times && (
                      <>
                        <Cell value={it.start} show={clock(it.start)} onSave={edit && ((v) => edit.onRow(it.id, { start: normTime(v) }))} />
                        <Cell value={it.finish} show={clock(it.finish)} onSave={edit && ((v) => edit.onRow(it.id, { finish: normTime(v) }))} />
                      </>
                    )}
                    <Cell
                      right
                      type="number"
                      value={String(it.hours || "")}
                      show={it.hours > 0 ? formatHours(it.hours) : "—"}
                      onSave={edit && ((v) => edit.onRow(it.id, { actualHours: Math.max(0, parseFloat(v) || 0) }))}
                    />
                    {edit && (
                      <button type="button" className="hb-del" title="Remove row" aria-label="Remove row" onClick={() => edit.onRemove(it.id)}>
                        ×
                      </button>
                    )}
                  </div>
                ) : it.kind === "total" ? (
                  <div key={`t${j}`} className={`ar-tr jo-total ${cols}`}>
                    <span>Total hours</span>
                    <span />
                    {times && (
                      <>
                        <span />
                        <span />
                      </>
                    )}
                    <span className="ar-r">{formatHours(it.hours)}</span>
                  </div>
                ) : null,
              )}
            </div>
            {edit && i === n - 1 && (
              <button type="button" className="hb-add" onClick={edit.onAdd}>
                + Add row
              </button>
            )}
            <div className="hb-foot">
              <span>{model.foot}</span>
              <span>
                Page {pad(i + 1)} / {pad(n)}
              </span>
            </div>
          </section>
        </div>
      ))}
    </div>
  );
}
