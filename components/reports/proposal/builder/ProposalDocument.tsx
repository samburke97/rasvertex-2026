// components/reports/proposal/builder/ProposalDocument.tsx
//
// The Painting proposal itself: a fixed 1440px-wide document matching the
// SOL Maroochydore proposal design. Rendered two ways from this one file:
//   - in the builder, scaled to fit the preview column (ProposalPreview.tsx)
//   - on the server, through renderToStaticMarkup, as the PDF's HTML
//     (app/api/reports/export-proposal-pdf/route.ts)
// Because the PDF render has no access to CSS Modules, everything here is
// inline styles, and the component holds no state or hooks. Click handlers
// only exist in the preview; static markup drops them.

import type { CSSProperties, ReactNode } from "react";
import {
  CLIENT_LOGOS,
  COMPANY_PHONE,
  SERVICES,
  STD_WORDING,
  fmtMoney,
  isSectionOn,
  lines,
  paras,
  pricingGst,
  pricingSubtotal,
  centreTotal,
  sectionNumber,
  sectionTotal,
  stageColor,
  titleFor,
  visibleSections,
  type ProposalData,
  type SectionId,
} from "@/lib/reports/proposal.types";

export interface ProposalDocAssets {
  logo: string;
  haymes: string;
  dulux: string;
  services: Record<string, string>; // service id → image url
}

interface Props {
  p: ProposalData;
  photoUrl: (id: string | null) => string | null;
  assets: ProposalDocAssets;
  // lower-case client name → logo url, only for logos that actually exist
  clientLogos: Record<string, string>;
  today: string;
  selected?: SectionId | null;
  onPick?: (id: SectionId) => void;
}

const INK = "#011955";
const BEBAS = "'Bebas Neue',Arial,sans-serif";
const SCRIPT = "'La Belle Aurore',cursive";
const TINT = "rgba(1,25,85,0.03)";

const bg = (src: string | null | undefined) => (src ? `url("${src}")` : "none");
const avoid: CSSProperties = { breakInside: "avoid" };

const h2: CSSProperties = {
  fontSize: 48,
  fontWeight: 700,
  lineHeight: 1.1,
  letterSpacing: "-0.05em",
  margin: "0 0 48px",
};
const h2WithIntro: CSSProperties = { ...h2, margin: "0 0 20px" };
const introP: CSSProperties = {
  fontSize: 18,
  color: "rgba(1,25,85,0.65)",
  maxWidth: 760,
  margin: "0 0 48px",
};
const h3: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  lineHeight: 1.2,
  letterSpacing: "-0.04em",
  margin: 0,
};
const factKey: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(1,25,85,0.45)",
};
const fieldBox: CSSProperties = {
  background: "rgba(1,25,85,0.08)",
  borderRadius: 12,
  padding: "12px 24px",
  minHeight: 52,
  display: "flex",
  alignItems: "center",
  gap: 16,
};
const fieldKey: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "rgba(1,25,85,0.45)",
};
const rvKey: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "rgba(1,25,85,0.45)",
  marginBottom: 6,
};
const rvVal: CSSProperties = { fontSize: 16, fontWeight: 700, paddingBottom: 8 };

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 4 }}>
      <path
        d="M20.09 12c0-.25-.1-.5-.28-.67a.95.95 0 0 0-.67-.28h-6.19V4.86a.95.95 0 0 0-1.9 0v6.19H4.86a.95.95 0 0 0 0 1.9h6.19v6.19a.95.95 0 0 0 1.9 0v-6.19h6.19c.25 0 .5-.1.67-.28.18-.17.28-.42.28-.67Z"
        fill="#4ba579"
      />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: 4 }}>
      <path
        d="M17.72 6.28a.95.95 0 0 0-1.35 0L12 10.65 7.63 6.28a.95.95 0 0 0-1.35 1.35L10.65 12l-4.37 4.37a.95.95 0 0 0 1.35 1.35L12 13.35l4.37 4.37a.95.95 0 0 0 1.35-1.35L13.35 12l4.37-4.37a.95.95 0 0 0 0-1.35Z"
        fill="#d97b7b"
      />
    </svg>
  );
}

