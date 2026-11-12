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
.ws-foot{position:absolute;left:96px;right:96px;bottom:40px;display:flex;justify-content:space-between;gap:24px;font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
`;

const pad = (n: number) => String(n).padStart(2, "0");

function Run({ run, refs }: { run: WeekRun; refs: boolean }) {
  return (
    <div className="ws-run" style={{ gridColumn: `${run.start + 2} / span ${run.span}` }}>
      {run.items.map((it, i) => (
        <div
          key={i}
          className={`ws-bar${it.kind === "activity" ? " ws-bar--off" : ""}`}
          style={it.tone ? { background: it.tone } : undefined}
        >
          <span>{it.label}</span>
          {refs && it.refs.length > 0 && <span className="ws-ref">{refText(it.refs)}</span>}
        </div>
      ))}
    </div>
  );
}

export default function WeekScheduleDocument({
  model,
  logo,
  screen,
}: {
  model: WeekModel;
  logo: string;
  screen?: boolean;
}) {
  const total = model.pages.length;
  const cols = { "--days": model.days.length } as CSSProperties;
  return (
    <div className={`ar ws${screen ? " ar--screen" : ""}`}>
      {model.pages.map((rows, pi) => (
        <div key={pi} className="ar-sheet">
          <section className="ar-page">
            <div className="ws-top">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="ar-logo" src={logo} alt="RAS-VERTEX" />
              <span className="ws-kicker">Weekly schedule</span>
            </div>
            {pi === 0 && (
              <div className="ws-head">
                <h2 className="ar-h2">{model.title}</h2>
                <span className="ar-label">{model.lede}</span>
              </div>
            )}
            <div className="ar-table">
              <div className="ar-thead ws-thead ws-cols" style={cols}>
                <span>Team member</span>
                {model.days.map((d) => (
                  <span key={d.iso}>
                    {d.day}
                    <b>{d.date}</b>
                  </span>
                ))}
              </div>
              {rows.map((r) => (
                <div key={r.n} className="ar-tr ws-tr ws-cols" style={cols}>
                  <span className="ws-name">{r.name}</span>
                  {r.runs.map((run) => (
                    <Run key={run.start} run={run} refs={model.opts.refs} />
                  ))}
                </div>
              ))}
            </div>
            <div className="ws-foot">
              <span>RAS-VERTEX</span>
              <span>
                Page {pad(pi + 1)} / {pad(total)}
              </span>
            </div>
          </section>
        </div>
      ))}
    </div>
  );
}
