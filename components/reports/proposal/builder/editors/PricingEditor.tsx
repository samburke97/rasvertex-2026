"use client";
// Pricing & Terms: totals-only vs chosen line items, cost centres (labels
// editable, items hidden from the client by default), deposit and claims.

import { useState } from "react";
import styles from "./Editors.module.css";
import { TextField } from "./fields";
import { patch, type BuilderCtx } from "../context";
import {
  centreTotal,
  fmtMoney,
  pricingGst,
  pricingSubtotal,
  type PricingCentre,
} from "@/lib/reports/proposal.types";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6" />
    </svg>
  );
}

export default function PricingEditor({ ctx }: { ctx: BuilderCtx }) {
  const { p, update, refreshPricing } = ctx;
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const sub = pricingSubtotal(p);
  const gst = pricingGst(p);

  const setCentre = (id: string, fn: (c: PricingCentre) => PricingCentre) =>
    update((prev) => ({
      ...prev,
      pricing: { ...prev.pricing, centres: prev.pricing.centres.map((c) => (c.id === id ? fn(c) : c)) },
    }));

  const toggleItem = (centreId: string, itemId: string, show: boolean) =>
    update((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        // Showing an item only means something with line items on.
        mode: show ? "lines" : prev.pricing.mode,
        centres: prev.pricing.centres.map((c) =>
          c.id === centreId
            ? { ...c, items: c.items.map((it) => (it.id === itemId ? { ...it, show } : it)) }
            : c,
        ),
      },
    }));

  return (
    <>
      <div className={styles.field}>
        <span className={styles.label}>In the PDF, show</span>
        <div className={styles.seg}>
          <button
            className={`${styles.segBtn} ${p.pricing.mode === "totals" ? styles.segOn : ""}`}
            onClick={() => patch(update, "pricing", { mode: "totals" })}
          >
            Totals only
          </button>
          <button
            className={`${styles.segBtn} ${p.pricing.mode === "lines" ? styles.segOn : ""}`}
            onClick={() => patch(update, "pricing", { mode: "lines" })}
          >
            Totals + chosen items
          </button>
        </div>
      </div>

      <div className={styles.box}>
        {p.pricing.centres.length === 0 && <div className={styles.empty}>No priced items on this quote.</div>}
        {p.pricing.centres.map((c) => {
          const isOpen = !!open[c.id];
          const shown = c.items.filter((i) => i.show).length;
          return (
            <div key={c.id} className={styles.centre}>
              <div className={styles.centreHead}>
                <button className={styles.chevBtn} onClick={() => setOpen((o) => ({ ...o, [c.id]: !o[c.id] }))}>
                  <svg
                    className={`${styles.chev} ${isOpen ? styles.chevOpen : ""}`}
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                <input
                  className={`${styles.ghostInput} ${styles.centreLabel}`}
                  value={c.label}
                  onChange={(e) => setCentre(c.id, (x) => ({ ...x, label: e.target.value }))}
                />
              </div>
              <div className={styles.centreMeta}>
                <span>
                  {c.items.length} line items · {shown ? `${shown} shown` : "all hidden"}
                </span>
                <span className={styles.money}>{fmtMoney(centreTotal(c))}</span>
              </div>
              {isOpen && (
                <div className={styles.items}>
                  {c.items.map((it) => (
                    <div key={it.id} className={`${styles.item} ${it.show ? styles.itemShown : ""}`}>
                      <span className={styles.itemName}>{it.name}</span>
                      <span className={styles.itemAmt}>{fmtMoney(it.amt)}</span>
                      <button
                        className={`${styles.eye} ${it.show ? styles.eyeOn : ""}`}
                        title={it.show ? "Shown in PDF" : "Hidden from client"}
                        onClick={() => toggleItem(c.id, it.id, !it.show)}
                      >
                        <EyeIcon open={it.show} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <div className={styles.totals}>
          <div className={styles.totalRow}>
            <span>Total (ex GST)</span>
            <span>{fmtMoney(sub)}</span>
          </div>
          <div className={styles.totalRow}>
            <span>GST</span>
            <span>{fmtMoney(gst)}</span>
          </div>
          <div className={`${styles.totalRow} ${styles.totalStrong}`}>
            <span>Total incl. GST</span>
            <span>{fmtMoney(sub + gst)}</span>
          </div>
        </div>
      </div>

      <button
        className={styles.link}
        disabled={syncing}
        onClick={async () => {
          setSyncing(true);
          await refreshPricing().finally(() => setSyncing(false));
        }}
      >
        {syncing ? "Refreshing…" : "Refresh pricing from quote"}
      </button>

      <div className={styles.depositGrid}>
        <TextField label="Deposit %" value={p.pricing.deposit} onChange={(v) => patch(update, "pricing", { deposit: v })} />
        <TextField label="Progress claims" value={p.pricing.terms} onChange={(v) => patch(update, "pricing", { terms: v })} />
      </div>
    </>
  );
}
