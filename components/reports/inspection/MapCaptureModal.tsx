"use client";
// components/reports/inspection/MapCaptureModal.tsx
//
// Frame the site on a live Google satellite map, then "Use this view" — the
// same capture the Anchor Inspection report's zone map uses (see
// ZoneMapEditor.tsx): the live map's centre and the zoom that fits its
// viewport (staticMapZoom.ts) are fetched from the static-map proxy, so the
// capture is exactly what was framed. Without a browser Maps key it falls
// back to a static preview with zoom buttons.

import { useEffect, useRef, useState } from "react";
import styles from "./MapCaptureModal.module.css";
import { loadGoogleMaps } from "@/lib/reports/googleMapsLoader";
import { zoomToFitBounds } from "@/lib/reports/staticMapZoom";

const HAS_LIVE_MAPS = !!process.env.NEXT_PUBLIC_GOOGLE_MAPS_JS_KEY;
// 3:2 — the site map's shape on the page.
const CAPTURE_W = 640;
const CAPTURE_H = 427;
const DEFAULT_ZOOM = 19;

export interface MapView {
  lat?: number;
  lng?: number;
  zoom: number;
}

interface Props {
  address: string;
  initial?: MapView;
  onCancel: () => void;
  onCapture: (dataUrl: string, view: MapView) => Promise<void>;
}

function staticUrl(v: { address?: string; lat?: number; lng?: number; zoom: number }): string {
  const params = new URLSearchParams();
  if (v.lat != null && v.lng != null) {
    params.set("lat", String(v.lat));
    params.set("lng", String(v.lng));
  } else if (v.address) {
    params.set("address", v.address);
  }
  params.set("zoom", String(v.zoom));
  params.set("size", `${CAPTURE_W}x${CAPTURE_H}`);
  return `/api/maps/static-map?${params}`;
}

async function urlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't capture the map. Try again.");
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export default function MapCaptureModal({ address, initial, onCancel, onCapture }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const liveMap = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(!HAS_LIVE_MAPS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [staticZoom, setStaticZoom] = useState(initial?.zoom ?? DEFAULT_ZOOM);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  // Live map: centre on the last capture, else geocode the site address.
  useEffect(() => {
    if (!HAS_LIVE_MAPS || !mapEl.current) return;
    let cancelled = false;
    (async () => {
      try {
        const g = await loadGoogleMaps();
        if (cancelled || !mapEl.current) return;
        const map = new g.maps.Map(mapEl.current, {
          center: { lat: initial?.lat ?? -26.65, lng: initial?.lng ?? 153.09 },
          zoom: initial?.zoom ?? DEFAULT_ZOOM,
          mapTypeId: "satellite",
          tilt: 0,
          gestureHandling: "greedy",
          streetViewControl: false,
          fullscreenControl: false,
          mapTypeControl: false,
        });
        liveMap.current = map;
        if (initial?.lat != null && initial.lng != null) {
          setReady(true);
          return;
        }
        const res = await fetch(`/api/maps/geocode?address=${encodeURIComponent(address)}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.lat != null && data.lng != null) {
          map.setCenter({ lat: data.lat, lng: data.lng });
          setReady(true);
        } else {
          setError(data.error ?? "Couldn't locate that address.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Google Maps.");
      }
    })();
    return () => {
      cancelled = true;
      liveMap.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = async () => {
    setBusy(true);
    setError(null);
    try {
      let view: MapView;
      let url: string;
      const map = liveMap.current;
      if (HAS_LIVE_MAPS && map) {
        // Re-measure first so the bounds match what's actually on screen.
        const c0 = map.getCenter();
        google.maps.event.trigger(map, "resize");
        if (c0) map.setCenter(c0);
        const center = map.getCenter();
        const bounds = map.getBounds();
        if (!center || !bounds) throw new Error("The map isn't ready yet.");
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        view = {
          lat: center.lat(),
          lng: center.lng(),
          zoom: zoomToFitBounds(
            { lat: sw.lat(), lng: sw.lng() },
            { lat: ne.lat(), lng: ne.lng() },
            CAPTURE_W,
            CAPTURE_H,
          ),
        };
        url = staticUrl(view);
      } else {
        view = { zoom: staticZoom };
        url = staticUrl({ address, zoom: staticZoom });
      }
      await onCapture(await urlToDataUrl(url), view);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't capture the map.");
      setBusy(false);
    }
  };

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.dialog} role="dialog" aria-label="Capture site map">
        <div className={styles.head}>
          <div>
            <div className={styles.title}>Capture site map</div>
            <div className={styles.sub}>
              {HAS_LIVE_MAPS
                ? "Pan and zoom until the whole building fills the frame."
                : "Zoom until the whole building fills the frame."}
            </div>
          </div>
          <button className={styles.close} onClick={onCancel} aria-label="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className={styles.frame}>
          {HAS_LIVE_MAPS ? (
            <div ref={mapEl} className={styles.map} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.map} src={staticUrl({ address, zoom: staticZoom })} alt="Satellite view" />
          )}
          {!ready && !error && <div className={styles.overlay}>Finding {address}…</div>}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.foot}>
          <span className={styles.address}>{address}</span>
          {!HAS_LIVE_MAPS && (
            <div className={styles.zoom}>
              <button onClick={() => setStaticZoom((z) => Math.max(15, z - 1))} aria-label="Zoom out">
                −
              </button>
              <button onClick={() => setStaticZoom((z) => Math.min(21, z + 1))} aria-label="Zoom in">
                +
              </button>
            </div>
          )}
          <button className={styles.secondary} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.primary} onClick={capture} disabled={!ready || busy}>
            {busy ? "Capturing…" : "Use this view"}
          </button>
        </div>
      </div>
    </div>
  );
}
