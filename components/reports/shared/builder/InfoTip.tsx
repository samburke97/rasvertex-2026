"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./InfoTip.module.css";

/** ⓘ with a hover / focus explanation. The bubble is portalled to the
 *  page body with fixed positioning, so no scrolling panel clips it; it sits
 *  above the icon, or below when there's no room, and stays on screen. */
export default function InfoTip({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [at, setAt] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const W = 260;
    const x = Math.max(8, Math.min(window.innerWidth - W - 8, r.left + r.width / 2 - W / 2));
    const below = r.top < 140;
    setAt({ x, y: below ? r.bottom + 8 : r.top - 8, below });
  };
  return (
    <span
      ref={ref}
      className={styles.tip}
      tabIndex={0}
      aria-label="More information"
      onMouseEnter={show}
      onMouseLeave={() => setAt(null)}
      onFocus={show}
      onBlur={() => setAt(null)}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 11v5.5M12 7.6v.4" strokeLinecap="round" />
      </svg>
      {at &&
        createPortal(
          <span
            className={styles.tipBody}
            role="tooltip"
            style={{ left: at.x, top: at.y, transform: at.below ? "none" : "translateY(-100%)" }}
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}