function GoogleMark() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" style={{ flexShrink: 0 }} aria-label="Google">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

interface SectionProps {
  p: ProposalData;
  id: SectionId;
  selected?: SectionId | null;
  onPick?: (id: SectionId) => void;
  padding?: string;
  // Short sections are kept whole on one PDF page rather than split.
  keep?: boolean;
  children: ReactNode;
}

function Section({ p, id, selected, onPick, padding = "96px 48px", keep, children }: SectionProps) {
  if (!isSectionOn(p, id)) return null;
  // Backgrounds alternate across the sections actually shown.
  const vi = visibleSections(p).findIndex((v) => v.id === id);
  const background = vi > 0 && vi % 2 === 0 ? TINT : "#ffffff";
  return (
    <section
      data-sec={id}
      onClick={onPick ? () => onPick(id) : undefined}
      style={{
        padding,
        background,
        cursor: onPick ? "pointer" : undefined,
        boxShadow: selected === id ? "inset 0 0 0 5px #3e7fb0" : "none",
        breakInside: keep ? "avoid" : undefined,
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>{children}</div>
    </section>
  );
}

function Label({ p, id }: { p: ProposalData; id: SectionId }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 40, breakAfter: "avoid" }}>
      <span
        style={{
          fontFamily: BEBAS,
          fontSize: 15,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "rgba(1,25,85,0.35)",
        }}
      >
        Section {sectionNumber(p, id)} / {sectionTotal(p)}
      </span>
      <div style={{ flex: 1, height: 1, background: "rgba(1,25,85,0.12)" }} />
    </div>
  );
}

