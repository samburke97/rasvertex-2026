// lib/reports/staticMapZoom.ts
//
// Computes the exact integer zoom level that fits a lat/lng bounding box
// (a live Google Map's current viewport) into a target pixel size, using
// the standard Web Mercator tile-pixel formula directly.
//
// Deliberately not using Static Maps' own `visible` parameter for this: it
// does not tightly fit the given points — it applies its own, much more
// generous padding heuristic and can shift the effective center, which
// produced a capture far more zoomed-out (and shifted) than what was
// actually framed on screen. Computing the zoom ourselves and requesting
// an explicit center+zoom avoids that entirely — center never moves, and
// zoom is floored (never rounded) so the capture always contains at least
// what was on screen, never less.

const TILE_SIZE = 256; // Google's tile size convention — world width in px at zoom Z is TILE_SIZE * 2^Z.

function mercatorY(latDeg: number): number {
  const rad = (latDeg * Math.PI) / 180;
  return 0.5 - Math.log((1 + Math.sin(rad)) / (1 - Math.sin(rad))) / (4 * Math.PI);
}

export function zoomToFitBounds(
  sw: { lat: number; lng: number },
  ne: { lat: number; lng: number },
  targetWidth: number,
  targetHeight: number,
): number {
  const lngSpan = ne.lng - sw.lng;
  const latSpanMerc = Math.abs(mercatorY(sw.lat) - mercatorY(ne.lat));

  const zoomForWidth = Math.log2((targetWidth * 360) / (TILE_SIZE * lngSpan));
  const zoomForHeight = Math.log2(targetHeight / (TILE_SIZE * latSpanMerc));

  // floor (not round) — a fractional result rounded up could crop content
  // that was actually visible on screen.
  return Math.max(1, Math.min(21, Math.floor(Math.min(zoomForWidth, zoomForHeight))));
}
