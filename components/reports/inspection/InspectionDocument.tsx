// components/reports/inspection/InspectionDocument.tsx
//
// The Inspection Report itself: A4 pages authored at 1280 × 1810 page units
// (the design handoff's report.css, scoped under .ir). Rendered two ways
// from this one file:
//   - in the builder, scaled to fit the preview column
//   - on the server, through renderToStaticMarkup, as the PDF's HTML
//     (app/api/reports/export-inspection-pdf/route.ts)
// So it holds no state or hooks, and styles come from the <style> tag below
// rather than CSS Modules. Pointer handlers only exist in the preview.
//
// InspectionMeasure renders every flowed block once, unpaginated, at the
// content width; its [data-bk] heights feed paginate() (lib/reports/
// inspection/generate.ts), which decides what goes on each page.

import type { PointerEvent, ReactNode } from "react";
import { BANDS, type ImageKey } from "@/lib/reports/inspection/codes";
import {
  CONTENT_W,
  padPage,
  type Block,
  type Chip,
  type InspectionModel,
  type Layout,
  type PhotoView,
} from "@/lib/reports/inspection/generate";
import { contactFor, type InspectionJob } from "@/lib/reports/inspection/types";

export interface InspectionAssets {
  logo: string;
  /** About and Also worth adding card photos. */
  images: Record<ImageKey, string>;
}

interface Ctx {
  model: InspectionModel;
  photoUrl: (id: string | null) => string | null;
  assets: InspectionAssets;
  chapPage: Record<string, number>;
  onPinPointerDown?: (zone: string, e: PointerEvent<HTMLElement>) => void;
  onCoverPointerDown?: (e: PointerEvent<HTMLElement>) => void;
}

const bg = (src: string | null | undefined) => (src ? `url("${src}")` : undefined);

// ── Stylesheet (report.css, scoped) ──────────────────────────────────────────

