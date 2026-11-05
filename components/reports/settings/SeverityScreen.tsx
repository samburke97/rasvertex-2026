// components/reports/settings/SeverityScreen.tsx
// The three severities: wording, OT letter, colour and order.

"use client";

import { SEV_COLOURS, colourOf, type Severity } from "@/lib/reports/settings/types";
import { useSettings } from "./store";
import { ColourPicker, Ic, P, tintVars } from "./ui";

export default function SeverityScreen() {
  const { s, set } = useSettings();
  const up = (i: number, patch: Partial<Severity>) =>
    set((p) => ({ ...p, severities: p.severities.map((b, j) => (j === i ? { ...b, ...patch } : b)) }));
  const move = (i: number, by: number) =>
    set((p) => {
      const a = [...p.severities];
      [a[i], a[i + by]] = [a[i + by], a[i]];
      return { ...p, severities: a };
    });
  const letters = s.severities.map((b) => b.letter);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__text">
          <h1 className="t-title">Severity</h1>
          <p className="t-sub">Every code sits in one of these. Most severe first: reports list the groups in this order.</p>
        </div>
      </div>
      {s.severities.map((b, i) => {
        const n = s.codes.filter((c) => !c.archived && !c.system && c.band === b.key).length;
        const dup = !!b.letter && letters.indexOf(b.letter) !== i;
        return (
          <div key={b.key} className="list list--open" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span className="pill pill--lg" style={tintVars(colourOf(b.colour, SEV_COLOURS))}>
                {b.name || "Untitled"}
              </span>
              <span className="hint spacer">
                {n} {n === 1 ? "code" : "codes"}
              </span>
              {i > 0 && (
                <button className="icon-btn" aria-label="Move up" onClick={() => move(i, -1)}>
                  <Ic d={P.up} size={14} stroke={2} />
                </button>
              )}
              {i < s.severities.length - 1 && (
                <button className="icon-btn" aria-label="Move down" onClick={() => move(i, 1)}>
                  <Ic d={P.down} size={14} stroke={2} />
                </button>
              )}
            </div>
            <div className="grid2 grid2--wide">
              <div className="field">
                <label>Name</label>
                <input className="input" value={b.name} onChange={(e) => up(i, { name: e.target.value })} />
              </div>
              <div className="field">
                <label>Letter on OT tags</label>
                <input
                  className={`input input--code${dup ? " input--error" : ""}`}
                  value={b.letter}
                  maxLength={1}
                  onChange={(e) => up(i, { letter: e.target.value.toUpperCase().replace(/[^A-Z]/g, "") })}
                />
              </div>
            </div>
            {dup && <span className="error">Another severity already uses {b.letter}.</span>}
            <div className="field">
              <label>Short description</label>
              <input className="input" value={b.desc} onChange={(e) => up(i, { desc: e.target.value })} />
            </div>
            <div className="field">
              <label>Summary page sentence</label>
              <input className="input" value={b.tail} onChange={(e) => up(i, { tail: e.target.value })} />
            </div>
            <div className="field">
              <label>Colour</label>
              <ColourPicker sm value={b.colour} list={SEV_COLOURS} onChange={(v) => up(i, { colour: v })} />
            </div>
          </div>
        );
      })}
      <p className="hint">
        Reports file every code under one of these three, so they can be renamed, recoloured and reordered but not added or removed.
      </p>
    </div>
  );
}
