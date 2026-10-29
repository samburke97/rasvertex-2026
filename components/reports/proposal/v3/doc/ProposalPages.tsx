// components/reports/proposal/v3/doc/ProposalPages.tsx
//
// The A4 proposal itself. Pure renderers of (proposal, derived): no inputs,
// no editing state. The Build/Review preview and the PDF export
// (app/api/reports/export-proposal-pdf) render this same component, so the
// preview is the PDF.
//
// Every sheet is 210×297mm holding a 1280 × 1810.29 artboard scaled by
// 0.6200781; all sizes below are in those page units. Styles are inline,
// lifted from the reference prototype, because the PDF is rendered with
// renderToStaticMarkup and has no stylesheet of ours.

import type { CSSProperties, ReactNode } from "react";
import { codeName, money, parseAmt, type Derived } from "@/lib/reports/proposal/v3/derive";
import { FINDING_PHOTO_H, MAX_POINTS, type Sheet, type SheetData } from "@/lib/reports/proposal/v3/layout";
import { RICH_CSS, richHtml, richItems } from "@/lib/reports/proposal/v3/rich";
import {
  BANDS,
  BRANDS,
  CODES,
  FLAG_GROUPS,
  PRESTART_GROUPS,
  STAGE_COLOURS,
  TERMS,
  asset,
  tradeOf,
  type PageId,
  type Proposal,
} from "@/lib/reports/proposal/v3/types";

// ── Tokens (styles/tokens.css, document layer) ───────────────────────────────
const NAVY = "#011955";
const INK = (a: number) => `rgba(1,25,85,${a})`;
const RULE = INK(0.12);
const RULE_STRONG = INK(0.25);
const CARD = INK(0.045);
const CARD_STRONG = INK(0.08);
const BLUE_CARD = "#deeeff";
const BIND = "rgba(62,127,176,0.14)";
const GREEN = { bg: "#dff2e6", fg: "#2f7a55" };
const RED = { bg: "#fbe7e7", fg: "#a83a3a" };
const BEBAS = "'Bebas Neue',Arial,sans-serif";
const INTER = "'Inter',system-ui,-apple-system,'Segoe UI',sans-serif";

export const SHEET_SHADOW = "0 1px 2px rgba(23,23,26,0.06),0 12px 32px -12px rgba(23,23,26,0.22)";

export type DocMode = "build" | "review" | "print";

interface PageProps {
  r: DocProps;
  s: Sheet;
}

export interface DocProps {
  p: Proposal;
  D: Derived;
  mode: DocMode;
  /** Resolves any photo ref or asset path to a URL (data: URLs in the PDF). */
  img: (ref: string) => string;
  selected?: PageId | null;
  onPick?: (id: PageId) => void;
  /** Build only: a finding's photo was clicked. */
  onPickFinding?: (index: number) => void;
  /** Build only: an editable element was clicked — its path inside p.d. */
  onPickField?: (id: PageId, path: string) => void;
  focusFinding?: number | null;
}

const bg = (url: string) => (url ? `url("${url}")` : "none");

/** A rich prose field (paragraphs, lists, bold, italic), styled by `style`. */
function Rich({ v, style, edit }: { v: string; style: CSSProperties; edit?: string }) {
  const html = richHtml(v);
  if (!html) return null;
  return <div className="pb3-rt" data-edit={edit} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** One item of a list field: inline HTML (bold / italic only). */
const Inline = ({ html }: { html: string }) => <span dangerouslySetInnerHTML={{ __html: html }} />;

const label: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: INK(0.45),
  lineHeight: 1.3,
};
const h2: CSSProperties = { fontSize: 48, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.05em", margin: 0 };
const h3card: CSSProperties = { fontSize: 40, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.05em", margin: 0 };
const sub: CSSProperties = { fontSize: "1.375rem", fontWeight: 700, lineHeight: 1.25, letterSpacing: "-0.04em", margin: 0 };
const lede = (maxWidth = 900, mt = 20): CSSProperties => ({
  fontSize: "1.25rem",
  lineHeight: 1.6,
  color: INK(0.65),
  maxWidth,
  margin: `${mt}px 0 0`,
  textWrap: "pretty",
});
const card: CSSProperties = { background: CARD, borderRadius: 16, padding: "22px 28px", minWidth: 0 };
const cardValue: CSSProperties = {
  fontSize: "1.25rem",
  fontWeight: 700,
  letterSpacing: "-0.02em",
  lineHeight: 1.3,
  marginTop: 8,
  textWrap: "pretty",
};
const chip = (b: { bg: string; fg: string }): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 44,
  height: 28,
  padding: "0 8px",
  borderRadius: 8,
  background: b.bg,
  color: b.fg,
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.04em",
  lineHeight: 1,
  justifySelf: "start",
});
const codeChip = (code: string) => chip(BANDS[CODES[code]?.band ?? "grey"]);
const tableHead = (cols: string, mt = 56): CSSProperties => ({
  display: "grid",
  gridTemplateColumns: cols,
  gap: 24,
  paddingBottom: 14,
  marginTop: mt,
  borderBottom: `1px solid ${RULE_STRONG}`,
  ...label,
  lineHeight: 1.7,
});
const rule = (i: number, n: number) => (i < n - 1 ? `1px solid ${RULE}` : "0");
const photo = (url: string, extra: CSSProperties = {}): CSSProperties => ({
  background: `${CARD} center/cover no-repeat`,
  backgroundImage: bg(url),
  ...extra,
});

// ── Shared pieces ────────────────────────────────────────────────────────────

function Bind({ build, children }: { build: boolean; children: ReactNode }) {
  return (
    <span
      data-bind="1"
      style={{ borderRadius: 4, ...(build ? { background: BIND, boxShadow: `0 0 0 3px ${BIND}` } : {}) }}
    >
      {children}
    </span>
  );
}

function SecLabel({ text }: { text?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 40 }}>
      <span
        style={{
          fontFamily: BEBAS,
          fontSize: 18,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: INK(0.35),
          lineHeight: 1,
        }}
      >
        {text}
      </span>
      <div style={{ flex: 1, height: 1, background: RULE }} />
    </div>
  );
}

function Footer({ r, s }: PageProps) {
  const b = r.mode === "build";
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        right: 96,
        bottom: 52,
        display: "flex",
        justifyContent: "space-between",
        fontFamily: BEBAS,
        fontSize: 18,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: INK(0.35),
        lineHeight: 1,
      }}
    >
      <span>
        <Bind build={b}>{r.D.bound.building}</Bind> · Q <Bind build={b}>{r.D.bound.quote}</Bind>
      </span>
      <span>
        Page {r.D.sheetNo[s.key] ?? "00"} / {r.D.pageTotal}
      </span>
    </div>
  );
}

