"use client";
// RAS-VERTEX signatory picker, shared by Introduction and Acceptance.

import styles from "./Editors.module.css";
import { SIGNERS, titleFor } from "@/lib/reports/proposal.types";

export default function SignerSelect({
  value,
  onChange,
  extra = [],
  order = SIGNERS.map((s) => s.name),
}: {
  value: string;
  onChange: (v: string) => void;
  extra?: string[]; // e.g. the quote's salesperson, when not a standard signer
  order?: string[];
}) {
  const names = [...order];
  for (const n of [...extra, value]) if (n && !names.includes(n)) names.push(n);
  return (
    <select className={styles.select} value={value} onChange={(e) => onChange(e.target.value)}>
      {names.map((n) => (
        <option key={n} value={n}>
          {n}, {titleFor(n)}
        </option>
      ))}
    </select>
  );
}
