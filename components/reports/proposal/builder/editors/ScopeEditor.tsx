"use client";
// Scope: inclusions and exclusions, one per line.

import { TextAreaField } from "./fields";
import { patch, type BuilderCtx } from "../context";

export default function ScopeEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update } = ctx;
  return (
    <>
      <TextAreaField
        label="Included · one per line"
        rows={8}
        value={p.scope.inc}
        onChange={(v) => patch(update, "scope", { inc: v })}
      />
      <TextAreaField
        label="Excluded · one per line"
        rows={6}
        value={p.scope.exc}
        onChange={(v) => patch(update, "scope", { exc: v })}
      />
    </>
  );
}
