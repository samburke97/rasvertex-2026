"use client";
// components/reports/proposal/builder/SectionRail.tsx
// Left column of the Build step: every section with its live status, a
// toggle for optional ones, and a collapsed 56px strip mode.

import styles from "./BuildStep.module.css";
import type { BuilderCtx } from "./context";
import {
  SECTIONS,
  isSectionOn,
  sectionNumber,
  sectionStatus,
  visibleSections,
  type OptionalSectionId,
  type SectionId,
} from "@/lib/reports/proposal.types";

interface Props {
  ctx: BuilderCtx;
  sel: SectionId;
  open: boolean;
  onToggleOpen: () => void;
}

function PanelIcon({ collapse }: { collapse: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15" />
      <path d={collapse ? "m15.5 9.5-2.5 2.5 2.5 2.5" : "m12.5 9.5 2.5 2.5-2.5 2.5"} />
    </svg>
  );
}

export default function SectionRail({ ctx, sel, open, onToggleOpen }: Props) {
  const { p, update, select } = ctx;
  const visible = visibleSections(p);
  const readyN = visible.filter((s) => !sectionStatus(p, s.id).need).length;

  const toggle = (id: SectionId) =>
    update((prev) => ({ ...prev, on: { ...prev.on, [id]: !prev.on[id as OptionalSectionId] } }));

  if (!open) {
    return (
      <aside className={styles.railMini}>
        <button className={styles.railToggle} onClick={onToggleOpen} title="Show sections">
          <PanelIcon collapse={false} />
        </button>
        <div className={styles.miniList}>
          {visible.map((s) => {
            const st = sectionStatus(p, s.id);
            return (
              <button
                key={s.id}
                className={`${styles.miniBtn} ${sel === s.id ? styles.miniBtnSel : ""}`}
                title={`${s.name} · ${st.text}`}
                onClick={() => select(s.id, true)}
              >
                {sectionNumber(p, s.id) || "C"}
                <span className={styles.miniDot} style={{ background: st.color }} />
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  return (
    <aside className={styles.rail}>
      <div className={styles.railHead}>
        <span className={styles.railTitle}>Sections</span>
        <span className={styles.railMeta}>
          {readyN} / {visible.length} ready
          <button className={styles.railToggle} onClick={onToggleOpen} title="Hide sections">
            <PanelIcon collapse />
          </button>
        </span>
      </div>
      <div className={styles.railList}>
        {SECTIONS.map((s) => {
          const on = isSectionOn(p, s.id);
          const st = sectionStatus(p, s.id);
          return (
            <div
              key={s.id}
              className={`${styles.railItem} ${sel === s.id ? styles.railItemSel : ""}`}
              onClick={() => select(s.id, true)}
            >
              <span className={styles.railNum}>{on ? sectionNumber(p, s.id) || "—" : ""}</span>
              <span className={`${styles.railText} ${on ? "" : styles.railOff}`}>
                <span className={styles.railName}>{s.name}</span>
                <span className={styles.railStatus} style={{ color: st.color }}>
                  <span className={styles.dot} style={{ background: st.color }} />
                  {st.text}
                </span>
              </span>
              {s.optional && (
                <button
                  className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
                  title="Include in proposal"
                  aria-pressed={on}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(s.id);
                  }}
                >
                  <span className={styles.knob} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