export const INSPECTION_CSS = `
.ir{--navy:#011955;--ink-80:rgba(1,25,85,.8);--ink-75:rgba(1,25,85,.75);--ink-70:rgba(1,25,85,.7);--ink-65:rgba(1,25,85,.65);--ink-60:rgba(1,25,85,.6);--ink-55:rgba(1,25,85,.55);--ink-45:rgba(1,25,85,.45);--ink-35:rgba(1,25,85,.35);--rule:rgba(1,25,85,.12);--rule-head:rgba(1,25,85,.25);--card-grey:rgba(1,25,85,.045);--card-blue:#deeeff;--img-empty:rgba(1,25,85,.08);--bebas:'Bebas Neue',Arial,sans-serif;
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--navy);line-height:1.7;font-size:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:left}
.ir :where(h1,h2,h3,p,span,div,a,strong){color:inherit;font:inherit;letter-spacing:inherit;margin:0;padding:0;box-sizing:border-box}
.ir *{box-sizing:border-box}
.ir strong{font-weight:700}
.ir--screen{display:flex;flex-direction:column;align-items:center;gap:40px}
.ir--screen .ir-sheet{box-shadow:0 1px 2px rgba(23,23,26,.06),0 12px 32px -12px rgba(23,23,26,.22)}
.ir-sheet{position:relative;width:1280px;height:1810px;overflow:hidden;background:#fff;break-after:page;flex-shrink:0}
.ir-sheet:last-child{break-after:auto}
.ir-page{position:relative;width:1280px;height:1810px;padding:80px 96px 0}
.ir-page--cover{display:flex;flex-direction:column;padding-bottom:96px}
.ir-page--contents{display:flex;flex-direction:column;padding-bottom:130px}
.ir-page--works{display:flex;flex-direction:column;padding-bottom:150px}
.ir-footer{position:absolute;left:96px;right:96px;bottom:52px;display:flex;justify-content:flex-end;font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1;white-space:nowrap}
.ir-measure{position:absolute;left:-100000px;top:0;visibility:hidden;pointer-events:none;width:${CONTENT_W}px}
.ir-blk{display:flow-root}

.ir-label{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-45);line-height:1.3}
.ir-seclabel{display:flex;align-items:baseline;gap:16px;margin-bottom:40px}
.ir-seclabel span,.ir-continued span{font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
.ir-seclabel::after,.ir-continued::after{content:'';flex:1;height:1px;background:var(--rule)}
.ir-continued{display:flex;align-items:baseline;gap:16px}
.ir-h-cover{font-size:84px;font-weight:700;line-height:1.05;letter-spacing:-.06em}
.ir-h-section{font-size:48px;font-weight:700;line-height:1.1;letter-spacing:-.05em}
.ir-h-card{font-size:40px;font-weight:700;line-height:1.1;letter-spacing:-.04em}
.ir-h-sub{font-size:22px;font-weight:700;line-height:1.2;letter-spacing:-.04em}
.ir-intro{font-size:20px;color:var(--ink-65);max-width:820px;margin-top:20px;text-wrap:pretty}
.ir-lede{font-size:22px;line-height:1.6;color:var(--ink-65);text-wrap:pretty}

.ir-logo{height:60px;width:auto;align-self:flex-start;display:block}
.ir-cover-photo{position:relative;width:100%;flex:1 1 0;min-height:0;border-radius:24px;overflow:hidden;background:var(--card-grey)}
.ir-cover-photo--drag{cursor:grab;touch-action:none}
.ir-cover-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;user-select:none;pointer-events:none}
.ir-facts{display:grid;grid-template-columns:minmax(0,1.1fr) repeat(3,minmax(0,1fr));gap:12px}
.ir-fact{background:var(--card-grey);border-radius:16px;padding:22px 28px;min-width:0}
.ir-fact__v{font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.3;margin-top:8px}

.ir-toc{margin-top:auto;display:flex;flex-direction:column;gap:64px}
.ir-toc .ir-h-sub{margin-bottom:20px}
.ir-toc__items{display:flex;flex-direction:column;gap:12px}
.ir-toc__row{display:flex;justify-content:space-between;align-items:baseline;gap:24px;font-size:20px;line-height:1.4;color:rgba(1,25,85,.72)}
.ir-num{font-variant-numeric:tabular-nums}

.ir-chip{display:inline-flex;align-items:center;justify-content:center;justify-self:start;flex-shrink:0;min-width:44px;height:28px;padding:0 8px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.04em;line-height:1}
.ir-chip--band{padding:0 10px;letter-spacing:.12em;text-transform:uppercase}
.ir-zone{display:inline-flex;align-items:center;justify-self:start;height:28px;padding:0 10px;border-radius:8px;background:var(--card-blue);font-size:17px;font-weight:700;line-height:1;white-space:nowrap}

.ir-tbl-head{display:grid;gap:24px;padding-bottom:14px;border-bottom:1px solid var(--rule-head);font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-45);line-height:1.3}
.ir-tbl-row{display:grid;gap:24px;align-items:center;padding:12px 0;border-bottom:1px solid transparent;line-height:1.3}
.ir-tbl-row.is-ruled{border-bottom-color:var(--rule)}
.ir-right{text-align:right}
.ir-cols-sev{grid-template-columns:110px minmax(0,1fr) 200px}
.ir-cols-zones{grid-template-columns:200px minmax(0,1fr) 160px 100px}
.ir-cols-def{grid-template-columns:90px 320px minmax(0,1fr) minmax(0,1fr)}
.ir-cols-ix{grid-template-columns:150px 110px 110px minmax(0,1fr) 220px}
.ir-cols-works{grid-template-columns:64px 340px minmax(0,1fr) 180px}
.ir-cell{font-size:20px}
.ir-cell--strong{font-size:20px;font-weight:600}
.ir-cell--muted{font-size:20px;color:var(--ink-65)}
.ir-cell--small{font-size:17px;color:var(--ink-65)}
.ir-cols-def.ir-tbl-row{align-items:start;padding:20px 0}
.ir-def-name{font-size:20px;font-weight:600;line-height:1.35}
.ir-def-what{font-size:17px;line-height:1.55;color:var(--ink-75)}
.ir-def-act{font-size:17px;line-height:1.55}
.ir-cols-works.ir-tbl-row{align-items:baseline;padding:16px 0;line-height:1.4}
.ir-chips{display:flex;flex-wrap:wrap;gap:6px}

.ir-band-wrap{padding-bottom:8px}
.ir-band{display:flex;align-items:baseline;gap:16px;padding:16px 24px;border-radius:14px}
.ir-band__name{font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1.2;white-space:nowrap}
.ir-band__desc{font-size:17px;color:var(--ink-70);line-height:1.4}

.ir-about{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px}
.ir-about__img{width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:var(--img-empty) center/cover no-repeat}
.ir-about .ir-h-sub{margin:24px 0 8px}
.ir-about p{font-size:17px;line-height:1.6;color:var(--ink-65);text-wrap:pretty}

.ir-card-blue{background:var(--card-blue);border-radius:32px;padding:48px 56px 56px}
.ir-card-blue>p{font-size:20px;line-height:1.6;color:var(--ink-70);margin-top:12px;max-width:720px;text-wrap:pretty}
.ir-explainer{display:grid;grid-template-columns:400px minmax(0,1fr);gap:32px;align-items:stretch;margin-top:36px}
.ir-explainer__photo{background:#fff;border-radius:20px;padding:16px 16px 22px;min-width:0}
.ir-explainer__photo .ir-photo__img{aspect-ratio:1/1;border-radius:12px}
.ir-explainer__legend{background:#fff;border-radius:20px;padding:8px 32px;display:flex;flex-direction:column;min-width:0}
.ir-legend-item{display:flex;flex-direction:column;gap:4px;padding:20px 0;border-bottom:1px solid var(--rule)}
.ir-legend-item:last-child{border-bottom:0}
.ir-legend-item__ex{font-size:20px;font-weight:600;line-height:1.35}
.ir-legend-item__mean{font-size:17px;line-height:1.5;color:var(--ink-60);text-wrap:pretty}

.ir-map{position:relative;width:100%;aspect-ratio:3/2;border-radius:16px;overflow:hidden;background:var(--card-grey) center/cover no-repeat}
.ir-pin{position:absolute;transform:translate(-50%,-50%);display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:8px;background:var(--card-blue);color:var(--navy);font-size:17px;font-weight:700;line-height:1;white-space:nowrap;box-shadow:0 2px 10px rgba(1,25,85,.3);user-select:none}
.ir-pin--drag{cursor:grab;touch-action:none}

.ir-chapter{display:flex;align-items:baseline;justify-content:space-between;gap:24px;flex-wrap:wrap;background:var(--card-grey);border-radius:24px;padding:32px 40px}
.ir-chapter__meta{font-size:17px;color:var(--ink-70)}
.ir-photo-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px}
.ir-photo{min-width:0}
.ir-photo__img{width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:var(--card-grey) center/cover no-repeat}
.ir-photo__head{display:flex;align-items:center;gap:12px;margin-top:20px}
.ir-photo__name{font-size:20px;font-weight:600;line-height:1.3;flex:1;min-width:0}
.ir-photo__num{font-size:17px;color:var(--ink-45);font-variant-numeric:tabular-nums;white-space:nowrap}
.ir-photo__desc{font-size:17px;color:var(--ink-65);line-height:1.45;margin-top:8px;text-wrap:pretty}

.ir-stats{background:var(--card-blue);border-radius:24px;padding:40px 48px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px;margin-bottom:32px}
.ir-stat{display:flex;flex-direction:column;gap:12px;min-width:0}
.ir-stat__v{font-size:72px;font-weight:700;letter-spacing:-.05em;line-height:1}
.ir-stat .ir-label{color:var(--ink-55)}
.ir-sum-rows{display:flex;flex-direction:column;border-top:1px solid var(--rule)}
.ir-sum-row{display:grid;grid-template-columns:220px minmax(0,1fr);gap:24px;padding:28px 0;border-bottom:1px solid var(--rule)}
.ir-sum-row:last-child{border-bottom:0}
.ir-sum-row__meta{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
.ir-sum-row__count{font-size:17px;color:var(--ink-60);line-height:1.4}
.ir-sum-row p{font-size:20px;line-height:1.6;color:var(--ink-80);text-wrap:pretty}
.ir-note{display:flex;flex-direction:column;gap:10px;margin-top:56px}
.ir-note p{font-size:17px;line-height:1.6;color:var(--ink-60);text-wrap:pretty}

.ir-works-tbl{margin-top:48px;display:flex;flex-direction:column}
.ir-extras-title{margin-top:88px}
.ir-extras{flex:1 1 auto;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:40px;min-height:0}
.ir-extra{display:flex;flex-direction:column;min-width:0;min-height:0}
.ir-extra__img{width:100%;flex:1 1 0;min-height:120px;border-radius:16px;overflow:hidden;background:var(--img-empty) center/cover no-repeat}
.ir-extra .ir-h-sub{margin:24px 0 8px}
.ir-extra p{font-size:17px;line-height:1.5;color:var(--ink-60);min-height:3em;text-wrap:pretty}
.ir-cta{margin-top:64px;display:flex;flex-direction:column;gap:40px}
.ir-btn{align-self:flex-start;display:inline-flex;align-items:center;gap:16px;height:64px;padding:0 36px;border-radius:14px;font-size:20px;font-weight:700;letter-spacing:-.01em;text-decoration:none}
.ir-btn--primary{background:var(--navy);color:#fff}
.ir a.ir-btn--primary{color:#fff}
.ir-contact{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:16px 40px;padding-top:32px;border-top:1px solid var(--rule)}
.ir-contact p{font-size:20px}
`;

