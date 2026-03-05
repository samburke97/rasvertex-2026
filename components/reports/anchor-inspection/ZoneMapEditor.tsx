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

// mapbox-gl is client-only — dynamic import to avoid SSR issues
import type mapboxgl from "mapbox-gl";

interface ZoneMapEditorProps {
  zone: Zone;
  jobAddress: string;
  onUpdate: (zone: Zone) => void;
  onBack: () => void;
  onDelete: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────
//
// DO NOT do: const TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
//
// Next.js performs a literal string replacement of NEXT_PUBLIC_ vars at build
// time. When this module is evaluated on the server during SSR the replacement
// hasn't happened yet and you get "". Reading inside a function call ensures
// we always get the live value after hydration.
//
const STYLE_URL = "mapbox://styles/samisbord/cmmcyrsb1000f01sq8kzy0g9z";
const STYLE_ID = "samisbord/cmmcyrsb1000f01sq8kzy0g9z";

function getToken(): string {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildStaticUrl(
  lng: number,
  lat: number,
  zoom: number,
  bearing = 0,
  pitch = 0,
  w = 1280,
  h = 720,
): string {
  return (
    `https://api.mapbox.com/styles/v1/${STYLE_ID}/static/` +
    `${lng},${lat},${zoom},${bearing},${pitch}/` +
    `${w}x${h}@2x?access_token=${getToken()}`
  );
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

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [captured, setCaptured] = useState<boolean>(!!zone.mapImageUrl);

  const frozenMapRef = useRef<HTMLDivElement>(null);
  const [isPlacingPin, setIsPlacingPin] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [editingAnchor, setEditingAnchor] = useState<AnchorPoint | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);

  // ── Save ─────────────────────────────────────────────────────────────────

  const save = useCallback(
    (updated: Zone) => {
      onUpdate(updated);
    },
    [onUpdate],
  );

  // ── Init map ─────────────────────────────────────────────────────────────

  useEffect(() => {
    // Read token HERE — inside the effect, always client-side, always live value
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

      // Set token right before constructing the Map instance
      mb.accessToken = token;

      let lng = 151.2093;
      let lat = -33.8688;
      let zoom = 18;

      if (zone.mapLat && zone.mapLng) {
        lat = zone.mapLat;
        lng = zone.mapLng;
        zoom = zone.mapZoom ?? 18;
      } else if (jobAddress.trim()) {
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
    if (!mapRef.current) return;
    const map = mapRef.current;
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();

    setCapturing(true);

    const imgUrl = buildStaticUrl(center.lng, center.lat, zoom, bearing, pitch);
    const updated: Zone = {
      ...localZone,
      name: zoneName,
      mapImageUrl: imgUrl,
      mapLat: center.lat,
      mapLng: center.lng,
      mapZoom: zoom,
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

  // ── Zone name ─────────────────────────────────────────────────────────────

  const handleNameBlur = () => {
    const updated = { ...localZone, name: zoneName };
    setLocalZone(updated);
    save(updated);
  };

  const activeTypes = [
    ...new Set(localZone.anchors.map((a) => a.type)),
  ] as AnchorType[];
  const hasToken = !!getToken();

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* Status bar — live map phase only */}
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
              🗺 Pan and zoom to frame the rooftop, then click{" "}
              <strong>Capture View</strong>.
            </span>
          ) : (
            <span className={styles.statusInfo}>Loading map…</span>
          )}
        </div>
      )}

      <div className={styles.layout}>
        {/* Map / image area */}
        <div className={styles.mapArea}>
          {/* Phase 1 — live interactive map */}
          {!captured && hasToken && (
            <div ref={mapContainerRef} className={styles.liveMap} />
          )}

          {/* No-token fallback */}
          {!captured && !hasToken && (
            <div className={styles.mapSetup}>
              <div className={styles.mapSetupIcon}>
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                  <line x1="9" y1="3" x2="9" y2="18" />
                  <line x1="15" y1="6" x2="15" y2="21" />
                </svg>
              </div>
              <p className={styles.mapSetupTitle}>No Mapbox token configured</p>
              <p className={styles.mapSetupSub}>
                Add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local, or upload an aerial
                screenshot directly.
              </p>
              <Button
                variant="primary"
                size="sm"
                onClick={() => uploadRef.current?.click()}
              >
                Upload Aerial Image
              </Button>
            </div>
          )}

          {/* Phase 2 — frozen image with pins */}
          {captured && localZone.mapImageUrl && (
            <div className={styles.mapContainer}>
              <div
                ref={frozenMapRef}
                className={`${styles.mapCanvas} ${isPlacingPin ? styles.mapCanvasPlacing : ""}`}
                onClick={handleMapClick}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={localZone.mapImageUrl}
                  alt="Zone aerial"
                  className={styles.mapImage}
                  draggable={false}
                />

                {localZone.anchors.map((anchor) => (
                  <button
                    key={anchor.id}
                    className={styles.pin}
                    style={{
                      left: `${anchor.x}%`,
                      top: `${anchor.y}%`,
                      background: ANCHOR_TYPE_COLOURS[anchor.type],
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingAnchor(anchor);
                    }}
                    title={`${anchor.label} — ${ANCHOR_TYPE_LABELS[anchor.type]}`}
                  >
                    <span className={styles.pinLabel}>{anchor.label}</span>
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
                    className={`${styles.anchorBadge} ${anchor.result === "PASSED" ? styles.anchorBadgePass : styles.anchorBadgeFail}`}
                  >
                    {anchor.result}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pin modal */}
      {(pendingPin || editingAnchor) && (
        <AnchorPinModal
          anchor={
            editingAnchor ?? {
              id: generateId(),
              label: `A.${localZone.anchors.length + 1}`,
              type: "fall-arrest-anchor",
              description: "Fall Arrest Anchor Point Surface Mount",
              inspectionDate: new Date().toLocaleDateString("en-AU"),
              nextInspection: new Date(
                Date.now() + 365 * 24 * 60 * 60 * 1000,
              ).toLocaleDateString("en-AU"),
              result: "PASSED",
              x: pendingPin!.x,
              y: pendingPin!.y,
            }
          }
          isNew={!editingAnchor}
          onSave={handlePinSave}
          onDelete={handlePinDelete}
          onClose={() => {
            setPendingPin(null);
            setEditingAnchor(null);
          }}
        />
      )}

      <input
        ref={uploadRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className={styles.hiddenInput}
        onChange={handleUploadMap}
      />
    </div>
  );
}
