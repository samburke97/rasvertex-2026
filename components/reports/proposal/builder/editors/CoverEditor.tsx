"use client";
// Cover: photo from the selected folders, title, subtitle, validity.

import styles from "./Editors.module.css";
import { FolderFilter, TextField, Field } from "./fields";
import { patch, type BuilderCtx } from "../context";
import type { CoverValidity } from "@/lib/reports/proposal.types";

export default function CoverEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update, pickPool, goStart } = ctx;
  return (
    <>
      <div className={styles.field}>
        <div className={styles.row}>
          <span className={styles.label}>Cover photo</span>
          <FolderFilter ctx={ctx} />
        </div>
        {pickPool.length ? (
          <div className={styles.photoGrid}>
            {pickPool.map((ph) => (
              <button
                key={ph.id}
                className={`${styles.photoBtn} ${p.cover.photo === ph.id ? styles.photoSel : ""}`}
                style={{ backgroundImage: `url("${ph.url}")` }}
                title={ph.name}
                onClick={() => patch(update, "cover", { photo: ph.id })}
              />
            ))}
          </div>
        ) : (
          <div className={styles.empty}>No photos in the selected folders yet.</div>
        )}
      </div>
      <TextField label="Title" value={p.cover.title} onChange={(v) => patch(update, "cover", { title: v })} />
      <TextField label="Subtitle" value={p.cover.eyebrow} onChange={(v) => patch(update, "cover", { eyebrow: v })} />
      <Field label="Valid for">
        <select
          className={styles.select}
          value={p.cover.valid}
          onChange={(e) => patch(update, "cover", { valid: e.target.value as CoverValidity })}
        >
          <option value="14 days">14 days</option>
          <option value="30 days">30 days</option>
          <option value="60 days">60 days</option>
        </select>
      </Field>
      <a
        href="#"
        style={{ fontSize: 13, fontWeight: 500 }}
        onClick={(e) => {
          e.preventDefault();
          goStart();
        }}
      >
        Edit job details
      </a>
    </>
  );
}
