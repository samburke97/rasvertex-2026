"use client";
/// <reference types="google.maps" />
// components/reports/proposal/AccessMapEditor.tsx
//
// Same approach as Anchor Inspection's ZoneMapEditor: a live, pannable/
// zoomable Google Map the user frames themselves before capturing, rather
// than a fixed view chosen for them. Marks rope-access drop points instead
// of anchor hardware, and each point ties to a stage in the Access Plan
// timeline. Edits a single zone's map — the parent (ProposalPage) owns the
// list of zones/buildings and renders one of these per zone.

import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "./AccessMapEditor.module.css";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import { loadGoogleMaps } from "@/lib/reports/googleMapsLoader";
import { compressMapImageDataUrl } from "@/lib/reports/compressImage";
import { zoomToFitBounds } from "@/lib/reports/staticMapZoom";
import {
  colorForStage,
  type AccessDropPoint,
  type ProposalAccessMap,
  type ProposalAccessStage,
} from "@/lib/reports/proposal.types";

interface Props {
  map: ProposalAccessMap;
  stages: ProposalAccessStage[];
  siteAddress: string;
  onChange: (map: ProposalAccessMap) => void;
}

const DEFAULT_ZOOM = 20;
const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 400;
const PREVIEW_SIZE = `${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}`;
const DEFAULT_RATIO = PREVIEW_WIDTH / PREVIEW_HEIGHT;

const HAS_LIVE_MAPS = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;

