"use client";
// Steps 2 and 3 share this layout: Rail | Preview | panel. In Build the panel
// is the selected page's fields; in Review it's the checklist (children),
// highlights are off and clicking a page does nothing.

import { PHOTO_TOOLS_CSS } from "@/components/reports/shared/builder/PhotoTools";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import styles from "./Builder.module.css";
import PageRail, { type RailRow } from "@/components/reports/shared/builder/PageRail";
import PanelResizer, { usePanelWidth } from "@/components/reports/shared/builder/PanelResizer";
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

export default function BuildStep({ ctx, review, scrollReq, children }: Props) {
  const panel = usePanelWidth("pb3-panel-width");
  const { p, D } = ctx;
  const rows: RailRow[] = p.order
    .filter((id) => PAGE[id])
    .map((id) => {
      const pg = PAGE[id];
      return {
        id,
        name: pg.name,
        num: id === "cover" ? "C" : id === "contents" ? "·" : (D.pageNo[id] ?? ""),
        hidden: !!p.hidden[id],
        hideable: id !== "cover",
        locked: pg.locked,
        fixed: pg.fixed,
      };
    });
  const reorder = (from: string, to: string, after: boolean) => {
    if (from === to || PAGE[from as PageId].fixed) return;
    ctx.update((prev) => {
      const o = prev.order.filter((x) => x !== from);
      let i = o.indexOf(to as PageId);
      if (i < 0) return prev;
      if (after) i++;
      o.splice(Math.max(2, i), 0, from as PageId); // cover and contents stay first
      return { ...prev, order: o };
    });
  };
  return (
    <>
      <PageRail
        rows={rows}
        sel={ctx.sel}
        onPick={(id) => ctx.select(id as PageId, true)}
        onToggle={(id) => ctx.toggleHide(id as PageId)}
        onReorder={reorder}
      />
      <Preview ctx={ctx} review={review} scrollReq={scrollReq} />
      {!review && <PanelResizer panel={panel} />}
      {review ? children : <SectionPanel ctx={ctx} width={panel.w} />}
    </>
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
      <style dangerouslySetInnerHTML={{ __html: PHOTO_TOOLS_CSS }} />
      <div className={styles.stack} style={{ zoom: z }}>
        <ProposalPages
          p={ctx.p}
          D={ctx.D}
          mode={review ? "review" : "build"}
          img={ctx.img}
          selected={ctx.sel}
          onPick={(id) => ctx.select(id, false)}
          onPickFinding={(i) => ctx.pickFinding(i, false)}
          onRemoveFinding={(i) => {
            ctx.set(["findings", "items"], ctx.p.d.findings.items.filter((_, j) => j !== i));
            ctx.pickFinding(null, false);
          }}
          onMoveFinding={(from, to) => {
            const next = [...ctx.p.d.findings.items];
            const [x] = next.splice(from, 1);
            next.splice(to, 0, x);
            ctx.set(["findings", "items"], next);
          }}
          onPickField={(id, path) => ctx.pickField(id, path)}
          onPinPointerDown={(zone, e) => {
            // Drag a site-map pin; stored as % of the map, so zoom doesn't matter.
            e.preventDefault();
            e.stopPropagation();
            const box = e.currentTarget.parentElement!.getBoundingClientRect();
            const move = (ev: PointerEvent) => {
              const x = Math.min(97, Math.max(3, ((ev.clientX - box.left) / box.width) * 100));
              const y = Math.min(95, Math.max(5, ((ev.clientY - box.top) / box.height) * 100));
              ctx.set(["findings", "pins", zone], [Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
            };
            const up = () => {
              window.removeEventListener("pointermove", move);
              window.removeEventListener("pointerup", up);
            };
            window.addEventListener("pointermove", move);
            window.addEventListener("pointerup", up);
          }}
          focusFinding={ctx.sel === "findings" ? ctx.focusFinding : null}
        />
      </div>
    </main>
  );
}
