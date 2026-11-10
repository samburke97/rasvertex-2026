// lib/reports/inspection/shapes.ts
//
// Zone sections on the site map: free-form polygons the tech draws round
// each zone (S1, D10…). Points are [x%, y%] of the map image. Older drafts
// hold rectangles (`boxes`), read here as four-point shapes.
//
// Geometry runs in the map's real proportions (3:2), so distances and the
// label position don't skew with the % coordinates.

import type { InspectionReportData, ZoneBox } from "./types";

export type Pt = [x: number, y: number];
export type Shape = Pt[];

/** The map's aspect (width : height), as .ir-map's aspect-ratio. */
export const MAP_ASPECT = 3 / 2;

const r1 = (n: number) => Math.round(n * 10) / 10;
const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** Points rounded to 0.1 and kept on the map. */
export const cleanShape = (pts: Shape): Shape => pts.map(([x, y]) => [r1(clamp(x)), r1(clamp(y))] as Pt);

export const boxToShape = ([x, y, w, h]: ZoneBox): Shape =>
  cleanShape([
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ]);

/** A zone's section: its shape, else its older rectangle, else none. */
export function zoneShape(data: Pick<InspectionReportData, "shapes" | "boxes">, zone: string): Shape | undefined {
  const s = data.shapes?.[zone];
  if (s && s.length >= 3) return s;
  const b = data.boxes?.[zone];
  return b ? boxToShape(b) : undefined;
}

// ── Geometry (in real proportions: x × 1.5) ──────────────────────────────────

const toReal = ([x, y]: Pt): Pt => [x * MAP_ASPECT, y];
const fromReal = ([x, y]: Pt): Pt => [x / MAP_ASPECT, y];

export function pointInPolygon([x, y]: Pt, poly: Shape): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Area-weighted centroid (falls back to the points' average). */
function centroid(poly: Shape): Pt {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [x0, y0] = poly[j];
    const [x1, y1] = poly[i];
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) return [poly.reduce((t, p) => t + p[0], 0) / poly.length, poly.reduce((t, p) => t + p[1], 0) / poly.length];
  return [cx / (3 * a), cy / (3 * a)];
}

function segDist2([px, py]: Pt, [ax, ay]: Pt, [bx, by]: Pt): number {
  let x = ax;
  let y = ay;
  let dx = bx - x;
  let dy = by - y;
  if (dx || dy) {
    const t = ((px - x) * dx + (py - y) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      x = bx;
      y = by;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }
  dx = px - x;
  dy = py - y;
  return dx * dx + dy * dy;
}

/** Signed distance from a point to the polygon's edge (+ inside). */
function edgeDist(p: Pt, poly: Shape): number {
  let min = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) min = Math.min(min, segDist2(p, poly[i], poly[j]));
  return (pointInPolygon(p, poly) ? 1 : -1) * Math.sqrt(min);
}

/** Pole of inaccessibility (polylabel): the inside point furthest from
 *  every edge, found by refining a grid of cells. */
function polylabel(poly: Shape, precision = 0.5): Pt {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const w = Math.max(...xs) - minX;
  const h = Math.max(...ys) - minY;
  const size = Math.min(w, h);
  if (!size) return [minX, minY];
  type Cell = { x: number; y: number; h: number; d: number; max: number };
  const cell = (x: number, y: number, half: number): Cell => {
    const d = edgeDist([x, y], poly);
    return { x, y, h: half, d, max: d + half * Math.SQRT2 };
  };
  const queue: Cell[] = [];
  for (let x = minX; x < minX + w; x += size) for (let y = minY; y < minY + h; y += size) queue.push(cell(x + size / 2, y + size / 2, size / 2));
  const c = centroid(poly);
  let best = cell(c[0], c[1], 0);
  const box = cell(minX + w / 2, minY + h / 2, 0);
  if (box.d > best.d) best = box;
  while (queue.length) {
    queue.sort((a, b) => a.max - b.max);
    const cur = queue.pop()!;
    if (cur.d > best.d) best = cur;
    if (cur.max - best.d <= precision) continue;
    const q = cur.h / 2;
    queue.push(cell(cur.x - q, cur.y - q, q), cell(cur.x + q, cur.y - q, q), cell(cur.x - q, cur.y + q, q), cell(cur.x + q, cur.y + q, q));
  }
  return [best.x, best.y];
}

/** Where a section's title sits: its centroid, or (when that falls outside,
 *  as in an L or U) the point deepest inside it. In %. */
export function labelPoint(shape: Shape): Pt {
  const real = shape.map(toReal);
  const c = centroid(real);
  // Inside, and not hugging an edge (the tag is ~28px tall: keep ~2% clear).
  if (pointInPolygon(c, real) && edgeDist(c, real) > 2) return fromReal(c);
  // Of the spots nearly as deep as the deepest (a U's whole base, say), the
  // one nearest the middle.
  const pole = polylabel(real);
  const depth = edgeDist(pole, real);
  const xs = real.map((q) => q[0]);
  const ys = real.map((q) => q[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = pole;
  let bestNear = Math.hypot(pole[0] - c[0], pole[1] - c[1]);
  const N = 40;
  for (let i = 0; i <= N; i++)
    for (let j = 0; j <= N; j++) {
      const q: Pt = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
      if (edgeDist(q, real) < depth * 0.85) continue;
      const near = Math.hypot(q[0] - c[0], q[1] - c[1]);
      if (near < bestNear) {
        best = q;
        bestNear = near;
      }
    }
  return fromReal(best);
}

/** Moves a whole shape, kept inside the map. */
export function moveShape(shape: Shape, dx: number, dy: number): Shape {
  const xs = shape.map((p) => p[0]);
  const ys = shape.map((p) => p[1]);
  const mx = Math.min(Math.max(dx, -Math.min(...xs)), 100 - Math.max(...xs));
  const my = Math.min(Math.max(dy, -Math.min(...ys)), 100 - Math.max(...ys));
  return shape.map(([x, y]) => [x + mx, y + my] as Pt);
}

/** The next point snapped to 0/45/90° from the last (Shift while drawing). */
export function snapAngle(from: Pt, to: Pt): Pt {
  const [ax, ay] = toReal(from);
  const [bx, by] = toReal(to);
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return fromReal([ax + Math.cos(ang) * len, ay + Math.sin(ang) * len]);
}

/** SVG points attribute. */
export const svgPoints = (shape: Shape) => shape.map(([x, y]) => `${x},${y}`).join(" ");
