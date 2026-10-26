// components/reports/anchor-inspection/AnchorDocument.tsx
//
// The Anchor Inspection Report: A4 pages authored at 1280 × 1810 page units,
// following the design handoff. Rendered two ways from this one file:
//   - in the builder, scaled to fit the preview column
//   - on the server, through renderToStaticMarkup, as the PDF's HTML
//     (lib/server/anchorPdf.ts)
// So it holds no state or hooks, and styles come from the <style> string
// below rather than CSS Modules. Pointer handlers only exist in the preview.

import type { PointerEvent } from "react";
import type {
  AnchorImageKey,
  AnchorModel,
  Page,
  RegLine,
  RegRow,
  SummaryItem,
  ZoneBlock,
} from "@/lib/reports/anchor.layout";
import { pad } from "@/lib/reports/anchor.layout";

export interface AnchorAssets {
  images: Record<AnchorImageKey, string>;
  /** Icon name (anchor type or subtype) → URL. */
  icons: Record<string, string>;
}

interface Ctx {
  model: AnchorModel;
  assets: AnchorAssets;
  onCoverPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  onPhotoRename?: (id: string, name: string) => void;
  onPhotoRemove?: (id: string) => void;
}

// ── Stylesheet (scoped under .ar) ────────────────────────────────────────────

