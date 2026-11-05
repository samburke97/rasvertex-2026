// components/reports/settings/CodesScreen.tsx
// Defect codes: the list, and the panel that edits one.

"use client";

import { useRef, useState } from "react";
import { leaves } from "@/lib/reports/settings/library";
import { SEV_COLOURS, colourOf, type BandKey, type DefectCodeDef, type Preset, type ReportSettings } from "@/lib/reports/settings/types";
import { go, useSettings } from "./store";
import { Chev, CodeChip, Ic, P, Sheet, codeTint, tintVars, useOutside } from "./ui";

const blank = (): DefectCodeDef => ({ code: "", name: "", band: "amber", what: "", action: "", work: "", why: "", aliases: [] });

/** Every preset (a report without types, or each type), with its path. */
function presets(s: ReportSettings) {
  return leaves(s).map((l) => ({ id: `${l.report}/${l.type ?? ""}`, label: l.label.replace(" inspection", ""), preset: l.preset }));
}

/** Change one preset, found by "report/type". */
export function withPreset(s: ReportSettings, id: string, fn: (p: Preset) => Preset): ReportSettings {
  const [rk, tk] = id.split("/");
  return {
    ...s,
    reports: s.reports.map((r) =>
      r.key !== rk ? r : tk ? { ...r, types: r.types.map((t) => (t.key === tk ? fn(t) : t)) } : { ...r, ...fn(r) },
    ),
  };
}

const liveCodes = (s: ReportSettings) => s.codes.filter((c) => !c.archived && !c.system).map((c) => c.code);

