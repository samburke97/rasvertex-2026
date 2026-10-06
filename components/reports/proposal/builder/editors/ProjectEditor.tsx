"use client";
// Your Project: fact strip (type / access / start) and the overview.

import { TextAreaField, TextField } from "./fields";
import { patch, type BuilderCtx } from "../context";

const FACTS = [
  ["Building type", "type", "e.g. Residential high-rise"],
  ["Access method", "access", "e.g. Rope access"],
  ["Target start", "start", "e.g. January 2027"],
] as const;

export default function ProjectEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update } = ctx;
  return (
    <>
      {FACTS.map(([label, key, ph]) => (
        <TextField
          key={key}
          label={label}
          placeholder={ph}
          value={p.project[key]}
          onChange={(v) => patch(update, "project", { [key]: v })}
        />
      ))}
      <TextAreaField
        label="Overview"
        rows={12}
        value={p.project.summary}
        placeholder="Describe the building, its setting and why the scope is what it is."
        onChange={(v) => patch(update, "project", { summary: v })}
        hint="Leave a blank line between paragraphs."
      />
    </>
  );
}