export const ANCHOR_CSS = `
.ar{--navy:#011955;--ink-72:rgba(1,25,85,.72);--ink-65:rgba(1,25,85,.65);--ink-60:rgba(1,25,85,.6);--ink-55:rgba(1,25,85,.55);--ink-45:rgba(1,25,85,.45);--ink-35:rgba(1,25,85,.35);--rule:1px solid rgba(1,25,85,.12);--rule-head:1px solid rgba(1,25,85,.25);--grey:rgba(1,25,85,.045);--blue:#deeeff;--bebas:'Bebas Neue',Arial,sans-serif;
  font-family:'Inter',system-ui,-apple-system,'Segoe UI',sans-serif;color:var(--navy);line-height:1.7;font-size:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact;text-align:left}
.ar :where(h1,h2,h3,p,span,div,a,img){color:inherit;font:inherit;letter-spacing:inherit;margin:0;padding:0;box-sizing:border-box}
.ar *{box-sizing:border-box}
.ar img{display:block;max-width:100%}
.ar a{text-decoration:none}
.ar--screen{display:flex;flex-direction:column;align-items:center;gap:40px}
.ar--screen .ar-sheet{box-shadow:0 1px 2px rgba(23,23,26,.06),0 12px 32px -12px rgba(23,23,26,.22)}
.ar-sheet{position:relative;width:1280px;height:1810px;overflow:hidden;background:#fff;break-after:page;flex-shrink:0}
.ar-sheet:last-child{break-after:auto}
.ar-page{position:relative;width:1280px;height:1810px;display:flex;flex-direction:column;padding:80px 96px 0}
.ar-page--cover{padding-bottom:96px}
.ar-page--contents{padding-bottom:130px}
.ar-page--end{padding-bottom:150px}
.ar-seclabel{display:flex;align-items:baseline;gap:16px;margin-bottom:40px}
.ar-seclabel span{font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1;white-space:nowrap}
.ar-seclabel i{flex:1;height:1px;background:rgba(1,25,85,.12)}
.ar-pageno{position:absolute;left:96px;right:96px;bottom:52px;text-align:right;font-family:var(--bebas);font-size:18px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-35);line-height:1}
.ar-h1{font-size:84px;font-weight:700;line-height:1.05;letter-spacing:-.06em}
.ar-h2{font-size:48px;font-weight:700;line-height:1.1;letter-spacing:-.05em}
.ar-h3{font-size:22px;font-weight:700;line-height:1.2;letter-spacing:-.04em}
.ar-h-card{font-size:40px;font-weight:700;line-height:1.1;letter-spacing:-.04em}
.ar-lede{font-size:20px;line-height:1.6;color:var(--ink-65);max-width:820px;text-wrap:pretty}
.ar-label{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-45);line-height:1.3}
.ar-logo{height:60px;width:auto !important;align-self:flex-start}
.ar-cover-photo{flex:1 1 0;min-height:0;border-radius:24px;overflow:hidden;background:var(--grey);position:relative}
.ar-cover-photo--drag{cursor:grab;touch-action:none}
.ar-cover-photo--drag:active{cursor:grabbing}
.ar-cover-photo img{width:100%;height:100%;max-width:none;object-fit:cover;user-select:none}
.ar-facts{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(3,minmax(0,1fr));gap:12px}
.ar-fact{background:var(--grey);border-radius:16px;padding:22px 28px;min-width:0}
.ar-fact__v{font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.3;margin-top:8px;text-wrap:pretty}
.ar-toc{margin-top:auto;display:flex;flex-direction:column;gap:64px}
.ar-toc__row{display:flex;justify-content:space-between;align-items:baseline;gap:24px;font-size:20px;line-height:1.4;color:var(--ink-72)}
.ar-stats{background:var(--blue);border-radius:24px;padding:40px 48px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:24px;margin-top:56px}
.ar-stat{display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px}
.ar-stat b{font-size:72px;font-weight:700;letter-spacing:-.05em;line-height:1}
.ar-stat span{font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-55);line-height:1.3}
.ar-map{position:relative;border-radius:16px;overflow:hidden;background:var(--grey);margin-top:24px}
.ar-map>img{width:100%;height:100%;object-fit:cover}
.ar-map svg{position:absolute;inset:0;width:100%;height:100%}
.ar-pill{display:inline-flex;align-items:center;height:20px;padding:0 5px;border-radius:6px;font-size:11px;font-weight:700;line-height:1;white-space:nowrap}
.ar-pin{position:absolute;transform:translate(-50%,-50%)}
.ar-table{display:flex;flex-direction:column}
.ar-thead,.ar-tr{display:grid;gap:24px}
.ar-thead{padding-bottom:14px;border-bottom:var(--rule-head);font-size:13px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-45);line-height:1.3}
.ar-tr{align-items:center;border-bottom:var(--rule);line-height:1.3;font-size:20px;font-variant-numeric:tabular-nums}
.ar-tr:last-child{border-bottom:0}
.ar-r{text-align:right}
.ar-dim{color:var(--ink-65)}
.ar-icon{flex-shrink:0;background:center/contain no-repeat}
.ar-cell{display:flex;align-items:center;min-width:0}
.ar-result{justify-self:start;display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;line-height:1}
.ar-photos{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px 10px}
.ar-photo{aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:var(--grey)}
.ar-photo{position:relative}
.ar-photo img{width:100%;height:100%;object-fit:cover}
.ar-photo-remove{position:absolute;top:14px;right:14px;width:44px;height:44px;border:0;border-radius:999px;background:rgba(1,25,85,.72);color:#fff;font-size:26px;line-height:1;cursor:pointer;opacity:0;transition:opacity .15s}
.ar-photo:hover .ar-photo-remove{opacity:1}
.ar-caption{font-size:17px;line-height:1.4;color:var(--ink-65);margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
input.ar-caption{display:block;width:100%;border:0;border-radius:6px;background:transparent;font-family:inherit;padding:2px 6px;margin-left:-6px;outline:none;cursor:text}
input.ar-caption:hover{background:rgba(1,25,85,.05)}
input.ar-caption:focus{background:#fff;box-shadow:0 0 0 2px #4a82c9;color:var(--navy)}
.ar-certfacts{background:var(--grey);border-radius:24px;padding:40px 48px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:32px 48px;margin-top:56px}
.ar-certfacts>div{display:flex;flex-direction:column;gap:8px;min-width:0}
.ar-certfacts b{font-size:20px;font-weight:600;line-height:1.35;text-wrap:pretty}
.ar-note{font-size:17px;line-height:1.6;color:var(--ink-60);max-width:960px;text-wrap:pretty;white-space:pre-line}
.ar-rich{white-space:normal;display:flex;flex-direction:column;gap:10px}
.ar-rich :where(ul,ol){margin:0;padding-left:26px;display:flex;flex-direction:column;gap:4px}
.ar-rich ul{list-style:disc}.ar-rich ol{list-style:decimal}
.ar-rich li p{margin:0}
.ar-rich h2,.ar-rich h3{font-size:20px;font-weight:700;letter-spacing:-.02em;color:var(--navy);line-height:1.3;margin-top:8px}
.ar-rich strong,.ar-rich b{font-weight:700;color:var(--navy)}
.ar-rich em,.ar-rich i{font-style:italic}
.ar-rich s{text-decoration:line-through}
.ar-rich blockquote{border-left:3px solid rgba(1,25,85,.15);padding-left:16px}
.ar-rich hr{border:0;border-top:var(--rule);margin:6px 0}
.ar-rich ul[data-type="taskList"]{list-style:none;padding-left:0}
.ar-rich li[data-type="taskItem"]{display:flex;align-items:flex-start;gap:10px}
.ar-rich li[data-type="taskItem"]>label{flex-shrink:0;display:flex;padding-top:5px}
.ar-rich li[data-type="taskItem"] input{appearance:none;-webkit-appearance:none;width:16px;height:16px;margin:0;border:1.5px solid rgba(1,25,85,.45);border-radius:4px;display:grid;place-items:center}
.ar-rich li[data-type="taskItem"] input:checked{background:var(--navy);border-color:var(--navy)}
.ar-rich li[data-type="taskItem"] input:checked::after{content:"";width:8px;height:4px;border:2px solid #fff;border-top:0;border-right:0;transform:translateY(-1px) rotate(-45deg)}
.ar-rich li[data-type="taskItem"][data-checked="true"]>div{text-decoration:line-through;opacity:.7}
.ar-rich label span{display:none}
.ar-services{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;height:750px;margin-top:56px}
.ar-services>div{display:flex;flex-direction:column;gap:10px;min-width:0}
.ar-svc{position:relative;display:block;border-radius:20px;overflow:hidden;background:rgba(1,25,85,.08) center/cover no-repeat;min-height:0}
.ar-svc span{position:absolute;left:0;bottom:0;background:#fff;border-top-right-radius:14px;padding:10px 16px 8px;font-size:17px;font-weight:700;letter-spacing:-.02em;line-height:1.2;white-space:nowrap}
.ar-clients{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:28px;align-items:center;margin-top:40px}
.ar-clients>div{display:flex;align-items:center;justify-content:center;height:64px;min-width:0}
.ar-clients img{max-width:100%;width:auto;object-fit:contain}
.ar-close{margin-top:auto;display:flex;align-items:flex-end;justify-content:space-between;gap:32px}
.ar-btn{display:inline-flex;align-items:center;gap:16px;height:64px;padding:0 36px;border-radius:14px;background:var(--navy);color:#fff !important;font-size:20px;font-weight:700;letter-spacing:-.01em}
`;

