"use client";
// components/reports/proposal/builder/ProposalPreview.tsx
// The middle column of the Build step: the 1440px proposal document, never
// reflowed — scaled with CSS zoom to fit whatever width the column has
// (zoom = clamp(0.15, (width − 48) / 1440, 1)), re-fitting whenever the
// column resizes (window resize, section rail collapsing).

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./BuildStep.module.css";
import ProposalDocument, { type ProposalDocAssets } from "./ProposalDocument";
import type { BuilderCtx } from "./context";
import {
  CLIENT_LOGOS,
  CLIENT_LOGO_DIR,
  SERVICES,
  todayLong,
  type SectionId,
} from "@/lib/reports/proposal.types";

const DOC_WIDTH = 1440;

const ASSETS: ProposalDocAssets = {
  logo: "/reports/proposal/assets/logo-full.png",
  haymes: "/reports/proposal/assets/haymes.svg",
  dulux: "/reports/proposal/assets/dulux.svg",
  services: Object.fromEntries(SERVICES.map((s) => [s.id, s.img])),
};

// Only logos whose files actually load are used — others fall back to the
// client's name in text, same rule the PDF route applies.
let logoProbe: Promise<Record<string, string>> | null = null;
function probeClientLogos(): Promise<Record<string, string>> {
  logoProbe ??= Promise.all(
    Object.entries(CLIENT_LOGOS).map(
      ([name, { file }]) =>
        new Promise<[string, string] | null>((resolve) => {
          const url = CLIENT_LOGO_DIR + file;
          const img = new Image();
          img.onload = () => resolve([name, url]);
          img.onerror = () => resolve(null);
          img.src = url;
        }),
    ),
  ).then((rows) => Object.fromEntries(rows.filter((r): r is [string, string] => !!r)));
  return logoProbe;
}

interface Props {
  ctx: BuilderCtx;
  sel: SectionId;
  scrollReq: { id: SectionId; n: number } | null;
}

export default function ProposalPreview({ ctx, sel, scrollReq }: Props) {
  const ref = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(0.5);
  const [clientLogos, setClientLogos] = useState<Record<string, string>>({});

  useEffect(() => {
    let live = true;
    probeClientLogos().then((l) => live && setClientLogos(l));
    return () => {
      live = false;
    };
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      const z = Math.max(0.15, Math.min(1, (el.clientWidth - 48) / DOC_WIDTH));
      setZoom((prev) => (Math.abs(prev - z) > 0.003 ? z : prev));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Smooth-scroll to a section when the rail (or a review "Fix") asks.
  useEffect(() => {
    if (!scrollReq) return;
    const t = setTimeout(() => {
      const c = ref.current;
      const el = c?.querySelector(`[data-sec="${scrollReq.id}"]`);
      if (!c || !el) return;
      const top = el.getBoundingClientRect().top - c.getBoundingClientRect().top + c.scrollTop - 16;
      c.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }, 60);
    return () => clearTimeout(t);
  }, [scrollReq]);

  return (
    <main ref={ref} className={styles.preview}>
      <div className={styles.page} style={{ zoom }}>
        <ProposalDocument
          p={ctx.p}
          photoUrl={ctx.photoUrl}
          assets={ASSETS}
          clientLogos={clientLogos}
          today={todayLong()}
          selected={sel}
          onPick={(id) => ctx.select(id, false)}
        />
      </div>
    </main>
  );
}
