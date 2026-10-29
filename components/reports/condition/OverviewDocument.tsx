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
}

// ── Stylesheet: the Anchor report's, plus the parts only this report has ─────

export const OVERVIEW_CSS =
  ANCHOR_CSS +
  `
.jo-items{display:flex;flex-direction:column;gap:18px}
.jo-items__group{font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.3;margin-bottom:6px}
.jo-items ul{margin:0;padding-left:26px;list-style:disc;display:flex;flex-direction:column;gap:2px;font-size:17px;line-height:1.6;color:var(--ink-65)}
.jo-cols{grid-template-columns:260px minmax(0,1fr) 140px}
.jo-cols--notes{grid-template-columns:220px 280px 120px minmax(0,1fr)}
.jo-tr{height:56px}
.jo-tr--notes{height:76px}
.jo-note{font-size:17px;line-height:1.4;color:var(--ink-65);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-wrap:pretty}
.jo-sec{height:72px;display:flex;align-items:flex-end;padding-bottom:14px;border-bottom:var(--rule-head);font-size:22px;font-weight:700;letter-spacing:-.04em;line-height:1.2}
.jo-sub{height:56px;font-weight:600;color:var(--ink-65)}
.jo-total{height:72px;align-items:center;background:var(--blue);border-radius:14px;padding:0 24px;margin:0 -24px;border-bottom:0;font-weight:700}
.jo-grid{display:grid;column-gap:24px;row-gap:32px}
.jo-day{font-size:22px;font-weight:700;letter-spacing:-.04em;line-height:1.2;margin-bottom:20px}
.jo-day span{font-weight:400;color:var(--ink-45)}
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

function PageNo({ no, total }: { no: number; total: number }) {
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

function Cover({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  const { x, y, zoom } = model.coverPos;
  return (
    <div className="ar-sheet">
      <section className="ar-page ar-page--cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ar-logo" src={ctx.assets.images.logo} alt="RAS-VERTEX Maintenance Solutions" />
        <h1 className="ar-h1" style={{ marginTop: 48 }}>
          {model.site}.
        </h1>
        <p className="ar-lede" style={{ fontSize: 22, marginTop: 24 }}>
          {model.blurb}
        </p>
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
            <div key={f.k} className="ar-fact">
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

/** The quote's line items, under each cost centre — names only, no prices. */
function LineItems({ groups }: { groups: { group: string; labels: string[] }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 56 }}>
      <span className="ar-label">Line items</span>
      <div className="jo-items">
        {groups.map((g, i) => (
          <div key={i}>
            <div className="jo-items__group">{g.group}</div>
            <ul>
              {g.labels.map((l, j) => (
                <li key={j}>{l}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryPage({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: "summary" }> }) {
  const { model } = ctx;
  return (
    <section className="ar-page">
      <SecLabel text={model.secText.summary} />
      {page.blocks.map((b) =>
        b === "intro" ? (
          <div key="intro">
            <h2 className="ar-h2">Job summary</h2>
            <p className="ar-lede" style={{ marginTop: 20 }}>
              {model.summaryLede}
            </p>
          </div>
        ) : b === "scope" ? (
          <Notes key={b} label={model.scopeSource ? `Scope of works · ${model.scopeSource}` : "Scope of works"} html={model.scope} />
        ) : b === "items" ? (
          <LineItems key={b} groups={model.items} />
        ) : (
          <Notes
            key={b}
            label={b === "comments" ? "Comments" : "Recommendations"}
            html={b === "comments" ? model.comments : model.recommendations}
          />
        ),
      )}
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

function HourRow({ it, notes }: { it: HourItem; notes: boolean }) {
  const cols = notes ? "jo-cols--notes" : "jo-cols";
  switch (it.kind) {
    case "section":
      return <div className="jo-sec">{it.title}</div>;
    case "row":
      return (
        <div className={`ar-tr jo-tr ${notes ? "jo-tr--notes" : ""} ${cols}`}>
          <span>{scheduleDate(it.date)}</span>
          <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
          <span className="ar-r">{it.hours > 0 ? formatHours(it.hours) : "—"}</span>
          {notes && <span className="jo-note">{it.note}</span>}
        </div>
      );
    case "subtotal":
      return (
        <div className={`ar-tr jo-sub ${cols}`}>
          <span>{it.title} subtotal</span>
          <span />
          <span className="ar-r">{formatHours(it.hours)}</span>
          {notes && <span />}
        </div>
      );
    case "total":
      return (
        <div className={`ar-tr jo-total ${cols}`}>
          <span>Total hours</span>
          <span />
          <span className="ar-r">{formatHours(it.hours)}</span>
          {notes && <span />}
        </div>
      );
  }
}

function HoursPage({ ctx, page }: { ctx: Ctx; page: Extract<Page, { kind: "hours" }> }) {
  const { model } = ctx;
  const notes = model.showNotes;
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
        <div className={`ar-thead ${notes ? "jo-cols--notes" : "jo-cols"}`}>
          <span>Date</span>
          <span>Team member</span>
          <span className="ar-r">Hours</span>
          {notes && <span>Notes</span>}
        </div>
        {page.items.map((it, i) => (
          <HourRow key={i} it={it} notes={notes} />
        ))}
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
                  <img src={p.url} alt="" />
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
}

export default function OverviewDocument({ model, assets, screen, onCoverPointerDown, onPhotoRename, onPhotoRemove }: DocProps) {
  const ctx: Ctx = { model, assets, onCoverPointerDown, onPhotoRename, onPhotoRemove };
  return (
    <div className={`ar jo${screen ? " ar--screen" : ""}`}>
      <Cover ctx={ctx} />
      <Contents ctx={ctx} />
      {model.pages.map((p) => (
        <div key={`${p.kind}-${p.no}`} className="ar-sheet">
          {p.kind === "summary" ? (
            <SummaryPage ctx={ctx} page={p} />
          ) : p.kind === "hours" ? (
            <HoursPage ctx={ctx} page={p} />
          ) : (
            <PhotosPage ctx={ctx} page={p} />
          )}
        </div>
      ))}
      <Partner images={assets.images} label={model.secText.about} />
    </div>
  );
}
