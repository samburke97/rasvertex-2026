// components/reports/settings/TagsScreen.tsx
// Location tags (D10, L2, U5…) and "Try a photo label".

"use client";

import { useState } from "react";
import { libraryFrom, readTag, tagText } from "@/lib/reports/settings/library";
import { SEV_COLOURS, colourOf, type LocationTag, type TagKind } from "@/lib/reports/settings/types";
import { useSettings } from "./store";
import { Chev, Seg, Sheet, codeTint, tintVars } from "./ui";

const KINDS: Record<TagKind, [string, string]> = {
  zone: ["Area", "Photos are grouped into a chapter for each area, like Drop 10."],
  level: ["Level", "Photos are sorted by level within each area."],
  unit: ["Unit", "Adds the unit to the photo’s location line."],
};

const sample = (t: LocationTag) => (t.kind === "level" ? "2" : t.kind === "unit" ? "5" : "10");
const example = (t: LocationTag) => (t.prefix || "?") + (t.num ? sample(t) : "");
const printed = (t: LocationTag) => (t.num ? t.prints.replace("#", sample(t)) : t.prints);

export default function TagsScreen() {
  const { s, set } = useSettings();
  const [open, setOpen] = useState<number | "new" | null>(null);
  const [label, setLabel] = useState("D10 L2 U5 SH CO - Expansion joint sealant split");

  // Read the label as a report would, with every code.
  const lib = libraryFrom({ ...s, reports: [{ ...s.reports[0], codes: null, types: [] }] }, s.reports[0]?.key);
  const k = label.indexOf(" - ");
  const head = k < 0 ? label : label.slice(0, k);
  const note = k < 0 ? "" : label.slice(k + 3);
  const chips = head
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const t = tok.toUpperCase().replace(/[,;.]$/, "");
      if (readTag(t, s.tags)) return { tag: t, means: tagText(t, s.tags), tint: { name: "", bg: "#eef1f6", fg: "rgba(1,25,85,0.8)" } };
      const ot = /^OT(.)$/.exec(t);
      const b = ot && s.severities.find((x) => x.letter === ot[1]);
      if (b) return { tag: t, means: `Other item, ${b.name}`, tint: colourOf(b.colour, SEV_COLOURS) };
      const code = lib.aliases[t] ?? t;
      const c = lib.codeMap[code];
      if (c) return { tag: t, means: c.name, tint: codeTint(s, code) };
      return { tag: t, means: "not recognised", tint: { name: "", bg: "#fff", fg: "#a83a3a" } };
    });
  const unknown = chips.filter((c) => c.means === "not recognised").length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Location tags</h1>
          <p className="t-sub">Tags that say where a photo was taken. Reports group and sort photos by them.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setOpen("new")}>
          New tag
        </button>
      </div>

      <div className="list">
        {s.tags.map((t, i) => (
          <button key={t.prefix + t.num} className="row row--tag" onClick={() => setOpen(i)}>
            <span>
              <span className="chip chip--loc">{example(t)}</span>
            </span>
            <span className="row__main">
              <span className="row__title">Prints as “{printed(t)}”</span>
              <span className="row__sub">{t.num ? `Letters ${t.prefix} followed by a number` : `Exactly ${t.prefix}`}</span>
            </span>
            <span>
              <span className="pill">{KINDS[t.kind][0]}</span>
            </span>
            <Chev />
          </button>
        ))}
      </div>

      <div className="try">
        <span className="sec__title">Try a photo label</span>
        <input className="search" aria-label="Photo label" value={label} onChange={(e) => setLabel(e.target.value)} style={{ fontWeight: 600 }} />
        <div className="wrap-row">
          {chips.map((c, i) => (
            <span key={i} className="pill" style={{ ...tintVars(c.tint), height: 28, fontSize: 12.5 }}>
              <strong>{c.tag}</strong> {c.means}
            </span>
          ))}
        </div>
        <span className="hint">
          {unknown ? `${unknown} tag${unknown > 1 ? "s" : ""} not recognised. Add it as a code or location tag. ` : "Every tag recognised. "}
          {note && `Note after the dash: “${note}”.`}
        </span>
      </div>

      {open !== null && (
        <TagPanel
          key={String(open)}
          initial={open === "new" ? { prefix: "", num: true, prints: "", kind: "zone" } : s.tags[open]}
          index={open}
          onClose={() => setOpen(null)}
          onSave={(t) => {
            set((p) => ({ ...p, tags: open === "new" ? [...p.tags, t] : p.tags.map((x, j) => (j === open ? t : x)) }));
            setOpen(null);
          }}
          onRemove={() => {
            set((p) => ({ ...p, tags: p.tags.filter((_, j) => j !== open) }));
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

function TagPanel({
  initial,
  index,
  onClose,
  onSave,
  onRemove,
}: {
  initial: LocationTag;
  index: number | "new";
  onClose: () => void;
  onSave: (t: LocationTag) => void;
  onRemove: () => void;
}) {
  const { s } = useSettings();
  const [t, setT] = useState<LocationTag>({ ...initial });
  const up = <K extends keyof LocationTag>(k: K, v: LocationTag[K]) => setT((x) => ({ ...x, [k]: v }));
  const p = t.prefix.toUpperCase();
  const clash =
    s.tags.find((x, i) => i !== index && x.prefix === p && x.num === t.num)?.prints ??
    (!t.num ? s.codes.find((c) => c.code === p || c.aliases.includes(p))?.name : undefined);
  const err = !p ? "" : !/^[A-Z]{1,3}$/.test(p) ? "Letters only, 1 to 3 of them." : clash ? `Already used by ${clash}.` : "";
  const ok = !!p && !err && !!t.prints.trim() && (!t.num || t.prints.includes("#"));

  return (
    <Sheet
      title={index === "new" ? "New tag" : printed(initial)}
      head={<span className="chip chip--loc">{example({ ...t, prefix: p })}</span>}
      onClose={onClose}
      foot={
        <>
          {index !== "new" && (
            <button className="btn" onClick={onRemove}>
              Remove tag
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" disabled={!ok} onClick={() => onSave({ ...t, prefix: p, prints: t.prints.trim() })}>
            Save
          </button>
        </>
      }
    >
      <div>
        <div className="grid2 grid2--tag">
          <div className="field">
            <label htmlFor="t-pre">Letters</label>
            <input id="t-pre" className="input input--code" value={t.prefix} maxLength={3} onChange={(e) => up("prefix", e.target.value.toUpperCase())} />
          </div>
          <div className="field">
            <label htmlFor="t-pr">Prints as{t.num ? " · # is the number" : ""}</label>
            <input id="t-pr" className="input" value={t.prints} placeholder={t.num ? "e.g. Drop #" : "e.g. Roof"} onChange={(e) => up("prints", e.target.value)} />
          </div>
        </div>
        {err && <p className="error" style={{ margin: "8px 0 0" }}>{err}</p>}
        {t.num && t.prints && !t.prints.includes("#") && <p className="error" style={{ margin: "8px 0 0" }}>Put # where the number goes.</p>}
      </div>
      <div className="sec">
        <span className="lbl">Followed by a number</span>
        <Seg label="Number" value={t.num} options={[["Yes", true], ["No", false]]} onChange={(v) => up("num", v)} />
      </div>
      <div className="sec">
        <span className="lbl">What it marks</span>
        <Seg label="Kind" value={t.kind} options={(Object.keys(KINDS) as TagKind[]).map((k) => [KINDS[k][0], k])} onChange={(v) => up("kind", v)} />
        <span className="hint">{KINDS[t.kind][1]}</span>
      </div>
      <div className="notice">
        <span>
          On a photo, <strong>{example({ ...t, prefix: p })}</strong> prints as <strong>{printed(t) || "…"}</strong>.
        </span>
      </div>
    </Sheet>
  );
}
