"use client";
// app/maps-compare/page.tsx
// Internal tool: side-by-side satellite imagery comparison (Mapbox vs
// Google) for a given address. Not part of the report flow — just here to
// eyeball quality before deciding whether to build Google in properly.

import React, { useState } from "react";
import styles from "./page.module.css";

const ZOOM = 19;
const WIDTH = 640;
const HEIGHT = 400;

async function geocodeMapbox(
  address: string,
): Promise<{ lng: number; lat: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
  const encoded = encodeURIComponent(address);
  const res = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json` +
      `?access_token=${token}&limit=1&country=AU`,
  );
  const data = await res.json();
  if (!data.features?.length) return null;
  const [lng, lat] = data.features[0].center as [number, number];
  return { lng, lat };
}

export default function MapsComparePage() {
  const [address, setAddress] = useState("");
  const [mapboxUrl, setMapboxUrl] = useState<string | null>(null);
  const [googleUrl, setGoogleUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompare = async () => {
    const trimmed = address.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setMapboxUrl(null);
    setGoogleUrl(null);
    try {
      const coords = await geocodeMapbox(trimmed);
      if (!coords)
        throw new Error("Could not geocode that address via Mapbox");
      setMapboxUrl(
        `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/` +
          `${coords.lng},${coords.lat},${ZOOM}/${WIDTH}x${HEIGHT}@2x` +
          `?access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`,
      );
      setGoogleUrl(
        `/api/maps/static-map?address=${encodeURIComponent(trimmed)}` +
          `&zoom=${ZOOM}&size=${WIDTH}x${HEIGHT}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load maps");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Map imagery comparison</h1>
      <p className={styles.sub}>
        Side-by-side satellite imagery for an address — Mapbox (current,
        free) vs Google (demo key). Internal tool, not part of the report
        flow.
      </p>

      <div className={styles.row}>
        <input
          className={styles.input}
          placeholder="Enter an address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCompare()}
        />
        <button
          className={styles.btn}
          onClick={handleCompare}
          disabled={loading || !address.trim()}
        >
          {loading ? "Loading…" : "Compare"}
        </button>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      {(mapboxUrl || googleUrl) && (
        <div className={styles.grid}>
          <div className={styles.panel}>
            <div className={styles.panelLabel}>Mapbox (current, free)</div>
            {mapboxUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.img} src={mapboxUrl} alt="Mapbox satellite view" />
            )}
          </div>
          <div className={styles.panel}>
            <div className={styles.panelLabel}>Google (demo key)</div>
            {googleUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.img} src={googleUrl} alt="Google satellite view" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
