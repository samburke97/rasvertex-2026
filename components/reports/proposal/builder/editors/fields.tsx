"use client";
// components/reports/proposal/builder/editors/fields.tsx
// Small form primitives shared by the section editors.

import type { ReactNode } from "react";
import styles from "./Editors.module.css";
import type { BuilderCtx } from "../context";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  needs,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  needs?: boolean;
}) {
  return (
    <Field label={label}>
      <input
        className={`${styles.input} ${needs ? styles.needs : ""}`}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows,
  hint,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
  hint?: string;
  placeholder?: string;
}) {
  return (
    <Field label={label} hint={hint}>
      <textarea
        className={styles.textarea}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/** "All selected folders" / one folder — narrows the photo choices. */
export function FolderFilter({ ctx }: { ctx: BuilderCtx }) {
  const { p, pickFolder, setPickFolder } = ctx;
  return (
    <select className={styles.miniSelect} value={pickFolder} onChange={(e) => setPickFolder(e.target.value)}>
      <option value="all">All selected folders</option>
      {p.folderList
        .filter((f) => p.folders.includes(f.id))
        .map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
    </select>
  );
}

export function RemoveButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button className={styles.remove} title="Remove" onClick={onClick}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6">
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </button>
  );
}
