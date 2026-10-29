"use client";
// Steps 2 and 3 share this layout: Rail | Preview | panel. In Build the panel
// is the selected page's fields; in Review it's the checklist (children),
// highlights are off and clicking a page does nothing.

import React, { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Builder.module.css";
import type { BuilderCtx } from "./ctx";
import SectionPanel from "./SectionPanel";
import ProposalPages from "./doc/ProposalPages";
import { PAGE, type PageId } from "@/lib/reports/proposal/v3/types";
import type { ScrollReq } from "./ProposalBuilder";

interface Props {
  ctx: BuilderCtx;
  review: boolean;
  scrollReq: ScrollReq | null;
  children?: ReactNode;
}

const PANEL_MIN = 300;
const PANEL_MAX = 760;
const PANEL_KEY = "pb3-panel-width";

/** Drag handle on the panel's left edge; the width is remembered. */
function usePanelWidth() {
  const [w, setW] = useState(340);
  useEffect(() => {
    const saved = Number(localStorage.getItem(PANEL_KEY));
    if (saved >= PANEL_MIN && saved <= PANEL_MAX) setW(saved);
  }, []);
  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    const x0 = e.clientX;
    const w0 = w;
    let last = w0;
    const move = (ev: PointerEvent) => {
      last = Math.max(PANEL_MIN, Math.min(PANEL_MAX, w0 + (x0 - ev.clientX)));
      setW(last);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.style.cursor = "";
      localStorage.setItem(PANEL_KEY, String(last));
    };
    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  return { w, start, reset: () => (setW(340), localStorage.setItem(PANEL_KEY, "340")) };
}

export default function BuildStep({ ctx, review, scrollReq, children }: Props) {
  const [railOpen, setRailOpen] = useState(true);
  const panel = usePanelWidth();
  return (
    <>
      {railOpen ? <PagesRail ctx={ctx} onCollapse={() => setRailOpen(false)} /> : (
        <aside className={styles.railClosed}>
          <button className={styles.iconBtn} title="Show pages" onClick={() => setRailOpen(true)}>
            <RailIcon expand />
          </button>
        </aside>
      )}
      <Preview ctx={ctx} review={review} scrollReq={scrollReq} />
      <div
        className={styles.resizer}
        onPointerDown={panel.start}
        onDoubleClick={panel.reset}
        title="Drag to resize the panel. Double-click to reset."
      />
      {review ? children : <SectionPanel ctx={ctx} width={panel.w} />}
    </>
  );
}

function RailIcon({ expand }: { expand?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15" />
      <path d={expand ? "m12.5 9.5 2.5 2.5-2.5 2.5" : "m15.5 9.5-2.5 2.5 2.5 2.5"} />
    </svg>
  );
}

// ── Pages rail ───────────────────────────────────────────────────────────────

function PagesRail({ ctx, onCollapse }: { ctx: BuilderCtx; onCollapse: () => void }) {
  const { p, D } = ctx;
  const drag = useRef<PageId | null>(null);
  const [drop, setDrop] = useState<{ id: PageId; after: boolean } | null>(null);

  const reorder = (from: PageId, to: PageId, after: boolean) => {
    if (from === to || PAGE[from].fixed) return;
    ctx.update((prev) => {
      const o = prev.order.filter((x) => x !== from);
      let i = o.indexOf(to);
      if (i < 0) return prev;
      if (after) i++;
      o.splice(Math.max(2, i), 0, from); // cover and contents stay first
      return { ...prev, order: o };
    });
  };

  const rows = p.order.filter((id) => PAGE[id]);
  return (
    <aside className={styles.rail}>
      <div className={styles.railHead}>
        <span>Pages</span>
        <button className={styles.iconBtn} title="Hide pages" onClick={onCollapse}>
          <RailIcon />
        </button>
      </div>
      <div className={styles.railList}>
        {rows.map((id) => {
          const pg = PAGE[id];
          const hidden = !!p.hidden[id];
          const n = id === "cover" ? "C" : id === "contents" ? "·" : hidden ? "" : (D.pageNo[id] ?? "");
          const cls = [
            styles.row,
            ctx.sel === id ? styles.rowSel : "",
            hidden ? styles.rowHidden : "",
            drop?.id === id ? (drop.after ? styles.dropAfter : styles.dropBefore) : "",
          ].join(" ");
          return (
            <div
              key={id}
              className={cls}
              draggable={!pg.fixed}
              onClick={() => ctx.select(id, true)}
              onDragStart={(e) => {
                if (pg.fixed) return e.preventDefault();
                drag.current = id;
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", id);
              }}
              onDragOver={(e) => {
                if (!drag.current || pg.fixed) return;
                e.preventDefault();
                const r = e.currentTarget.getBoundingClientRect();
                const after = e.clientY > r.top + r.height / 2;
                if (drop?.id !== id || drop.after !== after) setDrop({ id, after });
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag.current) reorder(drag.current, id, drop?.after ?? false);
                drag.current = null;
                setDrop(null);
              }}
              onDragEnd={() => {
                drag.current = null;
                setDrop(null);
              }}
            >
              <span className={styles.rowNum}>{n}</span>
              <span className={styles.rowName}>{pg.name}</span>
              {pg.locked && (
                <span className={styles.lock} title="Standard page">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="5" y="11" width="14" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                  </svg>
                </span>
              )}
              {id !== "cover" && (
                <button
                  className={styles.eye}
                  title={hidden ? "Show page" : "Hide page"}
                  onClick={(e) => {
                    e.stopPropagation();
                    ctx.toggleHide(id);
                  }}
                >
                  <EyeIcon off={hidden} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export function EyeIcon({ off }: { off?: boolean }) {
  return off ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.2M6.6 6.6C3.9 8.4 2 12 2 12s3.5 7 10 7a9.8 9.8 0 0 0 5.4-1.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

// ── Preview ──────────────────────────────────────────────────────────────────

function Preview({ ctx, review, scrollReq }: { ctx: BuilderCtx; review: boolean; scrollReq: Props["scrollReq"] }) {
  const mainRef = useRef<HTMLElement | null>(null);
  const [z, setZ] = useState(0.8);

  const fit = useCallback(() => {
    const el = mainRef.current;
    if (!el) return;
    const next = Math.max(0.15, Math.min(1.2, (el.clientWidth - 56) / 794));
    setZ((cur) => (Math.abs(cur - next) > 0.01 ? next : cur));
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    fit();
    return () => ro.disconnect();
  }, [fit]);

  useEffect(() => {
    if (!scrollReq) return;
    const id = requestAnimationFrame(() => {
      const m = mainRef.current;
      if (!m) return;
      const el =
        scrollReq.finding != null
          ? m.querySelector(`[data-finding="${scrollReq.finding}"]`)
          : m.querySelector(`[data-page="${scrollReq.id}"]`);
      if (!el) return;
      // A finding scrolls to its sheet so the whole 2×2 grid is in view.
      const target = scrollReq.finding != null ? (el.closest("[data-sheet]") ?? el) : el;
      m.scrollTo({
        top: Math.max(0, target.getBoundingClientRect().top - m.getBoundingClientRect().top + m.scrollTop - 20),
        behavior: "smooth",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [scrollReq]);

  return (
    <main ref={mainRef} className={styles.preview}>
      <div className={styles.stack} style={{ zoom: z }}>
        <ProposalPages
          p={ctx.p}
          D={ctx.D}
          mode={review ? "review" : "build"}
          img={ctx.img}
          selected={ctx.sel}
          onPick={(id) => ctx.select(id, false)}
          onPickFinding={(i) => ctx.pickFinding(i, false)}
          onPickField={(id, path) => ctx.pickField(id, path)}
          focusFinding={ctx.sel === "findings" ? ctx.focusFinding : null}
        />
      </div>
    </main>
  );
}
