"use client";
// Trusted by the Coast: which of the six services to show, and the intro.

import styles from "./Editors.module.css";
import { TextAreaField } from "./fields";
import { patch, type BuilderCtx } from "../context";
import { SERVICES } from "@/lib/reports/proposal.types";

export default function ServicesEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update } = ctx;
  const toggle = (id: string) =>
    update((prev) => ({
      ...prev,
      services: {
        ...prev.services,
        hidden: prev.services.hidden.includes(id)
          ? prev.services.hidden.filter((x) => x !== id)
          : [...prev.services.hidden, id],
      },
    }));
  return (
    <>
      <span className={styles.note}>Standard services page. Untick any you don&apos;t want to show this client.</span>
      <div className={styles.box}>
        {SERVICES.map((s) => {
          const on = !p.services.hidden.includes(s.id);
          return (
            <div key={s.id} className={`${styles.svcRow} ${on ? "" : styles.svcOff}`} onClick={() => toggle(s.id)}>
              <div className={styles.svcThumb} style={{ backgroundImage: `url("${s.img}")` }} />
              <span className={styles.svcName}>{s.name}</span>
              <span className={`${styles.check} ${on ? styles.checkOn : ""}`}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
                  <path d="m5 12 5 5 9-10" />
                </svg>
              </span>
            </div>
          );
        })}
      </div>
      <TextAreaField
        label="Intro"
        rows={4}
        value={p.services.intro}
        onChange={(v) => patch(update, "services", { intro: v })}
      />
    </>
  );
}
