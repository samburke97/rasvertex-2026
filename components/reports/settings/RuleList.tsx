// components/reports/settings/RuleList.tsx
//
// A list of rules, each read as a sentence, edited by clicking the blue
// parts of it. As Caro's automations. Shared by Next steps and the
// Maintenance plan.

"use client";

import { useRef, useState, type ReactNode } from "react";
import { Ic, P, Toggle, useOutside } from "./ui";

export type Part =
  | { w: string }
  | {
      key: string;
      label: string;
      empty?: boolean;
      /** A text box… */
      input?: { value: string; set: (v: string) => void; ph: string; label: string; long?: boolean };
      /** …or a list to pick from (several, with multi). */
      opts?: { label: string; sel: boolean; pick: () => void; chip?: ReactNode }[];
      multi?: boolean;
    };

export interface Rule {
  id: string;
  on: boolean;
  /** How it reads in the list. */
  sentence: ReactNode;
  parts: Part[];
}

export default function RuleList({
  rules,
  onToggle,
  onRemove,
  editing,
  setEditing,
}: {
  rules: Rule[];
  onToggle: (i: number, on: boolean) => void;
  onRemove: (i: number) => void;
  editing: string | null;
  setEditing: (id: string | null) => void;
}) {
  if (!rules.length) return <div className="list empty">Nothing here yet.</div>;
  return (
    <div className="list list--open">
      {rules.map((r, i) => (
        <div key={r.id} className="rule-wrap">
          {editing === r.id ? (
            <Builder parts={r.parts} onDone={() => setEditing(null)} onRemove={() => { onRemove(i); setEditing(null); }} />
          ) : (
            <div className={`rule${r.on ? "" : " is-off"}`}>
              <Toggle on={r.on} label="On" onChange={(v) => onToggle(i, v)} />
              <span className="rule-text">{r.sentence}</span>
              <button className="icon-btn" aria-label="Edit" onClick={() => setEditing(r.id)}>
                <Ic d={P.edit} size={14} />
              </button>
              <button className="icon-btn" aria-label="Delete" onClick={() => onRemove(i)}>
                <Ic d={P.trash} size={14} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Builder({ parts, onDone, onRemove }: { parts: Part[]; onDone: () => void; onRemove: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="builder">
      <div className="builder__sentence">
        {parts.map((p, i) =>
          "w" in p ? (
            p.w && (
              <span key={i} className="builder__word">
                {p.w}
              </span>
            )
          ) : (
            <ChipPart key={p.key} part={p} open={open === p.key} setOpen={(v) => setOpen(v ? p.key : null)} />
          ),
        )}
      </div>
      <div className="builder__foot">
        <span className="builder__hint">Click any blue part to change it.</span>
        <button className="btn btn--sm btn--danger-text" onClick={onRemove}>
          Delete
        </button>
        <button className="btn btn--sm btn--primary" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

function ChipPart({ part, open, setOpen }: { part: Exclude<Part, { w: string }>; open: boolean; setOpen: (v: boolean) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  useOutside(open, () => setOpen(false), ref);
  return (
    <span className="bchip-wrap" ref={ref}>
      <button type="button" className={`bchip${part.empty ? " bchip--empty" : ""}`} aria-expanded={open} onClick={() => setOpen(!open)}>
        {part.label}
        <span style={{ opacity: 0.5, display: "inline-flex" }}>
          <Ic d={P.down} size={10} stroke={3} />
        </span>
      </button>
      {open && (
        <div className="menu" role="listbox">
          {part.input ? (
            <div className="bchip-input">
              {part.input.long ? (
                <textarea
                  className="input"
                  rows={3}
                  aria-label={part.input.label}
                  autoFocus
                  value={part.input.value}
                  placeholder={part.input.ph}
                  onChange={(e) => part.input!.set(e.target.value)}
                />
              ) : (
                <input
                  className="input"
                  aria-label={part.input.label}
                  autoFocus
                  value={part.input.value}
                  placeholder={part.input.ph}
                  onChange={(e) => part.input!.set(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setOpen(false)}
                />
              )}
              <button className="btn btn--sm btn--primary" style={{ alignSelf: "flex-end" }} onClick={() => setOpen(false)}>
                Done
              </button>
            </div>
          ) : (
            part.opts?.map((o, i) => (
              <button
                key={i}
                className="menu__item"
                role="option"
                aria-selected={o.sel}
                onClick={() => {
                  o.pick();
                  if (!part.multi) setOpen(false);
                }}
              >
                <span className="menu__tick" style={{ opacity: o.sel ? 1 : 0 }}>
                  <Ic d={P.tick} size={11} stroke={3} />
                </span>
                {o.chip}
                <span>{o.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </span>
  );
}
