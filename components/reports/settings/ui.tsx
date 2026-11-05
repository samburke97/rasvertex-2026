// components/reports/settings/ui.tsx
// Small pieces shared by the settings screens.

"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { SEV_COLOURS, colourOf, tint, type ReportSettings, type Tint } from "@/lib/reports/settings/types";

// ── Icons ────────────────────────────────────────────────────────────────────

export const P = {
  chev: "M9 6l6 6-6 6",
  back: "M15 6l-6 6 6 6",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  trash: "M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13",
  tick: "M5 12.5l4.5 4.5L19 7.5",
  filter: "M4 5h16l-6.2 7.6V19l-3.6-1.8v-4.6z",
  down: "M6 9l6 6 6-6",
  up: "M6 15l6-6 6 6",
  lock: "M7 11V8a5 5 0 0110 0v3M5 11h14v9H5z",
  report: "M7 3h10a1 1 0 011 1v17l-3-2-3 2-3-2-3 2V4a1 1 0 011-1zM9 8h6M9 12h6M9 16h3",
  types: "M4 6h16M4 12h16M4 18h10",
  code: "M3.5 12.5 11 5h7.5v7.5L11 20zM15 9h.01",
  pin: "M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11zM12 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  bars: "M4 20h4V10H4zM10 20h4V4h-4zM16 20h4v-7h-4z",
  anchor: "M5 18h14a1 1 0 0 1 1 1v1a1 1 0 0 1 -1 1h-14a1 1 0 0 1 -1 -1v-1a1 1 0 0 1 1 -1zM12 18v-4.5M7.5 9a4.5 4.5 0 1 0 9 0a4.5 4.5 0 1 0 -9 0",
};

export function Ic({ d, size = 16, stroke = 1.8 }: { d: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const Chev = () => (
  <span className="row__chev">
    <Ic d={P.chev} stroke={2} />
  </span>
);

/** --bg / --fg for a pastel. */
export const tintVars = (t: Tint) => ({ "--bg": t.bg, "--fg": t.fg }) as CSSProperties;

/** A code's chip colours, from its severity. */
export function codeTint(s: ReportSettings, code: string): Tint {
  const c = s.codes.find((x) => x.code === code);
  if (!c || c.system) return { name: "", bg: "#f1f1ef", fg: "#17171a" };
  const b = s.severities.find((x) => x.key === c.band);
  return b ? colourOf(b.colour, SEV_COLOURS) : SEV_COLOURS[2];
}

export function CodeChip({ s, code, sm }: { s: ReportSettings; code: string; sm?: boolean }) {
  return (
    <span className={`chip${sm ? " chip--sm" : ""}`} style={tintVars(codeTint(s, code))}>
      {code || "··"}
    </span>
  );
}

// ── Controls ─────────────────────────────────────────────────────────────────

export function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" className="toggle" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)} />;
}

export function Seg<T extends string | boolean>({ value, options, onChange, label }: { value: T; options: [string, T][]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map(([l, v]) => (
        <button key={l} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

/** The side panel the code, tag and anchor editors open in. */
export function Sheet({ head, title, children, foot, onClose }: { head?: ReactNode; title: string; children: ReactNode; foot: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="sheet-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet__head">
          {head}
          <span className="sheet__title">{title}</span>
          <button type="button" className="icon-btn icon-btn--lg" aria-label="Close" onClick={onClose}>
            <Ic d={P.close} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        <div className="sheet__foot">{foot}</div>
      </div>
    </div>
  );
}

/** Closes a popover on an outside click. */
export function useOutside(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, close, ref]);
}

// ── Colour picker ────────────────────────────────────────────────────────────

const hsl2hex = (h: number, sat: number, l: number) => {
  sat /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(l, 1 - l);
  const f = (n: number) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return "#" + [f(0), f(8), f(4)].map((v) => v.toString(16).padStart(2, "0")).join("");
};
const hex2hue = (hex: string) => {
  const n = parseInt(hex.slice(1), 16) || 0;
  const [r, g, b] = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  const mx = Math.max(r, g, b);
  const d = mx - Math.min(r, g, b);
  if (!d) return 0;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round((h * 60 + 360) % 360);
};
const RECENT = [10, 28, 48, 160, 190, 215, 265, 320].map((h) => hsl2hex(h, 62, 48));

/** Preset pastels, plus a custom colour from a hue slider or a hex. */
export function ColourPicker({ value, list, onChange, sm }: { value: number | string; list: Tint[]; onChange: (v: number | string) => void; sm?: boolean }) {
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(typeof value === "string" ? value : "#4a82c9");
  const ok = /^#[0-9a-fA-F]{6}$/.test(hex);
  const custom = typeof value === "string" ? tint(value) : null;
  return (
    <div className="swatches">
      {list.map((c, i) => (
        <button key={c.name + i} type="button" className={`swatch${sm ? " swatch--sm" : ""}`} aria-label={c.name} aria-pressed={value === i} style={tintVars(c)} onClick={() => onChange(i)}>
          <span className="swatch__dot" />
        </button>
      ))}
      <div className="menu-wrap">
        <button
          type="button"
          className={`swatch${sm ? " swatch--sm" : ""}`}
          aria-label="Custom colour"
          aria-expanded={open}
          aria-pressed={!!custom}
          style={custom ? tintVars(custom) : ({ "--bg": "#fff", "--fg": "rgba(23,23,26,0.55)" } as CSSProperties)}
          onClick={() => {
            setHex(typeof value === "string" ? value : "#4a82c9");
            setOpen(!open);
          }}
        >
          <Ic d={P.plus} size={14} stroke={2.2} />
        </button>
        {open && (
          <div className="colour-pop" role="dialog" aria-label="Custom colour">
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="pill pill--lg" style={ok ? tintVars(tint(hex)) : undefined}>
                Preview
              </span>
              <input
                className="input"
                aria-label="Hex colour"
                value={hex}
                maxLength={7}
                onChange={(e) => setHex(e.target.value.trim().replace(/^([^#])/, "#$1"))}
                style={{ height: 30, padding: "0 10px", fontSize: 12.5, fontWeight: 600 }}
              />
            </div>
            <input className="hue" type="range" min={0} max={359} aria-label="Hue" value={hex2hue(ok ? hex : "#4a82c9")} onChange={(e) => setHex(hsl2hex(+e.target.value, 62, 48))} />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {RECENT.map((h) => (
                <button key={h} type="button" className="swatch" aria-label={h} style={{ ...tintVars(tint(h)), width: 24, height: 24, borderRadius: 7 }} onClick={() => setHex(h)}>
                  <span className="swatch__dot" style={{ width: 8, height: 8 }} />
                </button>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button type="button" className="btn btn--sm" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--sm btn--primary"
                disabled={!ok}
                onClick={() => {
                  onChange(hex.toLowerCase());
                  setOpen(false);
                }}
              >
                Use colour
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** "MT, LS, DLM or 3 more" */
export const orList = (a: string[]) =>
  a.length === 1 ? a[0] : a.length <= 3 ? a.slice(0, -1).join(", ") + " or " + a[a.length - 1] : a.slice(0, 3).join(", ") + " or " + (a.length - 3) + " more";

export const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "item";

/** A key not yet in use: "tiled", "tiled-2"… */
export function freshKey(base: string, used: string[]) {
  let k = slug(base);
  for (let n = 2; used.includes(k); n++) k = `${slug(base)}-${n}`;
  return k;
}
