"use client";
// components/reports/hours-breakdown/HoursCell.tsx
//
// A cell of the Hours breakdown preview that shows its text and turns into a
// box when clicked. Kept out of HoursDocument, which the PDF routes render
// on the server, where hooks can't be imported.

import { useState } from "react";
import type { CellProps } from "./HoursDocument";

export default function HoursCell({ value, show, type = "text", right, onSave }: CellProps) {
  const [editing, setEditing] = useState(false);
  if (!onSave) return <span className={right ? "ar-r" : undefined}>{show}</span>;
  if (!editing)
    return (
      <span className={`hb-cell${right ? " ar-r" : ""}`} title="Click to edit" onClick={() => setEditing(true)}>
        {show || "—"}
      </span>
    );
  const done = (v: string) => {
    setEditing(false);
    if (v !== value) onSave(v);
  };
  return (
    <input
      className={`hb-input${right ? " ar-r" : ""}`}
      type={type}
      step={type === "number" ? "0.25" : undefined}
      autoFocus
      defaultValue={value}
      onBlur={(e) => done(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEditing(false);
      }}
    />
  );
}
