"use client";
// Introduction letter: greeting, body (blank line = new paragraph), signer.

import { Field, TextAreaField, TextField } from "./fields";
import SignerSelect from "./SignerSelect";
import { patch, type BuilderCtx } from "../context";

export default function IntroEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update } = ctx;
  return (
    <>
      <TextField label="Dear…" value={p.intro.greeting} onChange={(v) => patch(update, "intro", { greeting: v })} />
      <TextAreaField
        label="Letter"
        rows={16}
        value={p.intro.body}
        onChange={(v) => patch(update, "intro", { body: v })}
        hint="Leave a blank line between paragraphs. Dated today."
      />
      <Field label="Signed by">
        <SignerSelect
          value={p.intro.signer}
          extra={[p.job.sales]}
          onChange={(v) => patch(update, "intro", { signer: v })}
        />
      </Field>
    </>
  );
}
