// components/reports/settings/AnchorTypesScreen.tsx
// What a technician can place on the roof plan: name, colour, icon, load
// rating and mounting options per type.

"use client";

import { useRef, useState } from "react";
import { ANCHOR_ICON_NAMES } from "@/lib/reports/anchor.layout";
import { ANCHOR_SUBTYPE_LABELS, anchorIconName, anchorIconSrc, type AnchorSubtype } from "@/lib/reports/anchor.types";
import { ANCHOR_PASTELS, colourOf, type AnchorTypeDef } from "@/lib/reports/settings/types";
import { useSettings } from "./store";
import { Chev, ColourPicker, Seg, Sheet, Toggle, freshKey, tintVars } from "./ui";

const SUBS = Object.keys(ANCHOR_SUBTYPE_LABELS) as AnchorSubtype[];
const subIcon = (st: AnchorSubtype, type: string) => anchorIconSrc(anchorIconName({ type, subtype: st }));

function Icon({ src, sm }: { src: string; sm?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={sm ? 17 : 22} height={sm ? 17 : 22} />;
}

export default function AnchorTypesScreen() {
  const { s, set } = useSettings();
  const [open, setOpen] = useState<number | "new" | null>(null);
  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Anchor types</h1>
          <p className="t-sub">What a technician can place on the roof plan in the anchor inspection report.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setOpen("new")}>
          New type
        </button>
      </div>
      <div className="list">
        {s.anchors.map((a, i) => {
          const t = colourOf(a.colour, ANCHOR_PASTELS);
          return (
            <button key={a.key} className="row row--anchor" onClick={() => setOpen(i)}>
              <span className="icon-tile" style={tintVars(t)}>
                <Icon src={anchorIconSrc(a.icon)} />
              </span>
              <span className="row__main" style={{ gap: 5 }}>
                <span className="row__title">{a.name}</span>
                {!!a.subs?.length && (
                  <span className="sub-pills">
                    {a.subs.map((st) => (
                      <span key={st} className="pill" style={{ ...tintVars(t), height: 22, padding: "0 7px" }}>
                        <Icon src={subIcon(st, a.key)} sm />
                        {ANCHOR_SUBTYPE_LABELS[st]}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span style={{ fontSize: 13, fontWeight: a.kn ? 600 : 400, color: a.kn ? "var(--rs-ink)" : "var(--rs-ink-45)" }}>{a.kn ? `${a.kn} kN` : "Not rated"}</span>
              <Chev />
            </button>
          );
        })}
      </div>
      <p className="hint">Reports already started keep the types they were started with.</p>

      {open !== null && (
        <AnchorPanel
          key={String(open)}
          initial={open === "new" ? { key: "", name: "", icon: "fall-arrest-anchor", colour: s.anchors.length, kn: "", subs: null } : s.anchors[open]}
          isNew={open === "new"}
          onClose={() => setOpen(null)}
          onSave={(a) => {
            set((p) => ({
              ...p,
              anchors:
                open === "new"
                  ? [...p.anchors, { ...a, key: freshKey(a.name, p.anchors.map((x) => x.key)) }]
                  : p.anchors.map((x, j) => (j === open ? a : x)),
            }));
            setOpen(null);
          }}
          onRemove={
            open === "new" || s.anchors.length < 2
              ? undefined
              : () => {
                  if (!confirm(`Remove ${s.anchors[open].name}? Reports already started keep it.`)) return;
                  set((p) => ({ ...p, anchors: p.anchors.filter((_, j) => j !== open) }));
                  setOpen(null);
                }
          }
        />
      )}
    </div>
  );
}

function AnchorPanel({
  initial,
  isNew,
  onClose,
  onSave,
  onRemove,
}: {
  initial: AnchorTypeDef;
  isNew: boolean;
  onClose: () => void;
  onSave: (a: AnchorTypeDef) => void;
  onRemove?: () => void;
}) {
  const [a, setA] = useState<AnchorTypeDef>(() => JSON.parse(JSON.stringify(initial)));
  const [rated, setRated] = useState(!!initial.kn.trim());
  const [upErr, setUpErr] = useState("");
  const file = useRef<HTMLInputElement>(null);
  const up = <K extends keyof AnchorTypeDef>(k: K, v: AnchorTypeDef[K]) => setA((x) => ({ ...x, [k]: v }));
  const t = colourOf(a.colour, ANCHOR_PASTELS);
  const icons: string[] = [...ANCHOR_ICON_NAMES, ...(a.icon.startsWith("data:") ? [a.icon] : [])];
  const ok = !!a.name.trim() && (!rated || !!a.kn.trim());

  const upload = (f: File | undefined) => {
    setUpErr("");
    if (!f) return;
    if (!/svg/.test(f.type) && !f.name.toLowerCase().endsWith(".svg")) return setUpErr("Choose an SVG file.");
    if (f.size > 60_000) return setUpErr("That SVG is over 60 KB. Simplify it and try again.");
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result);
      if (/<script|on\w+=/i.test(text)) return setUpErr("That SVG has scripts in it, which reports can't use.");
      up("icon", "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(text))));
    };
    r.readAsText(f);
  };

  return (
    <Sheet
      title={isNew ? "New anchor type" : a.name || "Anchor type"}
      head={
        <span className="icon-tile" style={{ ...tintVars(t), width: 36, height: 36 }}>
          <Icon src={anchorIconSrc(a.icon)} />
        </span>
      }
      onClose={onClose}
      foot={
        <>
          {onRemove && (
            <button className="btn" onClick={onRemove}>
              Remove type
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!ok} onClick={() => onSave({ ...a, name: a.name.trim(), kn: rated ? a.kn.trim() : "" })}>
            Save
          </button>
        </>
      }
    >
      <div className="field">
        <label htmlFor="a-name">Name</label>
        <input id="a-name" className="input" value={a.name} placeholder="e.g. Davit arm" onChange={(e) => up("name", e.target.value)} />
      </div>
      <div className="sec">
        <span className="lbl">Colour</span>
        <ColourPicker value={a.colour} list={ANCHOR_PASTELS} onChange={(v) => up("colour", v)} />
      </div>
      <div className="sec">
        <span className="lbl">Icon</span>
        <div className="icon-grid" style={tintVars(t)}>
          {icons.map((n) => (
            <button key={n.slice(0, 80)} type="button" aria-label={n.startsWith("data:") ? "Uploaded icon" : n} title={n.startsWith("data:") ? "Uploaded" : n} aria-pressed={a.icon === n} onClick={() => up("icon", n)}>
              <Icon src={anchorIconSrc(n)} />
            </button>
          ))}
        </div>
        <button className="btn btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => file.current?.click()}>
          Upload SVG
        </button>
        <input ref={file} type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => upload(e.target.files?.[0])} />
        {upErr && <span className="error">{upErr}</span>}
      </div>
      <div className="sec">
        <span className="lbl">Load rating</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Seg
            label="Load rated"
            value={rated}
            options={[["Rated", true], ["Not rated", false]]}
            onChange={(v) => {
              setRated(v);
              if (v && !a.kn) up("kn", "15");
            }}
          />
          {rated && (
            <label className="kn">
              <input aria-label="Rating in kN" inputMode="decimal" value={a.kn} onChange={(e) => up("kn", e.target.value.replace(/[^0-9.]/g, ""))} />
              kN
            </label>
          )}
        </div>
        <span className="hint">{rated ? "Prints on the certification table, to AS/NZS 1891.4." : "Shows a dash on the certification table."}</span>
      </div>
      <div className="sec">
        <div className="sec__head">
          <span className="lbl">Mounting options</span>
          <Toggle on={!!a.subs} label="Has mounting options" onChange={(v) => up("subs", v ? [] : null)} />
        </div>
        {a.subs && (
          <div className="list">
            {SUBS.map((st) => {
              const on = a.subs!.includes(st);
              return (
                <div key={st} className="line-row" style={{ padding: "10px 12px" }}>
                  <span className="icon-tile icon-tile--sm" style={on ? tintVars(t) : { "--bg": "rgba(0,0,0,0.04)" } as React.CSSProperties}>
                    <Icon src={subIcon(st, a.key || "fall-arrest-anchor")} sm />
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: on ? "var(--rs-ink)" : "var(--rs-ink-55)" }}>{ANCHOR_SUBTYPE_LABELS[st]}</span>
                  <Toggle on={on} label={ANCHOR_SUBTYPE_LABELS[st]} onChange={(v) => up("subs", v ? SUBS.filter((x) => x === st || a.subs!.includes(x)) : a.subs!.filter((x) => x !== st))} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Sheet>
  );
}
