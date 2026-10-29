"use client";
// Step 3 — Review panel: checks, summary, Export PDF. The PDF is rendered on
// the server from the same page components and attached to the SimPRO quote.

import { useState } from "react";
import styles from "./Builder.module.css";
import type { BuilderCtx } from "./ctx";
import { money, reviewChecks } from "@/lib/reports/proposal/v3/derive";
import type { PageId } from "@/lib/reports/proposal/v3/types";

export default function ReviewStep({ ctx, onFix, onBack }: { ctx: BuilderCtx; onFix: (id: PageId) => void; onBack: () => void }) {
  const { p, D } = ctx;
  const checks = reviewChecks(p, D);
  const issues = checks.filter((c) => c.ok === false).length;
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; saved: boolean; msg?: string } | null>(null);

  const exportPdf = async () => {
    if (issues || busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/reports/export-proposal-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: p, saveToQuote: true }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "PDF generation failed.");
      }
      const saved = res.headers.get("X-Saved-To-Quote") === "yes";
      const filename = decodeURIComponent(res.headers.get("X-Filename") ?? `Proposal - ${p.job.client} - Q${p.job.quote}.pdf`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setResult({ ok: true, saved });
    } catch (err) {
      setResult({ ok: false, saved: false, msg: err instanceof Error ? err.message : "PDF generation failed." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <aside className={styles.panel}>
      <div className={styles.reviewBody}>
        <div>
          <h1 className={styles.reviewTitle}>{issues ? `${issues} ${issues > 1 ? "things" : "thing"} to fix before sending` : "Ready to send"}</h1>
          <p className={styles.reviewSub}>{issues ? "Everything else checks out." : "This is exactly what the PDF will look like."}</p>
        </div>
        <div className={styles.checks}>
          {checks.map((c) => (
            <div key={c.title} className={styles.check}>
              <span
                className={styles.checkDot}
                style={{
                  background: c.ok ? "#e9f5ef" : c.info ? "rgba(0,0,0,0.045)" : "#fbf4e5",
                  color: c.ok ? "#3f8f68" : c.info ? "rgba(23,23,26,0.55)" : "#96731f",
                }}
              >
                {c.ok ? "✓" : c.info ? "i" : "!"}
              </span>
              <div className={styles.checkText}>
                <b>{c.title}</b>
                <small>{c.detail}</small>
              </div>
              {c.ok === false && c.fix && (
                <button className={styles.fix} onClick={() => onFix(c.fix!)}>
                  Fix
                </button>
              )}
            </div>
          ))}
        </div>
        <div className={styles.summary}>
          <div>
            <span>Pages</span>
            <span>{D.printCount} · A4</span>
          </div>
          <div>
            <span>Total (ex GST)</span>
            <span>{money(D.subtotal)}</span>
          </div>
          <div>
            <span>Dated</span>
            <span>{D.bound.date}</span>
          </div>
        </div>
      </div>
      <div className={styles.reviewFoot}>
        {result?.ok && (
          <div className={styles.exported}>
            {result.saved ? `PDF exported and saved to quote ${p.job.quote}.` : `PDF exported. It couldn't be attached to quote ${p.job.quote}, so attach the download manually.`}
          </div>
        )}
        {result && !result.ok && <div className={styles.exportErr}>{result.msg}</div>}
        <button className={`${styles.darkPill} ${styles.exportBtn}`} disabled={!!issues || busy} onClick={exportPdf}>
          {busy ? "Exporting…" : "Export PDF"}
        </button>
        <button className={styles.ghostPill} onClick={onBack}>
          Back to editing
        </button>
      </div>
    </aside>
  );
}
