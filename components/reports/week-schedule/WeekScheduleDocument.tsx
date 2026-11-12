// components/reports/week-schedule/WeekScheduleDocument.tsx
//
// The Weekly schedule as landscape A4 pages (1810 × 1280 page units), in the
// reports' design (the Anchor report's stylesheet). Rendered in the builder,
// scaled to the preview, and on the server for the PDF
// (app/api/reports/export-week-schedule-pdf), so it holds no state or hooks.

import type { CSSProperties } from "react";
import { ANCHOR_CSS } from "@/components/reports/anchor-inspection/AnchorDocument";
import { refText, WEEK_PAGE_H, WEEK_PAGE_W, type WeekModel, type WeekRun } from "@/lib/reports/weekSchedule";

export const WEEK_CSS =
  ANCHOR_CSS +
  `
.ws .ar-sheet{width:${WEEK_PAGE_W}px;height:${WEEK_PAGE_H}px}
.ws .ar-page{width:${WEEK_PAGE_W}px;height:${WEEK_PAGE_H}px;padding:64px 96px 0}
.ws-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:40px}
.ws-top .ar-logo{height:40px}
.ws-kicker{font-family:var(--bebas);font-size:20px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
.ws-head{display:flex;align-items:baseline;justify-content:space-between;gap:48px;margin-bottom:36px}
.ws-head .ar-h2{font-size:44px}
.ws-cols{grid-template-columns:230px repeat(var(--days),minmax(0,1fr));column-gap:12px}
.ws-thead{align-items:end}
.ws-thead b{display:block;font-size:18px;font-weight:600;letter-spacing:-.02em;text-transform:none;color:var(--navy);margin-top:4px}
.ws-tr{min-height:38px;padding:5px 0;align-items:center}
.ws-tr>*{grid-row:1}
.ws-name{grid-column:1;font-size:18px;font-weight:500;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ws-run{display:flex;flex-direction:column;gap:4px;min-width:0}
.ws-bar{display:flex;align-items:center;gap:10px;min-width:0;height:28px;padding:0 12px;border-radius:8px;background:var(--grey);font-size:16px;font-weight:500;letter-spacing:-.01em;line-height:1}
.ws-bar span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-ref{flex-shrink:0;margin-left:auto;font-size:13px;font-weight:400;color:var(--ink-45);font-variant-numeric:tabular-nums}
.ws-bar--off{background:none;box-shadow:inset 0 0 0 1px rgba(1,25,85,.12);padding:0 12px;font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-35)}
.ws--compact .ws-tr{min-height:32px;padding:3px 0}
.ws--compact .ws-run{gap:2px}
.ws--compact .ws-bar{height:24px;font-size:15px}
.ws--compact .ws-empty{height:24px}
.ws-foot{position:absolute;left:96px;right:96px;bottom:40px;display:flex;justify-content:space-between;gap:24px;font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
`;

/** Builder only: picking, removing and adding bars. Never in the PDF. */
export const WEEK_EDIT_CSS = `
.ws-edit .ws-bar{position:relative;cursor:pointer}
.ws-edit .ws-bar:hover{box-shadow:0 0 0 2px rgba(1,25,85,.18)}
.ws-edit .ws-bar.is-on{box-shadow:0 0 0 2px #3e7fb0}
.ws-edit .ws-bar--off.is-on,.ws-edit .ws-bar--off:hover{box-shadow:inset 0 0 0 1px rgba(1,25,85,.12),0 0 0 2px #3e7fb0}
.ws-x{position:absolute;right:-9px;top:-9px;width:22px;height:22px;border:0;border-radius:50%;background:#fff;color:var(--navy);box-shadow:0 1px 5px rgba(1,25,85,.3);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 100ms}
.ws-bar:hover .ws-x,.ws-bar.is-on .ws-x{opacity:1}
.ws-x:hover{color:#a83a3a}
.ws-dot{flex-shrink:0;width:7px;height:7px;border-radius:50%;background:#3e7fb0}
.ws-empty{grid-row:1;height:28px;border:0;border-radius:8px;background:none;cursor:pointer;color:transparent;font-size:18px;line-height:1}
.ws-empty:hover,.ws-empty.is-on{background:rgba(1,25,85,.04);color:var(--ink-35);box-shadow:inset 0 0 0 1px rgba(1,25,85,.12)}
.ws-empty.is-cleared{display:flex;align-items:center;gap:8px;padding:0 12px;border:1px dashed rgba(1,25,85,.25);color:var(--ink-35);font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase}
.ws-empty.is-cleared:hover,.ws-empty.is-cleared.is-on{border-color:#3e7fb0;box-shadow:none}
`;

