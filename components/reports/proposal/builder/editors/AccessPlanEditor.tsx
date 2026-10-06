"use client";
// Access & Disruption Plan: click the aerial to drop pins (D1, D2…) for the
// active stage; with a pin selected, a stage chip reassigns it. Below: the
// pin list with notes, the intro, and the programme of stages.

import { useState } from "react";
import styles from "./Editors.module.css";
import { RemoveButton, TextAreaField } from "./fields";
import { patch, type BuilderCtx } from "../context";
import {
  AERIAL_FOLDER_ID,
  STAGE_COLORS,
  stageColor,
  uid,
  type AccessPoint,
  type AccessStage,
  type ProposalData,
} from "@/lib/reports/proposal.types";

export default function AccessPlanEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update, pool, photoUrl, captureAerial } = ctx;
  const a = p.access;
  const [activeStage, setActiveStage] = useState<string | null>(a.stages[0]?.id ?? null);
  const [selPin, setSelPin] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);

  const active = a.stages.find((s) => s.id === activeStage) ?? a.stages[0] ?? null;
  const setAccess = (fn: (x: ProposalData["access"]) => Partial<ProposalData["access"]>) =>
    update((prev) => ({ ...prev, access: { ...prev.access, ...fn(prev.access) } }));
  const setPoint = (id: string, change: Partial<AccessPoint>) =>
    setAccess((x) => ({ points: x.points.map((q) => (q.id === id ? { ...q, ...change } : q)) }));
  const setStage = (id: string, change: Partial<AccessStage>) =>
    setAccess((x) => ({ stages: x.stages.map((s) => (s.id === id ? { ...s, ...change } : s)) }));

  // Satellite captures first, then the job photos.
  const aerials = [...p.photos.filter((ph) => ph.folderId === AERIAL_FOLDER_ID), ...pool];
  const cycleAerial = () => {
    if (!aerials.length) return;
    const i = aerials.findIndex((ph) => ph.id === a.aerial);
    patch(update, "access", { aerial: aerials[(i + 1) % aerials.length].id });
  };
  const aerialSrc = photoUrl(a.aerial);

  const placePin = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
    const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
    setSelPin(null);
    setAccess((s) => ({ points: [...s.points, { id: uid(), x, y, stageId: active?.id ?? null, note: "" }] }));
  };

  const pins = a.points.map((pt, i) => ({ ...pt, label: `D${i + 1}`, color: stageColor(a.stages, pt.stageId) }));

  return (
    <>
      <div className={styles.row}>
        <span className={styles.label}>Plan</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className={styles.pillBtn}
            title="Undo last point"
            disabled={!a.points.length}
            onClick={() => {
              setSelPin(null);
              setAccess((s) => ({ points: s.points.slice(0, -1) }));
            }}
          >
            Undo
          </button>
          <button
            className={styles.pillBtn}
            disabled={capturing || !p.job.site.trim()}
            title="Capture a satellite view of the site address"
            onClick={async () => {
              setCapturing(true);
              await captureAerial().finally(() => setCapturing(false));
            }}
          >
            {capturing ? "Capturing…" : "Satellite"}
          </button>
          <button className={styles.pillBtn} disabled={!aerials.length} onClick={cycleAerial}>
            Change aerial
          </button>
        </div>
      </div>

      <div className={styles.chipRow}>
        {a.stages.map((st, i) => (
          <button
            key={st.id}
            className={`${styles.stageChip} ${active?.id === st.id ? styles.stageChipOn : ""}`}
            onClick={() => {
              setActiveStage(st.id);
              if (selPin) setPoint(selPin, { stageId: st.id });
            }}
          >
            <span className={styles.swatch} style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }} />
            {st.what || st.when}
          </button>
        ))}
      </div>

      <div
        className={styles.aerial}
        style={{ backgroundImage: aerialSrc ? `url("${aerialSrc}")` : undefined }}
        onClick={placePin}
      >
        {!aerialSrc && <span className={styles.aerialEmpty}>Capture a satellite view or pick a photo</span>}
        {pins.map((pn) => (
          <span
            key={pn.id}
            className={`${styles.aerialPin} ${selPin === pn.id ? styles.aerialPinSel : ""}`}
            style={{ left: `${pn.x}%`, top: `${pn.y}%`, background: pn.color }}
            onClick={(e) => {
              e.stopPropagation();
              setSelPin((s) => (s === pn.id ? null : pn.id));
            }}
          >
            {pn.label}
          </span>
        ))}
        <span className={styles.aerialHint}>
          {selPin
            ? "Pick a stage above to reassign"
            : `Click to add a drop for ${active ? active.what || active.when : "stage"}`}
        </span>
      </div>

      <div className={styles.box}>
        <div className={styles.boxHead}>
          <span className={styles.boxTitle}>Drop points</span>
          <span className={styles.count}>{pins.length}</span>
        </div>
        {pins.map((pn) => (
          <div
            key={pn.id}
            className={`${styles.pinRow} ${selPin === pn.id ? styles.pinRowSel : ""}`}
            onClick={() => setSelPin((s) => (s === pn.id ? null : pn.id))}
          >
            <span className={styles.pinLabel}>
              <span className={styles.swatch} style={{ width: 7, height: 7, background: pn.color }} />
              {pn.label}
            </span>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <input
                className={`${styles.ghostInput} ${styles.pinNote}`}
                value={pn.note}
                placeholder="e.g. North face"
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => setPoint(pn.id, { note: e.target.value })}
              />
              <span className={styles.pinStage}>
                {a.stages.find((s) => s.id === pn.stageId)?.what || "No stage"}
              </span>
            </div>
            <RemoveButton
              onClick={(e) => {
                e.stopPropagation();
                setSelPin(null);
                setAccess((s) => ({ points: s.points.filter((q) => q.id !== pn.id) }));
              }}
            />
          </div>
        ))}
      </div>

      <TextAreaField label="Intro" rows={3} value={a.intro} onChange={(v) => patch(update, "access", { intro: v })} />

      <span className={styles.label} style={{ marginBottom: -10 }}>
        Programme
      </span>
      <div className={styles.box}>
        {a.stages.map((st, i) => (
          <div key={st.id} className={styles.stageRow}>
            <span className={styles.swatch} style={{ background: STAGE_COLORS[i % STAGE_COLORS.length] }} />
            <input
              className={`${styles.ghostInput} ${styles.stageWhen}`}
              value={st.when}
              onChange={(e) => setStage(st.id, { when: e.target.value })}
            />
            <input className={styles.ghostInput} value={st.what} onChange={(e) => setStage(st.id, { what: e.target.value })} />
            <RemoveButton
              onClick={() =>
                setAccess((s) => ({
                  stages: s.stages.filter((x) => x.id !== st.id),
                  points: s.points.map((q) => (q.stageId === st.id ? { ...q, stageId: null } : q)),
                }))
              }
            />
          </div>
        ))}
        <button
          className={styles.addRow}
          onClick={() => setAccess((s) => ({ stages: [...s.stages, { id: uid(), when: "Weeks", what: "" }] }))}
        >
          + Add stage
        </button>
      </div>
    </>
  );
}