function ContactFooter({ r }: { r: DocProps }) {
  const b = r.mode === "build";
  const v = r.D.bound;
  return (
    <div
      style={{
        position: "absolute",
        left: 96,
        right: 96,
        bottom: 52,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: "16px 40px",
      }}
    >
      <h3 style={sub}>Any questions? Reach out.</h3>
      <p style={{ fontSize: "1.25rem", margin: 0 }}>
        <Bind build={b}>{v.pm}</Bind>, <Bind build={b}>{v.pmTitle}</Bind> ·{" "}
        <strong>
          <Bind build={b}>{v.phone}</Bind>
        </strong>{" "}
        ·{" "}
        <strong>
          <Bind build={b}>{v.email}</Bind>
        </strong>
      </p>
    </div>
  );
}

function Sheet({ r, s, cover, children }: PageProps & { cover?: boolean; children: ReactNode }) {
  const id = s.id;
  const sel = r.mode === "build" && r.selected === id;
  return (
    <div
      data-sheet="1"
      data-page={s.part ? undefined : id}
      data-sheet-key={s.key}
      className={r.mode === "build" ? "pb3-sheet pb3-build" : "pb3-sheet"}
      onClick={
        r.mode === "build"
          ? (e) => {
              const t = e.target as HTMLElement;
              const fi = t.closest<HTMLElement>("[data-finding]");
              const ed = t.closest<HTMLElement>("[data-edit]");
              if (fi && r.onPickFinding) r.onPickFinding(Number(fi.dataset.finding));
              else r.onPick?.(id);
              if (ed && r.onPickField) r.onPickField(id, ed.dataset.edit!);
            }
          : undefined
      }
      style={{
        outline: sel ? "3px solid #3e7fb0" : "none",
        outlineOffset: 6,
        cursor: r.mode === "build" ? "pointer" : "default",
        width: "210mm",
        height: "297mm",
        flexShrink: 0,
        overflow: "hidden",
        background: "#fff",
        position: "relative",
        boxShadow: r.mode === "print" ? "none" : SHEET_SHADOW,
        breakAfter: "page",
        pageBreakAfter: "always",
      }}
    >
      <section
        style={{
          width: 1280,
          height: 1810.29,
          transform: "scale(0.6200781)",
          transformOrigin: "0 0",
          display: "flex",
          flexDirection: "column",
          fontFamily: INTER,
          color: NAVY,
          lineHeight: 1.7,
          padding: cover ? "80px 96px 96px" : "80px 96px 150px",
          position: "relative",
          boxSizing: "border-box",
        }}
      >
        {children}
      </section>
    </div>
  );
}

// ── Pages ────────────────────────────────────────────────────────────────────

