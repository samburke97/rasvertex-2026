"use client";
// components/reports/inspection/ZoneShapeEditor.tsx
//
// Builder only: draws and edits the zone sections on the site map, over the
// document's map (InspectionDocument injects it; the PDF draws ZoneShapes).
//
// Drawing: click to place points, click the first point (or Enter) to
// finish; Backspace undoes a point, Esc cancels, Shift snaps to 0/45/90°.
// Press and drag instead of clicking to draw a rectangle.
//
// Editing: click a section to select it. Drag its body to move it, a corner
// to move a point, a "+" on an edge to add a point there. Double-click a
// point (or select it and press Delete) to remove it, double-click an edge
// to add one.
//
// A drag keeps the shape here and repaints once a frame; the report (and
// so the autosave) gets it once, when the pointer comes up. Handles are
// sized against the preview's zoom so they stay the same size on screen.

import { useEffect, useRef, useState, type PointerEvent as RPE, type MouseEvent as RME } from "react";
import { zoneTone } from "@/lib/reports/inspection/types";
import { cleanShape, labelPoint, moveShape, snapAngle, svgPoints, type Pt, type Shape } from "@/lib/reports/inspection/shapes";
import { ZoneTag, type ZoneEditProps } from "./InspectionDocument";

const DRAG_PX = 3; // a click never nudges anything
const RECT_PX = 5; // press-and-drag past this while drawing draws a rectangle
const SNAP_PX = 12; // the first point closes the shape within this
const MIN_RECT = 3; // %

const CSS = `
.zse{position:absolute;inset:0;z-index:2;pointer-events:none;touch-action:none}
.zse--draw{pointer-events:auto;cursor:crosshair}
.zse svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
.zse-body{pointer-events:auto;cursor:grab;touch-action:none}
.zse--draw .zse-body{pointer-events:none}
.zse-body.is-dragging{cursor:grabbing}
.zse-edge{pointer-events:stroke;cursor:copy}
.zse-h{position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:move;touch-action:none}
.zse-h i{display:block;border-radius:50%;background:#fff;border:solid;box-shadow:0 1px 4px rgba(1,25,85,.3);transition:transform 80ms}
.zse-h:hover i,.zse-h.is-on i{transform:scale(1.25)}
.zse-h.is-on i{background:currentColor}
.zse-m i{background:rgba(255,255,255,.75);display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;line-height:1;opacity:.8}
.zse-m:hover i{opacity:1;background:#fff}
.zse-pt{position:absolute;transform:translate(-50%,-50%);border-radius:50%;background:#fff;border:solid;pointer-events:none}
.zse-pt.is-first.is-hot{background:currentColor}
`;

type Drag =
  | { kind: "body" | "vertex" | "mid"; zone: string; idx: number; start: Shape; from: Pt; sx: number; sy: number; moved: boolean; shape: Shape }
  | { kind: "draw"; from: Pt; sx: number; sy: number; moved: boolean; shape: Shape | null };