export default function CodesScreen() {
  const { s, set } = useSettings();
  const [q, setQ] = useState("");
  const [bf, setBf] = useState<string[]>([]);
  const [fOpen, setFOpen] = useState(false);
  const fRef = useRef<HTMLDivElement>(null);
  useOutside(fOpen, () => setFOpen(false), fRef);
  const [open, setOpen] = useState<{ i: number | "new"; forPreset?: string } | null>(null);

  const order = s.severities.map((b) => b.key);
  const nArch = s.codes.filter((c) => c.archived).length;
  const term = q.trim().toLowerCase();
  const rows = s.codes
    .map((c, i) => ({ c, i }))
    .filter(({ c }) =>
      bf.includes("archived")
        ? c.archived && (bf.length === 1 || bf.includes(c.band))
        : !c.archived && (!bf.length || (!c.system && bf.includes(c.band))),
    )
    .filter(({ c }) => !term || `${c.code} ${c.name} ${c.aliases.join(" ")}`.toLowerCase().includes(term))
    .sort((a, b) => Number(!!a.c.system) - Number(!!b.c.system) || order.indexOf(a.c.band) - order.indexOf(b.c.band));
  const togF = (v: string) => setBf((f) => (f.includes(v) ? f.filter((x) => x !== v) : [...f, v]));
  const otLetters = s.severities.map((b) => "OT" + b.letter).join(", ");

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Defect codes</h1>
          <p className="t-sub">The codes technicians put on photo labels, like SH in “D10 L2 SH”. Each one sets what the report says.</p>
        </div>
        <button className="btn btn--primary" onClick={() => setOpen({ i: "new" })}>
          New code
        </button>
      </div>

      <div className="toolbar">
        <input className="search" aria-label="Search codes" placeholder="Search codes" value={q} onChange={(e) => setQ(e.target.value)} />
        {bf.map((v) => {
          const b = s.severities.find((x) => x.key === v);
          const t = b ? colourOf(b.colour, SEV_COLOURS) : { name: "", bg: "#f1f1ef", fg: "#17171a" };
          return (
            <button key={v} className="pill pill-btn" style={tintVars(t)} aria-label={`Remove filter ${b?.name ?? "Archived"}`} onClick={() => togF(v)}>
              {b?.name ?? "Archived"}
              <Ic d={P.close} size={12} stroke={2.4} />
            </button>
          );
        })}
        <div className="menu-wrap" ref={fRef}>
          <button
            className="btn"
            aria-label="Filter"
            aria-expanded={fOpen}
            onClick={() => setFOpen(!fOpen)}
            style={{ width: 36, padding: 0, ...(bf.length || fOpen ? { background: "var(--rs-blue-100)", color: "var(--rs-blue-600)" } : {}) }}
          >
            <Ic d={P.filter} />
          </button>
          {fOpen && (
            <div className="menu" role="menu">
              <button className="menu__item" role="menuitemradio" aria-checked={!bf.length} onClick={() => setBf([])}>
                <span className="spacer">All codes</span>
                <span className="menu__tick" style={{ opacity: bf.length ? 0 : 1 }}>
                  <Ic d={P.tick} size={12} stroke={2.6} />
                </span>
              </button>
              {s.severities.map((b) => (
                <button key={b.key} className="menu__item" role="menuitemcheckbox" aria-checked={bf.includes(b.key)} onClick={() => togF(b.key)}>
                  <span className="spacer">
                    <span className="pill" style={tintVars(colourOf(b.colour, SEV_COLOURS))}>
                      {b.name}
                    </span>
                  </span>
                  <span className="menu__tick" style={{ opacity: bf.includes(b.key) ? 1 : 0 }}>
                    <Ic d={P.tick} size={12} stroke={2.6} />
                  </span>
                </button>
              ))}
              {nArch > 0 && (
                <button className="menu__item" role="menuitemcheckbox" aria-checked={bf.includes("archived")} onClick={() => togF("archived")}>
                  <span className="spacer">Archived ({nArch})</span>
                  <span className="menu__tick" style={{ opacity: bf.includes("archived") ? 1 : 0 }}>
                    <Ic d={P.tick} size={12} stroke={2.6} />
                  </span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="list">
        {rows.map(({ c, i }) => (
          <button key={c.code + i} className="row" onClick={() => setOpen({ i })}>
            <span>
              <span className="chip" style={tintVars(c.archived ? { name: "", bg: "rgba(0,0,0,0.05)", fg: "rgba(23,23,26,0.5)" } : codeTint(s, c.code))}>
                {c.code}
              </span>
            </span>
            <span className="row__main">
              <span className="row__title">{c.name}</span>
              <span className="row__sub">
                {c.system ? (c.code === "OT" ? `Built in. Severity is set on the photo: ${otLetters}.` : `Built in. ${c.what}`) : c.what}
              </span>
            </span>
            <Chev />
          </button>
        ))}
        {!rows.length && <div className="empty">No codes match.</div>}
      </div>

      {open && (
        <CodePanel
          key={String(open.i)}
          initial={open.i === "new" ? blank() : s.codes[open.i]}
          isNew={open.i === "new"}
          forPreset={open.forPreset}
          onClose={() => setOpen(null)}
          onSave={(next, used) => {
            set((prev) => saveCode(prev, open.i, next, used));
            setOpen(null);
          }}
          onArchive={() => {
            if (open.i === "new") return;
            const i = open.i;
            set((prev) => ({ ...prev, codes: prev.codes.map((c, j) => (j === i ? { ...c, archived: !c.archived } : c)) }));
            setOpen(null);
          }}
        />
      )}
    </div>
  );
}

/** Saves a code: renames carry through to every preset that names it, and
 *  "Used in" sets which presets list it. */
export function saveCode(s: ReportSettings, i: number | "new", next: DefectCodeDef, used: string[]): ReportSettings {
  const old = i === "new" ? null : s.codes[i].code;
  const codes = i === "new" ? [...s.codes.filter((c) => !c.system), next, ...s.codes.filter((c) => c.system)] : s.codes.map((c, j) => (j === i ? next : c));
  const ren = (a: string[] | undefined) => a?.map((c) => (c === old ? next.code : c));
  let out: ReportSettings = { ...s, codes };
  const all = liveCodes(out);
  for (const p of presets(out)) {
    out = withPreset(out, p.id, (x) => {
      let list = old && old !== next.code ? ren(x.codes ?? undefined) ?? null : x.codes;
      const on = used.includes(p.id);
      if (list === null && !on) list = all.filter((c) => c !== next.code);
      else if (list && on && !list.includes(next.code)) list = [...list, next.code];
      else if (list && !on) list = list.filter((c) => c !== next.code);
      return {
        ...x,
        codes: list,
        first: old && old !== next.code ? ren(x.first) : x.first,
        extras: x.extras.map((e) => ({ ...e, when: ren(e.when) })),
        plan: x.plan.map((e) => ({ ...e, when: ren(e.when) ?? [] })),
      };
    });
  }
  return out;
}

export function CodePanel({
  initial,
  isNew,
  forPreset,
  onClose,
  onSave,
  onArchive,
}: {
  initial: DefectCodeDef;
  isNew: boolean;
  forPreset?: string;
  onClose: () => void;
  onSave: (c: DefectCodeDef, usedIn: string[]) => void;
  onArchive: () => void;
}) {
  const { s } = useSettings();
  const [d, setD] = useState<DefectCodeDef>(() => JSON.parse(JSON.stringify(initial)));
  const ps = presets(s);
  const [used, setUsed] = useState<string[]>(() =>
    ps.filter((p) => (isNew ? (forPreset ? p.id === forPreset : p.preset.codes === null) : p.preset.codes === null || p.preset.codes.includes(initial.code))).map((p) => p.id),
  );
  const [alias, setAlias] = useState("");
  const up = <K extends keyof DefectCodeDef>(k: K, v: DefectCodeDef[K]) => setD((x) => ({ ...x, [k]: v }));

  const code = d.code.toUpperCase().trim();
  const clash =
    s.codes.find((c) => c.code !== initial.code && (c.code === code || c.aliases.includes(code))) ??
    (s.tags.some((t) => !t.num && t.prefix === code) ? { code, name: "a location tag" } : null);
  const bad = !code
    ? "Give the code 2 to 4 letters."
    : !/^[A-Z]{2,4}$/.test(code)
      ? "Letters only, 2 to 4 of them."
      : clash
        ? `Already used by ${clash.code}, ${clash.name}.`
        : "";
  const ok = !bad && !!d.name.trim();
  const addAlias = () => {
    const a = alias.toUpperCase().trim();
    if (a && /^[A-Z]{1,5}$/.test(a) && !d.aliases.includes(a) && a !== code) up("aliases", [...d.aliases, a]);
    setAlias("");
  };
  const ot = s.severities;

  return (
    <Sheet
      title={isNew ? "New code" : d.name || code}
      head={<CodeChip s={{ ...s, codes: s.codes.map((c) => (c.code === initial.code ? { ...d, code: code } : c)).concat(isNew ? [{ ...d, code }] : []) }} code={code} />}
      onClose={onClose}
      foot={
        <>
          {!isNew && !d.system && (
            <button className="btn" onClick={onArchive}>
              {d.archived ? "Restore" : "Archive"}
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            {d.system ? "Close" : "Cancel"}
          </button>
          {!d.system && (
            <button className="btn btn--primary" disabled={!ok} onClick={() => onSave({ ...d, code, name: d.name.trim() }, used)}>
              Save
            </button>
          )}
        </>
      }
    >
      {d.system ? (
        <>
          <div className="notice">
            <Ic d={P.lock} />
            <span>Built in. Every report understands this tag, so it can’t be edited or removed. {d.what}</span>
          </div>
          {d.code === "OT" && (
            <div className="sec">
              <div className="row__main">
                <span className="sec__title">Severity is set on the photo</span>
                <span className="hint">Add a severity letter after OT. A plain OT counts as {ot[ot.length - 1]?.name}.</span>
              </div>
              <div className="list">
                {ot.map((b) => (
                  <div key={b.key} className="line-row">
                    <span className="chip" style={tintVars(colourOf(b.colour, SEV_COLOURS))}>
                      OT{b.letter}
                    </span>
                    <span>Other item, {b.name}</span>
                  </div>
                ))}
              </div>
              <button className="text-btn" onClick={() => go("#severity")}>
                Edit severities
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div>
            <div className="grid2">
              <div className="field">
                <label htmlFor="c-code">Code</label>
                <input id="c-code" className={`input input--code${bad && code ? " input--error" : ""}`} value={d.code} maxLength={4} onChange={(e) => up("code", e.target.value.toUpperCase())} />
              </div>
              <div className="field">
                <label htmlFor="c-name">Name</label>
                <input id="c-name" className="input" value={d.name} placeholder="e.g. Cracked tile" onChange={(e) => up("name", e.target.value)} />
              </div>
            </div>
            {bad && code && <p className="error" style={{ margin: "8px 0 0" }}>{bad}</p>}
          </div>

          <div className="sec">
            <div className="sec__head">
              <span className="sec__title">Severity</span>
              <button className="text-btn" style={{ padding: 0 }} onClick={() => go("#severity")}>
                Edit severities
              </button>
            </div>
            <div role="radiogroup" aria-label="Severity" className="wrap-row" style={{ gap: 8 }}>
              {s.severities.map((b) => (
                <button key={b.key} role="radio" aria-checked={d.band === b.key} className="sev-pick" style={tintVars(colourOf(b.colour, SEV_COLOURS))} onClick={() => up("band", b.key as BandKey)}>
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sec">
            <span className="sec__title">In the report</span>
            <Area id="c-what" label="What it is" value={d.what} onChange={(v) => up("what", v)} limit />
            <Area id="c-act" label="What we do" value={d.action} onChange={(v) => up("action", v)} limit />
            <div className="field">
              <label htmlFor="c-work">Recommended work</label>
              <input id="c-work" className="input" value={d.work} onChange={(e) => up("work", e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="c-why">Why it matters</label>
              <input id="c-why" className="input" value={d.why} onChange={(e) => up("why", e.target.value)} />
            </div>
          </div>

          <div className="sec">
            <span className="sec__title">Used in</span>
            <div className="wrap-row">
              {ps.map((p) => {
                const on = used.includes(p.id);
                return (
                  <button key={p.id} role="switch" aria-checked={on} className="check-chip" onClick={() => setUsed((u) => (on ? u.filter((x) => x !== p.id) : [...u, p.id]))}>
                    <span className="check-chip__box">{on && <Ic d={P.tick} size={10} stroke={3.5} />}</span>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sec">
            <div className="row__main">
              <span className="sec__title">Also matches</span>
              <span className="hint">Old or misspelt codes on photos that mean the same thing.</span>
            </div>
            <div className="wrap-row">
              {d.aliases.map((a) => (
                <span key={a} className="alias">
                  {a}
                  <button className="icon-btn" style={{ width: 24, height: 24 }} aria-label={`Remove ${a}`} onClick={() => up("aliases", d.aliases.filter((x) => x !== a))}>
                    <Ic d={P.close} size={11} stroke={2.4} />
                  </button>
                </span>
              ))}
              <input
                className="input alias-in"
                aria-label="Add a code it also matches"
                placeholder="+ Add"
                value={alias}
                maxLength={5}
                onChange={(e) => setAlias(e.target.value.toUpperCase())}
                onBlur={addAlias}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addAlias();
                  }
                }}
              />
            </div>
          </div>
        </>
      )}
    </Sheet>
  );
}

/** A two-line field; the Defects explained table fits about 66 characters. */
function Area({ id, label, value, onChange, limit }: { id: string; label: string; value: string; onChange: (v: string) => void; limit?: boolean }) {
  const long = limit && value.length > 66;
  return (
    <div className="field">
      <label htmlFor={id} style={{ display: "flex", justifyContent: "space-between" }}>
        {label}
        {limit && <span style={{ color: long ? "var(--rs-red)" : "var(--rs-ink-45)" }}>{value.length} / 66</span>}
      </label>
      <textarea id={id} className="input" rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
      {long && <span className="hint">Longer than two lines in the Defects explained table.</span>}
    </div>
  );
}
