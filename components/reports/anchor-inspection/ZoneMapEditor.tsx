"use client";
/// <reference types="google.maps" />
// components/reports/anchor-inspection/ZoneMapEditor.tsx

import React, { useState, useRef, useCallback, useEffect } from "react";
import styles from "./ZoneMapEditor.module.css";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import AnchorPinModal from "./AnchorPinModal";
import MapLegend from "./MapLegend";
import { loadGoogleMaps } from "@/lib/reports/googleMapsLoader";
import {
  ANCHOR_SUBTYPE_LABELS,
  ANCHOR_TYPE_COLOURS,
  ANCHOR_TYPE_LABELS,
  ANCHOR_TYPE_OPTIONS,
  ANCHOR_TYPE_SUBTYPES,
  computeStaticLineEdges,
  generateId,
  type AnchorPoint,
  type AnchorSubtype,
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

// Close, near-overhead framing by default — a fresh zone should already be
// tight on the building in question, ready to capture with minimal manual
// adjustment, rather than opening zoomed out to the whole street.
const DEFAULT_ZOOM = 20;
const PREVIEW_WIDTH = 640;
const PREVIEW_HEIGHT = 400;
const PREVIEW_SIZE = `${PREVIEW_WIDTH}x${PREVIEW_HEIGHT}`;
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

// Google's satellite tiles are fixed north-up — there's no API to rotate the
// actual tile imagery (confirmed: setting tilt/heading on a live map has no
// effect outside a handful of major-metro "45° imagery" areas). Rotating the
// live map's own container via CSS was tried and reverted — Google's pan
// gestures compute deltas in the map's own unrotated coordinate space, so a
// visually-rotated map makes dragging go in the wrong direction, and the
// map's native zoom control (rendered inside that container) gets carried
// out of the visible viewport along with it. Both are real, unfixable
// limitations of transforming a widget Google controls internally — not
// bugs to patch around.
//
// So: the live map stays completely native (perfect pan/zoom, controls in
// their normal place). A thin rotated guide overlay (pointer-events: none)
// gives a straightedge to line up against while framing. The chosen angle
// is only actually applied once — baked into the captured bitmap the
// instant "Use This View" fires, at the image's full native resolution
// (not a fixed small size) so quality isn't lost.
function coverScaleForRotation(angleDeg: number, w: number, h: number): number {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  return Math.max((w * cos + h * sin) / w, (w * sin + h * cos) / h);
}

function rotateImageToDataUrl(
  imageUrl: string,
  angleDeg: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      // Full native resolution of the fetched capture (the static-map proxy
      // already requests scale=2, so this is real detail, not a guess) —
      // rotating into a smaller fixed canvas was silently downsampling the
      // image every time a rotation was applied.
      const targetRatio = PREVIEW_WIDTH / PREVIEW_HEIGHT;
      const w = img.naturalWidth;
      const h = Math.round(w / targetRatio);

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }

      // object-fit:cover-style crop of the source to the target aspect
      // ratio first, so a non-8:5 image doesn't get stretched.
      const srcRatio = img.naturalWidth / img.naturalHeight;
      let sx: number, sy: number, sw: number, sh: number;
      if (srcRatio > targetRatio) {
        sh = img.naturalHeight;
        sw = sh * targetRatio;
        sx = (img.naturalWidth - sw) / 2;
        sy = 0;
      } else {
        sw = img.naturalWidth;
        sh = sw / targetRatio;
        sx = 0;
        sy = (img.naturalHeight - sh) / 2;
      }

      const scale = coverScaleForRotation(angleDeg, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.rotate((angleDeg * Math.PI) / 180);
      ctx.scale(scale, scale);
      ctx.drawImage(img, sx, sy, sw, sh, -w / 2, -h / 2, w, h);

      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => reject(new Error("Failed to load captured image"));
    img.src = imageUrl;
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
  // Mirrors localZone so event handlers (e.g. pointerup after a drag) can
  // read the latest value directly and call `save` (which updates the
  // *parent's* state) without doing it from inside a setLocalZone updater —
  // updater functions must be pure, and calling another component's setState
  // from one trips React's "setState while rendering a different component"
  // check.
  const localZoneRef = useRef(localZone);
  useEffect(() => {
    localZoneRef.current = localZone;
  }, [localZone]);
  const [zoneName, setZoneName] = useState(zone.name);

  const [previewError, setPreviewError] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [captured, setCaptured] = useState<boolean>(!!zone.mapImageUrl);

  // Rotation, dialed in live while framing the shot in step 1 — applied to
  // the map's on-screen container as you set it, then baked into the
  // captured bitmap the moment "Use This View" fires. No separate step.
  const [mapRotation, setMapRotation] = useState(0);

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
  // Mount sub-option for the selected type (only meaningful when the type
  // has entries in ANCHOR_TYPE_SUBTYPES) — defaults to the first option
  // whenever the selected type changes.
  const [selectedSubtype, setSelectedSubtype] = useState<
    AnchorSubtype | undefined
  >(ANCHOR_TYPE_SUBTYPES[DEFAULT_TYPE]?.[0]);
  const selectType = useCallback((type: AnchorType) => {
    setSelectedType(type);
    setSelectedSubtype(ANCHOR_TYPE_SUBTYPES[type]?.[0]);
  }, []);
  const [editingAnchor, setEditingAnchor] = useState<AnchorPoint | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  // "Close Loop" mode — armed from the last-placed static-line anchor;
  // tapping another static-line pin while armed connects the two instead of
  // opening its edit modal. Covers loops and any other non-sequential join.
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const dragState = useRef<{
    anchorId: string;
    startX: number;
    startY: number;
    moved: boolean;
    startZone: Zone;
  } | null>(null);

  const save = useCallback((updated: Zone) => onUpdate(updated), [onUpdate]);

  // ── Undo/redo for pin actions (place, edit, delete, connect, drag) ───────
  // Not used for zone setup (capture/upload/rename) — scoped to anchor
  // edits only, so it matches "step back through what I just did to the
  // pins" rather than the whole zone's history.
  const MAX_HISTORY = 50;
  const [undoStack, setUndoStack] = useState<Zone[]>([]);
  const [redoStack, setRedoStack] = useState<Zone[]>([]);

  // Records `previous` (the state right before the change about to be
  // applied) and clears the redo stack, as any fresh action normally would.
  const pushHistory = useCallback((previous: Zone) => {
    setUndoStack((stack) => [...stack.slice(-MAX_HISTORY + 1), previous]);
    setRedoStack([]);
  }, []);

  // Reads localZoneRef (not localZone) for the same reason save() does
  // elsewhere in this file — avoids calling setState from inside another
  // state's functional updater.
  const handleUndo = useCallback(() => {
    setUndoStack((stack) => {
      if (stack.length === 0) return stack;
      const previous = stack[stack.length - 1];
      setRedoStack((redo) => [...redo, localZoneRef.current]);
      setLocalZone(previous);
      setZoneName(previous.name);
      save(previous);
      return stack.slice(0, -1);
    });
  }, [save]);

  const handleRedo = useCallback(() => {
    setRedoStack((stack) => {
      if (stack.length === 0) return stack;
      const next = stack[stack.length - 1];
      setUndoStack((undo) => [...undo, localZoneRef.current]);
      setLocalZone(next);
      setZoneName(next.name);
      save(next);
      return stack.slice(0, -1);
    });
  }, [save]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === "z" && e.shiftKey) {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
      } else if (e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo, handleRedo]);

  // Step 1's address — starts from the job's SimPRO address, but is always
  // manually searchable/correctable so a bad geocode or missing job address
  // is never a dead end (only escape hatch used to be Upload Aerial).
  const [searchInput, setSearchInput] = useState(jobAddress);
  const [activeAddress, setActiveAddress] = useState(jobAddress);
  const handleLocate = useCallback(() => {
    const trimmed = searchInput.trim();
    if (trimmed) {
      setActiveAddress(trimmed);
      setMapRotation(0);
    }
  }, [searchInput]);

  const hasAddress = !!activeAddress?.trim();

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

        // Only trust a stored position if it came from an actual confirmed
        // capture (mapImageUrl set) — otherwise it's a leftover from an
        // incomplete/stale session and re-geocoding from the (possibly
        // since-corrected) address is safer than trusting it.
        if (zone.mapImageUrl && zone.mapLat != null && zone.mapLng != null) {
          map.setCenter({ lat: zone.mapLat, lng: zone.mapLng });
          setLiveMapReady(true);
          return;
        }

        // Geocoded via our own server route (its own dedicated key/quota)
        // rather than the JS SDK's Geocoder, which is tied to whichever key
        // loaded the map script.
        const res = await fetch(
          `/api/maps/geocode?address=${encodeURIComponent(activeAddress)}`,
        );
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.lat != null && data.lng != null) {
          map.setCenter({ lat: data.lat, lng: data.lng });
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
        const liveZoom = liveMapRef.current.getZoom() ?? DEFAULT_ZOOM;
        capturedLat = center.lat();
        capturedLng = center.lng();

        // The static capture is a much smaller image than the live map's
        // on-screen size, and a Google zoom level defines real-world-area
        // per pixel — reusing the same zoom number on a smaller image shows
        // a smaller slice of the world (looks "more zoomed in" than what
        // was actually framed). Compensate by the size ratio so the capture
        // matches what was on screen.
        const containerWidth =
          liveMapContainerRef.current?.clientWidth || PREVIEW_WIDTH;
        const zoomAdjust = Math.log2(PREVIEW_WIDTH / containerWidth);
        capturedZoom = Math.max(
          1,
          Math.min(21, Math.round(liveZoom + zoomAdjust)),
        );

        url = buildStaticUrl({
          lat: capturedLat,
          lng: capturedLng,
          zoom: capturedZoom,
        });
      } else {
        capturedZoom = zoomLevel;
        url = buildStaticUrl({ address: activeAddress.trim(), zoom: capturedZoom });
      }

      let dataUrl = await urlToDataUrl(url);
      // Bake in whatever rotation was dialed in while framing — silently,
      // right here, no extra confirmation step.
      if (mapRotation !== 0) {
        dataUrl = await rotateImageToDataUrl(dataUrl, mapRotation);
      }

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
  }, [hasAddress, activeAddress, zoomLevel, mapRotation, localZone, zoneName, save]);

  // ── Re-capture ────────────────────────────────────────────────────────────

  const handleRecapture = useCallback(() => {
    const updated: Zone = { ...localZone, mapImageUrl: null };
    setLocalZone(updated);
    save(updated);
    setCaptured(false);
    setMapRotation(0);
  }, [localZone, save]);

  // ── Upload fallback — used as-is, no refine step ─────────────────────────

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
      const lastAnchor = localZone.anchors[localZone.anchors.length - 1];
      const anchor: AnchorPoint = {
        id: generateId(),
        x,
        y,
        label: `A${localZone.anchors.length + 1}`,
        type: selectedType,
        subtype: ANCHOR_TYPE_SUBTYPES[selectedType] ? selectedSubtype : undefined,
        commissionDate: "",
        inspectionDate: defaultInspectionDate,
        nextInspection: defaultNextInspection,
        result: "PASSED",
        // Placing static-line anchors back-to-back auto-connects them into
        // a chain — closing a loop later (Close Loop) adds an extra edge.
        connectsTo:
          selectedType === "static-line" && lastAnchor?.type === "static-line"
            ? [lastAnchor.id]
            : undefined,
      };
      const updated: Zone = {
        ...localZone,
        anchors: [...localZone.anchors, anchor],
      };
      pushHistory(localZone);
      setLocalZone(updated);
      save(updated);
    },
    [
      localZone,
      selectedType,
      selectedSubtype,
      defaultInspectionDate,
      defaultNextInspection,
      save,
      pushHistory,
    ],
  );

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragState.current?.moved) return;
    // Clicks bubble up from pin buttons too — ignore those, they're handled
    // by the pin's own pointer handlers (drag vs. tap-to-edit).
    if ((e.target as HTMLElement).closest(`.${styles.pin}`)) return;
    // Tapping empty space while "Close Loop" is armed cancels it rather
    // than placing a new pin — only tapping an existing pin can complete it.
    if (connectingFrom) {
      setConnectingFrom(null);
      return;
    }
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
    pushHistory(localZone);
    setLocalZone(updated);
    save(updated);
    setEditingAnchor(null);
  };

  // Deleting a pin closes the gap in the numbering (A4 becomes A3, etc.) so
  // the register never skips a number — but only for labels still on the
  // default "A{n}" pattern. A label a tech has manually retyped to
  // something else is left alone rather than silently overwritten.
  const AUTO_LABEL_RE = /^A\d+$/;
  const handlePinDelete = (anchorId: string) => {
    if (connectingFrom === anchorId) setConnectingFrom(null);
    let seq = 0;
    const anchors = localZone.anchors
      .filter((a) => a.id !== anchorId)
      .map((a) => {
        // Drop any static-line edge pointing at the pin being deleted.
        const connectsTo = a.connectsTo?.filter((id) => id !== anchorId);
        const withCleanEdges =
          connectsTo?.length !== a.connectsTo?.length
            ? { ...a, connectsTo }
            : a;
        if (!AUTO_LABEL_RE.test(withCleanEdges.label)) return withCleanEdges;
        seq += 1;
        return { ...withCleanEdges, label: `A${seq}` };
      });
    const updated: Zone = { ...localZone, anchors };
    pushHistory(localZone);
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
        startZone: localZoneRef.current,
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

  // Completes "Close Loop": adds an edge from the armed anchor to whichever
  // static-line pin was tapped next. A no-op (just disarms) if they're the
  // same pin or it's already connected. Reads connectingFrom directly
  // (not via a setState updater) — save() updates the *parent's* state, and
  // calling that from inside another component's state updater trips
  // React's "setState while rendering a different component" check.
  const handleConnectTo = useCallback(
    (targetId: string) => {
      if (!connectingFrom || connectingFrom === targetId) {
        setConnectingFrom(null);
        return;
      }
      const from = connectingFrom;
      const updated: Zone = {
        ...localZone,
        anchors: localZone.anchors.map((a) => {
          if (a.id !== from) return a;
          const existing = a.connectsTo ?? [];
          if (existing.includes(targetId)) return a;
          return { ...a, connectsTo: [...existing, targetId] };
        }),
      };
      pushHistory(localZone);
      setLocalZone(updated);
      save(updated);
      setConnectingFrom(null);
    },
    [connectingFrom, localZone, save, pushHistory],
  );

  const handlePinPointerUp = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>, anchor: AnchorPoint) => {
      const ds = dragState.current;
      dragState.current = null;
      setDraggingId(null);
      if (!ds) return;

      if (ds.moved) {
        pushHistory(ds.startZone);
        save(localZoneRef.current);
      } else if (connectingFrom) {
        // Tapping a non-static-line pin while armed just cancels — only a
        // static-line target can complete the connection.
        if (anchor.type === "static-line") handleConnectTo(anchor.id);
        else setConnectingFrom(null);
      } else {
        setEditingAnchor(anchor);
      }
    },
    [save, connectingFrom, handleConnectTo, pushHistory],
  );

  const activeTypes = [
    ...new Set(localZone.anchors.map((a) => a.type)),
  ] as AnchorType[];

  const staticLineEdges = computeStaticLineEdges(localZone.anchors);
  const lastAnchor = localZone.anchors[localZone.anchors.length - 1];
  const canCloseLoop =
    selectedType === "static-line" &&
    !!lastAnchor &&
    lastAnchor.type === "static-line" &&
    localZone.anchors.filter((a) => a.type === "static-line").length > 1;
  const subtypeOptions = ANCHOR_TYPE_SUBTYPES[selectedType];

  return (
    <div className={styles.page}>
      {/* Top bar */}
      <div className={styles.topBar}>
        <IconButton
          variant="secondary"
          size="sm"
          onClick={onBack}
          aria-label="Back to report"
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/utility-outline/back.svg" alt="" width={18} height={18} />
          }
        />

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
          {captured && (
            <div className={styles.undoRedoGroup}>
              <button
                type="button"
                className={styles.undoRedoBtn}
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                aria-label="Undo"
                title="Undo (Ctrl+Z)"
              >
                ↺
              </button>
              <button
                type="button"
                className={styles.undoRedoBtn}
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                aria-label="Redo"
                title="Redo (Ctrl+Shift+Z)"
              >
                ↻
              </button>
            </div>
          )}

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

      {/* Step indicator — always visible so it's unambiguous which phase
          you're in and what's left. Rotate/crop is still "Set Aerial View"
          — framing the shot isn't done until it's confirmed. */}
      <div className={styles.stepBar}>
        <div
          className={`${styles.step} ${!captured ? styles.stepActive : styles.stepDone}`}
        >
          <span className={styles.stepCircle}>{captured ? "✓" : "1"}</span>
          <span className={styles.stepLabel}>Set Aerial View</span>
        </div>
        <span className={styles.stepConnector} />
        <div
          className={`${styles.step} ${captured ? styles.stepActive : styles.stepPending}`}
        >
          <span className={styles.stepCircle}>2</span>
          <span className={styles.stepLabel}>Place Anchors</span>
        </div>
      </div>

      {!captured && (
        <>
          {/* Address search — always available, not just on error, so a
              wrong/missing job address is never a dead end. */}
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
            >
              Locate
            </button>
          </div>

          <div className={styles.statusBar}>
            {!hasAddress ? (
              <span className={styles.statusInfo}>
                Search an address above, or upload an aerial screenshot
                directly.
              </span>
            ) : HAS_LIVE_MAPS ? (
              liveMapError ? (
                <span className={styles.statusError}>
                  ⚠ {liveMapError} — try a different search above, or upload
                  an aerial screenshot instead.
                </span>
              ) : !liveMapReady ? (
                <span className={styles.statusInfo}>📍 Locating address…</span>
              ) : (
                <span className={styles.statusInfo}>
                  <strong>Drag and scroll to frame the roof</strong>, then
                  click Use This View.
                </span>
              )
            ) : previewError ? (
              <span className={styles.statusError}>
                ⚠ Couldn&apos;t load satellite imagery for this address — try
                a different search above, or upload an aerial screenshot
                instead.
              </span>
            ) : (
              <span className={styles.statusInfo}>
                <strong>Scroll to zoom</strong> and frame the roof, then
                click Use This View.
              </span>
            )}
          </div>
        </>
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
              onClick={() => selectType(opt.value)}
            >
              <span
                className={styles.stampDot}
                style={{ background: ANCHOR_TYPE_COLOURS[opt.value] }}
              />
              {opt.label}
            </button>
          ))}

          {canCloseLoop && (
            <button
              type="button"
              className={`${styles.closeLoopBtn} ${connectingFrom ? styles.closeLoopBtnActive : ""}`}
              onClick={() =>
                setConnectingFrom((from) => (from ? null : (lastAnchor?.id ?? null)))
              }
              title="Connect the last static line anchor to another one — e.g. to close a loop"
            >
              {connectingFrom
                ? "Tap an anchor to connect…"
                : "⤾ Close Loop"}
            </button>
          )}
        </div>
      )}

      {/* Mount-type sub-picker — only for types with sub-options */}
      {captured && subtypeOptions && (
        <div className={styles.stampSubBar}>
          {subtypeOptions.map((st) => (
            <button
              key={st}
              type="button"
              className={`${styles.stampSubChip} ${
                selectedSubtype === st ? styles.stampSubChipActive : ""
              }`}
              style={
                selectedSubtype === st
                  ? {
                      borderColor: ANCHOR_TYPE_COLOURS[selectedType],
                      color: ANCHOR_TYPE_COLOURS[selectedType],
                    }
                  : {}
              }
              onClick={() => setSelectedSubtype(st)}
            >
              {ANCHOR_SUBTYPE_LABELS[st]}
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
                <div key="live-map" className={styles.liveMapWrap}>
                  {/* The map itself is never transformed — Google's own pan
                      gestures and native zoom control both assume an
                      unrotated container, so rotating this div breaks both
                      (confirmed the hard way). This is a straightedge guide
                      only, purely visual, clicks pass straight through it. */}
                  <div
                    className={styles.liveMapContainer}
                    ref={liveMapContainerRef}
                  />
                  {liveMapReady && !liveMapError && mapRotation !== 0 && (
                    <div
                      className={styles.rotateGuideOverlay}
                      style={{ transform: `rotate(${mapRotation}deg)` }}
                    >
                      <div className={styles.rotateGuideLineH} />
                      <div className={styles.rotateGuideLineV} />
                    </div>
                  )}
                  {liveMapReady && !liveMapError && (
                    <div className={styles.rotateControls}>
                      <button
                        type="button"
                        className={styles.rotateResetBtn}
                        onClick={() => setMapRotation(0)}
                        disabled={mapRotation === 0}
                        aria-label="Reset rotation"
                        title="Reset rotation"
                      >
                        ⟲
                      </button>
                      <input
                        type="range"
                        min={-180}
                        max={180}
                        step={1}
                        value={mapRotation}
                        onChange={(e) => setMapRotation(Number(e.target.value))}
                        className={styles.rotateSlider}
                        aria-label="Straighten angle, applied when captured"
                      />
                      <span className={styles.rotateValue}>{mapRotation}°</span>
                    </div>
                  )}
                </div>
              ) : (
                <div
                  key="static-preview"
                  className={styles.previewWrap}
                  ref={previewWrapRef}
                >
                  {!previewError && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={zoomLevel}
                      src={buildStaticUrl({
                        address: activeAddress.trim(),
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
              <div key="no-address" className={styles.mapSetup}>
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
                <p className={styles.mapSetupTitle}>No address set</p>
                <p className={styles.mapSetupSub}>
                  Search an address above, or upload an aerial screenshot
                  directly.
                </p>
              </div>
            )
          ) : (
            <div key="captured" className={styles.mapContainer}>
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

                {/* Static line cable path — every explicit connection
                    between static-line pins, chain or loop alike. Behind
                    the pins, ignores pointer events so it never blocks
                    placing/dragging. */}
                {staticLineEdges.length > 0 && (
                  <svg
                    className={styles.staticLineOverlay}
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {staticLineEdges.map((edge, i) => (
                      <line
                        key={i}
                        x1={edge.from.x}
                        y1={edge.from.y}
                        x2={edge.to.x}
                        y2={edge.to.y}
                        stroke={ANCHOR_TYPE_COLOURS["static-line"]}
                        strokeWidth={0.5}
                        vectorEffect="non-scaling-stroke"
                        strokeLinecap="round"
                      />
                    ))}
                  </svg>
                )}

                {/* Anchor pins */}
                {localZone.anchors.map((anchor) => (
                  <button
                    key={anchor.id}
                    className={`${styles.pin} ${
                      draggingId === anchor.id ? styles.pinDragging : ""
                    } ${connectingFrom === anchor.id ? styles.pinConnecting : ""} ${
                      connectingFrom &&
                      connectingFrom !== anchor.id &&
                      anchor.type === "static-line"
                        ? styles.pinConnectTarget
                        : ""
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

                {activeTypes.length > 0 && (
                  <div className={styles.legendOverlay}>
                    <MapLegend types={activeTypes} anchors={localZone.anchors} />
                  </div>
                )}
              </div>
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
