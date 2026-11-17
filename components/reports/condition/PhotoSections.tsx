"use client";
// components/reports/condition/PhotoSections.tsx
//
// Job overview: group photos under a title ("Level 3 balcony – crack
// repairs") to show what was done where. New section → name it → click
// photos on the page to add or remove them → Done. Sections print first,
// each with its photos in the order picked; the rest follow.

import styles from "../shared/OptionsPanel.module.css";
import own from "./PhotoSections.module.css";
import type { PhotoSection } from "@/lib/reports/condition.types";

export default function PhotoSections({
  sections,
  onChange,
  picking,
  onPicking,
}: {
  sections: PhotoSection[];
  onChange: (next: PhotoSection[]) => void;
  /** The section whose photos are being picked on the page. */
  picking: string | null;
  onPicking: (id: string | null) => void;
}) {
  const set = (id: string, patch: Partial<PhotoSection>) => onChange(sections.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  const add = () => {
    const id = `s${Date.now().toString(36)}`;
    onChange([...sections, { id, title: "", note: "", photoIds: [] }]);
    onPicking(id);
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...sections];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };

  return (
    <div className={own.wrap}>
      <div className={styles.groupLabelRow}>
        <span className={styles.subLabel}>Sections</span>
      </div>
      {sections.map((s, i) => {
        const on = picking === s.id;
        return (
          <div key={s.id} className={`${own.card} ${on ? own.cardOn : ""}`}>
            <input
              className={styles.input}
              value={s.title}
              placeholder="Title, e.g. Level 3 balcony – crack repairs"
              autoFocus={on && !s.title}
              onChange={(e) => set(s.id, { title: e.target.value })}
            />
            <input
              className={styles.input}
              value={s.note}
              placeholder="What we did here (optional)"
              onChange={(e) => set(s.id, { note: e.target.value })}
            />
            <div className={own.row}>
              <span className={own.count}>
                {s.photoIds.length} photo{s.photoIds.length === 1 ? "" : "s"}
              </span>
              {sections.length > 1 && (
                <>
                  <button className={own.icon} onClick={() => move(i, -1)} disabled={i === 0} title="Move up" aria-label="Move up">
                    ↑
                  </button>
                  <button className={own.icon} onClick={() => move(i, 1)} disabled={i === sections.length - 1} title="Move down" aria-label="Move down">
                    ↓
                  </button>
                </>
              )}
              <button
                className={own.text}
                onClick={() => {
                  if (on) onPicking(null);
                  onChange(sections.filter((x) => x.id !== s.id));
                }}
              >
                Remove
              </button>
              <button className={`${own.pick} ${on ? own.pickOn : ""}`} onClick={() => onPicking(on ? null : s.id)}>
                {on ? "Done" : "Pick photos"}
              </button>
            </div>
            {on && <p className={own.hint}>Click photos on the page to add or remove them. They print in the order you pick.</p>}
          </div>
        );
      })}
      <button className={styles.addBtn} onClick={add}>
        + New section
      </button>
    </div>
  );
}