export function AnchorStyles() {
  return <style dangerouslySetInnerHTML={{ __html: ANCHOR_CSS }} />;
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

const secText = (n: number) => `Section ${pad(n)} / 04`;

function PageNo({ no, total }: { no: number; total: number }) {
  return (
    <div className="ar-pageno">
      Page {pad(no)} / {pad(total)}
    </div>
  );
}

function Icon({ ctx, name, size }: { ctx: Ctx; name: string; size: number }) {
  const src = ctx.assets.icons[name] ?? ctx.assets.icons["rope-access-anchor"];
  return (
    <span
      className="ar-icon"
      style={{ width: size, height: size, backgroundImage: `url("${src}")` }}
    />
  );
}

const RESULT_STYLE: Record<
  RegRow["result"],
  { background: string; color: string }
> = {
  Passed: { background: "#e3f5ea", color: "#3f9a68" },
  Failed: { background: "#fbe7e7", color: "#b54a4a" },
  "N/A": { background: "rgba(1,25,85,.045)", color: "rgba(1,25,85,.45)" },
};

// ── Pages ─────────────────────────────────────────────────────────────────────

function Cover({ ctx }: { ctx: Ctx }) {
  const { model } = ctx;
  const { x, y, zoom } = model.coverPos;
  return (
    <div className="ar-sheet">
      <section className="ar-page ar-page--cover">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="ar-logo"
          src={ctx.assets.images.logo}
          alt="RAS-VERTEX Maintenance Solutions"
        />
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
          {model.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
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
          )}
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
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {g.items.map((t) => (
                  <div key={t.name} className="ar-toc__row">
                    <span>{t.name}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {t.page}
                    </span>
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

const TYPE_COLS = {
  gridTemplateColumns: "minmax(0,1fr) 160px 90px 100px 100px",
};

function ZoneView({
  ctx,
  zone,
  first,
}: {
  ctx: Ctx;
  zone: ZoneBlock;
  first: boolean;
}) {
  // Several zones: "Zone 3", matching the register, with its name beside it.
  const many = ctx.model.zones.length > 1;
  const title = many ? `Zone ${ctx.model.zones.indexOf(zone) + 1}` : "Anchor layout";
  const name = zone.name.trim();
  return (
    <div>
      <h3 className="ar-h3" style={{ marginTop: first ? 0 : 72 }}>
        {title}
        {many && name && name.toLowerCase() !== title.toLowerCase() && (
          <span style={{ fontWeight: 500, color: "rgba(1,25,85,.45)", marginLeft: 12 }}>{name}</span>
        )}
      </h3>
      {zone.mapUrl && (
        <div
          className="ar-map"
          style={{ width: zone.mapW, aspectRatio: String(zone.mapRatio) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zone.mapUrl} alt={`${zone.name} aerial`} />
          {zone.lines.length > 0 && (
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              {zone.lines.map((l, i) => (
                <line
                  key={i}
                  {...{ x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2 }}
                  stroke={l.color}
                  strokeWidth={3}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              ))}
            </svg>
          )}
          {zone.pins.map((p) => (
            <span
              key={p.id}
              className="ar-pill ar-pin"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                background: p.pastel.bg,
                color: p.pastel.fg,
              }}
            >
              {p.label}
            </span>
          ))}
        </div>
      )}
      {zone.types.length > 0 && (
        <div className="ar-table" style={{ marginTop: 56 }}>
          <div className="ar-thead" style={TYPE_COLS}>
            <span>Anchor type</span>
            <span>Anchors</span>
            <span className="ar-r">Qty</span>
            <span className="ar-r">Passed</span>
            <span className="ar-r">Failed</span>
          </div>
          {zone.types.map((t) => (
            <div
              key={t.key}
              className="ar-tr"
              style={{ ...TYPE_COLS, padding: "12px 0" }}
            >
              <div className="ar-cell" style={{ gap: 14 }}>
                <Icon ctx={ctx} name={t.icon} size={28} />
                <span style={{ fontWeight: 600 }}>{t.name}</span>
              </div>
              <div className="ar-cell" style={{ gap: 10 }}>
                <span
                  className="ar-pill"
                  style={{
                    background: t.pastel.bg,
                    color: t.pastel.fg,
                    flexShrink: 0,
                  }}
                >
                  A
                </span>
                <span className="ar-dim" style={{ whiteSpace: "nowrap" }}>
                  {t.range}
                </span>
              </div>
              <span className="ar-r">{t.qty}</span>
              <span className="ar-r">{t.passed}</span>
              <span className="ar-r">{t.failed}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SummaryPage({
  ctx,
  page,
}: {
  ctx: Ctx;
  page: Extract<Page, { kind: "summary" }>;
}) {
  const { model } = ctx;
  return (
    <section className="ar-page">
      <SecLabel text={secText(1)} />
      {page.items.map((it: SummaryItem, i) =>
        it.kind === "intro" ? (
          <div key="intro">
            <h2 className="ar-h2">Summary</h2>
            <p className="ar-lede" style={{ marginTop: 20 }}>
              {model.summary}
            </p>
            <div className="ar-stats">
              {model.stats.map((s) => (
                <div key={s.k} className="ar-stat">
                  <b>{s.v}</b>
                  <span>{s.k}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <ZoneView
            key={it.zone.id + i}
            ctx={ctx}
            zone={it.zone}
            first={it.first}
          />
        ),
      )}
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

const REG_COLS = {
  gridTemplateColumns: "110px minmax(0,1fr) 190px 210px 120px",
};

function RegisterPage({
  ctx,
  page,
}: {
  ctx: Ctx;
  page: Extract<Page, { kind: "register" }>;
}) {
  return (
    <section className="ar-page">
      {page.first ? (
        <>
          <SecLabel text={secText(2)} />
          <h2 className="ar-h2">Asset register</h2>
          <p className="ar-lede" style={{ margin: "20px 0 56px" }}>
            Every anchor inspected, its type and the test result.
          </p>
        </>
      ) : (
        <SecLabel text="Asset register" />
      )}
      {page.rows.length > 0 || !page.notes ? (
        <RegTable ctx={ctx} rows={page.rows} />
      ) : null}
      {page.notes && <Notes html={page.notes} top={page.rows.length === 0} />}
      <PageNo no={page.no} total={ctx.model.total} />
    </section>
  );
}

function Notes({ html, top }: { html: string; top: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        marginTop: top ? 0 : 56,
      }}
    >
      <span className="ar-label">Technician notes</span>
      {/* Sanitised in buildAnchorModel (lib/reports/richText.ts). */}
      <div
        className="ar-note ar-rich"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function RegHead() {
  return (
    <div className="ar-thead" style={REG_COLS}>
      <span>Asset</span>
      <span>Type</span>
      <span>Inspected</span>
      <span>Next inspection</span>
      <span>Result</span>
    </div>
  );
}

function RegRowView({ ctx, r }: { ctx: Ctx; r: RegRow }) {
  return (
    <div className="ar-tr" style={{ ...REG_COLS, height: 48 }}>
      <span style={{ fontWeight: 600 }}>{r.label}</span>
      <div className="ar-cell" style={{ gap: 12 }}>
        <Icon ctx={ctx} name={r.icon} size={24} />
        <span
          className="ar-dim"
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {r.type}
        </span>
      </div>
      <span className="ar-dim">{r.inspected}</span>
      <span className="ar-dim">{r.next}</span>
      <span className="ar-result" style={RESULT_STYLE[r.result]}>
        {r.result}
      </span>
    </div>
  );
}

// The page's register lines, split into one table per zone: a zone line
// starts a new table under a "Zone 3" title.
function RegTable({ ctx, rows }: { ctx: Ctx; rows: RegLine[] }) {
  const tables: { title: string | null; rows: RegRow[] }[] = [];
  for (const line of rows) {
    if (line.kind === "group") tables.push({ title: line.title, rows: [] });
    else {
      if (!tables.length) tables.push({ title: null, rows: [] });
      tables[tables.length - 1].rows.push(line);
    }
  }
  if (!tables.length) {
    return (
      <div className="ar-table">
        <RegHead />
        <p className="ar-lede" style={{ paddingTop: 24 }}>
          No anchors recorded yet.
        </p>
      </div>
    );
  }
  return (
    <>
      {tables.map((t, i) => (
        <div key={i} className="ar-table" style={{ marginTop: i > 0 ? 72 : 0 }}>
          {t.title && (
            <h3 className="ar-h3" style={{ marginBottom: 16 }}>
              {t.title}
            </h3>
          )}
          <RegHead />
          {t.rows.map((r) => (
            <RegRowView key={r.id} ctx={ctx} r={r} />
          ))}
        </div>
      ))}
    </>
  );
}

function PhotosPage({
  ctx,
  page,
}: {
  ctx: Ctx;
  page: Extract<Page, { kind: "photos" }>;
}) {
  return (
    <section className="ar-page">
      <SecLabel text="Photos" />
      <div className="ar-photos">
        {page.photos.map((p) => (
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
                  if (v && v + ext !== p.name)
                    ctx.onPhotoRename!(p.id, v + ext);
                  else e.currentTarget.value = p.name.replace(/\.[^.]+$/, "");
                }}
              />
            ) : (
              <div className="ar-caption">{p.name.replace(/\.[^.]+$/, "")}</div>
            )}
          </div>
        ))}
      </div>
      <PageNo no={page.no} total={ctx.model.total} />
    </section>
  );
}

const STANDARDS = [
  [
    "AS/NZS 4488.2:1997",
    "Industrial rope access systems: Selection, use and maintenance",
  ],
  [
    "AS/NZS 1891.4:2009",
    "Industrial fall-arrest systems and devices: Selection, use and maintenance",
  ],
  [
    "AS/NZS 1891.1:2007",
    "Industrial fall-arrest systems and devices: Harnesses and equipment",
  ],
];

const NOTES = [
  "Hydraulic load testing equipment holds valid calibration and service certification.",
  "Height safety systems are for the use of competent persons only. For limitations and conditions, users must refer to the installer’s user manual.",
  "All height safety systems require annual recertification of hardware items and six-monthly recertification of synthetic equipment, such as harnesses and impact absorbers, as specified in the above standards.",
  "RAS-VERTEX attaches coloured test tags to all anchor points, identifying the type and intended use of each anchor.",
];

function CertPage({
  ctx,
  page,
}: {
  ctx: Ctx;
  page: Extract<Page, { kind: "cert" }>;
}) {
  const { model } = ctx;
  return (
    <section className="ar-page ar-page--end">
      <SecLabel text={secText(3)} />
      <h2 className="ar-h2">Certification</h2>
      <p className="ar-lede" style={{ marginTop: 20 }}>
        Certification of test and examination #{model.certNumber}.
      </p>
      <div className="ar-certfacts">
        {model.certFacts.map((f) => (
          <div key={f.k}>
            <span className="ar-label">{f.k}</span>
            <b>{f.v || "—"}</b>
          </div>
        ))}
      </div>
      <p style={{ marginTop: 56, lineHeight: 1.6, maxWidth: 960 }}>
        RAS-VERTEX have completed a height safety system inspection and applied
        hydraulic load testing to the required components as specified by:
      </p>
      <div className="ar-table" style={{ marginTop: 32 }}>
        <div
          className="ar-thead"
          style={{ gridTemplateColumns: "260px minmax(0,1fr)" }}
        >
          <span>Standard</span>
          <span>Title</span>
        </div>
        {STANDARDS.map(([code, title]) => (
          <div
            key={code}
            className="ar-tr"
            style={{
              gridTemplateColumns: "260px minmax(0,1fr)",
              padding: "12px 0",
            }}
          >
            <span style={{ fontWeight: 600 }}>{code}</span>
            <span className="ar-dim">{title}</span>
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          marginTop: 56,
        }}
      >
        <span className="ar-label">Please note</span>
        {NOTES.map((t) => (
          <p key={t} className="ar-note">
            {t}
          </p>
        ))}
      </div>
      {model.comments && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 32,
          }}
        >
          <span className="ar-label">Comments</span>
          <p className="ar-note">{model.comments}</p>
        </div>
      )}
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
        }}
      >
        <span style={{ lineHeight: 1.4 }}>Sincerely,</span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={ctx.assets.images.signature}
          alt="Phil Clark signature"
          style={{
            width: 280,
            height: "auto",
            marginTop: 16,
            mixBlendMode: "multiply",
          }}
        />
        <span className="ar-h3" style={{ marginTop: 16 }}>
          Phil Clark
        </span>
        <span className="ar-label" style={{ marginTop: 8 }}>
          Director
        </span>
      </div>
      <PageNo no={page.no} total={model.total} />
    </section>
  );
}

const SITE = "https://www.rasvertex.com.au";
const SERVICES: {
  name: string;
  img: AnchorImageKey;
  href: string;
  h?: number;
  pos?: string;
}[][] = [
  [
    { name: "Height safety", img: "height", href: "/height-safety", h: 270 },
    { name: "Building cleaning", img: "cleaning", href: "/external-cleaning" },
  ],
  [
    {
      name: "Painting",
      img: "painting",
      href: "/painting",
      h: 445,
      pos: "center 22%",
    },
    { name: "Maintenance", img: "maintenance", href: "/maintenance" },
  ],
  [
    {
      name: "Building inspections",
      img: "inspections",
      href: "/building-inspections",
      h: 355,
      pos: "center 80%",
    },
    { name: "Waterproofing", img: "waterproofing", href: "/waterproofing" },
  ],
];
const CLIENTS: [AnchorImageKey, string, number][] = [
  ["mosaic", "Mosaic", 48],
  ["coolum", "Coolum", 64],
  ["maroochy", "Maroochy RSL", 62],
  ["trafalgar", "Trafalgar", 64],
  ["mcnab", "McNab", 40],
  ["accor", "Accor", 62],
  ["novotel", "Novotel", 59],
  ["racv", "RACV", 64],
];

function Partner({ ctx }: { ctx: Ctx }) {
  const img = ctx.assets.images;
  return (
    <div className="ar-sheet">
      <section className="ar-page ar-page--end">
        <SecLabel text={secText(4)} />
        <h2 className="ar-h2" style={{ whiteSpace: "nowrap" }}>
          We maintain the buildings where
          <br />
          Sunshine Coast locals live, learn, and work.
        </h2>
        <div className="ar-services">
          {SERVICES.map((col, i) => (
            <div key={i}>
              {col.map((s) => (
                <a
                  key={s.name}
                  className="ar-svc"
                  href={SITE + s.href}
                  target="_blank"
                  rel="noopener"
                  style={{
                    backgroundImage: `url("${img[s.img]}")`,
                    backgroundPosition: s.pos ?? "center",
                    ...(s.h ? { height: s.h, flexShrink: 0 } : { flex: 1 }),
                  }}
                >
                  <span>{s.name}</span>
                </a>
              ))}
            </div>
          ))}
        </div>
        <h3 className="ar-h-card" style={{ marginTop: 112 }}>
          Trusted by the coast’s
          <br />
          best run buildings.
        </h3>
        <div className="ar-clients">
          {CLIENTS.map(([k, alt, h]) => (
            <div key={k}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img[k]} alt={alt} style={{ maxHeight: h }} />
            </div>
          ))}
        </div>
        <div className="ar-close">
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 24,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.caroline}
                alt="Caroline"
                style={{
                  width: 96,
                  height: 120,
                  borderRadius: 14,
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                  style={{
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    lineHeight: 1.2,
                  }}
                >
                  Caroline
                </span>
                <span style={{ lineHeight: 1.3, color: "rgba(1,25,85,.6)" }}>
                  Client Services Manager
                </span>
              </div>
            </div>
            <a
              className="ar-btn"
              href={`${SITE}/contact`}
              target="_blank"
              rel="noopener"
            >
              Let us know how we can help
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: 32,
            }}
          >
            <h3 className="ar-h-card" style={{ fontSize: 32 }}>
              Fully qualified.
            </h3>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 36,
                height: 64,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.qbcc}
                alt="QBCC"
                style={{ height: 60, width: "auto" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.smartstrata}
                alt="Smart Strata"
                style={{ height: 60, width: "auto" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.workcover}
                alt="WorkCover Queensland"
                style={{ height: 42, width: "auto" }}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Document ──────────────────────────────────────────────────────────────────

interface DocProps {
  model: AnchorModel;
  assets: AnchorAssets;
  screen?: boolean;
  onCoverPointerDown?: (e: PointerEvent<HTMLElement>) => void;
  /** Preview only: captions on photo pages become editable. */
  onPhotoRename?: (id: string, name: string) => void;
  onPhotoRemove?: (id: string) => void;
}

export default function AnchorDocument({
  model,
  assets,
  screen,
  onCoverPointerDown,
  onPhotoRename,
  onPhotoRemove,
}: DocProps) {
  const ctx: Ctx = {
    model,
    assets,
    onCoverPointerDown,
    onPhotoRename,
    onPhotoRemove,
  };
  return (
    <div className={`ar${screen ? " ar--screen" : ""}`}>
      <Cover ctx={ctx} />
      <Contents ctx={ctx} />
      {model.pages.map((p) => (
        <div key={`${p.kind}-${p.no}`} className="ar-sheet">
          {p.kind === "summary" ? (
            <SummaryPage ctx={ctx} page={p} />
          ) : p.kind === "register" ? (
            <RegisterPage ctx={ctx} page={p} />
          ) : p.kind === "photos" ? (
            <PhotosPage ctx={ctx} page={p} />
          ) : (
            <CertPage ctx={ctx} page={p} />
          )}
        </div>
      ))}
      <Partner ctx={ctx} />
    </div>
  );
}
