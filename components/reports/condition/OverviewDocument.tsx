// components/reports/condition/OverviewDocument.tsx
//
// The Job Overview report: A4 pages authored at 1280 × 1810 page units, in
// the same design as the Anchor and Inspection reports (it reuses the Anchor
// report's stylesheet, plus the hours table and photo grid below). Rendered
// two ways from this one file:
//   - in the builder, scaled to fit the preview column
//   - on the server, through renderToStaticMarkup, as the PDF's HTML
//     (lib/server/overviewPdf.ts)
// So it holds no state or hooks. Pointer and caption handlers only exist in
// the preview.

import type { PointerEvent } from "react";
import { ANCHOR_CSS, Partner } from "@/components/reports/anchor-inspection/AnchorDocument";
import type { AnchorImageKey } from "@/lib/reports/anchor.layout";
import {
  formatHours,
  pad,
  scheduleDate,
  type HourItem,
  type OverviewModel,
  type Page,
} from "@/lib/reports/overview.layout";
import { photoPosStyle } from "@/lib/reports/photos";

export interface OverviewAssets {
  /** Logo plus the closing page's service and client images. */
  images: Record<AnchorImageKey, string>;
}

interface Ctx {
  model: OverviewModel;
  assets: OverviewAssets;
  onCoverPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onPhotoRename?: (id: string, name: string) => void;
  onPhotoRemove?: (id: string) => void;
  /** Preview only: click a photo to adjust it in its frame. */
  onPhotoAdjust?: (id: string, frame: HTMLElement) => void;
}

// ── Stylesheet: the Anchor report's, plus the parts only this report has ─────

export const OVERVIEW_CSS =
  ANCHOR_CSS +
  `
.jo-cols{grid-template-columns:260px minmax(0,1fr) 140px}
.jo-cols--notes{grid-template-columns:220px 280px 120px minmax(0,1fr)}
.jo-cols--times{grid-template-columns:220px minmax(0,1fr) 130px 130px 120px}
.jo-cols--times-notes{grid-template-columns:180px 230px 105px 105px 100px minmax(0,1fr)}
.jo-tr{height:56px}
.jo-tr--notes{height:76px}
.jo-note{font-size:17px;line-height:1.4;color:var(--ink-65);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:pretty}
.jo-sec{height:72px;display:flex;align-items:flex-end;padding-bottom:14px;border-bottom:var(--rule-head);font-size:22px;font-weight:700;letter-spacing:-.04em;line-height:1.2}
.jo-sub{height:56px;font-weight:600;color:var(--ink-65)}
.jo-total{height:72px;align-items:center;background:var(--blue);border-radius:14px;padding:0 24px;margin:0 -24px;border-bottom:0;font-weight:700}
.jo-grid{display:grid;column-gap:24px;row-gap:32px}
.jo-day{font-size:22px;font-weight:700;letter-spacing:-.04em;line-height:1.2;margin-bottom:20px}
.jo-day span{font-weight:400;color:var(--ink-45)}
.jo-h3{font-size:22px;font-weight:700;letter-spacing:-.04em;line-height:1.2}
.jo-num{font-family:var(--bebas);font-size:22px;letter-spacing:.04em;color:var(--ink-35);margin-right:14px;font-weight:400}
.jo-group{display:flex;align-items:flex-end;justify-content:space-between;gap:24px;height:62px;padding-bottom:14px;border-bottom:var(--rule-head)}
.jo-step{display:grid;grid-template-columns:64px minmax(0,1fr);padding:16px 0;border-bottom:var(--rule);font-size:20px;line-height:1.4;text-wrap:pretty}
.jo-step>span:first-child{color:var(--ink-45);font-variant-numeric:tabular-nums}
.jo-step:last-child{border-bottom:0}
.jo-mphoto{position:relative;margin-top:56px;height:760px;border-radius:20px;overflow:hidden;background:var(--grey);flex-shrink:0}
.jo-mphoto img{width:100%;height:100%;display:block}
.jo-cap{font-size:17px;line-height:1.4;color:var(--ink-55);margin-top:14px}
.jo-plan{grid-template-columns:minmax(0,1fr) 200px 170px}
.jo-plan--next{grid-template-columns:minmax(0,1fr) 190px 170px 170px}
.jo-plan.ar-tr,.jo-plan--next.ar-tr{padding:16px 0}
.jo-prio{justify-self:start;display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.jo-prio--required{background:#fcf0dc;color:#86561a}
.jo-prio--recommended{background:#eef1f6;color:rgba(1,25,85,.72)}
.jo-wfacts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:56px}
.jo-wfacts .ar-fact__v,.jo-wfacts b{font-size:20px;font-weight:700;line-height:1.3}
.jo-detail{display:grid;grid-template-columns:260px minmax(0,1fr);gap:24px;align-items:baseline;padding:16px 0;border-bottom:var(--rule)}
.jo-detail b{font-size:20px;font-weight:600;line-height:1.35}
.jo-sign{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,0.9fr) minmax(0,0.8fr);gap:40px;margin-top:48px}
.jo-sign>div{display:flex;flex-direction:column;gap:12px}
.jo-sign i{display:block;border-bottom:var(--rule-head);height:64px;display:flex;align-items:flex-end;font-style:normal;font-size:20px;font-weight:700;padding-bottom:10px}
.jo-sched{grid-template-columns:200px 280px minmax(0,1fr)}
.jo-sched.ar-tr{padding:18px 0;align-items:start}
.jo-small{font-size:17px;line-height:1.5;color:var(--ink-60);text-wrap:pretty}
`;