function Cover({ r, s }: PageProps) {
  const b = r.mode === "build";
  const v = r.D.bound;
  const cards: [string, ReactNode][] = [
    ["Prepared for", <Bind key="c" build={b}>{v.client}</Bind>],
    ["Reference", <>Q <Bind build={b}>{v.quote}</Bind></>],
    ["Price", <><Bind build={b}>{v.priceEx}</Bind> + GST</>],
    ["Valid for", <Bind key="v" build={b}>{v.valid}</Bind>],
  ];
  return (
    <Sheet r={r} s={s} cover>
      <img src={r.img(asset("logo-full.png")) || undefined} alt="RAS-VERTEX Maintenance Solutions" style={{ height: 68, width: "auto", alignSelf: "flex-start" }} />
      <h1 style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.06em", margin: "48px 0 0" }}>
        <Bind build={b}>{v.building}</Bind>.
      </h1>
      <Rich v={r.p.d.cover.blurb} edit="cover.blurb" style={{ ...lede(820, 24), fontSize: "1.375rem" }} />
      <div data-edit="cover.photo" style={photo(r.img(r.p.d.cover.photo), { width: "100%", flex: "1 1 0", minHeight: 0, borderRadius: 24, overflow: "hidden", marginTop: 64 })} />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1.5fr) minmax(0,0.9fr) minmax(0,1.4fr) minmax(0,0.9fr)",
          gap: 12,
          marginTop: 64,
        }}
      >
        {cards.map(([k, val]) => (
          <div key={k} style={card}>
            <div style={label}>{k}</div>
            <div style={cardValue}>{val}</div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function Contents({ r, s }: PageProps) {
  return (
    <Sheet r={r} s={s}>
      <h2 style={h2}>Contents</h2>
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 72 }}>
        {r.D.contents.map((g) => (
          <div key={g.title} style={{ display: "flex", flexDirection: "column" }}>
            <h3 style={{ ...sub, margin: "0 0 20px" }}>{g.title}</h3>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                fontSize: "1.25rem",
                lineHeight: 1.4,
                color: INK(0.72),
                borderTop: `1px solid ${RULE_STRONG}`,
              }}
            >
              {g.rows.map((row, i) => (
                <div key={row.name} style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "18px 0", borderBottom: rule(i, g.rows.length) }}>
                  <span>{row.name}</span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{row.page}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function IconTile({ children }: { children: ReactNode }) {
  return (
    <div style={{ width: 48, height: 48, borderRadius: 12, background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {children}
    </div>
  );
}

const tileTitle: CSSProperties = { fontSize: "1.625rem", fontWeight: 700, lineHeight: 1.2, letterSpacing: "-0.04em" };
const tileText: CSSProperties = { fontSize: "1.25rem", lineHeight: 1.45, color: INK(0.65), textWrap: "pretty" };

function Company({ r, s }: PageProps) {
  const tile: CSSProperties = {
    borderRadius: 20,
    background: "#f4f5f8",
    padding: 32,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 24,
    minHeight: 0,
  };
  const T = tradeOf(r.p.trade);
  const pic = (area: "a" | "g" | "c" | "d"): CSSProperties => ({
    gridArea: area,
    borderRadius: 20,
    minHeight: 0,
    background: `${CARD} ${T.company.photos[area][1]}/cover no-repeat`,
    backgroundImage: bg(r.img(T.company.photos[area][0])),
  });
  return (
    <Sheet r={r} s={s}>
      <SecLabel text={r.D.sectionLabel.company} />
      <h2 style={{ ...h2, maxWidth: 1000, textWrap: "balance" }}>
        {T.company.h2}
      </h2>
      <p style={lede()}>
        {T.company.lede}
      </p>
      <div
        style={{
          flex: "1 1 0",
          minHeight: 0,
          marginTop: 56,
          display: "grid",
          gridTemplateColumns: "repeat(3,minmax(0,1fr))",
          gridTemplateRows: "repeat(3,minmax(0,1fr))",
          gridTemplateAreas: "'a g t' 'a k c' 'w w d'",
          gap: 16,
        }}
      >
        <div style={pic("a")} />
        <div style={{ ...tile, gridArea: "t" }}>
          <IconTile>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="8" r="3" />
              <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
              <circle cx="17" cy="9" r="2.5" />
              <path d="M16 14.2c2.8.3 5 2.7 5 5.8" />
            </svg>
          </IconTile>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={tileTitle}>Fully employed team</span>
            <span style={tileText}>The same faces, start to finish.</span>
          </div>
        </div>
        <div style={pic("g")} />
        <div style={{ ...tile, gridArea: "k" }}>
          <IconTile>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={NAVY} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="4" width="14" height="17" rx="2" />
              <path d="M9 3h6v3H9z" />
              <path d="M9 11h6M9 15h4" />
            </svg>
          </IconTile>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={tileTitle}>Project reporting</span>
            <span style={tileText}>Photos, milestones and updates, start to finish.</span>
          </div>
        </div>
        <div style={pic("c")} />
        <div
          style={{
            gridArea: "w",
            borderRadius: 20,
            background: BLUE_CARD,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 28,
            padding: "36px 40px",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", gap: 16 }}>
            <span style={{ fontFamily: BEBAS, fontSize: 112, lineHeight: 0.74, letterSpacing: "-0.04em" }}>{T.warrantyYears}</span>
            <span style={{ fontSize: "1.0625rem", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", lineHeight: 1.35, paddingBottom: 2 }}>
              Year
              <br />
              warranty
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, maxWidth: 640 }}>
            <span style={tileTitle}>Standing by our team, and our products.</span>
            <span style={{ ...tileText, color: INK(0.7) }}>
              {T.company.warrantyLine}
            </span>
          </div>
        </div>
        <div style={pic("d")} />
      </div>
      <Footer r={r} s={s} />
    </Sheet>
  );
}

const CLIENT_LOGOS: [string, string, number][] = [
  ["racv.png", "RACV", 52],
  ["accor-clean.svg", "Accor", 50],
  ["novotel.png", "Novotel", 42],
  ["mosaic-clean.svg", "Mosaic", 34],
  ["maroochy.png", "Maroochy RSL", 58],
  ["raywhite.png", "Ray White", 30],
  ["henzells.png", "Henzells Agency", 52],
  ["coolum.png", "Coolum", 66],
  ["mantra.png", "Mantra", 34],
  ["savills.png", "Savills", 68],
  ["mcnab.png", "McNab", 26],
];

function Quote({ text, who, role, logo, gap }: { text: string; who: string; role: string; logo?: ReactNode; gap: number }) {
  return (
    <div style={{ background: BLUE_CARD, borderRadius: 24, padding: "64px 160px 40px 64px", display: "flex", flexDirection: "column", marginTop: 72 }}>
      <p style={{ fontSize: 40, fontWeight: 200, lineHeight: 1.15, letterSpacing: "-0.04em", margin: 0, textWrap: "pretty" }}>{text}</p>
      <div
        style={{
          margin: `${gap}px -96px 0 0`,
          paddingTop: 28,
          borderTop: `1px solid ${INK(0.15)}`,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 40,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={sub}>{who}</span>
          <span style={{ fontSize: "1.25rem", lineHeight: 1.3, color: INK(0.6) }}>{role}</span>
        </div>
        {logo}
      </div>
    </div>
  );
}

function Recent({ r, s }: PageProps) {
  return (
    <Sheet r={r} s={s}>
      <SecLabel text={r.D.sectionLabel.recent} />
      <div style={{ flex: "1 1 0", minHeight: 0, display: "grid", gridTemplateColumns: "minmax(0,1.55fr) minmax(0,1fr)", gap: 16 }}>
        <div style={photo(r.img(tradeOf(r.p.trade).recent.photo), { position: "relative", borderRadius: 20, overflow: "hidden", minHeight: 0, backgroundPosition: "center 30%" })} />
        <a
          href="https://www.rasvertex.com.au/projects"
          target="_blank"
          rel="noopener"
          style={{
            borderRadius: 20,
            background: "#f4f5f8",
            padding: 32,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: 24,
            minHeight: 0,
            color: NAVY,
            textDecoration: "none",
          }}
        >
          <span style={{ alignSelf: "flex-end", display: "inline-flex", alignItems: "center", gap: 12, fontSize: "1.25rem", fontWeight: 300, letterSpacing: "-0.01em", lineHeight: 1 }}>
            Recent Projects
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 380 }}>
            <span style={{ ...h3card, textWrap: "balance" }}>Trusted by the coast’s best run buildings.</span>
          </div>
        </a>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(11,minmax(0,1fr))", gap: 16, alignItems: "center", marginTop: 72 }}>
        {CLIENT_LOGOS.map(([file, alt, h]) => (
          <div key={file} style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}>
            <img src={r.img(asset("clients/" + file)) || undefined} alt={alt} style={{ maxHeight: h, maxWidth: "100%", width: "auto", objectFit: "contain" }} />
          </div>
        ))}
      </div>
      <Quote
        gap={120}
        text={tradeOf(r.p.trade).recent.quote}
        who={tradeOf(r.p.trade).recent.who}
        role={tradeOf(r.p.trade).recent.role}
        logo={
          tradeOf(r.p.trade).recent.logo ? (
            <img src={r.img(tradeOf(r.p.trade).recent.logo!) || undefined} alt={tradeOf(r.p.trade).recent.role} style={{ height: 56, width: "auto" }} />
          ) : undefined
        }
      />
      <Footer r={r} s={s} />
    </Sheet>
  );
}

function Intro({ r, s }: PageProps) {
  const b = r.mode === "build";
  const v = r.D.bound;
  const d = r.p.d.intro;
  const body: CSSProperties = { margin: 0, color: INK(0.8), textWrap: "pretty" };
  return (
    <Sheet r={r} s={s}>
      <SecLabel text={r.D.sectionLabel.intro} />
      <h2 style={h2}>Introduction</h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 860, marginTop: 56, fontSize: "1.25rem", lineHeight: 1.65 }}>
        <p style={{ margin: 0, color: INK(0.65) }}>
          <strong style={{ color: NAVY, fontWeight: 700 }}>
            <Bind build={b}>{v.building}</Bind>
          </strong>
          <br />
          Quote #<Bind build={b}>{v.quote}</Bind>
          <br />
          <Bind build={b}>{v.site}</Bind>
          <br />
          <Bind build={b}>{v.date}</Bind>
        </p>
        <p style={{ margin: "32px 0 0" }}>
          Dear <Bind build={b}>{v.contact}</Bind>,
        </p>
        <Rich v={d.open} edit="intro.open" style={body} />
        <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
          {d.bullets.map((it, i) => (
            <div key={i} data-edit={`intro.bullets.${i}.t`} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", padding: "16px 0", borderBottom: rule(i, d.bullets.length) }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: NAVY, marginTop: 14 }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: "1.25rem", fontWeight: 700, lineHeight: 1.5 }}>{it.t}</span>
                <Rich v={it.d} edit={`intro.bullets.${i}.d`} style={{ fontSize: "1.0625rem", lineHeight: 1.5, color: INK(0.65), textWrap: "pretty" }} />
              </div>
            </div>
          ))}
        </div>
        <Rich v={d.close} edit="intro.close" style={body} />
        <div style={{ marginTop: 24 }}>
          <p style={{ margin: 0, color: INK(0.8) }}>Kind regards,</p>
          {/* Signed by whoever wrote it: the project manager on the job. */}
          <div style={{ height: 80, margin: "20px 0 8px", display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
            <span style={{ fontFamily: "'La Belle Aurore',cursive", fontSize: "2.25rem", lineHeight: 1, color: NAVY }}>
              <Bind build={b}>{v.pm}</Bind>
            </span>
          </div>
          <p style={{ margin: 0, fontWeight: 700 }}>
            <Bind build={b}>{v.pm}</Bind>
            <br />
            <span style={{ fontWeight: 400, color: INK(0.65) }}>
              <Bind build={b}>{v.pmTitle}</Bind>, RAS-VERTEX Maintenance Solutions
            </span>
          </p>
        </div>
      </div>
      <ContactFooter r={r} />
    </Sheet>
  );
}

function Project({ r, s }: PageProps) {
  const d = r.p.d.project;
  const brand = BRANDS[d.brand] ?? BRANDS.dulux;
  const rows = d.rows[d.brand] ?? [];
  const cols = "minmax(0,1fr) minmax(0,1.7fr) 240px";
  return (
    <Sheet r={r} s={s}>
      <SecLabel text={r.D.sectionLabel.project} />
      <h2 style={h2}>Your project</h2>
      <Rich v={d.p1} edit="project.p1" style={lede(860)} />
      <Rich v={d.p2} edit="project.p2" style={lede(860, 16)} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 12, marginTop: 56 }}>
        {(
          [
            ["Building type", d.type, "type"],
            ["Access method", d.access, "access"],
            ["Program", d.program, "program"],
          ] as const
        ).map(([k, v, f]) => (
          <div key={k} data-edit={`project.${f}`} style={card}>
            <div style={label}>{k}</div>
            <div style={cardValue}>{v}</div>
          </div>
        ))}
      </div>
      <div data-edit="project.photo" style={photo(r.img(d.photo), { width: "100%", flex: "1 1 0", minHeight: 360, borderRadius: 20, overflow: "hidden", marginTop: 56 })} />
      <div style={{ marginTop: 72 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h3 style={h3card}>Higher standards.</h3>
          <Rich v={d.specIntro} edit="project.specIntro" style={lede(860, 0)} />
        </div>
        <div style={{ ...tableHead(cols, 48), gap: 40, lineHeight: 1.3 }}>
          <span>Surface</span>
          <span>System</span>
          <span>{tradeOf(r.p.trade).coatsLabel}</span>
        </div>
        {rows.map((sr, i) => (
          <div key={i} data-edit={`project.rows.${d.brand}.${i}.surface`} style={{ display: "grid", gridTemplateColumns: cols, gap: 40, padding: "18px 0", borderBottom: rule(i, rows.length), fontSize: "1.25rem", lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>{sr.surface}</span>
            <span>{sr.system}</span>
            <span style={{ color: INK(0.65) }}>{sr.coats}</span>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "flex-end", gap: 24, marginTop: 32 }}>
          <img src={r.img(brand.logo) || undefined} alt={brand.name} style={{ height: brand.height, width: "auto", display: "block" }} />
          <span data-edit="project.note" style={{ fontSize: "1.0625rem", lineHeight: 1, color: INK(0.6), paddingBottom: 2 }}>{d.note}</span>
        </div>
      </div>
      <Footer r={r} s={s} />
    </Sheet>
  );
}


/** Narrows a sheet's flowed content to the kind its page produces. */
function dataOf<K extends SheetData["kind"]>(s: Sheet, kind: K): Extract<SheetData, { kind: K }> | null {
  return s.data.kind === kind ? (s.data as Extract<SheetData, { kind: K }>) : null;
}

/** Section label on every sheet; title and lede only on a page's first. */
function Head({ r, s, title, intro, width, edit }: PageProps & { title: string; intro: string; width?: number; edit: string }) {
  return (
    <>
      <SecLabel text={r.D.sectionLabel[s.id]} />
      {!s.part && (
        <>
          <h2 style={h2}>{title}</h2>
          <Rich v={intro} edit={edit} style={lede(width)} />
        </>
      )}
    </>
  );
}

/** Content after the head: 56 below the lede on a first sheet, flush on a continuation. */
const flowTop = (s: Sheet, first = 56) => (s.part ? 0 : first);

function Scope({ r, s }: PageProps) {
  const d = r.p.d.scope;
  const data = dataOf(s, "scope");
  const col = (title: string, items: string[], inc: boolean) => (
    <div data-edit={inc ? "scope.inc" : "scope.exc"} style={{ display: "flex", flexDirection: "column" }}>
      {items.length > 0 && (
        <div style={{ ...label, lineHeight: 1.7, paddingBottom: 14, borderBottom: `1px solid ${RULE_STRONG}` }}>{title}</div>
      )}
      {items.map((t, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "28px minmax(0,1fr)",
            gap: 16,
            padding: "14px 0",
            borderBottom: rule(i, items.length),
            fontSize: "1.25rem",
            lineHeight: 1.5,
            color: inc ? NAVY : INK(0.65),
          }}
        >
          <span style={{ width: 28, height: 28, borderRadius: 8, background: inc ? GREEN.bg : RED.bg, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}>
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path d={inc ? "M12 4.9v14.2M4.9 12h14.2" : "M7 7l10 10M17 7 7 17"} stroke={inc ? GREEN.fg : RED.fg} strokeWidth="1.9" strokeLinecap="round" fill="none" />
            </svg>
          </span>
          <Inline html={t} />
        </div>
      ))}
    </div>
  );
  return (
    <Sheet r={r} s={s}>
      <Head r={r} s={s} title="Scope" intro={d.intro} edit="scope.intro" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 64, marginTop: flowTop(s) }}>
        {col(s.part ? "Included, continued" : "Included", data?.inc ?? [], true)}
        {col(s.part ? "Not included, continued" : "Not included", data?.exc ?? [], false)}
      </div>
      <Footer r={r} s={s} />
    </Sheet>
  );
}

const secondary: CSSProperties = { fontSize: "1.0625rem", color: INK(0.65), margin: 0, lineHeight: 1.5, textWrap: "pretty" };

/** Standard style: one line reads as a sentence, two or more as bullets. */
function Points({ text }: { text: string }) {
  const pts = richItems(text).slice(0, MAX_POINTS);
  if (pts.length <= 1) return <p style={secondary}>{pts[0] ? <Inline html={pts[0]} /> : null}</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignSelf: "stretch" }}>
      {pts.map((t, i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "18px minmax(0,1fr)", ...secondary }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: NAVY, marginTop: 11 }} />
          <Inline html={t} />
        </div>
      ))}
    </div>
  );
}

function Findings({ r, s }: PageProps) {
  const report = r.p.d.findings.style === "report";
  const items = dataOf(s, "findings")?.items ?? [];
  const build = r.mode === "build";
  return (
    <Sheet r={r} s={s}>
      <Head r={r} s={s} title="Site survey & findings" intro={r.p.d.findings.intro} edit="findings.intro" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "48px 40px", marginTop: flowTop(s) }}>
        {items.map(({ f, i, textH }) => (
          <div
            key={i}
            data-finding={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: textH ? 20 : 0,
              minHeight: 0,
              borderRadius: 24,
              ...(build && r.focusFinding === i ? { outline: "4px solid #3e7fb0", outlineOffset: 10 } : {}),
            }}
          >
            <div data-edit={`findings.items.${i}.photo`} style={photo(r.img(f.photo), { width: "100%", height: FINDING_PHOTO_H, flexShrink: 0, borderRadius: 20 })} />
            {textH > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start", height: textH, flexShrink: 0, overflow: "hidden" }}>
                {report && f.code && <span style={codeChip(f.code)}>{f.code}</span>}
                {f.title.trim() && (
                  <h3 data-edit={`findings.items.${i}.title`} style={{ ...sub, margin: report && f.code ? "4px 0 0" : 0 }}>
                    {f.title}
                  </h3>
                )}
                {richItems(f.desc).length > 0 && (
                  <div data-edit={`findings.items.${i}.desc`} style={{ alignSelf: "stretch" }}>
                    {report ? <Rich v={f.desc} style={secondary} /> : <Points text={f.desc} />}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <Footer r={r} s={s} />
    </Sheet>
  );
}

function GroupBar({ name, desc, bg: b, pt }: { name: string; desc: string; bg: string; pt: number }) {
  return (
    <div style={{ paddingTop: pt, paddingBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 16, padding: "16px 24px", borderRadius: 14, background: b }}>
        <span style={{ ...sub, whiteSpace: "nowrap" }}>{name}</span>
        <span style={{ fontSize: "1.0625rem", color: INK(0.7), lineHeight: 1.4 }}>{desc}</span>
      </div>
    </div>
  );
}

const contName = (name: string, start: boolean) => (start ? name : `${name}, continued`);

function Flagged({ r, s }: PageProps) {
  const d = r.p.d.flagged;
  const groups = dataOf(s, "flagged")?.groups ?? [];
  const cols = "110px minmax(0,1fr) 200px";
  return (
    <Sheet r={r} s={s}>
      <Head r={r} s={s} title="Flagged issues" intro={d.intro} edit="flagged.intro" />
      {!s.part && (
        <div style={{ background: BLUE_CARD, borderRadius: 24, padding: "40px 48px", display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 24, marginTop: 56 }}>
          {r.D.flagStats.map((st) => (
            <div key={st.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, minWidth: 0 }}>
              <span style={{ fontSize: 72, fontWeight: 700, letterSpacing: "-0.05em", lineHeight: 1 }}>{st.v}</span>
              <span style={{ ...label, color: INK(0.55) }}>{st.k}</span>
            </div>
          ))}
        </div>
      )}
      <div style={tableHead(cols, flowTop(s, 72))}>
        <span>Code</span>
        <span>Defect</span>
        <span style={{ textAlign: "right" }}>Found</span>
      </div>
      {groups.map((g, gi) => (
        <div key={g.band}>
          <GroupBar name={contName(FLAG_GROUPS[g.band][0], g.start)} desc={FLAG_GROUPS[g.band][1]} bg={BANDS[g.band].bg} pt={gi ? 28 : 16} />
          {g.rows.map((row, i) => {
            const n = parseInt(row.count, 10) || 0;
            return (
              <div key={i} data-edit={`flagged.rows.${d.rows.indexOf(row)}.code`} style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 24, padding: "12px 0", borderBottom: rule(i, g.rows.length), lineHeight: 1.3 }}>
                <span style={codeChip(row.code)}>{row.code}</span>
                <span style={{ fontSize: "1.25rem", fontWeight: 600 }}>{codeName(row.code)}</span>
                <span style={{ fontSize: "1.0625rem", color: INK(0.55), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                  {n} {n === 1 ? "location" : "locations"}
                </span>
              </div>
            );
          })}
        </div>
      ))}
      <Footer r={r} s={s} />
    </Sheet>
  );
}

function Prestart({ r, s }: PageProps) {
  const d = r.p.d.prestart;
  const data = dataOf(s, "prestart");
  const groups = data?.groups ?? [];
  const cols = "110px minmax(0,1fr) 380px";
  return (
    <Sheet r={r} s={s}>
      <Head r={r} s={s} title="Pre-start maintenance" intro={d.intro} edit="prestart.intro" />
      {groups.length > 0 && (
        <div style={tableHead(cols, flowTop(s))}>
          <span>Code</span>
          <span>Work</span>
          <span>Where</span>
        </div>
      )}
      {groups.map((g, gi) => (
        <div key={g.band}>
          <GroupBar name={contName(PRESTART_GROUPS[g.band][0], g.start)} desc={PRESTART_GROUPS[g.band][1]} bg={BANDS[g.band].bg} pt={gi ? 28 : 16} />
          {g.rows.map((row, i) => (
            <div key={i} data-edit={`prestart.rows.${d.rows.indexOf(row)}.work`} style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 24, padding: "16px 0", borderBottom: rule(i, g.rows.length), lineHeight: 1.35 }}>
              <span style={codeChip(row.code)}>{row.code}</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 600 }}>{row.work}</span>
              <span style={{ fontSize: "1.0625rem", color: INK(0.6) }}>{row.where}</span>
            </div>
          ))}
        </div>
      ))}
      {data?.note && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: groups.length ? 56 : flowTop(s) }}>
          <span style={label}>Please note</span>
          <Rich v={d.note} edit="prestart.note" style={{ fontSize: "1.0625rem", lineHeight: 1.6, color: INK(0.6), margin: 0, maxWidth: 960, textWrap: "pretty" }} />
        </div>
      )}
      <Footer r={r} s={s} />
    </Sheet>
  );
}

