"use client";
// Acceptance: who signs for the client, and for RAS-VERTEX.

import styles from "./Editors.module.css";
import { TextField } from "./fields";
import SignerSelect from "./SignerSelect";
import { patch, type BuilderCtx } from "../context";

export default function AcceptanceEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update } = ctx;
  return (
    <>
      <span className={styles.heading}>Client signatory</span>
      <TextField
        label="Name"
        value={p.accept.clientName}
        placeholder="Who signs for the client?"
        needs={!p.accept.clientName.trim()}
        onChange={(v) => patch(update, "accept", { clientName: v })}
      />
      <TextField
        label="Position"
        value={p.accept.clientRole}
        placeholder="e.g. Committee Chair"
        needs={!p.accept.clientRole.trim()}
        onChange={(v) => patch(update, "accept", { clientRole: v })}
      />
      {p.job.contact && (
        <button className={styles.link} onClick={() => patch(update, "accept", { clientName: p.job.contact })}>
          Use {p.job.contact}
        </button>
      )}
      <span className={styles.heading} style={{ marginTop: 6 }}>
        RAS-VERTEX signatory
      </span>
      <SignerSelect
        value={p.accept.rvSigner}
        order={["Phil Clark", "Sam Burke", "Shane Kidby"]}
        onChange={(v) => patch(update, "accept", { rvSigner: v })}
      />
    </>
  );
}
