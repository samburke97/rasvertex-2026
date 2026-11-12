// components/reports/week-schedule/WeekScheduleDocument.tsx
//
// The Weekly schedule as landscape A4 pages (1810 × 1280 page units), in the
// reports' design (the Anchor report's stylesheet). Rendered in the builder,
// scaled to the preview, and on the server for the PDF
// (app/api/reports/export-week-schedule-pdf), so it holds no state or hooks.

import type { CSSProperties } from "react";
import { ANCHOR_CSS } from "@/components/reports/anchor-inspection/AnchorDocument";
import { MAX_DAY_JOBS, rangeTitle, refText, WEEK_PAGE_H, WEEK_PAGE_W, type WeekModel, type WeekRun } from "@/lib/reports/weekSchedule";

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
/* Jobs starting (scoped .jb): the overview table after the schedule. */
.ws .jb .ar-page{padding:80px 96px 0}
.jb-top{display:flex;align-items:flex-start;justify-content:space-between;gap:40px}
.jb-top .ar-logo{height:58px;width:auto;display:block;margin-top:6px}
.jb-lede{font-size:20px;line-height:1.6;color:var(--ink-65);margin:12px 0 40px}
.jb-gap{height:40px}
.jb-cols{grid-template-columns:200px 120px 300px 440px minmax(0,1fr);column-gap:24px}
.jb .ar-tr{font-size:18px;line-height:1.3}
.jb .ar-tr:last-child{border-bottom:0}
.jb-tr{height:52px}
.jb-tr span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.jb-tr--day{border-top:var(--rule-head)}
.jb-day{font-weight:600}
.jb-day em{font-style:normal;font-weight:400;color:var(--ink-45);margin-left:8px}
.jb-no{font-family:var(--bebas);font-size:22px;letter-spacing:.04em;color:var(--ink-45)}
.jb-site{font-weight:600}
.jb-addr{color:var(--ink-65)}
.jb-foot{bottom:52px}
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
.ws-edit .ws-name{position:relative;display:flex;align-items:center;gap:8px;padding-right:30px}
.ws-name span{min-width:0;overflow:hidden;text-overflow:ellipsis}
.ws-name .ws-x{position:static;flex-shrink:0;margin-left:auto}
.ws-name:hover .ws-x{opacity:1}
.ws-part{cursor:pointer;border-radius:4px}
.ws-part:hover{text-decoration:underline;text-underline-offset:3px}
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
  /** Takes a person's row off the schedule. */
  onRemoveRow: (staffId: number) => void;
}

export const pickKey = (p: WeekPick) => `${p.staffId}|${p.days[0]}|${p.item}`;

const pad = (n: number) => String(n).padStart(2, "0");

/** A run of days: one bar. A day with two jobs reads "A / B" (more: "+2"),
 *  coloured as its first; in the builder each name is picked on its own. */
function Run({ run, refs, staffId, isos, edit }: { run: WeekRun; refs: boolean; staffId: number; isos: string[]; edit?: WeekEditView }) {
  const days = isos.slice(run.start, run.start + run.span);
  const first = run.items[0];
  const shown = run.items.slice(0, MAX_DAY_JOBS);
  const more = run.items.length - shown.length;
  const picks = run.items.map((_, i): WeekPick => ({ staffId, days, item: i }));
  const on = picks.some((p) => edit?.selected === pickKey(p));
  const allRefs = [...new Set(run.items.flatMap((it) => it.refs))];
  return (
    <div className="ws-run" style={{ gridColumn: `${run.start + 2} / span ${run.span}` }}>
      <div
        className={`ws-bar${first.leave && !first.flag ? " ws-bar--off" : ""}${on ? " is-on" : ""}`}
        style={first.tone ? { background: first.tone } : undefined}
        onClick={edit ? (e) => edit.onPick(picks[0], e.currentTarget) : undefined}
        title={edit ? "Click to edit" : run.items.length > 1 ? run.items.map((it) => it.label).join(" / ") : undefined}
      >
        <span>
          {shown.map((it, i) => (
            <span
              key={i}
              className={edit && run.items.length > 1 ? "ws-part" : undefined}
              onClick={
                edit && run.items.length > 1
                  ? (e) => {
                      e.stopPropagation();
                      edit.onPick(picks[i], e.currentTarget.closest(".ws-bar") as HTMLElement);
                    }
                  : undefined
              }
            >
              {i > 0 && " / "}
              {it.label}
            </span>
          ))}
          {more > 0 && ` +${more}`}
        </span>
        {refs && allRefs.length > 0 && <span className="ws-ref">{refText(allRefs)}</span>}
        {edit && run.edited && <span className="ws-dot" title="Edited here, not in SimPRO" />}
        {/* × only for a single item: on "A / B", pick a name, then Remove. */}
        {edit && run.items.length === 1 && (
          <button
            type="button"
            className="ws-x"
            aria-label="Remove"
            title="Remove"
            onClick={(e) => {
              e.stopPropagation();
              edit.onRemove(picks[0]);
            }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
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
  const total = model.pages.length + model.overview.length;
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
                      {edit ? (
                        <span className="ws-name">
                          <span>{r.name}</span>
                          <button
                            type="button"
                            className="ws-x"
                            aria-label={`Remove ${r.name} from the schedule`}
                            title="Remove from the schedule (switch back on in Team)"
                            onClick={() => edit.onRemoveRow(r.staffId)}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                              <path d="M6 6l12 12M18 6L6 18" />
                            </svg>
                          </button>
                        </span>
                      ) : (
                        <span className="ws-name">{r.name}</span>
                      )}
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
      {model.overview.map((rows, oi) => (
        <div key={`ov${oi}`} className="ar-sheet jb">
          <section className="ar-page">
            <div className="jb-top">
              <h2 className="ar-h2">Jobs starting</h2>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ar-logo" src={logo} alt="RAS-VERTEX Maintenance Solutions" />
            </div>
            {oi === 0 ? (
              <p className="jb-lede">
                {model.overviewCount} job{model.overviewCount === 1 ? "" : "s"} starting {model.title}
              </p>
            ) : (
              <div className="jb-gap" />
            )}
            <div className="ar-table">
              <div className="ar-thead jb-cols">
                <span>Starts</span>
                <span>Job</span>
                <span>Site</span>
                <span>Address</span>
                <span>Work</span>
              </div>
              {rows.map((r, i) => (
                <div key={`${r.iso}-${r.ref}`} className={`ar-tr jb-tr jb-cols${r.first && i > 0 ? " jb-tr--day" : ""}`}>
                  <span className="jb-day">
                    {(r.first || i === 0) && (
                      <>
                        {r.day}
                        <em>{r.date}</em>
                      </>
                    )}
                  </span>
                  <span className="jb-no">
                    {r.quote ? "Q" : "#"}
                    {r.ref}
                  </span>
                  <span className="jb-site">{r.site}</span>
                  <span className="jb-addr">{r.address || "—"}</span>
                  <span>{r.work || "—"}</span>
                </div>
              ))}
            </div>
            <div className="ws-foot jb-foot">
              <span>RAS-VERTEX · Jobs starting · {model.days.length ? rangeTitle(model.days[0].iso, model.days[model.days.length - 1].iso, true) : model.title}</span>
              <span>
                Page {pad(model.pages.length + oi + 1)} / {pad(total)}
              </span>
            </div>
          </section>
        </div>
      ))}
    </div>
  );
}