export function OverviewStyles() {
  return <style dangerouslySetInnerHTML={{ __html: OVERVIEW_CSS }} />;
}

// ── Parts ─────────────────────────────────────────────────────────────────────

function SecLabel({ text }: { text: string }) {
  return (
    <div className="ar-seclabel">
      <span>{text}</span>
      <i />
    </div>
  );
}

export function PageNo({ no, total }: { no: number; total: number }) {
  return (
    <div className="ar-pageno">
      Page {pad(no)} / {pad(total)}
    </div>
  );
}

function Heading({ title, lede }: { title: string; lede: string }) {
  return (
    <>
      <h2 className="ar-h2">{title}</h2>
      <p className="ar-lede" style={{ margin: "20px 0 56px" }}>
        {lede}
      </p>
    </>
  );
}

// ── Fixed pages ───────────────────────────────────────────────────────────────

/** Builder: the Report details field behind each cover fact. */
const FACT_FIELD: Record<string, string> = {
  "Prepared for": "preparedFor",
  Project: "project",
  Date: "date",
  "Prepared by": "preparedBy",
};

function Cover({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  const { x, y, zoom } = model.coverPos;
  return (
    <div className="ar-sheet" data-page="cover">
      <section className="ar-page ar-page--cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ar-logo" src={ctx.assets.images.logo} alt="RAS-VERTEX Maintenance Solutions" />
        <h1 className="ar-h1" style={{ marginTop: 48 }} data-panel-field="site">
          {model.site}.
        </h1>
        <div className="ar-lede ar-rich" style={{ fontSize: 22, marginTop: 24 }} data-panel-field="intro" dangerouslySetInnerHTML={{ __html: model.blurb }} />
        <div
          className={`ar-cover-photo${ctx.onCoverPointerDown ? " ar-cover-photo--drag" : ""}`}
          style={{ marginTop: 64 }}
          title={ctx.onCoverPointerDown ? "Drag to reposition" : undefined}
          onPointerDown={ctx.onCoverPointerDown}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={model.coverUrl}
            alt=""
            draggable={false}
            style={{
              objectPosition: `${x}% ${y}%`,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined,
              transformOrigin: `${x}% ${y}%`,
            }}
          />
        </div>
        <div className="ar-facts" style={{ marginTop: 64 }}>
          {model.facts.map((f) => (
            <div key={f.k} className="ar-fact" data-panel-field={FACT_FIELD[f.k]}>
              <div className="ar-label">{f.k}</div>
              <div className="ar-fact__v">{f.v || "—"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Contents({ ctx }: { ctx: Ctx }) {
  return (
    <div className="ar-sheet">
      <section className="ar-page ar-page--contents">
        <h2 className="ar-h2">Contents</h2>
        <div className="ar-toc">
          {ctx.model.toc.map((g) => (
            <div key={g.title}>
              <h3 className="ar-h3" style={{ marginBottom: 20 }}>
                {g.title}
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {g.items.map((t) => (
                  <div key={t.name} className="ar-toc__row">
                    <span>{t.name}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>{t.page}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Flowed pages ──────────────────────────────────────────────────────────────

function Notes({ label, html }: { label: string; html: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 56 }}>
      <span className="ar-label">{label}</span>
      {/* Sanitised in buildOverviewModel (lib/reports/richText.ts). */}
      <div className="ar-note ar-rich" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** "07:00" → "7:00 am", "15:30" → "3:30 pm". */
export function clock(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return "—";
  const h = +m[1];
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? "am" : "pm"}`;
}

export const hourCols = (notes: boolean, times: boolean) =>
  times ? (notes ? "jo-cols--times-notes" : "jo-cols--times") : notes ? "jo-cols--notes" : "jo-cols";

export function HourRow({ it, notes, times }: { it: HourItem; notes: boolean; times: boolean }) {
  const cols = hourCols(notes, times);
  const gap = times && (
    <>
      <span />
      <span />
    </>
  );
  switch (it.kind) {
    case "section":
      return <div className="jo-sec">{it.title}</div>;
    case "row":
      return (
        <div className={`ar-tr jo-tr ${notes ? "jo-tr--notes" : ""} ${cols}`}>
          <span>{scheduleDate(it.date)}</span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
          {times && (
            <>
              <span>{clock(it.start)}</span>
              <span>{clock(it.finish)}</span>
            </>
          )}
          <span className="ar-r">{it.hours > 0 ? formatHours(it.hours) : "—"}</span>
          {notes && <span className="jo-note">{it.note}</span>}
        </div>
      );
    case "subtotal":
      return (
        <div className={`ar-tr jo-sub ${cols}`}>
          <span>{it.title} subtotal</span>
          <span />
          {gap}
          <span className="ar-r">{formatHours(it.hours)}</span>
          {notes && <span />}
        </div>
      );
    case "total":
      return (
        <div className={`ar-tr jo-total ${cols}`}>
          <span>Total hours</span>
          <span />
          {gap}
          <span className="ar-r">{formatHours(it.hours)}</span>
          {notes && <span />}
        </div>
      );
  }
}

function HoursPage({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: "hours" }> }) {
  const { model } = ctx;
  const notes = model.showNotes;
  const times = model.showTimes;
  return (
    <section className="ar-page">
      {page.first ? (
        <>
          <SecLabel text={model.secText.hours} />
          <Heading title="Hours schedule" lede={model.hoursLede} />
        </>
      ) : (
        <SecLabel text="Hours schedule, continued" />
      )}
      <div className="ar-table">
        <div className={`ar-thead ${hourCols(notes, times)}`}>
          <span>Date</span>
          <span>Team member</span>
          {times && (
            <>
              <span>Start</span>
              <span>Finish</span>
            </>
          )}
          <span className="ar-r">Hours</span>
          {notes && <span>Notes</span>}
        </div>
        {page.items.map((it, i) => (
          <HourRow key={i} it={it} notes={notes} times={times} />
        ))}
      </div>
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

/** Methodology: stages with numbered steps, then the photo. */
function MethodPage({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: "method" }> }) {
  const { model } = ctx;
  const m = model.method!;
  return (
    <section className="ar-page">
      {page.first ? (
        <>
          <SecLabel text={model.secText.method} />
          <h2 className="ar-h2">Methodology</h2>
          <p className="ar-lede" style={{ margin: "20px 0 56px" }} data-panel-field="methodIntro">
            {m.intro}
          </p>
        </>
      ) : (
        <SecLabel text="Methodology, continued" />
      )}
      {page.blocks.map((b, i) =>
        b.t === "group" ? (
          <div key={i} className="jo-group" style={{ marginTop: i ? 56 : 0 }}>
            <span className="jo-h3">
              <span className="jo-num">{pad(b.stage)}</span>
              {b.cont ? `${b.title}, continued` : b.title}
            </span>
            <span className="ar-label">
              {b.from === b.to ? `Step ${pad(b.from)}` : `Steps ${pad(b.from)} to ${pad(b.to)}`}
            </span>
          </div>
        ) : b.t === "step" ? (
          <div key={i} className="jo-step">
            <span>{pad(b.n)}</span>
            <span dangerouslySetInnerHTML={{ __html: b.html }} />
          </div>
        ) : (
          <div key={i} data-panel-field="methodCaption">
            <div className="jo-mphoto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.photoUrl && <img src={m.photoUrl} alt="" style={photoPosStyle(m.photoPos)} />}
            </div>
            {m.caption && <p className="jo-cap">{m.caption}</p>}
          </div>
        ),
      )}
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

/** Maintenance plan: services, how often, and what's required. */
function PlanPage({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: "plan" }> }) {
  const { model } = ctx;
  const p = model.plan!;
  const cols = p.next ? "jo-plan--next" : "jo-plan";
  return (
    <section className="ar-page">
      {page.first ? (
        <>
          <SecLabel text={model.secText.plan} />
          <Heading title="Maintenance plan" lede={p.intro} />
        </>
      ) : (
        <SecLabel text="Maintenance plan, continued" />
      )}
      {page.rows.length > 0 && (
        <div className="ar-table">
          <div className={`ar-thead ${cols}`}>
            <span>Service</span>
            <span>Frequency</span>
            <span>Priority</span>
            {p.next && <span>Next due</span>}
          </div>
          {page.rows.map((x, i) => (
            <div key={i} className={`ar-tr ${cols}`}>
              <span style={{ fontWeight: 600 }}>{x.service}</span>
              <span className="ar-dim">{x.interval}</span>
              <span className={`jo-prio jo-prio--${x.priority}`}>{x.priority === "required" ? "Required" : "Recommended"}</span>
              {p.next && <span className="ar-dim">{x.next || "—"}</span>}
            </div>
          ))}
        </div>
      )}
      {page.notes && (
        <div data-panel-field="planNotes">
          <Notes label="Technician comments" html={p.notes} />
        </div>
      )}
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

/** Workmanship warranty: the facts, project details and the signed statement. */
function WarrantyPage({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: "warranty" }> }) {
  const { model } = ctx;
  const w = model.warranties[page.w]!;
  const f = (name: string) => `${page.w}.${name}`;
  const FIELD: Record<string, string> = { Warranty: "years", Manufacturer: "supplier", Area: "area", Commences: "completed" };
  return (
    <section className="ar-page">
      <SecLabel text={page.first ? model.secText.warranty : "Warranty, continued"} />
      <h2 className="ar-h2">{w.title}</h2>
      <p className="ar-lede" style={{ marginTop: 20 }} data-panel-field={f("intro")}>
        {w.intro}
      </p>
      <div className="jo-wfacts">
        {w.facts.map((x) => (
          <div key={x.k} className="ar-fact" data-panel-field={f(FIELD[x.k])}>
            <div className="ar-label">{x.k}</div>
            <div className="ar-fact__v">{x.v}</div>
          </div>
        ))}
      </div>
      <h3 className="jo-h3" style={{ marginTop: 72, paddingBottom: 14, borderBottom: "var(--rule-head)" }}>
        Project details
      </h3>
      {w.details.map((d) => (
        <div key={d.k} className="jo-detail" data-panel-field={d.k === "Products applied" ? f("products") : d.k === "Area of works" ? f("area") : undefined}>
          <span className="ar-label">{d.k}</span>
          <b>{d.v}</b>
        </div>
      ))}
      <h3 className="jo-h3" style={{ marginTop: 72, paddingBottom: 14, borderBottom: "var(--rule-head)" }}>
        Declaration
      </h3>
      <p style={{ fontSize: 20, lineHeight: 1.6, marginTop: 20, maxWidth: 960, textWrap: "pretty" }} data-panel-field={f("statement")}>
        {w.statement}
      </p>
      <div className="jo-sign">
        <div>
          <span className="ar-label">Signature</span>
          <i>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ctx.assets.images.signature} alt="Phil Clark signature" style={{ height: 56, width: "auto", mixBlendMode: "multiply" }} />
          </i>
          <span className="jo-small">Phil Clark, Director</span>
        </div>
        <div>
          <span className="ar-label">Contractor</span>
          <i>RAS-VERTEX</i>
        </div>
        <div data-panel-field={f("signed")}>
          <span className="ar-label">Date</span>
          <i>{w.signed}</i>
        </div>
      </div>
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

/** Keeping your warranty: the owner's obligations, then the inspections
 *  (and, for painting, the washes) that go with it. */
function CarePage({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: "care" }> }) {
  const { model } = ctx;
  const w = model.warranties[page.w]!;
  const f = (name: string) => `${page.w}.${name}`;
  return (
    <section className="ar-page ar-page--end">
      <SecLabel text={`${w.title}, continued`} />
      <h2 className="ar-h2">Keeping your warranty</h2>
      <p className="ar-lede" style={{ marginTop: 20 }}>
        {w.careIntro}
      </p>
      {w.requirements.length > 0 && (
        <>
          <div className="jo-group" style={{ marginTop: 56 }} data-panel-field={f("requirements")}>
            <span className="jo-h3">{w.obligations}</span>
          </div>
          {w.requirements.map((r, i) => (
            <div key={i} className="jo-step" data-panel-field={f("requirements")}>
              <span>{pad(i + 1)}</span>
              <span dangerouslySetInnerHTML={{ __html: r }} />
            </div>
          ))}
        </>
      )}
      {w.schedule.length > 0 && (
        <div data-panel-field={f("schedule")}>
          <h3 className="jo-h3" style={{ marginTop: 72 }}>
            {w.scheduleTitle}
          </h3>
          <p className="jo-small" style={{ marginTop: 12, maxWidth: 860 }}>
            {w.scheduleIntro}
          </p>
          <div className="ar-table" style={{ marginTop: 32 }}>
            <div className="ar-thead jo-sched">
              <span>Interval</span>
              <span>{page.w === "painting" ? "Service" : "Inspection"}</span>
              <span>Notes</span>
            </div>
            {w.schedule.map((r, i) => (
              <div key={i} className="ar-tr jo-sched">
                <span style={{ fontWeight: 700 }}>{r.when}</span>
                <span style={{ fontWeight: 600 }}>{r.inspection}</span>
                <span className="jo-small">{r.notes}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: "auto", paddingTop: 56, display: "flex", flexDirection: "column", gap: 40 }}>
        <a className="ar-btn" href={w.href} style={{ alignSelf: "flex-start" }}>
          {page.w === "painting" ? "Book a building wash" : "Book an annual inspection"}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 24, paddingTop: 32, borderTop: "var(--rule)" }}>
          <span className="jo-h3">Any questions? Reach out.</span>
          <span style={{ fontSize: 20 }}>
            {w.contact.name} · <b>{w.contact.phone}</b> · <b>{w.contact.email}</b>
          </span>
        </div>
      </div>
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

function PhotosPage({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: "photos" }> }) {
  const { model } = ctx;
  const n = model.photoCount;
  const dated = page.days.some((d) => d.label);
  return (
    <section className="ar-page">
      {page.first ? (
        <>
          <SecLabel text={model.secText.photos} />
          <Heading
            title="Photos"
            lede={`${n} photo${n === 1 ? "" : "s"} of the work${dated ? ", by the day they were taken" : ""}.`}
          />
        </>
      ) : (
        <SecLabel text="Photos, continued" />
      )}
      {page.days.map((d, di) => (
        <div key={di} style={{ marginTop: di ? 24 : 0 }}>
          {d.label && (
            <h3 className="jo-day">
              {d.label}
              {d.continued && <span>, continued</span>}
            </h3>
          )}
          <div className="jo-grid" style={{ gridTemplateColumns: `repeat(${model.grid.cols},minmax(0,1fr))` }}>
            {d.rows.flat().map((p) => (
              <div key={p.id} style={{ minWidth: 0 }}>
                <div className="ar-photo">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    title={ctx.onPhotoAdjust ? "Click to adjust" : undefined}
                    style={{ ...photoPosStyle(p.pos), cursor: ctx.onPhotoAdjust ? "pointer" : undefined }}
                    onClick={ctx.onPhotoAdjust ? (e) => ctx.onPhotoAdjust!(p.id, e.currentTarget.parentElement!) : undefined}
                  />
                  {ctx.onPhotoRemove && (
                    <button
                      type="button"
                      className="ar-photo-remove"
                      title="Remove photo"
                      aria-label="Remove photo"
                      onClick={() => ctx.onPhotoRemove!(p.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
                {ctx.onPhotoRename ? (
                  // Uncontrolled, keyed on the name, so typing doesn't re-render
                  // the whole document; commits on blur or Enter.
                  <input
                    key={p.name}
                    className="ar-caption"
                    defaultValue={p.name.replace(/\.[^.]+$/, "")}
                    title="Click to edit the caption"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                      if (e.key === "Escape") {
                        e.currentTarget.value = p.name.replace(/\.[^.]+$/, "");
                        e.currentTarget.blur();
                      }
                    }}
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      const ext = p.name.match(/\.[^.]+$/)?.[0] ?? "";
                      if (v && v + ext !== p.name) ctx.onPhotoRename!(p.id, v + ext);
                      else e.currentTarget.value = p.name.replace(/\.[^.]+$/, "");
                    }}
                  />
                ) : (
                  <div className="ar-caption">{p.name.replace(/\.[^.]+$/, "")}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────

interface DocProps {
  model: OverviewModel;
  assets: OverviewAssets;
  /** Preview only: page shadows and gaps between sheets. */
  screen?: boolean;
  onCoverPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  /** Preview only: captions on photo pages become editable. */
  onPhotoRename?: (id: string, name: string) => void;
  onPhotoRemove?: (id: string) => void;
  /** Preview only: click a photo to adjust it in its frame. */
  onPhotoAdjust?: (id: string, frame: HTMLElement) => void;
}

export default function OverviewDocument({ model, assets, screen, onCoverPointerDown, onPhotoRename, onPhotoRemove, onPhotoAdjust }: DocProps) {
  const ctx: Ctx = { model, assets, onCoverPointerDown, onPhotoRename, onPhotoRemove, onPhotoAdjust };
  return (
    <div className={`ar jo${screen ? " ar--screen" : ""}`}>
      <Cover ctx={ctx} />
      <Contents ctx={ctx} />
      {model.pages.map((p) => (
        <div key={`${p.kind}-${p.no}`} className="ar-sheet" data-page={p.kind === "care" ? "warranty" : p.kind}>
          {p.kind === "hours" ? (
            <HoursPage ctx={ctx} page={p} />
          ) : p.kind === "method" ? (
            <MethodPage ctx={ctx} page={p} />
          ) : p.kind === "plan" ? (
            <PlanPage ctx={ctx} page={p} />
          ) : p.kind === "warranty" ? (
            <WarrantyPage ctx={ctx} page={p} />
          ) : p.kind === "care" ? (
            <CarePage ctx={ctx} page={p} />
          ) : (
            <PhotosPage ctx={ctx} page={p} />
          )}
        </div>
      ))}
      <Partner images={assets.images} label={model.secText.about} />
    </div>
  );
}