/** What the builder needs to know about a click. */
export interface WeekPick {
  staffId: number;
  /** The days the bar covers (one, for an empty cell). */
  days: string[];
  /** Which item of the day (a split day has two); -1 for an empty cell. */
  item: number;
}

export interface WeekEditView {
  /** WeekPick key of the selected bar or cell (pickKey). */
  selected: string | null;
  onPick: (p: WeekPick, el: HTMLElement) => void;
  onRemove: (p: WeekPick) => void;
}

export const pickKey = (p: WeekPick) => `${p.staffId}|${p.days[0]}|${p.item}`;

const pad = (n: number) => String(n).padStart(2, "0");

function Run({ run, refs, staffId, isos, edit }: { run: WeekRun; refs: boolean; staffId: number; isos: string[]; edit?: WeekEditView }) {
  const days = isos.slice(run.start, run.start + run.span);
  return (
    <div className="ws-run" style={{ gridColumn: `${run.start + 2} / span ${run.span}` }}>
      {run.items.map((it, i) => {
        const pick: WeekPick = { staffId, days, item: i };
        const on = edit?.selected === pickKey(pick);
        return (
          <div
            key={i}
            className={`ws-bar${it.leave && !it.flag ? " ws-bar--off" : ""}${on ? " is-on" : ""}`}
            style={it.tone ? { background: it.tone } : undefined}
            onClick={edit ? (e) => edit.onPick(pick, e.currentTarget) : undefined}
            title={edit ? "Click to edit" : undefined}
          >
            <span>{it.label}</span>
            {refs && it.refs.length > 0 && <span className="ws-ref">{refText(it.refs)}</span>}
            {edit && run.edited && <span className="ws-dot" title="Edited here, not in SimPRO" />}
            {edit && (
              <button
                type="button"
                className="ws-x"
                aria-label="Remove"
                title="Remove"
                onClick={(e) => {
                  e.stopPropagation();
                  edit.onRemove(pick);
                }}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function WeekScheduleDocument({
  model,
  logo,
  screen,
  edit,
}: {
  model: WeekModel;
  logo: string;
  screen?: boolean;
  /** Builder only. */
  edit?: WeekEditView;
}) {
  const total = model.pages.length;
  return (
    <div className={`ar ws${model.compact ? " ws--compact" : ""}${screen ? " ar--screen" : ""}${edit ? " ws-edit" : ""}`}>
      {model.pages.map((page, pi) => {
        const cols = { "--days": page.days.length } as CSSProperties;
        const isos = page.days.map((d) => d.iso);
        return (
          <div key={pi} className="ar-sheet">
            <section className="ar-page">
              <div className="ws-top">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="ar-logo" src={logo} alt="RAS-VERTEX" />
                <span className="ws-kicker">Weekly schedule</span>
              </div>
              {page.first && (
                <div className="ws-head">
                  <h2 className="ar-h2">{model.title}</h2>
                  <span className="ar-label">{model.lede}</span>
                </div>
              )}
              <div className="ar-table">
                <div className="ar-thead ws-thead ws-cols" style={cols}>
                  <span>Team member</span>
                  {page.days.map((d) => (
                    <span key={d.iso}>
                      {d.day}
                      <b>{d.date}</b>
                    </span>
                  ))}
                </div>
                {page.rows.map(({ row: r, runs }) => {
                  const covered = new Set(runs.flatMap((run) => Array.from({ length: run.span }, (_, k) => run.start + k)));
                  return (
                    <div key={r.n} className="ar-tr ws-tr ws-cols" style={cols}>
                      <span className="ws-name">{r.name}</span>
                      {runs.map((run) => (
                        <Run key={run.start} run={run} refs={model.opts.refs} staffId={r.staffId} isos={isos} edit={edit} />
                      ))}
                      {edit &&
                        isos.map((d, i) => {
                          if (covered.has(i)) return null;
                          const pick: WeekPick = { staffId: r.staffId, days: [d], item: -1 };
                          // Emptied here (SimPRO has something that day): say so.
                          const cleared = r.edited[page.offset + i];
                          return (
                            <button
                              key={d}
                              type="button"
                              className={`ws-empty${cleared ? " is-cleared" : ""}${edit.selected === pickKey(pick) ? " is-on" : ""}`}
                              style={{ gridColumn: i + 2 }}
                              title={cleared ? "Removed in this report. Click to put SimPRO's back, or fill it." : "Add an entry"}
                              onClick={(e) => edit.onPick(pick, e.currentTarget)}
                            >
                              {cleared ? (
                                <>
                                  <span className="ws-dot" />
                                  Removed
                                </>
                              ) : (
                                "+"
                              )}
                            </button>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
              <div className="ws-foot">
                <span>RAS-VERTEX</span>
                <span>
                  Page {pad(pi + 1)} / {pad(total)}
                </span>
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
