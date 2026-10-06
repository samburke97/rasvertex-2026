"use client";
// Our Clients: sub paragraph, Google rating, and the client list.

import styles from "./Editors.module.css";
import { TextAreaField, TextField } from "./fields";
import { patch, type BuilderCtx } from "../context";

export default function ClientsEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update } = ctx;
  return (
    <>
      <TextAreaField label="Sub paragraph" rows={5} value={p.why.sub} onChange={(v) => patch(update, "why", { sub: v })} />
      <div className={styles.twoCol}>
        <TextField label="Google rating" value={p.why.rating} onChange={(v) => patch(update, "why", { rating: v })} />
        <TextField label="Reviews" value={p.why.reviews} onChange={(v) => patch(update, "why", { reviews: v })} />
      </div>
      <TextAreaField
        label="Clients · one per line"
        rows={9}
        value={p.why.clients}
        onChange={(v) => patch(update, "why", { clients: v })}
        hint="Clients with a logo in the library show their logo; others show their name."
      />
    </>
  );
}