export default function ProposalDocument({
  p,
  photoUrl,
  assets,
  clientLogos,
  today,
  selected,
  onPick,
}: Props) {
  const job = p.job;
  const visible = visibleSections(p);
  const sub = pricingSubtotal(p);
  const gst = pricingGst(p);
  const salesTitle = titleFor(job.sales);

  const ctx = { p, selected, onPick };

  const coverSrc = photoUrl(p.cover.photo);
  const contents = visible.slice(1);
  const projectFacts: [string, string][] = [
    ["Building Type", p.project.type],
    ["Access Method", p.project.access],
    ["Target Start", p.project.start],
  ];
  const stages = p.access.stages;
  const pins = p.access.points.map((pt, i) => ({
    ...pt,
    label: `D${i + 1}`,
    color: stageColor(stages, pt.stageId),
  }));
  const terms = [
    `Deposit: ${p.pricing.deposit}% on acceptance of this proposal.`,
    `Progress claims: ${p.pricing.terms.replace(/\.$/, "").toLowerCase()}.`,
    "Final payment: on completion & sign-off.",
    "Workmanship warranty: 8 years, written, unconditional.",
  ];
  const services = SERVICES.filter((s) => !p.services.hidden.includes(s.id));

  return (
    <div
      style={{
        width: 1440,
        background: "#ffffff",
        fontFamily: "'Inter',system-ui,-apple-system,'Segoe UI',Roboto,'Helvetica Neue',sans-serif",
        color: INK,
        lineHeight: 1.7,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ── Cover ── */}
      <Section {...ctx} id="cover" padding="56px 48px 96px">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={assets.logo}
          alt="RAS-VERTEX Maintenance Solutions"
          style={{ height: 48, width: "auto", marginBottom: 40, display: "block" }}
        />
        <span
          style={{
            fontFamily: BEBAS,
            fontSize: 15,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "rgba(1,25,85,0.45)",
          }}
        >
          {p.cover.eyebrow}
        </span>
        <h1 style={{ fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.06em", margin: "20px 0 0", color: INK }}>
          {p.cover.title}
        </h1>
        <p style={{ fontSize: 22, color: "rgba(1,25,85,0.65)", maxWidth: 680, margin: "20px 0 0", fontWeight: 400 }}>
          {job.site}. Prepared for {job.contact}, {job.client}.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 56 }}>
          {[
            ["Date", today],
            ["Reference", `Q ${p.quote}`],
            ["Price", `${fmtMoney(sub)} + GST`],
            ["Valid For", p.cover.valid],
          ].map(([k, v]) => (
            <div key={k} style={{ background: "rgba(1,25,85,0.045)", borderRadius: 12, padding: "16px 48px" }}>
              <div style={factKey}>{k}</div>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 6 }}>{v}</div>
            </div>
          ))}
        </div>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
            borderRadius: 24,
            overflow: "hidden",
            marginTop: 56,
            background: "rgba(1,25,85,0.045)",
            ...avoid,
          }}
        >
          {coverSrc ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "center 68%/cover no-repeat",
                backgroundImage: bg(coverSrc),
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "3px dashed #c9a24a",
                borderRadius: 24,
                background: "#fbf4e5",
              }}
            >
              <span style={{ fontSize: 28, fontWeight: 600, color: "#96731f" }}>Choose a cover photo</span>
            </div>
          )}
        </div>
        <p style={{ fontSize: 14, color: "rgba(1,25,85,0.45)", marginTop: 20, marginBottom: 0 }}>
          Prepared by {job.sales}, {salesTitle}.
        </p>
      </Section>

      {/* ── Contents ── */}
      <section style={{ padding: "96px 48px", background: TINT, breakBefore: "page" }}>
        <div style={{ maxWidth: 1400, margin: "0 auto" }}>
          <h2 style={h2}>Contents</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2,minmax(0,1fr))",
              columnGap: 64,
              gridAutoFlow: "column",
              gridTemplateRows: `repeat(${Math.ceil(contents.length / 2)},auto)`,
            }}
          >
            {contents.map((x, i) => (
              <div
                key={x.id}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 20,
                  padding: "18px 0",
                  borderTop: "1px solid rgba(1,25,85,0.15)",
                  color: INK,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "rgba(1,25,85,0.4)",
                    width: 24,
                    flexShrink: 0,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span style={{ fontSize: 17, fontWeight: 500 }}>{x.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Introduction ── */}
      <Section {...ctx} id="intro">
        <Label p={p} id="intro" />
        <div style={{ maxWidth: 680 }}>
          <p style={{ fontSize: 15, color: "rgba(1,25,85,0.55)", margin: "0 0 40px" }}>{today}</p>
          <p style={{ fontSize: 17, margin: "0 0 24px" }}>Dear {p.intro.greeting},</p>
          {paras(p.intro.body).map((t, i) => (
            <p key={i} style={{ fontSize: 17, margin: "0 0 24px" }}>
              {t}
            </p>
          ))}
          <div style={avoid}>
            <p style={{ fontFamily: SCRIPT, fontSize: 36, lineHeight: 1, color: INK, margin: "40px 0 4px" }}>
              {p.intro.signer}
            </p>
            <p style={{ fontSize: 17, margin: 0, fontWeight: 700 }}>
              {p.intro.signer}
              <br />
              <span style={{ fontWeight: 400, color: "rgba(1,25,85,0.65)" }}>
                {titleFor(p.intro.signer)}, RAS-VERTEX Maintenance Solutions
              </span>
            </p>
          </div>
        </div>
      </Section>

      {/* ── Your Project ── */}
      <Section {...ctx} id="project" keep>
        <Label p={p} id="project" />
        <h2 style={h2WithIntro}>Your Project</h2>
        {paras(p.project.summary).map((t, i) => (
          <p key={i} style={{ ...introP, margin: "0 0 20px" }}>
            {t}
          </p>
        ))}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            borderTop: "1px solid rgba(1,25,85,0.15)",
            marginTop: 28,
            ...avoid,
          }}
        >
          {projectFacts.map(([k, v], i) => (
            <div key={k} style={{ padding: "24px 24px 0", borderRight: i < 2 ? "1px solid rgba(1,25,85,0.15)" : "0" }}>
              <div style={factKey}>{k}</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6, color: v ? INK : "#b8860b" }}>
                {v || "To be confirmed"}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Site Survey & Findings ── */}
      <Section {...ctx} id="findings">
        <Label p={p} id="findings" />
        <h2 style={h2WithIntro}>Site Survey &amp; Findings</h2>
        <p style={introP}>
          We don&apos;t quote from a desk. {job.sales} inspected {job.building} on{" "}
          {p.project.inspected || "[inspection date]"}. Here&apos;s exactly what was found, and what it means for the
          job.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 32 }}>
          {p.findings.map((f, i) => (
            <div key={f.id} style={{ display: "flex", flexDirection: "column", gap: 16, ...avoid }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "rgba(1,25,85,0.08) center/cover no-repeat",
                  backgroundImage: bg(photoUrl(f.photo)),
                }}
              />
              <div>
                <p style={{ fontWeight: 700, fontSize: 16, margin: "0 0 4px" }}>
                  {String(i + 1).padStart(2, "0")}. {f.title || "Untitled finding"}
                </p>
                <p style={{ fontSize: 14, color: "rgba(1,25,85,0.6)", margin: 0 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Scope ── */}
      <Section {...ctx} id="scope">
        <Label p={p} id="scope" />
        <h2 style={h2}>Scope: Inclusions &amp; Exclusions</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: "rgba(1,25,85,0.12)",
            borderRadius: 24,
            overflow: "hidden",
            border: "1px solid rgba(1,25,85,0.12)",
            ...avoid,
          }}
        >
          <div style={{ background: "#ffffff", padding: 40 }}>
            <h3 style={{ ...h3, margin: "0 0 24px" }}>Included</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {lines(p.scope.inc).map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <PlusIcon />
                  <span style={{ fontSize: 16 }}>{x}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: "#ffffff", padding: 40 }}>
            <h3 style={{ ...h3, margin: "0 0 24px" }}>Excluded</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {lines(p.scope.exc).map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <CrossIcon />
                  <span style={{ fontSize: 16, color: "rgba(1,25,85,0.65)" }}>{x}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* ── Access & Disruption Plan ── */}
      <Section {...ctx} id="access">
        <Label p={p} id="access" />
        <h2 style={h2WithIntro}>Access &amp; Disruption Plan</h2>
        <p style={introP}>{p.access.intro}</p>
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16/9",
            borderRadius: 16,
            overflow: "hidden",
            background: "rgba(1,25,85,0.08) center/cover no-repeat",
            backgroundImage: bg(photoUrl(p.access.aerial)),
            ...avoid,
          }}
        >
          {pins.map((pn) => (
            <span
              key={pn.id}
              style={{
                position: "absolute",
                left: `${pn.x}%`,
                top: `${pn.y}%`,
                transform: "translate(-50%,-50%)",
                background: pn.color,
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1,
                padding: "7px 10px",
                borderRadius: 7,
                boxShadow: "0 0 0 2px #fff,0 2px 6px rgba(0,0,0,0.3)",
              }}
            >
              {pn.label}
            </span>
          ))}
        </div>
        {pins.some((pn) => pn.note.trim()) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 28px", marginTop: 20, ...avoid }}>
            {pins.map((pn) => (
              <span key={pn.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "rgba(1,25,85,0.65)" }}>
                <span style={{ width: 10, height: 10, borderRadius: "50%", background: pn.color, flexShrink: 0 }} />
                <strong style={{ color: INK, fontWeight: 700 }}>{pn.label}</strong>
                {pn.note}
              </span>
            ))}
          </div>
        )}
        {stages.length > 0 && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${stages.length},1fr)`,
              gap: 1,
              background: "rgba(1,25,85,0.12)",
              border: "1px solid rgba(1,25,85,0.12)",
              borderRadius: 16,
              overflow: "hidden",
              marginTop: 40,
              ...avoid,
            }}
          >
            {stages.map((st) => {
              const drops = pins.filter((pn) => pn.stageId === st.id);
              return (
                <div key={st.id} style={{ background: "#ffffff", padding: 28 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: stageColor(stages, st.id),
                        flexShrink: 0,
                      }}
                    />
                    <span style={factKey}>{st.when}</span>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginTop: 8 }}>{st.what}</div>
                  {drops.length > 0 && (
                    <div style={{ fontSize: 14, color: "rgba(1,25,85,0.55)", marginTop: 4 }}>
                      {drops.length} drop{drops.length > 1 ? "s" : ""}: {drops.map((d) => d.label).join(", ")}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Pricing & Terms ── */}
      <Section {...ctx} id="pricing">
        <Label p={p} id="pricing" />
        <h2 style={h2}>Pricing &amp; Terms</h2>
        <div style={{ maxWidth: 1000 }}>
          {p.pricing.centres.map((c) => (
            <div key={c.id} style={{ borderTop: "1px solid rgba(1,25,85,0.15)", padding: "20px 0", ...avoid }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24 }}>
                <span style={{ fontSize: 17 }}>
                  {c.label} {c.note && <span style={{ color: "rgba(1,25,85,0.45)" }}>{c.note}</span>}
                </span>
                <span style={{ fontSize: 17, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  {fmtMoney(centreTotal(c))}
                </span>
              </div>
              {p.pricing.mode === "lines" &&
                c.items
                  .filter((it) => it.show)
                  .map((it) => (
                    <div key={it.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, paddingTop: 8 }}>
                      <span style={{ fontSize: 15, color: "rgba(1,25,85,0.6)", paddingLeft: 20 }}>{it.name}</span>
                      <span style={{ fontSize: 15, color: "rgba(1,25,85,0.6)", fontVariantNumeric: "tabular-nums" }}>
                        {fmtMoney(it.amt)}
                      </span>
                    </div>
                  ))}
            </div>
          ))}
          <div style={avoid}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "20px 0", borderTop: "2px solid rgba(1,25,85,0.35)" }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>Total (ex GST)</span>
              <span style={{ fontSize: 17, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(sub)}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", padding: "20px 0", borderTop: "1px solid rgba(1,25,85,0.15)" }}>
              <span style={{ fontSize: 17, color: "rgba(1,25,85,0.65)" }}>GST (10%)</span>
              <span style={{ fontSize: 17, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(gst)}</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                padding: "24px 28px",
                background: "rgba(1,25,85,0.08)",
                borderRadius: 16,
                marginTop: 16,
              }}
            >
              <span style={{ fontSize: 22, fontWeight: 700 }}>Total incl. GST</span>
              <span style={{ fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{fmtMoney(sub + gst)}</span>
            </div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                fontSize: 15,
                color: "#1f7a4d",
                fontWeight: 600,
                background: "#dcf2e3",
                padding: "10px 18px",
                borderRadius: 12,
                marginTop: 20,
              }}
            >
              Ready to proceed? Turn to Acceptance in Section {sectionNumber(p, "accept")}.
            </span>
          </div>
        </div>
        <div style={{ marginTop: 56, maxWidth: 760, ...avoid }}>
          <h3 style={{ ...h3, fontSize: 18, margin: "0 0 16px" }}>Payment terms</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {terms.map((t) => (
              <div key={t} style={{ display: "flex", gap: 12, alignItems: "baseline", fontSize: 15, color: "rgba(1,25,85,0.65)" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: INK, flexShrink: 0, transform: "translateY(-3px)" }} />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <p style={{ fontSize: 15, color: "rgba(1,25,85,0.65)", margin: "40px 0 0", maxWidth: 1000 }}>
          <strong style={{ color: INK, fontWeight: 700 }}>Insurance:</strong> $20M public liability, $20M products
          liability, $20M professional liability, workers&apos; compensation, QBCC licensed, IRATA-certified
          technicians. Certificates of currency on request.
        </p>
      </Section>

      {/* ── The 8-Year Warranty ── */}
      <Section {...ctx} id="warranty" keep>
        <Label p={p} id="warranty" />
        <div
          style={{
            background: "#deeeff",
            borderRadius: 24,
            padding: 64,
            display: "flex",
            alignItems: "flex-end",
            gap: 64,
            ...avoid,
          }}
        >
          <div style={{ flexShrink: 0, display: "flex", alignItems: "flex-end", gap: 16 }}>
            <span style={{ fontFamily: BEBAS, fontSize: 230, letterSpacing: "-0.04em", color: INK, lineHeight: 0.85 }}>8</span>
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(1,25,85,0.65)",
                lineHeight: 1.4,
              }}
            >
              Year
              <br />
              Warranty
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <h2 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.1, letterSpacing: "-0.05em", margin: 0 }}>
              Standing by our team,
              <br />
              and our products.
            </h2>
            <p style={{ fontSize: 17, color: "rgba(1,25,85,0.65)", margin: 0 }}>
              {p.std.warranty ?? STD_WORDING.warranty}
            </p>
          </div>
          <div style={{ flexShrink: 0, width: 260, display: "flex", flexDirection: "column", gap: 16 }}>
            <h3 style={h3}>Backed by the best.</h3>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assets.haymes} alt="Haymes Paint" style={{ height: 32, width: "auto" }} />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={assets.dulux} alt="Dulux" style={{ height: 28, width: "auto" }} />
            </div>
          </div>
        </div>
      </Section>

      {/* ── Our Clients ── */}
      <Section {...ctx} id="why" keep>
        <Label p={p} id="why" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 64, alignItems: "end", ...avoid }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <h2 style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.06em", margin: 0 }}>
              We maintain the buildings where
              <br />
              Sunshine Coast locals live, learn, and work.
            </h2>
            <p style={{ fontSize: 18, color: "rgba(1,25,85,0.65)", maxWidth: 760, margin: 0 }}>{p.why.sub}</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 6 }}>
            <GoogleMark />
            <div style={{ display: "flex", flexDirection: "column", gap: 0, lineHeight: 1.2 }}>
              <span style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.2 }}>Google Rating</span>
              <span
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  lineHeight: 1.2,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {p.why.rating}
                <span style={{ fontSize: 16, letterSpacing: "0.08em" }}>★★★★★</span>
              </span>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  lineHeight: 1.3,
                  color: "rgba(1,25,85,0.55)",
                }}
              >
                Based on {p.why.reviews} reviews
              </span>
            </div>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
            gap: "48px 72px",
            marginTop: 80,
            ...avoid,
          }}
        >
          {lines(p.why.clients).map((name, i) => {
            const key = name.toLowerCase();
            const logo = clientLogos[key];
            return (
              <div key={i} style={{ width: 170, height: 84, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {logo ? (
                  <div
                    style={{
                      width: "100%",
                      height: CLIENT_LOGOS[key]?.height ?? 56,
                      background: "center/contain no-repeat",
                      backgroundImage: bg(logo),
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 700,
                      letterSpacing: "-0.02em",
                      color: "rgba(1,25,85,0.45)",
                      textAlign: "center",
                      lineHeight: 1.2,
                    }}
                  >
                    {name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Acceptance ── */}
      <Section {...ctx} id="accept" keep>
        <Label p={p} id="accept" />
        <h2 style={h2WithIntro}>Acceptance</h2>
        <p style={{ fontSize: 17, color: "rgba(1,25,85,0.65)", maxWidth: 640, margin: "0 0 48px" }}>
          To accept this proposal for {fmtMoney(sub)} + GST, sign below or confirm in writing.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: "rgba(1,25,85,0.12)",
            border: "1px solid rgba(1,25,85,0.12)",
            borderRadius: 24,
            overflow: "hidden",
            ...avoid,
          }}
        >
          <div style={{ background: "#ffffff", padding: 40, display: "flex", flexDirection: "column", gap: 24 }}>
            <h3 style={{ ...h3, fontSize: 18 }}>On behalf of the Client</h3>
            <div style={fieldBox}>
              <span style={fieldKey}>Name</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{p.accept.clientName}</span>
            </div>
            <div style={fieldBox}>
              <span style={fieldKey}>Position</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{p.accept.clientRole}</span>
            </div>
            <div style={fieldBox}>
              <span style={fieldKey}>Company</span>
              <span style={{ fontSize: 16, fontWeight: 600 }}>{job.client}</span>
            </div>
            <div style={{ ...fieldBox, minHeight: 80, alignItems: "flex-start" }}>
              <span style={fieldKey}>Signature</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={fieldBox}>
                <span style={fieldKey}>Date</span>
              </div>
              <div style={fieldBox}>
                <span style={fieldKey}>Purchase order no.</span>
              </div>
            </div>
          </div>
          <div style={{ background: "#ffffff", padding: 40, display: "flex", flexDirection: "column", gap: 24 }}>
            <h3 style={{ ...h3, fontSize: 18 }}>On behalf of RAS-VERTEX</h3>
            <div>
              <div style={rvKey}>Name</div>
              <div style={rvVal}>{p.accept.rvSigner}</div>
            </div>
            <div>
              <div style={rvKey}>Position</div>
              <div style={rvVal}>{titleFor(p.accept.rvSigner)}</div>
            </div>
            <div>
              <div style={rvKey}>Signature</div>
              <div
                style={{
                  borderBottom: "1px solid rgba(1,25,85,0.25)",
                  height: 64,
                  display: "flex",
                  alignItems: "flex-end",
                  paddingBottom: 4,
                }}
              >
                <span style={{ fontFamily: SCRIPT, fontSize: 36, lineHeight: 1, color: INK }}>{p.accept.rvSigner}</span>
              </div>
            </div>
            <div>
              <div style={rvKey}>Date</div>
              <div style={rvVal}>{today}</div>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 13, color: "rgba(1,25,85,0.45)", marginTop: 16, marginBottom: 0 }}>
          This proposal is valid for {p.cover.valid} from {today}.
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "16px 40px",
            marginTop: 48,
            paddingTop: 32,
            borderTop: "1px solid rgba(1,25,85,0.12)",
            ...avoid,
          }}
        >
          <h3 style={h3}>Any questions? Reach out.</h3>
          <p style={{ fontSize: 17, margin: 0 }}>
            {job.sales}, {salesTitle} · <strong>{COMPANY_PHONE}</strong> · <strong>{job.email}</strong>
          </p>
        </div>
      </Section>

      {/* ── Trusted by the Coast ── */}
      <Section {...ctx} id="services" keep>
        <Label p={p} id="services" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "end", marginBottom: 56, ...avoid }}>
          <h2 style={{ ...h2, margin: 0 }}>
            Trusted by the Coast&apos;s
            <br />
            best-run buildings.
          </h2>
          <p style={{ fontSize: 18, color: "rgba(1,25,85,0.65)", margin: 0, maxWidth: 560 }}>{p.services.intro}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "32px 24px" }}>
          {services.map((sv) => (
            <div key={sv.id} style={{ display: "flex", flexDirection: "column", gap: 20, ...avoid }}>
              <div
                style={{
                  width: "100%",
                  aspectRatio: "4/3",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "rgba(1,25,85,0.08) center/cover no-repeat",
                  backgroundImage: bg(assets.services[sv.id] ?? sv.img),
                }}
              />
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h3 style={h3}>{sv.name}</h3>
                <p
                  style={{
                    fontSize: 16,
                    color: "rgba(1,25,85,0.6)",
                    margin: 0,
                    display: "-webkit-box",
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {sv.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
