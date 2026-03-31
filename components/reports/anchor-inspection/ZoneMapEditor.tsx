"use client";
// components/reports/anchor-inspection/ZoneMapEditor.tsx

import React, { useState, useRef, useCallback, useEffect } from "react";
import styles from "./ZoneMapEditor.module.css";
import Button from "@/components/ui/Button";
import AnchorPinModal from "./AnchorPinModal";
import MapLegend from "./MapLegend";
import {
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_LABELS,
  generateId,
  type AnchorPoint,
  type AnchorType,
  type Zone,
} from "@/lib/reports/anchor.types";

import type mapboxgl from "mapbox-gl";

interface ZoneMapEditorProps {
  zone: Zone;
  jobAddress: string;
  onUpdate: (zone: Zone) => void;
  onBack: () => void;
  onDelete: () => void;
}

const STYLE_URL = "mapbox://styles/mapbox/satellite-streets-v12";

function getToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
}

async function geocodeAddress(
  address: string,
): Promise<{ lng: number; lat: number } | null> {
  const encoded = encodeURIComponent(address);
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
      `?access_token=${getToken()}&limit=1&country=AU`,
  );
  const data = await res.json();
  if (!data.features?.length) return null;
  const [lng, lat] = data.features[0].center as [number, number];
  return { lng, lat };
}

export default function ZoneMapEditor({
  zone,
  jobAddress,
  onUpdate,
  onBack,
  onDelete,
}: ZoneMapEditorProps) {
  const [localZone, setLocalZone] = useState<Zone>({ ...zone });
  const [zoneName, setZoneName] = useState(zone.name);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<boolean>(!zone.mapImageUrl);

  const frozenMapRef = useRef<HTMLDivElement>(null);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(
    null,
  );
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

  // ── Init map ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    if (captured) return;
    if (!mapContainerRef.current) return;

    let cancelled = false;

    async function initMap() {
      setGeocoding(true);

      const mb = (await import("mapbox-gl")).default;
      await import("mapbox-gl/dist/mapbox-gl.css");

      if (cancelled) return;

      mb.accessToken = token;

      let lng = 151.2093;
      let lat = -33.8688;
      let zoom = 18;

      if (zone.mapLat && zone.mapLng) {
        lat = zone.mapLat;
        lng = zone.mapLng;
        zoom = zone.mapZoom ?? 18;
      } else if (jobAddress?.trim()) {
        try {
          const coords = await geocodeAddress(jobAddress);
          if (coords && !cancelled) {
            lat = coords.lat;
            lng = coords.lng;
          }
        } catch {
          /* fall back to Sydney CBD */
        }
      }

      if (cancelled || !mapContainerRef.current) return;

      const map = new mb.Map({
        container: mapContainerRef.current,
        style: STYLE_URL,
        center: [lng, lat],
        zoom,
        bearing: 0,
        pitch: 0,
        preserveDrawingBuffer: true,
      });

      map.addControl(new mb.NavigationControl(), "top-right");
      map.on("load", () => {
        if (!cancelled) {
          setMapReady(true);
          setGeocoding(false);
        }
      });

      mapRef.current = map;
    }

    initMap();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captured]);

  // ── Capture ───────────────────────────────────────────────────────────────

  const handleCapture = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    setCapturing(true);

    await new Promise<void>((resolve) => {
      if (map.isStyleLoaded() && map.areTilesLoaded()) {
        resolve();
      } else {
        map.once("idle", () => resolve());
      }
    });

    const canvas = map.getCanvas();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);

    const center = map.getCenter();
    const updated: Zone = {
      ...localZone,
      name: zoneName,
      mapImageUrl: dataUrl,
      mapLat: center.lat,
      mapLng: center.lng,
      mapZoom: map.getZoom(),
    };

    setLocalZone(updated);
    save(updated);
    setCaptured(true);
    setCapturing(false);

    map.remove();
    mapRef.current = null;
  }, [localZone, zoneName, save]);

  // ── Re-capture ────────────────────────────────────────────────────────────

  const handleRecapture = useCallback(() => {
    const updated: Zone = { ...localZone, mapImageUrl: null };
    setLocalZone(updated);
    save(updated);
    setCaptured(false);
    setIsPlacingPin(false);
    setPendingPin(null);
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

  // ── Pin placement ─────────────────────────────────────────────────────────

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPlacingPin) return;
    if (dragState.current?.moved) return;
    const rect = frozenMapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setPendingPin({ x, y });
    setIsPlacingPin(false);
  };

  const handlePinSave = (anchor: AnchorPoint) => {
    const isNew = !localZone.anchors.find((a) => a.id === anchor.id);
    const updated: Zone = {
      ...localZone,
      anchors: isNew
        ? [...localZone.anchors, anchor]
        : localZone.anchors.map((a) => (a.id === anchor.id ? anchor : a)),
    };
    setLocalZone(updated);
    save(updated);
    setPendingPin(null);
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
      if (isPlacingPin) return;
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
    [isPlacingPin],
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
  const hasToken = !!getToken();

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

          {!captured && hasToken && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleCapture}
              disabled={!mapReady || capturing}
            >
              {capturing ? "Capturing…" : "Capture View"}
            </Button>
          )}

          {captured && (
            <>
              <Button variant="secondary" size="sm" onClick={handleRecapture}>
                Re-capture Map
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setIsPlacingPin(true)}
                disabled={isPlacingPin}
              >
                {isPlacingPin ? "Click map to place…" : "+ Add Anchor"}
              </Button>
            </>
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
          {!hasToken ? (
            <span className={styles.statusError}>
              ⚠ NEXT_PUBLIC_MAPBOX_TOKEN not set — use Upload Aerial instead.
            </span>
          ) : geocoding ? (
            <span className={styles.statusInfo}>📍 Locating address…</span>
          ) : mapReady ? (
            <span className={styles.statusInfo}>
              <strong>Ready.</strong> Pan and zoom to the roof, then click
              Capture View.
            </span>
          ) : (
            <span className={styles.statusInfo}>Loading map…</span>
          )}
        </div>
      )}

      {/* Main layout */}
      <div className={styles.layout}>
        {/* Map area */}
        <div className={styles.mapArea}>
          {!captured ? (
            hasToken ? (
              <div ref={mapContainerRef} className={styles.liveMap} />
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
                <p className={styles.mapSetupTitle}>
                  No Mapbox token configured
                </p>
                <p className={styles.mapSetupSub}>
                  Add NEXT_PUBLIC_MAPBOX_TOKEN to your environment, or upload an
                  aerial screenshot directly.
                </p>
              </div>
            )
          ) : (
            <div className={styles.mapContainer}>
              <div
                ref={frozenMapRef}
                className={styles.mapCanvas}
                onClick={handleMapClick}
                style={{ cursor: isPlacingPin ? "crosshair" : "default" }}
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

                {isPlacingPin && (
                  <div className={styles.placingOverlay}>
                    <span>Click to place anchor point</span>
                  </div>
                )}
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
                ? 'Click "+ Add Anchor" then click the map to place pins'
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

      {/* Pin modal — new pin */}
      {pendingPin && (
        <AnchorPinModal
          anchor={{
            id: generateId(),
            x: pendingPin.x,
            y: pendingPin.y,
            label: `A${localZone.anchors.length + 1}`,
            type: "fall-arrest-anchor",
            description: "",
            inspectionDate: "",
            nextInspection: "",
            result: "PASSED",
            notes: "",
          }}
          onSave={handlePinSave}
          onDelete={handlePinDelete}
          onClose={() => setPendingPin(null)}
          isNew
        />
      )}

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
