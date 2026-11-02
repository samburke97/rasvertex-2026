"use client";
// Adjust a photo in its frame: drag to move it, slide or scroll to zoom. The
// frame has the printed frame's shape and draws the photo the same way
// (photoPosStyle), so what's framed here is what prints.

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Slider from "@/components/ui/Slider";
import { photoPosStyle, type PhotoPos, type ReportPhoto } from "@/lib/reports/photos";
import { HeaderButton } from "./BuilderHeader";
import styles from "./CropModal.module.css";

const CENTRED: PhotoPos = { x: 50, y: 50, zoom: 1 };
const clamp = (v: number) => Math.max(0, Math.min(100, v));

interface Props {
  src: string;
  /** Width ÷ height of the printed frame. */
  aspect: number;
  pos?: PhotoPos;
  /** undefined: back to centred. */
  onDone: (pos: PhotoPos | undefined) => void;
  onClose: () => void;
}

export default function CropModal({ src, aspect, pos, onDone, onClose }: Props) {
  const [p, setP] = useState<PhotoPos>(pos ?? CENTRED);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const start = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  useEffect(() => {
    const im = new Image();
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight });
    im.src = src;
  }, [src]);

  const onDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    start.current = { px: e.clientX, py: e.clientY, x: p.x, y: p.y };
  };
  const onMove = (e: ReactPointerEvent) => {
    const s0 = start.current;
    const el = frame.current;
    if (!s0 || !el || !nat) return;
    const fw = el.clientWidth;
    const fh = el.clientHeight;
    const s = Math.max(fw / nat.w, fh / nat.h);
    // Distance (frame px) the focal point travels from 0 to 100 %: the cover
    // overflow, scaled by zoom, plus what the zoom itself pushes out. Moving
    // the photo right reveals its left, so the focal point falls.
    const z = p.zoom;
    const rx = fw * (z - 1) + (nat.w * s - fw) * z;
    const ry = fh * (z - 1) + (nat.h * s - fh) * z;
    setP((q) => ({
      ...q,
      x: rx > 0.5 ? clamp(s0.x - ((e.clientX - s0.px) / rx) * 100) : q.x,
      y: ry > 0.5 ? clamp(s0.y - ((e.clientY - s0.py) / ry) * 100) : q.y,
    }));
  };
  const onUp = () => {
    start.current = null;
  };

  const done = () =>
    onDone(
      p.x === 50 && p.y === 50 && p.zoom === 1
        ? undefined
        : { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10, zoom: Math.round(p.zoom * 100) / 100 },
    );

  return createPortal(
    <div className={styles.back} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal} role="dialog" aria-label="Adjust photo">
        <div className={styles.head}>
          <div>
            <b>Adjust photo</b>
            <small>Drag to move it in the frame. Zoom in to crop tighter.</small>
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div
          ref={frame}
          className={styles.frame}
          // Tall frames are narrowed so the whole frame fits on screen.
          style={{ aspectRatio: String(aspect), width: aspect < 1.2 ? `min(100%, calc(60vh * ${aspect}))` : undefined }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onWheel={(e) => setP((q) => ({ ...q, zoom: Math.max(1, Math.min(3, q.zoom - e.deltaY * 0.002)) }))}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="" draggable={false} style={{ width: "100%", height: "100%", display: "block", pointerEvents: "none", ...photoPosStyle(p) }} />
        </div>
        <div className={styles.bar}>
          <span>Zoom</span>
          <Slider min={1} max={3} step={0.01} value={p.zoom} onChange={(zoom) => setP({ ...p, zoom })} />
          <button className={styles.reset} onClick={() => setP(CENTRED)}>
            Reset
          </button>
        </div>
        <div className={styles.foot}>
          <HeaderButton onClick={onClose}>Cancel</HeaderButton>
          <HeaderButton primary onClick={done}>
            Done
          </HeaderButton>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** For supporting-photo grids: click a photo on the page to adjust it. The
 *  editor takes its shape from the clicked frame. Render `modal` once. */
export function usePhotoAdjust(photos: ReportPhoto[], onPos: (id: string, pos: PhotoPos | undefined) => void) {
  const [open, setOpen] = useState<{ id: string; aspect: number } | null>(null);
  const photo = open && photos.find((p) => p.id === open.id);
  return {
    adjust: (id: string, frame: HTMLElement) => {
      const box = frame.getBoundingClientRect();
      setOpen({ id, aspect: box.height ? box.width / box.height : 4 / 3 });
    },
    modal: photo ? (
      <CropModal
        src={photo.url}
        aspect={open.aspect}
        pos={photo.pos}
        onDone={(pos) => {
          onPos(photo.id, pos);
          setOpen(null);
        }}
        onClose={() => setOpen(null)}
      />
    ) : null,
  };
}
