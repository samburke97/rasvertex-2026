"use client";
// components/reports/proposal/AccessMapEditor.tsx
//
// Same idea as Anchor Inspection's map-marking process (capture an aerial
// photo, drop pins on it) but marking rope-access drop points instead of
// anchor hardware, and each point ties to a stage in the Access Plan
// timeline so the write-up can say exactly how the crew will move across
// the building, not just when. Deliberately simpler than ZoneMapEditor: no
// live interactive Google Map, no rotation — just a static aerial capture
// (recapturable at a different zoom) or a manual upload, with numbered
// click-to-place pins. See ZoneMapEditor.tsx if this ever needs to grow
// into full pan/zoom/rotate territory.

import { useCallback, useRef, useState } from "react";
import styles from "./AccessMapEditor.module.css";
import Button from "@/components/ui/Button";
import TextInput from "@/components/ui/TextInput";
import { compressImageDataUrl } from "@/lib/reports/compressImage";
import type {
  AccessDropPoint,
  ProposalAccessMap,
  ProposalAccessStage,
} from "@/lib/reports/proposal.types";

interface Props {
  map: ProposalAccessMap;
  stages: ProposalAccessStage[];
  siteAddress: string;
  onChange: (map: ProposalAccessMap) => void;
}

const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 400;
const MIN_ZOOM = 15;
const MAX_ZOOM = 21;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
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

function buildStaticUrl(lat: number, lng: number, zoom: number): string {
  const params = new URLSearchParams();
  params.set("lat", String(lat));
  params.set("lng", String(lng));
  params.set("zoom", String(zoom));
  params.set("size", `${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}`);
  return `/api/maps/static-map?${params.toString()}`;
}

export default function AccessMapEditor({ map, stages, siteAddress, onChange }: Props) {
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const captureAt = useCallback(
    async (lat: number, lng: number, zoom: number) => {
      setCapturing(true);
      setCaptureError(null);
      try {
        const dataUrl = await urlToDataUrl(buildStaticUrl(lat, lng, zoom));
        const compressed = await compressImageDataUrl(dataUrl);
        onChange({ ...map, imageUrl: compressed, lat, lng, zoom });
      } catch (err) {
        setCaptureError(
          err instanceof Error ? err.message : "Failed to capture aerial image",
        );
      } finally {
        setCapturing(false);
      }
    },
    [map, onChange],
  );

  const handleCapture = useCallback(async () => {
    if (!siteAddress.trim()) {
      setCaptureError("Enter a site address first");
      return;
    }
    setCapturing(true);
    setCaptureError(null);
    try {
      const res = await fetch(
        `/api/maps/geocode?address=${encodeURIComponent(siteAddress)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Geocoding failed");
      await captureAt(data.lat, data.lng, map.zoom || 20);
    } catch (err) {
      setCaptureError(
        err instanceof Error ? err.message : "Failed to capture aerial image",
      );
      setCapturing(false);
    }
  }, [siteAddress, map.zoom, captureAt]);

  const handleZoom = useCallback(
    (delta: number) => {
      if (map.lat == null || map.lng == null) return;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, map.zoom + delta));
      if (newZoom === map.zoom) return;
      captureAt(map.lat, map.lng, newZoom);
    },
    [map, captureAt],
  );

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const raw = ev.target?.result as string;
        const url = await compressImageDataUrl(raw);
        onChange({ ...map, imageUrl: url });
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

  return (
    <div className={styles.wrap}>
      <div className={styles.actions}>
        <Button variant="outline" size="sm" onClick={handleCapture} disabled={capturing}>
          {capturing ? "Capturing…" : map.imageUrl ? "Recapture aerial" : "Capture aerial"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()}>
          Upload aerial
        </Button>
        {map.imageUrl && map.lat != null && (
          <div className={styles.zoomControls}>
            <Button variant="ghost" size="sm" onClick={() => handleZoom(-1)} disabled={capturing}>
              −
            </Button>
            <span className={styles.zoomLabel}>Zoom</span>
            <Button variant="ghost" size="sm" onClick={() => handleZoom(1)} disabled={capturing}>
              +
            </Button>
          </div>
        )}
        <input
          ref={uploadInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleUpload}
        />
      </div>

      {captureError && <div className={styles.error}>{captureError}</div>}

      {map.imageUrl ? (
        <>
          <div
            ref={imageContainerRef}
            className={styles.imageWrap}
            onClick={handleImageClick}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={map.imageUrl} alt="Site aerial" className={styles.image} />
            {map.points.map((p, i) => (
              <div
                key={p.id}
                className={styles.pin}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                onClick={(e) => e.stopPropagation()}
              >
                {i + 1}
              </div>
            ))}
          </div>
          <div className={styles.hint}>
            Click the aerial to drop a numbered point, then give it a note and tie
            it to a stage below.
          </div>

          {map.points.length > 0 && (
            <div className={styles.pointList}>
              {map.points.map((p, i) => (
                <div key={p.id} className={styles.pointRow}>
                  <span className={styles.pointNumber}>{i + 1}</span>
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
                    onChange={(e) =>
                      updatePoint(p.id, { stageId: e.target.value || null })
                    }
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
        <div className={styles.emptyHint}>
          No aerial image yet — capture one from the site address or upload your own.
        </div>
      )}
    </div>
  );
}
