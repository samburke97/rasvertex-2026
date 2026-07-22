"use client";
/// <reference types="google.maps" />
// components/reports/anchor-inspection/ZoneMapEditor.tsx

import React, { useState, useRef, useCallback, useEffect } from "react";
import styles from "./ZoneMapEditor.module.css";
import Button from "@/components/ui/Button";
import AnchorPinModal from "./AnchorPinModal";
import MapLegend from "./MapLegend";
import { loadGoogleMaps } from "@/lib/reports/googleMapsLoader";
import {
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_LABELS,
  ANCHOR_TYPE_OPTIONS,
  generateId,
  type AnchorPoint,
  type AnchorType,
  type Zone,
} from "@/lib/reports/anchor.types";

interface ZoneMapEditorProps {
  zone: Zone;
  jobAddress: string;
  defaultInspectionDate: string;
  defaultNextInspection: string;
  onUpdate: (zone: Zone) => void;
  onBack: () => void;
  onDelete: () => void;
}

const DEFAULT_ZOOM = 19;
const PREVIEW_SIZE = "640x400";
const DEFAULT_TYPE: AnchorType = "fall-arrest-anchor";

// Live, pannable/zoomable Google Maps embed — used whenever a client-side
// JS Maps key is configured. Falls back to a static image with a discrete
// zoom stepper (no continuous zoom, but works with only the server-side
// key) when it isn't.
const HAS_LIVE_MAPS = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;

// Static-fallback-only zoom bounds.
const MIN_ZOOM = 17;
const MAX_ZOOM = 21;

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

