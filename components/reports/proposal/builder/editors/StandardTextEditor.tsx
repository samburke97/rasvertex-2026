"use client";
// Standard company wording (the warranty): locked until the rep chooses to
// edit it for this proposal; null in the data means "standard wording".

import styles from "./Editors.module.css";
import { STD_WORDING } from "@/lib/reports/proposal.types";
import { patch, type BuilderCtx } from "../context";

export default function StandardTextEditor({ ctx, field }: { ctx: BuilderCtx; field: keyof typeof STD_WORDING }) {
  const { p, update } = ctx;
  const value = p.std[field];
  const locked = value == null;
  return (
    <>
      <div className={styles.lockCard}>
        <div className={styles.lockTitle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(23,23,26,0.6)" strokeWidth="2">
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
          </svg>
          {locked ? "Standard wording" : "Edited for this proposal"}
        </div>
        <span className={styles.note}>
          {locked
            ? "Same in every painting proposal. Only edit it if this job needs something different."
            : "Changes apply to this proposal only."}
        </span>
        {locked && (
          <button className={styles.lockBtn} onClick={() => patch(update, "std", { [field]: STD_WORDING[field] })}>
            Edit for this proposal
          </button>
        )}
      </div>
      {!locked && (
        <>
          <textarea
            className={styles.textarea}
            rows={14}
            value={value}
            onChange={(e) => patch(update, "std", { [field]: e.target.value })}
          />
          <button className={styles.link} style={{ fontSize: 13 }} onClick={() => patch(update, "std", { [field]: null })}>
            Reset to standard wording
          </button>
        </>
      )}
    </>
  );
}