export default function ZoneShapeEditor({ pins, drawZone, selected, zoom, onSelect, onCommit, onDrawEnd }: ZoneEditProps) {
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const raf = useRef(0);
  const pending = useRef<{ zone: string; shape: Shape } | null>(null);
  // The shape mid-drag, ahead of the report.
  const [live, setLive] = useState<{ zone: string; shape: Shape } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Drawing: points placed so far, the cursor, and whether it's on the first point.
  const [pts, setPts] = useState<Pt[]>([]);
  const [cursor, setCursor] = useState<Pt | null>(null);
  const [hot, setHot] = useState(false);
  const [shift, setShift] = useState(false);
  const [vSel, setVSel] = useState<number | null>(null);

  const k = zoom || 1;
  const px = (n: number) => n / k; // a size that stays n px on screen
  const shapeOf = (zone: string) => (live?.zone === zone ? live.shape : pins.find((p) => p.zone === zone)?.shape);
  const drawTone = zoneTone(pins.find((p) => p.zone === drawZone)?.tone ?? 0);

  // Pointer → % of the map (the rect is on screen, so zoom is already in it).
  const rect = () => root.current!.getBoundingClientRect();
  const toPct = (e: { clientX: number; clientY: number }): Pt => {
    const r = rect();
    return [Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100)), Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100))];
  };
  const screenDist = (a: Pt, b: Pt) => {
    const r = rect();
    return Math.hypot(((a[0] - b[0]) / 100) * r.width, ((a[1] - b[1]) / 100) * r.height);
  };

  const paint = (zone: string, shape: Shape) => {
    pending.current = { zone, shape };
    if (!raf.current)
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        setLive(pending.current);
      });
  };
  const stopPaint = () => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    pending.current = null;
    setLive(null);
  };
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // A new zone to draw starts clean.
  useEffect(() => {
    setPts([]);
    setCursor(null);
    setHot(false);
  }, [drawZone]);
  useEffect(() => setVSel(null), [selected]);

  const finish = (zone: string, shape: Shape) => {
    onCommit(zone, cleanShape(shape));
    setPts([]);
    setCursor(null);
    setHot(false);
    onDrawEnd();
    onSelect(zone);
  };
  const cancelDraw = () => {
    setPts([]);
    setCursor(null);
    onDrawEnd();
  };

  // ── Keys ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const typing = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.key === "Shift") setShift(true);
      if (typing(e.target)) return;
      if (drawZone) {
        if (e.key === "Escape") cancelDraw();
        else if (e.key === "Enter" && pts.length >= 3) finish(drawZone, pts);
        else if (e.key === "Backspace") setPts((p) => p.slice(0, -1));
        else return;
        e.preventDefault();
        return;
      }
      if (!selected) return;
      if (e.key === "Escape") onSelect(null);
      else if ((e.key === "Delete" || e.key === "Backspace") && vSel != null) {
        const s = shapeOf(selected);
        if (s && s.length > 3) onCommit(selected, s.filter((_, i) => i !== vSel));
        setVSel(null);
      } else return;
      e.preventDefault();
    };
    const up = (e: KeyboardEvent) => e.key === "Shift" && setShift(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  });

  // Clicking empty map deselects.
  useEffect(() => {
    if (!selected || drawZone) return;
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.(".ir-map") && !t.closest("[data-zse]")) onSelect(null);
    };
    window.addEventListener("pointerdown", down, true);
    return () => window.removeEventListener("pointerdown", down, true);
  }, [selected, drawZone, onSelect]);

  // ── Dragging a section, a point or a "+" ────────────────────────────────
  const grab = (kind: "body" | "vertex" | "mid", zone: string, idx: number) => (e: RPE<Element>) => {
    if (e.button !== 0 || drawZone) return;
    const start = shapeOf(zone);
    if (!start) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind, zone, idx, start, from: toPct(e), sx: e.clientX, sy: e.clientY, moved: false, shape: start };
  };

  const onMove = (e: RPE<Element>) => {
    const d = drag.current;
    if (!d) {
      // Drawing: the preview line follows the cursor.
      if (drawZone) {
        const p = toPct(e);
        setCursor(p);
        setHot(pts.length >= 3 && screenDist(p, pts[0]) <= SNAP_PX);
      }
      return;
    }
    const dist = Math.hypot(e.clientX - d.sx, e.clientY - d.sy);
    if (!d.moved && dist < (d.kind === "draw" ? RECT_PX : DRAG_PX)) return;
    if (!d.moved) {
      d.moved = true;
      setDragging(true);
    }
    const p = toPct(e);
    if (d.kind === "draw") {
      const [x0, y0] = d.from;
      d.shape = [
        [Math.min(x0, p[0]), Math.min(y0, p[1])],
        [Math.max(x0, p[0]), Math.min(y0, p[1])],
        [Math.max(x0, p[0]), Math.max(y0, p[1])],
        [Math.min(x0, p[0]), Math.max(y0, p[1])],
      ];
      paint(drawZone!, d.shape);
      return;
    }
    if (d.kind === "mid") {
      // The "+" becomes a point at its edge's middle, dragged in one motion.
      const s = d.start.slice();
      s.splice(d.idx + 1, 0, p);
      Object.assign(d, { kind: "vertex", idx: d.idx + 1, start: s });
    }
    if (d.kind === "body") d.shape = moveShape(d.start, p[0] - d.from[0], p[1] - d.from[1]);
    else d.shape = d.start.map((q, i) => (i === d.idx ? p : q));
    paint(d.zone, d.shape);
  };

  const onUp = (e: RPE<Element>) => {
    const d = drag.current;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    setDragging(false);
    if (!d) return;
    if (d.kind === "draw") {
      if (d.moved && d.shape) {
        stopPaint();
        const [[x0, y0], , [x1, y1]] = d.shape;
        if (x1 - x0 >= MIN_RECT && y1 - y0 >= MIN_RECT) finish(drawZone!, d.shape);
        return;
      }
      // A click: place a point, or close the shape on the first one.
      if (!drawZone) return;
      if (pts.length >= 3 && screenDist(toPct(e), pts[0]) <= SNAP_PX) return finish(drawZone, pts);
      const p = toPct(e);
      setPts((ps) => [...ps, shift && ps.length ? snapAngle(ps[ps.length - 1], p) : p]);
      return;
    }
    if (d.moved) {
      onCommit(d.zone, d.shape);
      stopPaint();
      return;
    }
    // A click: select the section, or a point in it.
    onSelect(d.zone);
    setVSel(d.kind === "vertex" ? d.idx : null);
  };

  const drawDown = (e: RPE<HTMLDivElement>) => {
    if (!drawZone || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { kind: "draw", from: toPct(e), sx: e.clientX, sy: e.clientY, moved: false, shape: null };
  };

  const stop = (e: RME) => e.stopPropagation();
  const handlers = { onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp, onClick: stop };

  const removePoint = (zone: string, i: number) => (e: RME) => {
    e.stopPropagation();
    const s = shapeOf(zone);
    if (s && s.length > 3) onCommit(zone, s.filter((_, j) => j !== i));
    setVSel(null);
  };
  const addPointOnEdge = (zone: string, i: number) => (e: RME) => {
    e.stopPropagation();
    const s = shapeOf(zone);
    if (!s) return;
    const next = s.slice();
    next.splice(i + 1, 0, toPct(e));
    onCommit(zone, next);
    setVSel(i + 1);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  // The zone being redrawn steps aside; the selected one draws on top.
  const shaped = pins
    .map((p) => ({ pin: p, shape: shapeOf(p.zone) }))
    .filter((x): x is { pin: (typeof pins)[number]; shape: Shape } => !!x.shape && x.pin.zone !== drawZone)
    .sort((a, b) => Number(a.pin.zone === selected) - Number(b.pin.zone === selected));
  const sel = shaped.find((x) => x.pin.zone === selected);
  const drawing = drawZone ? (live?.zone === drawZone ? live.shape : pts) : [];
  const next = drawZone && cursor && pts.length && !dragging ? (shift ? snapAngle(pts[pts.length - 1], cursor) : cursor) : null;
  const dot = (n: number, line: string, w = 2.5) => ({ width: px(n), height: px(n), borderColor: line, borderWidth: px(w), color: line });

  return (
    <div
      ref={root}
      data-zse=""
      className={`zse${drawZone ? " zse--draw" : ""}`}
      onPointerDown={drawZone ? drawDown : undefined}
      onPointerMove={drawZone ? onMove : undefined}
      onPointerUp={drawZone ? onUp : undefined}
      onPointerCancel={drawZone ? onUp : undefined}
      onPointerLeave={() => drawZone && !drag.current && setCursor(null)}
      onClick={stop}
    >
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        {shaped.map(({ pin, shape }) => {
          const t = zoneTone(pin.tone);
          return (
            <polygon
              key={pin.zone}
              className={`zse-body${dragging && live?.zone === pin.zone ? " is-dragging" : ""}`}
              points={svgPoints(shape)}
              fill={t.fill}
              stroke={t.line}
              strokeWidth={pin.zone === selected ? 4 : 3}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              onPointerDown={grab("body", pin.zone, -1)}
              {...handlers}
            />
          );
        })}
        {/* The selected section's edges: double-click to add a point. */}
        {sel &&
          sel.shape.map((a, i) => {
            const b = sel.shape[(i + 1) % sel.shape.length];
            return (
              <line
                key={i}
                className="zse-edge"
                x1={a[0]}
                y1={a[1]}
                x2={b[0]}
                y2={b[1]}
                stroke="transparent"
                strokeWidth={px(16)}
                vectorEffect="non-scaling-stroke"
                onDoubleClick={addPointOnEdge(sel.pin.zone, i)}
                onClick={stop}
              />
            );
          })}
        {drawZone && drawing.length > 0 && (
          <>
            <polygon
              points={svgPoints(next ? [...drawing, next] : drawing)}
              fill={drawing.length + (next ? 1 : 0) >= 3 ? drawTone.fill : "none"}
              stroke="none"
            />
            {live?.zone === drawZone ? (
              // Press-and-drag: the rectangle so far, closed.
              <polygon points={svgPoints(drawing)} fill={drawTone.fill} stroke={drawTone.line} strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            ) : (
              <polyline points={svgPoints(drawing)} fill="none" stroke={drawTone.line} strokeWidth={3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            )}
            {next && (
              <line
                x1={drawing[drawing.length - 1][0]}
                y1={drawing[drawing.length - 1][1]}
                x2={hot ? drawing[0][0] : next[0]}
                y2={hot ? drawing[0][1] : next[1]}
                stroke={drawTone.line}
                strokeWidth={2}
                strokeDasharray="6 5"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </>
        )}
      </svg>

      {shaped.map(({ pin, shape }) => (
        <ZoneTag key={pin.zone} pin={pin} at={labelPoint(shape)} />
      ))}

      {sel && !drawZone && (
        <>
          {sel.shape.map((a, i) => {
            const b = sel.shape[(i + 1) % sel.shape.length];
            const t = zoneTone(sel.pin.tone);
            return (
              <span
                key={`m${i}`}
                className="zse-h zse-m"
                style={{ left: `${(a[0] + b[0]) / 2}%`, top: `${(a[1] + b[1]) / 2}%`, width: px(30), height: px(30) }}
                title="Drag to add a point"
                onPointerDown={grab("mid", sel.pin.zone, i)}
                {...handlers}
              >
                <i style={{ ...dot(14, t.line, 1.5), fontSize: px(12), color: t.line }}>+</i>
              </span>
            );
          })}
          {sel.shape.map((p, i) => {
            const t = zoneTone(sel.pin.tone);
            return (
              <span
                key={`v${i}`}
                className={`zse-h${vSel === i ? " is-on" : ""}`}
                style={{ left: `${p[0]}%`, top: `${p[1]}%`, width: px(40), height: px(40) }}
                title="Drag to move. Double-click to remove."
                onPointerDown={grab("vertex", sel.pin.zone, i)}
                onDoubleClick={removePoint(sel.pin.zone, i)}
                {...handlers}
              >
                <i style={dot(14, t.line)} />
              </span>
            );
          })}
        </>
      )}

      {drawZone &&
        !(live?.zone === drawZone) &&
        pts.map((p, i) => {
          const first = i === 0;
          const big = first && hot;
          return (
            <span
              key={i}
              className={`zse-pt${first ? " is-first" : ""}${big ? " is-hot" : ""}`}
              style={{ left: `${p[0]}%`, top: `${p[1]}%`, ...dot(big ? 20 : first ? 14 : 10, drawTone.line, 2.5) }}
            />
          );
        })}
    </div>
  );
}