// Static-fallback-only zoom bounds (no JS Maps key configured).
const MIN_ZOOM = 15;
const MAX_ZOOM = 21;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function buildStaticUrl(opts: {
  address?: string;
  lat?: number;
  lng?: number;
  zoom: number;
}): string {
  const params = new URLSearchParams();
  if (opts.lat != null && opts.lng != null) {
    params.set("lat", String(opts.lat));
    params.set("lng", String(opts.lng));
  } else if (opts.address) {
    params.set("address", opts.address);
  }
  params.set("zoom", String(opts.zoom));
  params.set("size", PREVIEW_SIZE);
  return `/api/maps/static-map?${params.toString()}`;
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Aerial fetch failed: HTTP ${res.status}`);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Uploaded photos aren't cropped to any fixed shape — record their real
// aspect ratio so the editor and PDF size the image box to match instead of
// assuming 8:5 and cropping whatever doesn't fit.
function getImageNaturalRatio(dataUrl: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      if (!img.naturalWidth || !img.naturalHeight) {
        reject(new Error("Image has no natural dimensions"));
        return;
      }
      resolve(img.naturalWidth / img.naturalHeight);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = dataUrl;
  });
}

export default function AccessMapEditor({ map, stages, siteAddress, onChange }: Props) {
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const captured = !!map.imageUrl;
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  // ── Live map (Google Maps JS API) ────────────────────────────────────────
  const liveMapContainerRef = useRef<HTMLDivElement>(null);
  const liveMapRef = useRef<google.maps.Map | null>(null);
  const [liveMapReady, setLiveMapReady] = useState(false);
  const [liveMapError, setLiveMapError] = useState<string | null>(null);

  // ── Static fallback (no JS Maps key configured) ──────────────────────────
  const [zoomLevel, setZoomLevel] = useState(map.zoom || DEFAULT_ZOOM);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  // Address search — starts from the job's site address, always
  // manually correctable so a bad geocode is never a dead end.
  const [searchInput, setSearchInput] = useState(siteAddress);
  const [activeAddress, setActiveAddress] = useState(siteAddress);
  const handleLocate = useCallback(() => {
    const trimmed = searchInput.trim();
    if (trimmed) setActiveAddress(trimmed);
  }, [searchInput]);
  const hasAddress = !!activeAddress?.trim();

  // The site address is already known (job.siteAddress) — this only needs
  // to run once the first time it actually arrives. useState(siteAddress)
  // only captures whatever the prop was at first mount, so if the address
  // loads asynchronously (e.g. after a SimPRO import finishes) after this
  // component is already on screen, it would otherwise sit there empty
  // forever, forcing a manual search for an address we already have.
  useEffect(() => {
    if (siteAddress && !activeAddress) {
      setSearchInput(siteAddress);
      setActiveAddress(siteAddress);
    }
  }, [siteAddress, activeAddress]);

  useEffect(() => {
    setPreviewError(false);
  }, [zoomLevel]);

  // ── Live map init — geocode once, then hand off to native pan/zoom ──────
  useEffect(() => {
    if (!HAS_LIVE_MAPS || captured || !hasAddress) return;
    const container = liveMapContainerRef.current;
    if (!container) return;

    let cancelled = false;
    setLiveMapReady(false);
    setLiveMapError(null);

    (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !container) return;

        const gmap = new g.maps.Map(container, {
          center: { lat: map.lat ?? -26.65, lng: map.lng ?? 153.09 },
          zoom: map.zoom || DEFAULT_ZOOM,
          mapTypeId: "satellite",
          gestureHandling: "greedy",
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        });
        liveMapRef.current = gmap;

        const res = await fetch(
          `/api/maps/geocode?address=${encodeURIComponent(activeAddress)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.lat != null && data.lng != null) {
          gmap.setCenter({ lat: data.lat, lng: data.lng });
          setLiveMapReady(true);
        } else {
          setLiveMapError(data.error ?? "Couldn't locate that address");
        }
      } catch (err) {
        if (!cancelled) {
          setLiveMapError(
            err instanceof Error ? err.message : "Failed to load Google Maps",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      liveMapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captured, hasAddress, activeAddress]);

  // Scroll/trackpad zoom over the static-fallback preview only — the live
  // map handles its own native zoom.
  useEffect(() => {
    if (HAS_LIVE_MAPS) return;
    const el = previewWrapRef.current;
    if (!el) return;

    let accumulated = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      accumulated += e.deltaY;
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const direction = accumulated > 0 ? -1 : 1;
        accumulated = 0;
        setZoomLevel((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + direction)));
      }, 150);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [captured, hasAddress]);

  // ── Capture ───────────────────────────────────────────────────────────────

  const handleCapture = useCallback(async () => {
    if (!hasAddress) {
      setCaptureError("Enter a site address first");
      return;
    }
    setCapturing(true);
    setCaptureError(null);
    try {
      let url: string;
      let capturedLat: number | undefined;
      let capturedLng: number | undefined;
      let capturedZoom: number;

      if (HAS_LIVE_MAPS && liveMapRef.current) {
        const liveMap = liveMapRef.current;
        // Force the map to re-measure its container immediately before
        // reading bounds — see ZoneMapEditor's handleCapture for why.
        // 'resize' can re-anchor the map to the wrong point, so the center
        // is pinned back explicitly right after.
        const preResizeCenter = liveMap.getCenter();
        google.maps.event.trigger(liveMap, "resize");
        if (preResizeCenter) liveMap.setCenter(preResizeCenter);
        const center = liveMap.getCenter();
        const bounds = liveMap.getBounds();
        if (!center || !bounds) throw new Error("Map not ready");
        capturedLat = center.lat();
        capturedLng = center.lng();

        // Exact integer zoom that fits the live map's current viewport into
        // the capture's target size, from the real Web Mercator projection
        // — not Static Maps' own `visible`-bounds auto-fit (tried and
        // reverted: it pads far more generously than the actual viewport
        // and can shift the center). Center is passed through unchanged.
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        capturedZoom = zoomToFitBounds(
          { lat: sw.lat(), lng: sw.lng() },
          { lat: ne.lat(), lng: ne.lng() },
          PREVIEW_WIDTH,
          PREVIEW_HEIGHT,
        );

        url = buildStaticUrl({ lat: capturedLat, lng: capturedLng, zoom: capturedZoom });
      } else {
        capturedZoom = zoomLevel;
        url = buildStaticUrl({ address: activeAddress.trim(), zoom: capturedZoom });
      }

      const dataUrl = await compressMapImageDataUrl(await urlToDataUrl(url));

      onChange({
        ...map,
        imageUrl: dataUrl,
        imageRatio: DEFAULT_RATIO,
        zoom: capturedZoom,
        lat: capturedLat ?? map.lat,
        lng: capturedLng ?? map.lng,
      });
    } catch (err) {
      setCaptureError(
        err instanceof Error ? err.message : "Failed to capture aerial image",
      );
      setPreviewError(true);
    } finally {
      setCapturing(false);
    }
  }, [hasAddress, activeAddress, zoomLevel, map, onChange]);

  const handleRecapture = useCallback(() => {
    onChange({ ...map, imageUrl: null });
  }, [map, onChange]);

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const raw = ev.target?.result as string;
        const url = await compressMapImageDataUrl(raw);
        const ratio = await getImageNaturalRatio(url).catch(() => undefined);
        onChange({ ...map, imageUrl: url, imageRatio: ratio });
      };
      reader.readAsDataURL(file);
    },
    [map, onChange],
  );

  const handleImageClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = imageContainerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      const point: AccessDropPoint = {
        id: uid(),
        x: Math.min(100, Math.max(0, x)),
        y: Math.min(100, Math.max(0, y)),
        note: "",
        stageId: stages[0]?.id ?? null,
      };
      onChange({ ...map, points: [...map.points, point] });
    },
    [map, stages, onChange],
  );

  const updatePoint = useCallback(
    (id: string, patch: Partial<AccessDropPoint>) => {
      onChange({
        ...map,
        points: map.points.map((p) => (p.id === id ? { ...p, ...patch } : p)),
      });
    },
    [map, onChange],
  );

  const removePoint = useCallback(
    (id: string) => {
      onChange({ ...map, points: map.points.filter((p) => p.id !== id) });
    },
    [map, onChange],
  );

  // ── Drag-to-reposition pins ──────────────────────────────────────────────
  const dragStateRef = useRef<{ id: string; moved: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null);

  const handlePinPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: string) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragStateRef.current = { id, moved: false };
      setDraggingId(id);
    },
    [],
  );

  const handlePinPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const ds = dragStateRef.current;
    if (!ds) return;
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    ds.moved = true;
    setDragPos({ id: ds.id, x, y });
  }, []);

  const handlePinPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: string) => {
      const ds = dragStateRef.current;
      dragStateRef.current = null;
      setDraggingId(null);
      if (ds?.moved && dragPos && dragPos.id === id) {
        updatePoint(id, { x: dragPos.x, y: dragPos.y });
      }
      setDragPos(null);
    },
    [dragPos, updatePoint],
  );

  return (
    <div className={styles.wrap}>
      {!captured && (
        <div className={styles.addressBar}>
          <input
            className={styles.addressInput}
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLocate()}
            placeholder="Search an address…"
          />
          <button
            className={styles.addressLocateBtn}
            onClick={handleLocate}
            disabled={!searchInput.trim()}
            type="button"
          >
            Locate
          </button>
        </div>
      )}

      <div className={styles.actions}>
        {captured ? (
          <Button variant="outline" size="sm" onClick={handleRecapture}>
            Re-capture aerial
          </Button>
        ) : (
          hasAddress && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleCapture}
              disabled={
                capturing || previewError || (HAS_LIVE_MAPS && (!liveMapReady || !!liveMapError))
              }
            >
              {capturing ? "Capturing…" : "Use This View"}
            </Button>
          )
        )}
        <Button variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()}>
          Upload aerial
        </Button>
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleUpload}
        />
      </div>

      {captureError && <div className={styles.error}>{captureError}</div>}

      {!captured && (
        <div className={styles.statusBar}>
          {!hasAddress ? (
            <span className={styles.statusInfo}>
              Search an address above, or upload an aerial screenshot directly.
            </span>
          ) : HAS_LIVE_MAPS ? (
            liveMapError ? (
              <span className={styles.statusError}>
                ⚠ {liveMapError} — try a different search above, or upload an
                aerial screenshot instead.
              </span>
            ) : !liveMapReady ? (
              <span className={styles.statusInfo}>📍 Locating address…</span>
            ) : (
              <span className={styles.statusInfo}>
                <strong>Drag and scroll to frame the site</strong>, then click
                Use This View.
              </span>
            )
          ) : previewError ? (
            <span className={styles.statusError}>
              ⚠ Couldn&apos;t load satellite imagery for this address — try a
              different search above, or upload an aerial screenshot instead.
            </span>
          ) : (
            <span className={styles.statusInfo}>
              <strong>Scroll to zoom</strong> and frame the site, then click Use
              This View.
            </span>
          )}
        </div>
      )}

      {!captured && hasAddress && (
        <div className={styles.captureArea}>
          {HAS_LIVE_MAPS ? (
            <div className={styles.liveMapWrap}>
              <div className={styles.liveMapContainer} ref={liveMapContainerRef} />
            </div>
          ) : (
            <div className={styles.previewWrap} ref={previewWrapRef}>
              {!previewError && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={zoomLevel}
                  src={buildStaticUrl({ address: activeAddress.trim(), zoom: zoomLevel })}
                  alt="Satellite preview"
                  className={styles.previewImage}
                  onError={() => setPreviewError(true)}
                />
              )}
              <div className={styles.zoomControls}>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomLevel((z) => Math.max(MIN_ZOOM, z - 1))}
                  disabled={zoomLevel <= MIN_ZOOM}
                  aria-label="Zoom out"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/utility-outline/minus.svg" alt="" width={14} height={14} />
                </Button>
                <span className={styles.zoomLabel}>{zoomLevel}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setZoomLevel((z) => Math.min(MAX_ZOOM, z + 1))}
                  disabled={zoomLevel >= MAX_ZOOM}
                  aria-label="Zoom in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/icons/utility-outline/plus.svg" alt="" width={14} height={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {captured ? (
        <>
          <div
            ref={imageContainerRef}
            className={styles.imageWrap}
            style={{ aspectRatio: map.imageRatio ?? DEFAULT_RATIO }}
            onClick={handleImageClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={map.imageUrl ?? ""} alt="Site aerial" className={styles.image} />
            {map.points.map((p, i) => {
              const pos = dragPos && dragPos.id === p.id ? dragPos : p;
              return (
                <div
                  key={p.id}
                  className={`${styles.pin} ${draggingId === p.id ? styles.pinDragging : ""}`}
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    background: colorForStage(p.stageId, stages),
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => handlePinPointerDown(e, p.id)}
                  onPointerMove={handlePinPointerMove}
                  onPointerUp={(e) => handlePinPointerUp(e, p.id)}
                >
                  {i + 1}
                </div>
              );
            })}
          </div>
          <div className={styles.hint}>
            Click the aerial to drop a numbered point, drag a pin to reposition
            it, then give it a note and tie it to a stage below.
          </div>

          {map.points.length > 0 && (
            <div className={styles.pointList}>
              {map.points.map((p, i) => (
                <div key={p.id} className={styles.pointRow}>
                  <span
                    className={styles.pointNumber}
                    style={{ background: colorForStage(p.stageId, stages) }}
                  >
                    {i + 1}
                  </span>
                  <TextInput
                    id={`drop-point-${p.id}`}
                    label={`Drop Point ${i + 1}`}
                    value={p.note}
                    onChange={(e) => updatePoint(p.id, { note: e.target.value })}
                    className={styles.pointNote}
                  />
                  <select
                    className={styles.stageSelect}
                    value={p.stageId ?? ""}
                    onChange={(e) => updatePoint(p.id, { stageId: e.target.value || null })}
                  >
                    <option value="">No stage</option>
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label || "Untitled stage"}
                      </option>
                    ))}
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => removePoint(p.id)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        !hasAddress && (
          <div className={styles.emptyHint}>
            No aerial image yet — search an address above, or upload your own.
          </div>
        )
      )}
    </div>
  );
}
