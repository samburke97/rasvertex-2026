"use client";
// Site Survey & Findings: inspection date, then any number of findings,
// each with a photo (tap to cycle through the filtered folder).

import styles from "./Editors.module.css";
import { FolderFilter, RemoveButton, TextField } from "./fields";
import { patch, type BuilderCtx } from "../context";
import { uid, type ProposalFinding } from "@/lib/reports/proposal.types";

export default function FindingsEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update, pickPool, pool, photoUrl, folderName } = ctx;
  const cyclePool = pickPool.length ? pickPool : pool;

  const setFinding = (id: string, change: Partial<ProposalFinding>) =>
    update((prev) => ({
      ...prev,
      findings: prev.findings.map((f) => (f.id === id ? { ...f, ...change } : f)),
    }));

  const cycle = (f: ProposalFinding) => {
    if (!cyclePool.length) return;
    const i = cyclePool.findIndex((ph) => ph.id === f.photo);
    setFinding(f.id, { photo: cyclePool[(i + 1) % cyclePool.length].id });
  };

  const add = () =>
    update((prev) => ({
      ...prev,
      findings: [
        ...prev.findings,
        {
          id: uid(),
          photo: cyclePool.length ? cyclePool[prev.findings.length % cyclePool.length].id : null,
          title: "",
          desc: "",
        },
      ],
    }));

  return (
    <>
      <div className={styles.row}>
        <span className={styles.note} style={{ color: "rgba(23,23,26,0.55)" }}>
          Tap a photo to cycle through
        </span>
        <FolderFilter ctx={ctx} />
      </div>
      <TextField
        label="Inspection date"
        placeholder="e.g. 29 September 2026"
        value={p.project.inspected}
        needs={!p.project.inspected.trim()}
        onChange={(v) => patch(update, "project", { inspected: v })}
      />
      {p.findings.map((f, i) => {
        const src = photoUrl(f.photo);
        const folderId = p.photos.find((ph) => ph.id === f.photo)?.folderId;
        return (
          <div key={f.id} className={styles.findingCard}>
            <div className={styles.findingTop}>
              <button
                className={styles.findingThumb}
                title="Change photo"
                style={{ backgroundImage: src ? `url("${src}")` : undefined }}
                onClick={() => cycle(f)}
              />
              <div className={styles.findingMain}>
                <div className={styles.findingTitleRow}>
                  <span className={styles.findingNum}>{String(i + 1).padStart(2, "0")}</span>
                  <input
                    className={`${styles.ghostInput} ${styles.findingTitle}`}
                    value={f.title}
                    placeholder="Defect, location"
                    onChange={(e) => setFinding(f.id, { title: e.target.value })}
                  />
                  <RemoveButton
                    onClick={() => update((prev) => ({ ...prev, findings: prev.findings.filter((x) => x.id !== f.id) }))}
                  />
                </div>
                <span className={styles.findingFolder}>{folderId ? folderName(folderId) : "No photo"}</span>
              </div>
            </div>
            <textarea
              className={styles.findingDesc}
              rows={2}
              value={f.desc}
              placeholder="What this means for the scope"
              onChange={(e) => setFinding(f.id, { desc: e.target.value })}
            />
          </div>
        );
      })}
      <button className={styles.addDashed} onClick={add}>
        + Add finding
      </button>
    </>
  );
}
