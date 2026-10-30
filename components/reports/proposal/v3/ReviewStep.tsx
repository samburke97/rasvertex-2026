"use client";
// Step 3 — Review panel: checks, summary, Export PDF (download) and Save to
// SimPRO (the quote's and/or the site's attachments). The PDF is rendered on
// the server from the same page components as the preview.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Builder.module.css";
import type { BuilderCtx } from "./ctx";
import { InfoTip } from "./fields";
import { money, reviewChecks } from "@/lib/reports/proposal/v3/derive";
import type { PageId } from "@/lib/reports/proposal/v3/types";

type Saved = { quote: string; site: string; filename: string };

const defaultName = (ctx: BuilderCtx) => `Proposal - ${ctx.p.job.client || ctx.p.job.building} - Q${ctx.p.job.quote}`;

async function renderPdf(ctx: BuilderCtx, body: Record<string, unknown>) {
  const res = await fetch("/api/reports/export-proposal-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report: ctx.p, ...body }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data?.error ?? "PDF generation failed.");
  }
  return res;
}

export default function ReviewStep({ ctx, onFix, onBack }: { ctx: BuilderCtx; onFix: (id: PageId) => void; onBack: () => void }) {
  const { p, D } = ctx;
  const checks = reviewChecks(p, D);
  const issues = checks.filter((c) => c.ok === false).length;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);

  // Export PDF: just the download.
  const exportPdf = async () => {
    if (issues || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await renderPdf(ctx, {});
      const filename = decodeURIComponent(res.headers.get("X-Filename") ?? `${defaultName(ctx)}.pdf`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF generation failed.");
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
        {saved && <SavedNote saved={saved} ctx={ctx} />}
        {error && <div className={styles.exportErr}>{error}</div>}
        <button className={`${styles.darkPill} ${styles.exportBtn}`} disabled={!!issues} onClick={() => setSaving(true)}>
          Save to SimPRO
        </button>
        <button className={styles.ghostPill} disabled={!!issues || busy} onClick={exportPdf}>
          {busy ? "Exporting…" : "Download PDF"}
        </button>
        <button className={styles.ghostPill} onClick={onBack}>
          Back to editing
        </button>
      </div>
      {saving && (
        <SaveModal
          ctx={ctx}
          onClose={() => setSaving(false)}
          onSaved={(r) => {
            setSaved(r);
            setSaving(false);
          }}
        />
      )}
    </aside>
  );
}

function SavedNote({ saved, ctx }: { saved: Saved; ctx: BuilderCtx }) {
  const ok = [saved.quote === "yes" && `quote ${ctx.p.job.quote}`, saved.site === "yes" && "the site"].filter(Boolean);
  const failed = [saved.quote === "error" && "the quote", saved.site === "error" && "the site"].filter(Boolean);
  return (
    <>
      {ok.length > 0 && (
        <div className={styles.exported}>
          “{saved.filename}” saved to {ok.join(" and ")} in SimPRO.
        </div>
      )}
      {failed.length > 0 && <div className={styles.exportErr}>Couldn’t save to {failed.join(" or ")}. Try again in a moment.</div>}
    </>
  );
}

/** Save to SimPRO: filename and destinations. A same-name file is replaced. */
function SaveModal({ ctx, onClose, onSaved }: { ctx: BuilderCtx; onClose: () => void; onSaved: (r: Saved) => void }) {
  const hasSite = !!ctx.p.siteId;
  const [name, setName] = useState(defaultName(ctx));
  const [quote, setQuote] = useState(true);
  const [site, setSite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, busy]);

  const save = async () => {
    if (busy || (!quote && !site) || !name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await renderPdf(ctx, { filename: name.trim(), destinations: { quote, site } });
      onSaved({
        quote: res.headers.get("X-Saved-To-Quote") ?? "no",
        site: res.headers.get("X-Saved-To-Site") ?? "no",
        filename: decodeURIComponent(res.headers.get("X-Filename") ?? name),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t save to SimPRO.");
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className={`${styles.vars} ${styles.modalBack}`} onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className={`${styles.modal} ${styles.saveModal}`} role="dialog" aria-label="Save to SimPRO">
        <div className={styles.modalHead}>
          <div>
            <b>Save to SimPRO</b>
            <small>Quote {ctx.p.job.quote} · {ctx.p.job.client}</small>
          </div>
          <button className={styles.modalClose} onClick={onClose} disabled={busy} aria-label="Close">
            ×
          </button>
        </div>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>
            File name
            <InfoTip>Saving again with the same name replaces the earlier file, so the quote always has the latest version.</InfoTip>
          </span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Save to</span>
          <label className={styles.check}>
            <input type="checkbox" checked={quote} onChange={(e) => setQuote(e.target.checked)} />
            <span>
              <b>Quote attachments</b>
              <small>Quote {ctx.p.job.quote}</small>
            </span>
          </label>
          <label className={`${styles.check} ${hasSite ? "" : styles.checkOff}`}>
            <input type="checkbox" checked={site} disabled={!hasSite} onChange={(e) => setSite(e.target.checked)} />
            <span>
              <b>Site attachments</b>
              <small>{hasSite ? "Shows in the Customer Portal" : "This quote has no site in SimPRO"}</small>
            </span>
          </label>
        </div>
        {error && <div className={styles.exportErr}>{error}</div>}
        <div className={styles.modalFoot}>
          <button className={styles.ghostPill} onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className={styles.darkPill} onClick={save} disabled={busy || (!quote && !site) || !name.trim()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