export default function ZoneMapEditor({
  zone,
  jobAddress,
  defaultInspectionDate,
  defaultNextInspection,
  onUpdate,
  onBack,
  onDelete,
}: ZoneMapEditorProps) {
  const [localZone, setLocalZone] = useState<Zone>({ ...zone });
  const [zoneName, setZoneName] = useState(zone.name);

  const [previewError, setPreviewError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<boolean>(!!zone.mapImageUrl);

  // ── Live map (Google Maps JS API) ────────────────────────────────────────
  const liveMapContainerRef = useRef<HTMLDivElement>(null);
  const liveMapRef = useRef<google.maps.Map | null>(null);
  const [liveMapReady, setLiveMapReady] = useState(false);
  const [liveMapError, setLiveMapError] = useState<string | null>(null);

  // ── Static fallback (no JS Maps key configured) ──────────────────────────
  const [zoomLevel, setZoomLevel] = useState(zone.mapZoom ?? DEFAULT_ZOOM);
  const previewWrapRef = useRef<HTMLDivElement>(null);

  const frozenMapRef = useRef<HTMLDivElement>(null);
  // Stamp mode: whichever type is selected here places instantly on tap —
  // no modal per pin, since techs place many of the same type in a row.
  const [selectedType, setSelectedType] = useState<AnchorType>(DEFAULT_TYPE);
  const [editingAnchor, setEditingAnchor] = useState<AnchorPoint | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const dragState = useRef<{
    anchorId: string;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);

  const save = useCallback((updated: Zone) => onUpdate(updated), [onUpdate]);

  const hasAddress = !!jobAddress?.trim();

  // Reset preview error whenever the zoom (and therefore the request) changes.
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

        const map = new g.maps.Map(container, {
          center: { lat: zone.mapLat ?? -26.65, lng: zone.mapLng ?? 153.09 },
          zoom: zone.mapZoom ?? DEFAULT_ZOOM,
          mapTypeId: "satellite",
          gestureHandling: "greedy",
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        });
        liveMapRef.current = map;

        // Already have a precise position from a previous capture — reuse
        // it directly instead of re-geocoding the address string.
        if (zone.mapLat != null && zone.mapLng != null) {
          map.setCenter({ lat: zone.mapLat, lng: zone.mapLng });
          setLiveMapReady(true);
          return;
        }

        const geocoder = new g.maps.Geocoder();
        geocoder.geocode(
          { address: jobAddress, region: "au" },
          (results, status) => {
            if (cancelled) return;
            if (status === "OK" && results?.[0]) {
              map.setCenter(results[0].geometry.location);
              setLiveMapReady(true);
            } else {
              setLiveMapError(`Couldn't locate that address (${status})`);
            }
          },
        );
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
  }, [captured, hasAddress, jobAddress]);

  // Scroll/trackpad zoom over the static-fallback preview — Static Maps only
  // takes a fixed integer zoom per request (no continuous zoom), so this
  // steps one level per gesture rather than fetching on every wheel tick.
  // No-ops when the live map (which handles its own native zoom) is active.
  useEffect(() => {
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
        setZoomLevel((z) =>
          Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + direction)),
        );
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
    if (!hasAddress) return;
    setCapturing(true);
    try {
      let url: string;
      let capturedLat: number | undefined;
      let capturedLng: number | undefined;
      let capturedZoom: number;

      if (HAS_LIVE_MAPS && liveMapRef.current) {
        const center = liveMapRef.current.getCenter();
        if (!center) throw new Error("Map not ready");
        capturedZoom = liveMapRef.current.getZoom() ?? DEFAULT_ZOOM;
        capturedLat = center.lat();
        capturedLng = center.lng();
        url = buildStaticUrl({
          lat: capturedLat,
          lng: capturedLng,
          zoom: capturedZoom,
        });
      } else {
        capturedZoom = zoomLevel;
        url = buildStaticUrl({ address: jobAddress.trim(), zoom: capturedZoom });
      }

      const dataUrl = await urlToDataUrl(url);
      const updated: Zone = {
        ...localZone,
        name: zoneName,
        mapImageUrl: dataUrl,
        mapZoom: capturedZoom,
        mapLat: capturedLat ?? localZone.mapLat,
        mapLng: capturedLng ?? localZone.mapLng,
      };
      setLocalZone(updated);
      save(updated);
      setCaptured(true);
    } catch {
      setPreviewError(true);
    } finally {
      setCapturing(false);
    }
  }, [hasAddress, jobAddress, zoomLevel, localZone, zoneName, save]);

  // ── Re-capture ────────────────────────────────────────────────────────────

  const handleRecapture = useCallback(() => {
    const updated: Zone = { ...localZone, mapImageUrl: null };
    setLocalZone(updated);
    save(updated);
    setCaptured(false);
  }, [localZone, save]);

  // ── Upload fallback ───────────────────────────────────────────────────────

  const handleUploadMap = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      const updated: Zone = { ...localZone, mapImageUrl: url };
      setLocalZone(updated);
      save(updated);
      setCaptured(true);
    };
    reader.readAsDataURL(file);
  };

  // ── Stamp placement ──────────────────────────────────────────────────────
  // Tapping the aerial drops a pin of the selected type immediately — the
  // common case is 15-20 of the same type in a row, so there's no modal in
  // the way. Tap an existing pin to correct/delete it instead.

  const placePin = useCallback(
    (x: number, y: number) => {
      const anchor: AnchorPoint = {
        id: generateId(),
        x,
        y,
        label: `A${localZone.anchors.length + 1}`,
        type: selectedType,
        commissionDate: "",
        inspectionDate: defaultInspectionDate,
        nextInspection: defaultNextInspection,
        result: "PASSED",
      };
      const updated: Zone = {
        ...localZone,
        anchors: [...localZone.anchors, anchor],
      };
      setLocalZone(updated);
      save(updated);
    },
    [localZone, selectedType, defaultInspectionDate, defaultNextInspection, save],
  );

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.current?.moved) return;
    // Clicks bubble up from pin buttons too — ignore those, they're handled
    // by the pin's own pointer handlers (drag vs. tap-to-edit).
    if ((e.target as HTMLElement).closest(`.${styles.pin}`)) return;
    const rect = frozenMapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    placePin(x, y);
  };

  const handlePinSave = (anchor: AnchorPoint) => {
    const updated: Zone = {
      ...localZone,
      anchors: localZone.anchors.map((a) => (a.id === anchor.id ? anchor : a)),
    };
    setLocalZone(updated);
    save(updated);
    setEditingAnchor(null);
  };

  const handlePinDelete = (anchorId: string) => {
    const updated: Zone = {
      ...localZone,
      anchors: localZone.anchors.filter((a) => a.id !== anchorId),
    };
    setLocalZone(updated);
    save(updated);
    setEditingAnchor(null);
  };

  const handleNameBlur = () => {
    const updated = { ...localZone, name: zoneName };
    setLocalZone(updated);
    save(updated);
  };

  // ── Drag handlers ─────────────────────────────────────────────────────────

  const handlePinPointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, anchorId: string) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      dragState.current = {
        anchorId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
      };
      setDraggingId(anchorId);
    },
    [],
  );

  const handlePinPointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const ds = dragState.current;
      if (!ds) return;
      const rect = frozenMapRef.current?.getBoundingClientRect();
      if (!rect) return;

      const dx = e.clientX - ds.startX;
      const dy = e.clientY - ds.startY;
      if (!ds.moved && Math.hypot(dx, dy) < 5) return;
      ds.moved = true;

      const x = Math.min(
        100,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * 100),
      );
      const y = Math.min(
        100,
        Math.max(0, ((e.clientY - rect.top) / rect.height) * 100),
      );

      setLocalZone((prev) => ({
        ...prev,
        anchors: prev.anchors.map((a) =>
          a.id === ds.anchorId ? { ...a, x, y } : a,
        ),
      }));
    },
    [],
  );

  const handlePinPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, anchor: AnchorPoint) => {
      const ds = dragState.current;
      dragState.current = null;
      setDraggingId(null);
      if (!ds) return;

      if (ds.moved) {
        setLocalZone((prev) => {
          save(prev);
          return prev;
        });
      } else {
        setEditingAnchor(anchor);
      }
    },
    [save],
  );

  const activeTypes = [
    ...new Set(localZone.anchors.map((a) => a.type)),
  ] as AnchorType[];

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Back to report
        </button>

        <div className={styles.zoneTitleWrap}>
          <input
            className={styles.zoneNameInput}
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Zone name…"
          />
        </div>

        <div className={styles.topActions}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => uploadRef.current?.click()}
          >
            Upload Aerial
          </Button>

          {!captured && hasAddress && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleCapture}
              disabled={
                capturing ||
                previewError ||
                (HAS_LIVE_MAPS && (!liveMapReady || !!liveMapError))
              }
            >
              {capturing ? "Capturing…" : "Use This View"}
            </Button>
          )}

          {captured && (
            <Button variant="secondary" size="sm" onClick={handleRecapture}>
              Re-capture Map
            </Button>
          )}

          <button
            className={styles.deleteZoneBtn}
            onClick={() => {
              if (
                confirm(`Delete zone "${localZone.name}" and all its anchors?`)
              )
                onDelete();
            }}
          >
            Delete Zone
          </button>
        </div>
      </div>

      {/* Status bar */}
      {!captured && (
        <div className={styles.statusBar}>
          {!hasAddress ? (
            <span className={styles.statusError}>
              ⚠ No job address set — use Upload Aerial instead.
            </span>
          ) : HAS_LIVE_MAPS ? (
            liveMapError ? (
              <span className={styles.statusError}>
                ⚠ {liveMapError} — use Upload Aerial instead.
              </span>
            ) : !liveMapReady ? (
              <span className={styles.statusInfo}>📍 Locating address…</span>
            ) : (
              <span className={styles.statusInfo}>
                <strong>Drag and scroll to frame the roof</strong>, then click
                Use This View.
              </span>
            )
          ) : previewError ? (
            <span className={styles.statusError}>
              ⚠ Couldn&apos;t load satellite imagery for this address — use
              Upload Aerial instead.
            </span>
          ) : (
            <span className={styles.statusInfo}>
              <strong>Scroll to zoom</strong> and frame the roof, then click
              Use This View.
            </span>
          )}
        </div>
      )}

      {/* Type stamp toolbar — pick a type, then tap the map to place it */}
      {captured && (
        <div className={styles.stampBar}>
          {ANCHOR_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              className={`${styles.stampChip} ${
                selectedType === opt.value ? styles.stampChipActive : ""
              }`}
              style={
                selectedType === opt.value
                  ? {
                      borderColor: ANCHOR_TYPE_COLOURS[opt.value],
                      background: ANCHOR_TYPE_COLOURS[opt.value] + "18",
                      color: ANCHOR_TYPE_COLOURS[opt.value],
                    }
                  : {}
              }
              onClick={() => setSelectedType(opt.value)}
            >
              <span
                className={styles.stampDot}
                style={{ background: ANCHOR_TYPE_COLOURS[opt.value] }}
              />
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {/* Main layout */}
      <div className={styles.layout}>
        {/* Map area */}
        <div className={styles.mapArea}>
          {!captured ? (
            hasAddress ? (
              HAS_LIVE_MAPS ? (
                <div className={styles.liveMapContainer} ref={liveMapContainerRef} />
              ) : (
                <div className={styles.previewWrap} ref={previewWrapRef}>
                  {!previewError && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={zoomLevel}
                      src={buildStaticUrl({
                        address: jobAddress.trim(),
                        zoom: zoomLevel,
                      })}
                      alt="Satellite preview"
                      className={styles.previewImage}
                      onError={() => setPreviewError(true)}
                    />
                  )}
                  <div className={styles.zoomControls}>
                    <button
                      className={styles.zoomBtn}
                      onClick={() =>
                        setZoomLevel((z) => Math.max(MIN_ZOOM, z - 1))
                      }
                      disabled={zoomLevel <= MIN_ZOOM}
                      aria-label="Zoom out"
                    >
                      −
                    </button>
                    <span className={styles.zoomLevel}>{zoomLevel}</span>
                    <button
                      className={styles.zoomBtn}
                      onClick={() =>
                        setZoomLevel((z) => Math.min(MAX_ZOOM, z + 1))
                      }
                      disabled={zoomLevel >= MAX_ZOOM}
                      aria-label="Zoom in"
                    >
                      +
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className={styles.mapSetup}>
                <div className={styles.mapSetupIcon}>
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <p className={styles.mapSetupTitle}>No job address set</p>
                <p className={styles.mapSetupSub}>
                  Load a job to fetch its address, or upload an aerial
                  screenshot directly.
                </p>
              </div>
            )
          ) : (
            <div className={styles.mapContainer}>
              <div
                ref={frozenMapRef}
                className={styles.mapCanvas}
                onClick={handleMapClick}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localZone.mapImageUrl ?? ""}
                  alt="Zone aerial"
                  className={styles.mapImage}
                  draggable={false}
                />

                {/* Anchor pins */}
                {localZone.anchors.map((anchor) => (
                  <button
                    key={anchor.id}
                    className={`${styles.pin} ${
                      draggingId === anchor.id ? styles.pinDragging : ""
                    }`}
                    style={{
                      left: `${anchor.x}%`,
                      top: `${anchor.y}%`,
                      cursor: draggingId === anchor.id ? "grabbing" : "grab",
                    }}
                    onPointerDown={(e) => handlePinPointerDown(e, anchor.id)}
                    onPointerMove={handlePinPointerMove}
                    onPointerUp={(e) => handlePinPointerUp(e, anchor)}
                    title={`${anchor.label} — ${ANCHOR_TYPE_LABELS[anchor.type]}`}
                  >
                    <span
                      className={styles.pinLabel}
                      style={{ background: ANCHOR_TYPE_COLOURS[anchor.type] }}
                    >
                      {anchor.label}
                    </span>
                  </button>
                ))}
              </div>

              {activeTypes.length > 0 && (
                <MapLegend types={activeTypes} anchors={localZone.anchors} />
              )}
            </div>
          )}
        </div>

        {/* Anchor sidebar */}
        <div className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.sidebarTitle}>Anchors</span>
            <span className={styles.sidebarCount}>
              {localZone.anchors.length}
            </span>
          </div>

          {localZone.anchors.length === 0 ? (
            <p className={styles.noAnchors}>
              {captured
                ? "Pick a type above, then tap the map to place pins"
                : "Capture the aerial view first, then add anchors"}
            </p>
          ) : (
            <div className={styles.anchorList}>
              {localZone.anchors.map((anchor) => (
                <button
                  key={anchor.id}
                  className={styles.anchorRow}
                  onClick={() => setEditingAnchor(anchor)}
                >
                  <span
                    className={styles.anchorDot}
                    style={{ background: ANCHOR_TYPE_COLOURS[anchor.type] }}
                  />
                  <div className={styles.anchorRowInfo}>
                    <span className={styles.anchorRowLabel}>
                      {anchor.label}
                    </span>
                    <span className={styles.anchorRowType}>
                      {ANCHOR_TYPE_LABELS[anchor.type]}
                    </span>
                  </div>
                  <span
                    className={`${styles.anchorBadge} ${
                      anchor.result === "PASSED"
                        ? styles.anchorBadgePass
                        : anchor.result === "FAILED"
                          ? styles.anchorBadgeFail
                          : styles.anchorBadgeNone
                    }`}
                  >
                    {anchor.result ?? "—"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={uploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleUploadMap}
      />

      {/* Pin modal — edit existing */}
      {editingAnchor && (
        <AnchorPinModal
          anchor={editingAnchor}
          onSave={handlePinSave}
          onDelete={handlePinDelete}
          onClose={() => setEditingAnchor(null)}
          isNew={false}
        />
      )}
    </div>
  );
}