function Access({ r, s }: PageProps) {
  const d = r.p.d.access;
  const drops = dataOf(s, "access")?.drops ?? [];
  const cols = "110px minmax(0,1fr) minmax(0,1.2fr) 160px";
  const stageC = (i: number) => STAGE_COLOURS[(i < 0 ? 0 : i) % STAGE_COLOURS.length];
  return (
    <Sheet r={r} s={s}>
      <Head r={r} s={s} title="Access & disruption plan" intro={d.intro} width={860} edit="access.intro" />
      {!s.part && (
        <>
          <div
            data-edit="access.aerial"
            style={photo(r.img(d.aerial), {
              marginTop: 56,
              width: "100%",
              aspectRatio: "2/1",
              flexShrink: 0,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            })}
          >
            {!d.aerial && r.mode !== "print" && (
              <span data-ph="1" className="pb3-ph" style={{ fontSize: "1.375rem", fontWeight: 600, color: INK(0.4) }}>
                Add an aerial or elevation photo
              </span>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.max(1, d.stages.length)},minmax(0,1fr))`, gap: 40, marginTop: 56 }}>
            {d.stages.map((sg, i) => (
              <div key={i} data-edit={`access.stages.${i}.what`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    height: 28,
                    padding: "0 10px",
                    borderRadius: 8,
                    background: stageC(i).bg,
                    color: stageC(i).fg,
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    lineHeight: 1,
                  }}
                >
                  {sg.when}
                </span>
                <span style={{ ...sub, marginTop: 6 }}>{sg.what}</span>
                <span style={{ fontSize: "1.0625rem", color: INK(0.6), lineHeight: 1.5 }}>{sg.where}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {drops.length > 0 && (
        <>
          <div style={tableHead(cols, flowTop(s, 72))}>
            <span>Drop</span>
            <span>Where</span>
            <span>Access</span>
            <span style={{ textAlign: "right" }}>Levels</span>
          </div>
          {drops.map((x, i) => (
            <div key={i} data-edit={`access.drops.${d.drops.indexOf(x)}.where`} style={{ display: "grid", gridTemplateColumns: cols, alignItems: "center", gap: 24, padding: "12px 0", borderBottom: rule(i, drops.length), lineHeight: 1.3 }}>
              <span style={chip(stageC(parseInt(x.stage, 10) || 0))}>{x.d}</span>
              <span style={{ fontSize: "1.25rem", fontWeight: 600 }}>{x.where}</span>
              <span style={{ fontSize: "1.0625rem", color: INK(0.65) }}>{x.access}</span>
              <span style={{ fontSize: "1.0625rem", color: INK(0.55), textAlign: "right" }}>{x.levels}</span>
            </div>
          ))}
        </>
      )}
      <Footer r={r} s={s} />
    </Sheet>
  );
}


function Safety({ r, s }: PageProps) {
  const stats = [
    ["0", "Incidents since we began"],
    ["30+", "IRATA certified techs"],
    ["Daily", "Pre-start safety checks"],
    ["Annual", "Safety audits and training"],
  ];
  return (
    <Sheet r={r} s={s}>
      <SecLabel text={r.D.sectionLabel.safety} />
      <h2 style={h2}>Safety</h2>
      <p style={lede()}>
        We take pride in our safety. Every technician on your building is IRATA certified and current, every drop is checked before it’s used, and every shift is reported accurately. When our team works safely, your residents and your building are in safe hands.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(0,1fr))", gap: 12, marginTop: 56 }}>
        {stats.map(([v, k]) => (
          <div key={k} style={{ background: CARD, borderRadius: 16, padding: 28, display: "flex", flexDirection: "column", gap: 8 }}>
            <span style={{ fontSize: 48, fontWeight: 700, lineHeight: 1, letterSpacing: "-0.05em" }}>{v}</span>
            <span style={{ fontSize: "1.0625rem", lineHeight: 1.4, color: INK(0.65), whiteSpace: "nowrap" }}>{k}</span>
          </div>
        ))}
      </div>
      <div style={photo(r.img(asset("web-rope-access-works.jpg")), { flex: "1 1 0", minHeight: 320, marginTop: 56, borderRadius: 20, backgroundPosition: "center 35%" })} />
      <div style={{ marginTop: 72, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 40 }}>
        <h3 style={h3card}>Certified and accredited.</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 40 }}>
          <img src={r.img(asset("irata.png")) || undefined} alt="IRATA International" style={{ height: 72, width: "auto", mixBlendMode: "multiply" }} />
          <img src={r.img(asset("qbcc.png")) || undefined} alt="QBCC" style={{ height: 52, width: "auto" }} />
          <img src={r.img(asset("workcover.png")) || undefined} alt="WorkCover Queensland" style={{ height: 36, width: "auto" }} />
          <img src={r.img(asset("smartstrata.png")) || undefined} alt="Smart Strata" style={{ height: 52, width: "auto" }} />
        </div>
      </div>
      <Quote
        gap={72}
        text="“Safety is our priority, and it’s part of our higher standards. When the team is safe, we’re confident. Quality results come from preparation, and my role is to make sure the team carries that out.”"
        who="Archer Dutch"
        role="Height & Safety Manager"
      />
      <Footer r={r} s={s} />
    </Sheet>
  );
}

function MoneyRows({ ex, gst, inc, exLabel, incLabel, mt }: { ex: string; gst: string; inc: string; exLabel: string; incLabel: string; mt?: number }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "22px 0", borderTop: `2px solid ${RULE_STRONG}`, fontSize: "1.25rem", lineHeight: 1.5, fontWeight: 700, marginTop: mt }}>
        <span>{exLabel}</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{ex}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "22px 0", borderTop: `1px solid ${RULE}`, fontSize: "1.25rem", lineHeight: 1.5, color: INK(0.65) }}>
        <span>GST (10%)</span>
        <span style={{ color: NAVY, fontVariantNumeric: "tabular-nums" }}>{gst}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 24, marginTop: 8, padding: "30px 36px", borderRadius: 16, background: CARD_STRONG }}>
        <span style={{ fontSize: "1.375rem", fontWeight: 700 }}>{incLabel}</span>
        <span style={{ fontSize: "1.375rem", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{inc}</span>
      </div>
    </>
  );
}

function Pricing({ r, s }: PageProps) {
  const d = r.p.d.pricing;
  const data = dataOf(s, "pricing");
  const rows = data?.rows ?? [];
  // Content that opens a continuation sheet sits flush under the label.
  const top = (first: boolean, gap: number) => (first ? flowTop(s) : gap);
  return (
    <Sheet r={r} s={s}>
      <Head r={r} s={s} title="Pricing & terms" intro={d.intro} edit="pricing.intro" />
      {(rows.length > 0 || data?.totals) && (
        <div style={{ display: "flex", flexDirection: "column", marginTop: flowTop(s) }}>
          {rows.length > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 24, paddingBottom: 14, borderBottom: `1px solid ${RULE_STRONG}`, ...label }}>
              <span>{s.part ? "Stage, continued" : "Stage"}</span>
              <span>Price (ex GST)</span>
            </div>
          )}
          {rows.map(({ x, i }, k) => (
            <div key={i} data-edit={`pricing.stages.${i}.label`} style={{ display: "flex", justifyContent: "space-between", gap: 24, padding: "22px 0", borderTop: k ? `1px solid ${RULE}` : "0", fontSize: "1.25rem", lineHeight: 1.5 }}>
              <span>
                {x.label} <span style={{ color: INK(0.45) }}>{x.note}</span>
              </span>
              <span style={{ fontWeight: 700, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{money(parseAmt(x.amt))}</span>
            </div>
          ))}
          {data?.totals && (
            <>
              <MoneyRows ex={money(r.D.subtotal)} gst={money(r.D.gst)} inc={money(r.D.total)} exLabel="Total (ex GST)" incLabel="Total incl. GST" />
              {r.D.pageNo.accept && (
                <div style={{ alignSelf: "flex-start", marginTop: 20, padding: "12px 20px", borderRadius: 12, background: GREEN.bg, color: GREEN.fg, fontSize: "1.0625rem", fontWeight: 600, lineHeight: 1.5 }}>
                  Ready to proceed? Sign the acceptance on page {r.D.pageNo.accept}.
                </div>
              )}
            </>
          )}
        </div>
      )}
      {data?.termsHead && <h3 style={{ ...sub, margin: `${top(!rows.length && !data.totals, 72)}px 0 20px` }}>Payment terms</h3>}
      {(data?.terms.length ?? 0) > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontSize: "1.25rem",
            lineHeight: 1.5,
            color: INK(0.65),
            marginTop: data!.termsHead ? 0 : top(!rows.length && !data!.totals, 0),
          }}
        >
          {data!.terms.map((t, i) => (
            <div key={i} data-edit="pricing.terms" style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: NAVY, marginTop: 12 }} />
              <Inline html={t} />
            </div>
          ))}
        </div>
      )}
      {data?.qualified && (
        <div
          style={{
            marginTop: top(!rows.length && !data.totals && !data.terms.length, 72),
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 16,
          }}
        >
          <h3 style={h3card}>Fully qualified.</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 36, height: 64 }}>
            <img src={r.img(asset("qbcc.png")) || undefined} alt="QBCC" style={{ height: 60, width: "auto" }} />
            <img src={r.img(asset("smartstrata.png")) || undefined} alt="Smart Strata" style={{ height: 60, width: "auto" }} />
            <img src={r.img(asset("workcover.png")) || undefined} alt="WorkCover Queensland" style={{ height: 42, width: "auto" }} />
          </div>
        </div>
      )}
      <Footer r={r} s={s} />
    </Sheet>
  );
}

const PLAN_ROWS: [string, string, string, string][] = [
  ["01", "Wash-down", "Full façade, by rope", "Up to 3 m"],
  ["02", "Balconies", "Included", "Excluded"],
  ["03", "Painting hours", "48 hrs, unused roll over", "Use it or lose it"],
  ["04", "Defect report", "Tracked with your survey codes", "General report"],
  ["05", "Contract", "Rolling, 60 days’ notice", "Locked from handover"],
  ["06", "Price", "In this proposal", "On request"],
  ["07", "8-year warranty", "Stands either way", "Tied to the plan"],
];

function Maintenance({ r, s }: PageProps) {
  const d = r.p.d.maintenance;
  const cols = "80px minmax(0,1fr) 270px 210px";
  const mp = parseAmt(d.price);
  const mg = Math.round(mp * 10) / 100;
  const greyChip = chip(BANDS.grey);
  const T = tradeOf(r.p.trade);
  const PLAN = PLAN_ROWS.map((x): (typeof PLAN_ROWS)[number] =>
    x[0] === "03" ? [x[0], T.hoursLabel, x[2], x[3]] : x[0] === "07" ? [x[0], `${T.warrantyYears}-year warranty`, x[2], x[3]] : x,
  );
  const row = ([n, a, b2, c]: (typeof PLAN_ROWS)[number], last: boolean) => (
    <div key={n} style={{ display: "grid", gridTemplateColumns: cols, gap: 24, alignItems: "center", padding: "12px 0", borderBottom: last ? 0 : `1px solid ${RULE}`, lineHeight: 1.3 }}>
      <span style={greyChip}>{n}</span>
      <span style={{ fontSize: "1.25rem", fontWeight: 600 }}>{a}</span>
      <span style={{ fontSize: "1.0625rem", fontWeight: 700 }}>{b2}</span>
      <span style={{ fontSize: "1.0625rem", color: INK(0.55) }}>{c}</span>
    </div>
  );
  return (
    <Sheet r={r} s={s}>
      <SecLabel text={r.D.sectionLabel.maintenance} />
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <h2 style={h2}>10-year maintenance plan</h2>
        <span style={{ display: "inline-flex", alignItems: "center", height: 32, padding: "0 12px", borderRadius: 8, background: GREEN.bg, color: GREEN.fg, fontSize: 13, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", lineHeight: 1 }}>
          Optional
        </span>
      </div>
      <Rich v={d.intro} edit="maintenance.intro" style={lede()} />
      <div style={tableHead(cols)}>
        <span>Item</span>
        <span>Service</span>
        <span>RAS-VERTEX</span>
        <span>Typical plan</span>
      </div>
      <GroupBar name="Every visit" desc="Wash, inspect and repair, by the same team each year." bg="#eef1f6" pt={16} />
      {PLAN.slice(0, 4).map((x, i) => row(x, i === 3))}
      <GroupBar name="Plan terms" desc="Billed quarterly. Labour fixed for two years, then CPI." bg={BLUE_CARD} pt={28} />
      {PLAN.slice(4).map((x, i) => row(x, i === 2))}
      <div data-edit="maintenance.price" style={{ display: "flex", flexDirection: "column", marginTop: 72 }}>
        <MoneyRows ex={money(mp)} gst={money(mg)} inc={money(mp + mg)} exLabel="Maintenance plan, per year (ex GST)" incLabel="Per year incl. GST" />
      </div>
      <div style={{ marginTop: "auto", alignSelf: "flex-start", display: "inline-flex", flexDirection: "column", alignItems: "stretch", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 20 }}>
          <img src={r.img(asset("people-caro.jpg")) || undefined} alt="Caroline Park" style={{ width: 96, height: 120, borderRadius: 14, objectFit: "cover", flexShrink: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={sub}>Caroline Park</span>
            <span style={{ fontSize: "1.25rem", lineHeight: 1.3, color: INK(0.6) }}>Client Services Manager</span>
            <span style={{ fontSize: "1.25rem", lineHeight: 1.3, fontWeight: 700, marginTop: 6 }}>07 5371 0201</span>
          </div>
        </div>
        <a
          href={`mailto:${r.p.job.email}?subject=${encodeURIComponent(`Maintenance plan enquiry - ${r.p.job.building}`)}`}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, height: 64, padding: "0 32px", borderRadius: 14, background: NAVY, color: "#ffffff", fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em", textDecoration: "none" }}
        >
          Chat about your plan
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
      </div>
      <Footer r={r} s={s} />
    </Sheet>
  );
}

function Accept({ r, s }: PageProps) {
  const b = r.mode === "build";
  const v = r.D.bound;
  const field = (name: string, h = 56, children?: ReactNode): ReactNode => (
    <div style={{ background: CARD_STRONG, borderRadius: 12, padding: "12px 24px", minHeight: h, display: "flex", alignItems: h > 56 ? "flex-start" : "center", gap: 16 }}>
      <span style={{ ...label, lineHeight: 1.7, whiteSpace: "nowrap" }}>{name}</span>
      {children}
    </div>
  );
  const rv = (name: string, children: ReactNode) => (
    <div>
      <div style={{ ...label, lineHeight: 1.7, marginBottom: 6 }}>{name}</div>
      {children}
    </div>
  );
  const rvVal: CSSProperties = { fontSize: "1.25rem", fontWeight: 700, paddingBottom: 8 };
  const panel: CSSProperties = { background: "#ffffff", padding: "40px 48px", display: "flex", flexDirection: "column", gap: 20 };
  return (
    <Sheet r={r} s={s}>
      <SecLabel text={r.D.sectionLabel.accept} />
      <h2 style={h2}>Acceptance</h2>
      <div style={lede(860)}>
        <Rich v={r.p.d.accept.intro} edit="accept.intro" style={{}} />
        <p style={{ margin: richHtml(r.p.d.accept.intro) ? "0.6em 0 0" : 0 }}>
          Valid until <Bind build={b}>{v.validUntil}</Bind>.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 1, marginTop: 56, background: RULE, border: `1px solid ${RULE}`, borderRadius: 24, overflow: "hidden" }}>
        <div style={panel}>
          <h3 style={sub}>On behalf of the Client</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {field("Name")}
            {field("Position")}
          </div>
          {field(
            "Company",
            56,
            <span style={{ fontSize: "1.25rem", fontWeight: 600 }}>
              <Bind build={b}>{v.client}</Bind>
            </span>,
          )}
          {field("Signature", 80)}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {field("Date")}
            {field("PO no.")}
          </div>
        </div>
        <div style={panel}>
          <h3 style={sub}>On behalf of RAS-VERTEX</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 48px", alignItems: "end" }}>
            {rv("Name", <div style={rvVal}><Bind build={b}>{v.signer}</Bind></div>)}
            {rv("Position", <div style={rvVal}><Bind build={b}>{v.signerTitle}</Bind></div>)}
            {rv(
              "Signature",
              <div style={{ borderBottom: `1px solid ${RULE_STRONG}`, height: 64, display: "flex", alignItems: "flex-end", paddingBottom: 4 }}>
                <span style={{ fontFamily: "'La Belle Aurore',cursive", fontSize: "2.25rem", lineHeight: 1, color: NAVY }}>
                  <Bind build={b}>{v.signer}</Bind>
                </span>
              </div>,
            )}
            {rv("Date", <div style={rvVal}><Bind build={b}>{v.date}</Bind></div>)}
          </div>
        </div>
      </div>
      <p style={{ ...lede(1000, 40) }}>
        <strong style={{ color: NAVY, fontWeight: 700 }}>Insurance:</strong> $20M public liability, $20M products liability, $20M professional liability, workers&apos; compensation, QBCC licensed, IRATA-certified technicians. Certificates of currency on request.
      </p>
      <ContactFooter r={r} />
    </Sheet>
  );
}

function Terms({ r, s }: PageProps) {
  return (
    <Sheet r={r} s={s}>
      <SecLabel text={r.D.sectionLabel.terms} />
      <h2 style={h2}>Terms &amp; conditions</h2>
      <div style={{ columnCount: 3, columnGap: 48, marginTop: 56, fontSize: "1rem", lineHeight: 1.6 }}>
        {TERMS.map((t) => tradeOf(r.p.trade).terms[t.k] ?? t).map((tc) => (
          <div key={tc.k} style={{ breakInside: "avoid", marginBottom: 22 }}>
            <div style={{ fontWeight: 700 }}>{tc.k}</div>
            <div style={{ color: INK(0.65), marginTop: 2, textWrap: "pretty" }}>{tc.v}</div>
          </div>
        ))}
      </div>
      <p style={{ position: "absolute", left: 96, right: 96, bottom: 52, margin: 0, fontSize: "1rem", lineHeight: 1, color: INK(0.45) }}>
        Rope Access Services Pty Ltd trading as RAS-VERTEX · ABN 53 167 652 637 · QBCC Lic. 1307234
      </p>
    </Sheet>
  );
}

const RENDER: Record<PageId, (props: PageProps) => ReactNode> = {
  cover: Cover,
  contents: Contents,
  company: Company,
  recent: Recent,
  intro: Intro,
  project: Project,
  scope: Scope,
  findings: Findings,
  flagged: Flagged,
  prestart: Prestart,
  access: Access,
  safety: Safety,
  pricing: Pricing,
  maintenance: Maintenance,
  accept: Accept,
  terms: Terms,
};

/** Every visible sheet, in order. Pages with long content run onto
 *  continuation sheets (lib/reports/proposal/v3/layout.ts). */
export default function ProposalPages(props: DocProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: RICH_CSS }} />
      {props.D.sheets.map((s) => {
        const Page = RENDER[s.id];
        return Page ? <Page key={s.key} r={props} s={s} /> : null;
      })}
    </>
  );
}
