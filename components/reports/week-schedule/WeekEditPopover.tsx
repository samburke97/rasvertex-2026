"use client";
// components/reports/week-schedule/WeekEditPopover.tsx
//
// Edits one bar (or fills one empty day) of the Weekly schedule: rename it,
// change the days it covers, replace it from a SimPRO job search, leave or
// free text, remove it, or put it back to SimPRO. Report-only: nothing is
// written to SimPRO. Sits by the clicked bar; Esc closes it.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./WeekSchedulePage.module.css";
import type { EditItem, WeekDay } from "@/lib/reports/weekSchedule";
import type { JobHit } from "@/app/api/simpro/jobs/search/route";

const LEAVE = ["Annual Leave", "RDO", "Sick / Personal Leave", "Public Holiday"];
const W = 340;

export interface PopoverTarget {
  person: string;
  /** The bar's label, or null for an empty day. */
  label: string | null;
  /** From SimPRO (renaming sets the site's name every week). */
  simproSite: boolean;
  edited: boolean;
  days: string[];
}

export default function WeekEditPopover({
  anchor,
  target,
  allDays,
  onRename,
  onDays,
  onFill,
  onRemove,
  onReset,
  onClose,
}: {
  anchor: DOMRect;
  target: PopoverTarget;
  /** The range's columns, for the day pickers. */
  allDays: WeekDay[];
  onRename: (label: string) => void;
  onDays: (days: string[]) => void;
  onFill: (item: EditItem) => void;
  onRemove: () => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState(target.label ?? "");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<JobHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [pos, setPos] = useState({ left: anchor.left, top: anchor.bottom + 8 });
  const empty = target.label == null;

  useEffect(() => setLabel(target.label ?? ""), [target.label]);

  // By the bar, kept on screen (above it when there's no room below).
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight ?? 300;
    const left = Math.max(12, Math.min(anchor.left, window.innerWidth - W - 12));
    const below = anchor.bottom + 8;
    const top = below + h > window.innerHeight - 12 ? Math.max(12, anchor.top - h - 8) : below;
    setPos({ left, top });
  }, [anchor, hits, target]);

  // Esc closes; a click elsewhere closes (but not on a bar: that re-targets).
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const down = (e: PointerEvent) => {
      const t = e.target as Element;
      if (!ref.current?.contains(t) && !t.closest?.(".ws-bar, .ws-empty")) onClose();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("pointerdown", down, true);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("pointerdown", down, true);
    };
  }, [onClose]);

  // SimPRO job search, 250ms after typing stops.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setHits(null);
      return;
    }
    let live = true;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/simpro/jobs/search?q=${encodeURIComponent(term)}`);
        const body = await res.json();
        if (!res.ok) throw new Error();
        if (live) {
          setHits(body.results as JobHit[]);
          setErr(false);
        }
      } catch {
        if (live) setErr(true);
      } finally {
        if (live) setBusy(false);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q]);

  const isos = allDays.map((d) => d.iso);
  const first = isos.indexOf(target.days[0]);
  const last = isos.indexOf(target.days[target.days.length - 1]);
  const span = (a: number, b: number) => isos.slice(Math.min(a, b), Math.max(a, b) + 1);
  const dayName = (d: WeekDay) => `${d.day.slice(0, 3)} ${d.date}`;
  const commitLabel = () => label.trim() && label.trim() !== target.label && onRename(label.trim());

  return (
    <div ref={ref} className={styles.pop} style={{ left: pos.left, top: pos.top, width: W }} role="dialog" aria-label="Edit schedule entry">
      <div className={styles.popHead}>
        <b>{target.person}</b>
        <span>
          {target.days.length > 1
            ? `${dayName(allDays[first])} – ${dayName(allDays[last])}`
            : first >= 0
              ? dayName(allDays[first])
              : ""}
        </span>
      </div>

      {!empty && (
        <div className={styles.popField}>
          <label>Label</label>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commitLabel}
            onKeyDown={(e) => e.key === "Enter" && (commitLabel(), (e.target as HTMLInputElement).blur())}
          />
          {target.simproSite && <span className={styles.popHint}>Renames this site every week.</span>}
        </div>
      )}

      {!empty && first >= 0 && (
        <div className={styles.popDays}>
          <div className={styles.popField}>
            <label>From</label>
            <select value={first} onChange={(e) => onDays(span(Number(e.target.value), Math.max(Number(e.target.value), last)))}>
              {allDays.map((d, i) => (
                <option key={d.iso} value={i} disabled={i > last}>
                  {dayName(d)}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.popField}>
            <label>To</label>
            <select value={last} onChange={(e) => onDays(span(first, Number(e.target.value)))}>
              {allDays.map((d, i) => (
                <option key={d.iso} value={i} disabled={i < first}>
                  {dayName(d)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className={styles.popField}>
        <label>{empty ? "Add" : "Replace with"}</label>
        <input
          autoFocus={empty}
          value={q}
          placeholder="Search jobs: number, site or customer"
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      {q.trim().length >= 2 && (
        <div className={styles.popList}>
          {busy && !hits && <span className={styles.popHint}>Searching SimPRO…</span>}
          {err && <span className={styles.popHint}>Couldn&apos;t search SimPRO.</span>}
          {hits?.map((h) => (
            <button key={h.id} type="button" className={styles.popHit} onClick={() => onFill({ label: h.site || h.name || `Job #${h.id}`, kind: "job", ref: String(h.id) })}>
              <b>{h.site || h.name}</b>
              <span>
                #{h.id}
                {h.customer ? ` · ${h.customer}` : ""}
              </span>
            </button>
          ))}
          {hits && !hits.length && !busy && <span className={styles.popHint}>No open jobs match.</span>}
          <button type="button" className={styles.popHit} onClick={() => onFill({ label: q.trim(), kind: "other", ref: null })}>
            <b>Use “{q.trim()}”</b>
            <span>As typed</span>
          </button>
        </div>
      )}
      <div className={styles.popChips}>
        {LEAVE.map((l) => (
          <button key={l} type="button" onClick={() => onFill({ label: l, kind: "leave", ref: null })}>
            {l}
          </button>
        ))}
      </div>

      <div className={styles.popFoot}>
        {!empty && (
          <button type="button" className={styles.popDanger} onClick={onRemove} title="Delete">
            Remove
          </button>
        )}
        {target.edited && (
          <button type="button" onClick={onReset}>
            Reset to SimPRO
          </button>
        )}
        <button type="button" className={styles.popDone} onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
