// components/reports/week-schedule/WeekScheduleDocument.tsx
//
// The Weekly schedule as landscape A4 pages (1810 × 1280 page units), in the
// reports' design (the Anchor report's stylesheet). Rendered in the builder,
// scaled to the preview, and on the server for the PDF
// (app/api/reports/export-week-schedule-pdf), so it holds no state or hooks.

import type { CSSProperties } from "react";
import { ANCHOR_CSS } from "@/components/reports/anchor-inspection/AnchorDocument";
import { refText, WEEK_PAGE_H, WEEK_PAGE_W, type WeekCell, type WeekModel } from "@/lib/reports/weekSchedule";

export const WEEK_CSS =
  ANCHOR_CSS +
  `
.ws .ar-sheet{width:${WEEK_PAGE_W}px;height:${WEEK_PAGE_H}px}
.ws .ar-page{width:${WEEK_PAGE_W}px;height:${WEEK_PAGE_H}px;padding:56px 96px 0}
.ws-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:32px}
.ws-top .ar-logo{height:44px}
.ws-kicker{font-family:var(--bebas);font-size:20px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
.ws-head{display:flex;align-items:flex-end;justify-content:space-between;gap:48px;margin-bottom:28px}
.ws-head .ar-lede{margin-top:10px;max-width:none}
.ws-key{display:flex;gap:40px;flex-shrink:0;padding-bottom:6px}
.ws-key div{display:flex;flex-direction:column;align-items:flex-end;gap:6px}
.ws-key b{font-size:44px;font-weight:700;letter-spacing:-.05em;line-height:1}
.ws-cols{grid-template-columns:44px 240px repeat(var(--days),minmax(0,1fr));gap:16px}
.ws-thead{align-items:end}
.ws-thead b{display:block;font-size:18px;font-weight:700;letter-spacing:-.02em;text-transform:none;color:var(--navy);margin-top:4px}
.ws-tr{min-height:37px;padding:5px 0;align-items:center}
.ws-num{font-family:var(--bebas);font-size:20px;letter-spacing:.04em;color:var(--ink-35);line-height:1}
.ws-name{font-size:18px;font-weight:600;letter-spacing:-.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ws-cell{display:flex;flex-direction:column;gap:4px;min-width:0}
.ws-chip{display:flex;align-items:center;gap:8px;min-width:0;height:27px;padding:0 12px;border-radius:7px;background:var(--grey);font-size:16px;font-weight:600;letter-spacing:-.01em;line-height:1}
.ws-chip span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ws-ref{flex-shrink:0;font-size:13px;font-weight:500;color:var(--ink-45);font-variant-numeric:tabular-nums}
.ws-chip--off{background:transparent;box-shadow:inset 0 0 0 1px rgba(1,25,85,.16);font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-55)}
.ws-none{font-size:16px;color:var(--ink-35);padding-left:12px}
.ws-foot{position:absolute;left:96px;right:96px;bottom:40px;display:flex;justify-content:space-between;gap:24px;font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
`;

const pad = (n: number) => String(n).padStart(2, "0");

function Cell({ items, refs }: { items: WeekCell[]; refs: boolean }) {
  if (!items.length) return <div className="ws-none">—</div>;
  return (
    <div className="ws-cell">
      {items.map((it, i) => (
        <div
          key={i}
          className={`ws-chip${it.kind === "activity" ? " ws-chip--off" : ""}`}
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
                <div>
                  <h2 className="ar-h2">{model.title}</h2>
                  <p className="ar-lede">{model.lede}</p>
                </div>
                <div className="ws-key">
                  <div>
                    <b>{model.staffCount}</b>
                    <span className="ar-label">Team</span>
                  </div>
                  <div>
                    <b>{model.siteCount}</b>
                    <span className="ar-label">Sites</span>
                  </div>
                </div>
              </div>
            )}
            <div className="ar-table">
              <div className="ar-thead ws-thead ws-cols" style={cols}>
                <span />
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
                  <span className="ws-num">{pad(r.n)}</span>
                  <span className="ws-name">{r.name}</span>
                  {r.cells.map((items, i) => (
                    <Cell key={i} items={items} refs={model.opts.refs} />
                  ))}
                </div>
              ))}
            </div>
            <div className="ws-foot">
              <span>RAS-VERTEX · {model.title}</span>
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
