// components/reports/project-progress/ProgressDocument.tsx
//
// The Project progress report: title and lede, three figures, the jobs in
// the proposal's pricing style (Job · Work · Status · Hours · Price), then
// the completed works totalled with GST, on 1280 × 1810 pages in the Job
// overview's design. Rendered in the builder and on the server for the PDF,
// so it holds no state or hooks.

import { pad } from "@/lib/reports/overview.layout";
import { hoursText, money, STATE_LABEL, type JobState, type ProgressModel } from "@/lib/reports/projectProgress";

export const PROGRESS_CSS = `
.pp-figs{background:var(--blue);border-radius:24px;padding:36px 48px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:48px}
.pp-fig{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px}
.pp-fig b{font-size:56px;font-weight:700;letter-spacing:-.05em;line-height:1;font-variant-numeric:tabular-nums}
.pp-cols{grid-template-columns:110px minmax(0,1fr) 150px 130px 190px;column-gap:24px}
.pp-table{margin-top:56px}
.pp-tr{min-height:72px;padding:14px 0;font-size:20px;line-height:1.4}
.pp-no{font-family:var(--bebas);font-size:24px;letter-spacing:.04em;color:var(--ink-45)}
.pp-work{min-width:0}
.pp-work small{display:block;font-size:15px;color:var(--ink-45);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pp-var{font-weight:600;color:#86561a}
.pp-sub{display:block;font-size:14px;font-weight:400;color:var(--ink-45);margin-top:2px}
.pp-r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.pp-price{font-weight:700}
.pp-price--due{font-weight:500;color:var(--ink-45)}
.pp-hrs small{color:var(--ink-45);font-size:15px}
.pp-state{justify-self:start;display:inline-flex;align-items:center;height:30px;padding:0 12px;border-radius:8px;font-size:15px;font-weight:600;white-space:nowrap}
.pp-state--complete{background:#dff2e6;color:#2f7a55}
.pp-state--progress{background:#fcf0dc;color:#86561a}
.pp-state--pending{background:#eef1f6;color:rgba(1,25,85,.72)}
.pp-money{display:flex;flex-direction:column;margin-top:56px}
.pp-mrow{display:flex;justify-content:space-between;gap:24px;padding:22px 0;font-size:20px;line-height:1.5}
.pp-mrow--ex{border-top:2px solid rgba(1,25,85,.25);font-weight:700}
.pp-mrow--gst{border-top:var(--rule);color:var(--ink-65)}
.pp-mrow--gst span:last-child{color:var(--navy)}
.pp-mrow span:last-child{font-variant-numeric:tabular-nums}
.pp-inc{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-top:8px;padding:30px 36px;border-radius:16px;background:#e9edf5;font-size:22px;font-weight:700}
.pp-note{margin-top:20px;font-size:17px;line-height:1.5;color:var(--ink-65)}
.pp-foot{position:absolute;left:96px;right:96px;bottom:52px;display:flex;justify-content:space-between;gap:24px;font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
.pp-foot span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

function State({ s }: { s: JobState }) {
  return <span className={`pp-state pp-state--${s}`}>{STATE_LABEL[s]}</span>;
}

export default function ProgressDocument({ model, screen }: { model: ProgressModel; screen?: boolean }) {
  const n = model.pages.length;
  const head = (
    <div className="ar-thead pp-cols">
      <span>Job</span>
      <span>Work</span>
      <span>Status</span>
      <span className="pp-r">Hours</span>
      <span className="pp-r">Price (ex GST)</span>
    </div>
  );
  return (
    <div className={`ar jo${screen ? " ar--screen" : ""}`}>
      {model.pages.map((rows, i) => (
        <div key={i} className="ar-sheet">
          <section className="ar-page">
            {i === 0 && (
              <>
                <h2 className="ar-h2">Project progress</h2>
                <p className="ar-lede" style={{ margin: "20px 0 0" }}>
                  <b style={{ color: "var(--navy)" }}>{model.title}</b>
                  {model.asAt && <> · as at {model.asAt}</>}
                </p>
                {model.intro.trim() && (
                  <p className="ar-lede" style={{ margin: "12px 0 0" }}>
                    {model.intro}
                  </p>
                )}
                <div className="pp-figs">
                  <div className="pp-fig">
                    <b>{model.jobs}</b>
                    <span className="ar-label">{model.jobs === 1 ? "Job" : "Jobs"}</span>
                  </div>
                  <div className="pp-fig">
                    <b>{hoursText(model.hours)}</b>
                    <span className="ar-label">Hours used</span>
                  </div>
                  <div className="pp-fig">
                    <b>{money(model.completed).replace(/\.00$/, "")}</b>
                    <span className="ar-label">Completed (ex GST)</span>
                  </div>
                </div>
              </>
            )}

            {rows.length > 0 && (
              <div className="ar-table" style={i === 0 ? undefined : { marginTop: 0 }}>
                <div className={i === 0 ? "pp-table" : undefined}>{head}</div>
                {rows.map((r) => (
                  <div key={r.id} className="ar-tr pp-tr pp-cols">
                    <span className="pp-no">#{r.jobId}</span>
                    <span className="pp-work">
                      {r.work}
                      <small>
                        {r.variation ? <b className="pp-var">Variation</b> : "Original scope"}
                        {r.jobName && r.jobName !== r.work ? ` · ${r.jobName}` : ""}
                      </small>
                    </span>
                    <State s={r.state} />
                    <span className="pp-r pp-hrs">
                      {hoursText(r.hours)}
                      {model.showEstimate && r.hoursEstimate > 0 && <small> of {hoursText(r.hoursEstimate)}</small>}
                    </span>
                    <span className={`pp-r ${r.state === "complete" ? "pp-price" : "pp-price--due"}`}>
                      {money(r.price)}
                      {r.priceFromHours && <small className="pp-sub">Hours worked</small>}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {i === n - 1 && (
              <div className="pp-money" style={rows.length ? undefined : { marginTop: 0 }}>
                <div className="pp-mrow pp-mrow--ex">
                  <span>Completed works (ex GST)</span>
                  <span>{money(model.completed)}</span>
                </div>
                <div className="pp-mrow pp-mrow--gst">
                  <span>GST (10%)</span>
                  <span>{money(model.completedGst)}</span>
                </div>
                <div className="pp-inc">
                  <span>Completed works incl. GST</span>
                  <span>{money(model.completed + model.completedGst)}</span>
                </div>
                {model.inProgress > 0 && (
                  <p className="pp-note">
                    Works not yet completed: {money(model.inProgress)} ex GST, invoiced on completion.
                  </p>
                )}
              </div>
            )}

            <div className="pp-foot">
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
