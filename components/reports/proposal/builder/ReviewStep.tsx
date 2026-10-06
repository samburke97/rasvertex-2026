"use client";
// components/reports/proposal/builder/ReviewStep.tsx — Screen 3: Review.
// Checklist of anything missing (each with a jump back to its section),
// then Export PDF, which also attaches the PDF to the SimPRO quote.

import { useState } from "react";
import styles from "./ReviewStep.module.css";
import type { BuilderCtx } from "./context";
import {
  fmtMoney,
  pricingSubtotal,
  reviewChecks,
  todayLong,
  visibleSections,
  type SectionId,
} from "@/lib/reports/proposal.types";

type ExportState =
  | { phase: "idle" }
  | { phase: "exporting" }
  | { phase: "done"; savedToQuote: boolean }
  | { phase: "error"; message: string };

interface Props {
  ctx: BuilderCtx;
  onFix: (id: SectionId) => void;
  onBackToBuild: () => void;
}

export default function ReviewStep({ ctx, onFix, onBackToBuild }: Props) {
  const { p, photoUrl } = ctx;
  const [exp, setExp] = useState<ExportState>({ phase: "idle" });
  const checks = reviewChecks(p);
  const issues = checks.filter((c) => c.kind === "issue").length;
  const cover = photoUrl(p.cover.photo);

  const exportPdf = async () => {
    if (issues || exp.phase === "exporting") return;
    setExp({ phase: "exporting" });
    try {
      const res = await fetch("/api/reports/export-proposal-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: p, saveToQuote: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const filename = decodeURIComponent(res.headers.get("X-Filename") ?? "") || `Proposal Q${p.quote}.pdf`;
      const savedToQuote = res.headers.get("X-Saved-To-Quote") === "yes";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExp({ phase: "done", savedToQuote });
    } catch (err) {
      setExp({ phase: "error", message: err instanceof Error ? err.message : "Export failed" });
    }
  };

  return (
    <div className={styles.scroll}>
      <div className={styles.grid}>
        <div className={styles.main}>
          <div className={styles.intro}>
            <h1 className={styles.h1}>
              {issues ? `${issues} thing${issues > 1 ? "s" : ""} to fix before sending` : "Ready to send"}
            </h1>
            <p className={styles.sub}>
              {issues ? "Everything else checks out." : "Export the PDF and it saves to the quote."}
            </p>
          </div>
          <div className={styles.card}>
            {checks.map((c, i) => (
              <div key={i} className={styles.check}>
                <span
                  className={`${styles.mark} ${
                    c.kind === "ok" ? styles.markOk : c.kind === "info" ? styles.markInfo : styles.markIssue
                  }`}
                >
                  {c.kind === "ok" ? "✓" : c.kind === "info" ? "i" : "!"}
                </span>
                <div className={styles.checkText}>
                  <span className={styles.checkTitle}>{c.title}</span>
                  <span className={styles.checkDetail}>{c.detail}</span>
                </div>
                {c.fix && (
                  <button className={styles.fix} onClick={() => onFix(c.fix!)}>
                    {c.fixLabel ?? "Fix"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.side}>
          <div className={styles.card}>
            <div className={styles.coverImg} style={{ backgroundImage: cover ? `url("${cover}")` : undefined }} />
            <div className={styles.summary}>
              <div className={styles.sumTitle}>
                <span className={styles.sumName}>{p.cover.title}</span>
                <span className={styles.sumFor}>
                  For {p.job.contact}, {p.job.client}
                </span>
              </div>
              <div className={styles.sumRows}>
                <div className={styles.sumRow}>
                  <span>Sections</span>
                  <span>{visibleSections(p).length - 1} + cover</span>
                </div>
                <div className={styles.sumRow}>
                  <span>Total (ex GST)</span>
                  <span>{fmtMoney(pricingSubtotal(p))}</span>
                </div>
                <div className={styles.sumRow}>
                  <span>Dated</span>
                  <span>{todayLong()}</span>
                </div>
              </div>
            </div>
          </div>
          <button className={styles.export} disabled={!!issues || exp.phase === "exporting"} onClick={exportPdf}>
            {exp.phase === "exporting" ? "Exporting…" : "Export PDF"}
          </button>
          {exp.phase === "done" &&
            (exp.savedToQuote ? (
              <div className={styles.done}>PDF exported and saved to quote {p.quote}.</div>
            ) : (
              <div className={styles.warn}>PDF exported, but it couldn&apos;t be saved to quote {p.quote}.</div>
            ))}
          {exp.phase === "error" && <div className={styles.warn}>{exp.message}. Please try again.</div>}
          <button className={styles.secondary} onClick={onBackToBuild}>
            Back to editing
          </button>
        </div>
      </div>
    </div>
  );
}