export function InspectionStyles() {
  return <style dangerouslySetInnerHTML={{ __html: INSPECTION_CSS }} />;
}

// ── Small parts ──────────────────────────────────────────────────────────────

function ChipView({ chip }: { chip: Chip }) {
  return (
    <span className="ir-chip" style={{ background: chip.bg, color: chip.fg }}>
      {chip.code}
    </span>
  );
}

function Footer({ no, total }: { no: number; total: number }) {
  return (
    <div className="ir-footer">
      <span>
        Page {padPage(no)} / {padPage(total)}
      </span>
    </div>
  );
}

function Photo({ p, ctx }: { p: PhotoView; ctx: Ctx }) {
  return (
    <div className="ir-photo">
      <div className="ir-photo__img" style={{ backgroundImage: bg(ctx.photoUrl(p.id)) }} />
      <div className="ir-photo__head">
        <ChipView chip={p.chip} />
        <span className="ir-photo__name">{p.gname}</span>
        <span className="ir-photo__num">Photo {p.num}</span>
      </div>
      <div className="ir-photo__desc">{p.desc}</div>
    </div>
  );
}

// ── Flowed blocks ────────────────────────────────────────────────────────────

function BlockView({ b, ctx, ruled }: { b: Block; ctx: Ctx; ruled: boolean }): ReactNode {
  const rowCls = (cols: string) => `ir-tbl-row ${cols}${ruled ? " is-ruled" : ""}`;
  switch (b.type) {
    case "sec":
      return (
        <>
          <div className="ir-seclabel">
            <span>{b.label}</span>
          </div>
          <h2 className="ir-h-section">{b.title}</h2>
          {b.intro && <p className="ir-intro">{b.intro}</p>}
        </>
      );
    case "why":
      return (
        <div className="ir-about">
          {ctx.model.about.map((a) => (
            <div key={a.t}>
              <div className="ir-about__img" style={{ backgroundImage: bg(ctx.assets.images[a.img]) }} />
              <h3 className="ir-h-sub">{a.t}</h3>
              <p>{a.d}</p>
            </div>
          ))}
        </div>
      );
    case "ex":
      return (
        <div className="ir-card-blue">
          <h3 className="ir-h-card">Reading a photo</h3>
          <p>Every photo in this report is labelled the same way. Here is one from your building.</p>
          <div className="ir-explainer">
            <div className="ir-explainer__photo">
              <Photo p={b.photo} ctx={ctx} />
            </div>
            <div className="ir-explainer__legend">
              {b.legend.map((l) => (
                <div key={l.part} className="ir-legend-item">
                  <span className="ir-label">{l.part}</span>
                  <span className="ir-legend-item__ex">{l.ex}</span>
                  <span className="ir-legend-item__mean">{l.mean}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    case "sub":
      return <h3 className="ir-h-card">{b.title}</h3>;
    case "kHead":
      return (
        <div className="ir-tbl-head ir-cols-sev">
          <span>Code</span>
          <span>Defect</span>
          <span className="ir-right">In this report</span>
        </div>
      );
    case "kGroup": {
      const band = BANDS[b.band];
      return (
        <div className="ir-band-wrap" style={{ paddingTop: b.first ? 24 : 40 }}>
          <div className="ir-band" style={{ background: band.bg }}>
            <span className="ir-band__name">{band.name}</span>
            <span className="ir-band__desc">{band.desc}</span>
          </div>
        </div>
      );
    }
    case "kRow":
      return (
        <div className={rowCls("ir-cols-sev")}>
          <ChipView chip={b.chip} />
          <span className="ir-cell--strong">{b.name}</span>
          <span className="ir-cell--small ir-right ir-num" style={{ color: "var(--ink-55)" }}>
            {b.count}
          </span>
        </div>
      );
    case "map":
      return (
        <div className="ir-map" style={{ backgroundImage: bg(ctx.photoUrl(b.photoId)) }}>
          {b.pins.map((pin) => (
            <span
              key={pin.zone}
              className={`ir-pin${ctx.onPinPointerDown ? " ir-pin--drag" : ""}`}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
              title={ctx.onPinPointerDown ? "Drag to position" : undefined}
              onPointerDown={ctx.onPinPointerDown ? (e) => ctx.onPinPointerDown!(pin.zone, e) : undefined}
            >
              {pin.zone}
            </span>
          ))}
        </div>
      );
    case "zones": {
      const rows = ctx.model.zoneRows;
      return (
        <div>
          <div className="ir-tbl-head ir-cols-zones">
            <span>Zone</span>
            <span>Levels</span>
            <span>Photos</span>
            <span className="ir-right">Page</span>
          </div>
          {rows.map((z, i) => (
            <div key={z.zone} className={`ir-tbl-row ir-cols-zones${i < rows.length - 1 ? " is-ruled" : ""}`}>
              <span className="ir-zone">{z.title}</span>
              <span className="ir-cell--muted">{z.levels}</span>
              <span className="ir-cell--muted ir-num">{z.count}</span>
              <span className="ir-cell--strong ir-right ir-num">
                {ctx.chapPage[z.zone] ? padPage(ctx.chapPage[z.zone]) : ""}
              </span>
            </div>
          ))}
        </div>
      );
    }
    case "dHead":
      return (
        <div className="ir-tbl-head ir-cols-def">
          <span>Code</span>
          <span>Defect</span>
          <span>What it is</span>
          <span>Recommended action</span>
        </div>
      );
    case "defect":
      return (
        <div className={rowCls("ir-cols-def")}>
          <ChipView chip={b.chip} />
          <span className="ir-def-name">{b.name}</span>
          <p className="ir-def-what">{b.what}</p>
          <p className="ir-def-act">{b.act}</p>
        </div>
      );
    case "chap":
      return (
        <div className="ir-chapter">
          <h3 className="ir-h-card">{b.title}</h3>
          <span className="ir-chapter__meta">{b.meta}</span>
        </div>
      );
    case "cont":
      return (
        <div className="ir-continued">
          <span>{b.text}</span>
        </div>
      );
    case "row":
      return (
        <div className="ir-photo-row">
          {b.photos.map((p) => (
            <Photo key={p.id + p.chip.code} p={p} ctx={ctx} />
          ))}
        </div>
      );
    case "ixHead":
      return (
        <div className="ir-tbl-head ir-cols-ix">
          <span>Zone</span>
          <span>Level</span>
          <span>Unit</span>
          <span>Defects</span>
          <span>Photos</span>
        </div>
      );
    case "ixRow":
      return (
        <div className={rowCls("ir-cols-ix")}>
          <span className="ir-zone">{b.zone}</span>
          <span className="ir-cell">{b.level}</span>
          <span className="ir-cell">{b.unit}</span>
          <div className="ir-chips">
            {b.chips.map((c) => (
              <ChipView key={c.code} chip={c} />
            ))}
          </div>
          <span className="ir-cell--small ir-num">{b.photos}</span>
        </div>
      );
    case "sum":
      return (
        <div>
          <div className="ir-stats">
            {b.stats.map((s) => (
              <div key={s.k} className="ir-stat">
                <span className="ir-stat__v">{s.v}</span>
                <span className="ir-label">{s.k}</span>
              </div>
            ))}
          </div>
          {b.rows.length > 0 && (
            <div className="ir-sum-rows">
              {b.rows.map((r) => {
                const band = BANDS[r.band];
                return (
                  <div key={r.band} className="ir-sum-row">
                    <div className="ir-sum-row__meta">
                      <span className="ir-chip ir-chip--band" style={{ background: band.bg, color: band.fg }}>
                        {r.name}
                      </span>
                      <span className="ir-sum-row__count">{r.count}</span>
                    </div>
                    <p>{r.text}</p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="ir-note">
            <span className="ir-label">Please note</span>
            <p>{b.note}</p>
          </div>
        </div>
      );
  }
}

// ── Fixed pages ──────────────────────────────────────────────────────────────

function Cover({ ctx, job }: { ctx: Ctx; job: InspectionJob }) {
  const { model } = ctx;
  const coverSrc = ctx.photoUrl(model.coverPhotoId);
  const { x, y, zoom } = model.coverPos;
  return (
    <div className="ir-sheet">
      <section className="ir-page ir-page--cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ir-logo" src={ctx.assets.logo} alt="RAS-VERTEX Maintenance Solutions" />
        <h1 className="ir-h-cover" style={{ marginTop: 48 }}>
          {job.site}.
        </h1>
        <p className="ir-lede" style={{ maxWidth: 820, marginTop: 24 }}>
          {job.blurb}
        </p>
        <div
          className={`ir-cover-photo${ctx.onCoverPointerDown ? " ir-cover-photo--drag" : ""}`}
          style={{ marginTop: 64 }}
          title={ctx.onCoverPointerDown ? "Drag to reposition" : undefined}
          onPointerDown={ctx.onCoverPointerDown}
        >
          {coverSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="ir-cover-img"
              src={coverSrc}
              alt=""
              draggable={false}
              style={{
                objectPosition: `${x}% ${y}%`,
                transform: zoom !== 1 ? `scale(${zoom})` : undefined,
                transformOrigin: `${x}% ${y}%`,
              }}
            />
          )}
        </div>
        <div className="ir-facts" style={{ marginTop: 64 }}>
          {model.facts.map((f) => (
            <div key={f.k} className="ir-fact">
              <div className="ir-label">{f.k}</div>
              <div className="ir-fact__v">{f.v}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Contents({ ctx, layout }: { ctx: Ctx; layout: Layout }) {
  const { model } = ctx;
  const title = (k: string) => model.sections.find((s) => s.key === k)?.title ?? "";
  const it = (k: keyof Layout["secPage"]) => ({ name: title(k), page: layout.secPage[k] });
  const findings: { name: string; page: number | undefined }[] = model.zoneRows.map((z) => ({
    name: z.title,
    page: layout.chapPage[z.zone],
  }));
  if (model.hasOther) findings.push({ name: "Other items of note", page: layout.chapPage.OT });
  findings.push(it("index"));
  const groups = [
    { title: "About this report", items: [it("about"), it("map"), it("defects")] },
    { title: "Findings", items: findings },
    { title: "Summary and next steps", items: [it("summary"), it("works")] },
  ];
  return (
    <div className="ir-sheet">
      <section className="ir-page ir-page--contents">
        <h2 className="ir-h-section">Contents</h2>
        <div className="ir-toc">
          {groups.map((g) => (
            <div key={g.title}>
              <h3 className="ir-h-sub">{g.title}</h3>
              <div className="ir-toc__items">
                {g.items.map((t) => (
                  <div key={t.name} className="ir-toc__row">
                    <span>{t.name}</span>
                    <span className="ir-num">{t.page ?? ""}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Footer no={2} total={layout.total} />
      </section>
    </div>
  );
}

function Works({ ctx, job, layout }: { ctx: Ctx; job: InspectionJob; layout: Layout }) {
  const { works, sections } = ctx.model;
  const sec = sections.find((s) => s.key === "works")!;
  // A long works table leaves no room for the image cards.
  const showExtras = works.items.length <= 12;
  const contact = contactFor(job.contact);
  return (
    <div className="ir-sheet">
      <section className="ir-page ir-page--works">
        <div className="ir-seclabel">
          <span>{sec.label}</span>
        </div>
        <h2 className="ir-h-section">{sec.title}</h2>
        <p className="ir-intro">What needs to be done, in order of priority, and why.</p>

        <div className="ir-works-tbl">
          <div className="ir-tbl-head ir-cols-works">
            <span>Code</span>
            <span>Work</span>
            <span>Why</span>
            <span>Where</span>
          </div>
          {works.items.map((w, i) => (
            <div
              key={w.chip.code}
              className={`ir-tbl-row ir-cols-works${i < works.items.length - 1 ? " is-ruled" : ""}`}
            >
              <ChipView chip={w.chip} />
              <span className="ir-cell--strong">{w.name}</span>
              <span className="ir-cell--small" style={{ textWrap: "pretty" }}>
                {w.why}
              </span>
              <span className="ir-cell--small">{w.zones}</span>
            </div>
          ))}
        </div>

        {showExtras ? (
          <>
            <h3 className="ir-h-card ir-extras-title">Also worth adding</h3>
            <div className="ir-extras">
              {works.extras.map((x) => (
                <div key={x.t} className="ir-extra">
                  <div className="ir-extra__img" style={{ backgroundImage: bg(ctx.assets.images[x.img]) }} />
                  <h3 className="ir-h-sub">{x.t}</h3>
                  <p>{x.d}</p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ flex: "1 1 auto" }} />
        )}

        <div className="ir-cta">
          <a className="ir-btn ir-btn--primary" href={works.href}>
            Request a quote
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </a>
          <div className="ir-contact">
            <h3 className="ir-h-sub">Any questions? Reach out.</h3>
            <p>
              {contact.name}
              {contact.title ? `, ${contact.title}` : ""} · <strong>{contact.phone}</strong> ·{" "}
              <strong>{contact.email}</strong>
            </p>
          </div>
        </div>
        <Footer no={layout.total} total={layout.total} />
      </section>
    </div>
  );
}

// ── Exports ──────────────────────────────────────────────────────────────────

interface DocProps {
  model: InspectionModel;
  layout: Layout;
  job: InspectionJob;
  photoUrl: (id: string | null) => string | null;
  assets: InspectionAssets;
  /** Preview only: page shadows and gaps between sheets. */
  screen?: boolean;
  onPinPointerDown?: (zone: string, e: PointerEvent<HTMLElement>) => void;
  onCoverPointerDown?: (e: PointerEvent<HTMLElement>) => void;
}

export default function InspectionDocument(props: DocProps) {
  const { layout, job } = props;
  const ctx: Ctx = {
    model: props.model,
    photoUrl: props.photoUrl,
    assets: props.assets,
    chapPage: layout.chapPage,
    onPinPointerDown: props.onPinPointerDown,
    onCoverPointerDown: props.onCoverPointerDown,
  };
  return (
    <div className={`ir${props.screen ? " ir--screen" : ""}`}>
      <Cover ctx={ctx} job={job} />
      <Contents ctx={ctx} layout={layout} />
      {layout.pages.map((blocks, pi) => (
        <div key={pi} className="ir-sheet">
          <section className="ir-page">
            {blocks.map((b, i) => (
              <div key={`${i}-${b.key}`} style={{ paddingTop: b.pt }}>
                <div className="ir-blk">
                  <BlockView b={b} ctx={ctx} ruled={b.ruled} />
                </div>
              </div>
            ))}
            <Footer no={pi + 3} total={layout.total} />
          </section>
        </div>
      ))}
      <Works ctx={ctx} job={job} layout={layout} />
    </div>
  );
}

/**
 * Every flowed block (plus each repeat header / continued marker) once, at
 * the content width, for measuring. Photos are left out: image boxes size
 * by aspect ratio, so heights don't depend on them.
 */
export function InspectionMeasure({
  model,
  assets,
}: {
  model: InspectionModel;
  assets: InspectionAssets;
}) {
  const ctx: Ctx = { model, photoUrl: () => null, assets, chapPage: {} };
  const seen = new Set<string>();
  const all: Block[] = [];
  for (const b of model.blocks) {
    for (const x of b.cont ? [b.cont, b] : [b]) {
      if (seen.has(x.key)) continue;
      seen.add(x.key);
      all.push(x);
    }
  }
  return (
    <div className="ir ir-measure" aria-hidden>
      {all.map((b) => (
        <div key={b.key} className="ir-blk" data-bk={b.key}>
          <BlockView b={b} ctx={ctx} ruled />
        </div>
      ))}
    </div>
  );
}
