"use client";
// components/reports/proposal/builder/StartStep.tsx — Screen 1: Quote.

import shell from "./ProposalBuilder.module.css";
import styles from "./StartStep.module.css";
import { patch, type BuilderCtx } from "./context";
import { fmtMoney, pricingSubtotal, type ProposalJob } from "@/lib/reports/proposal.types";

interface Props {
  ctx: BuilderCtx | null;
  quoteInput: string;
  setQuoteInput: (v: string) => void;
  loading: boolean;
  loadError: string | null;
  onLoad: () => void;
  loadingFolders: string[];
  onCreate: () => void;
}

const JOB_ROWS: [string, keyof ProposalJob][] = [
  ["Building", "building"],
  ["Client", "client"],
  ["Contact", "contact"],
  ["Site address", "site"],
  ["Prepared by", "sales"],
  ["Email", "email"],
];

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export default function StartStep({
  ctx,
  quoteInput,
  setQuoteInput,
  loading,
  loadError,
  onLoad,
  loadingFolders,
  onCreate,
}: Props) {
  const p = ctx?.p;
  const loaded = !!p && p.quote === quoteInput.trim();
  const itemCount = p ? p.pricing.centres.reduce((a, c) => a + c.items.length, 0) : 0;

  // Placeholders for photos still on their way in from SimPRO.
  const pending = p
    ? p.folders.reduce((n, id) => {
        if (!loadingFolders.includes(id)) return n;
        const expected = p.folderList.find((f) => f.id === id)?.count ?? 0;
        const have = p.photos.filter((ph) => ph.folderId === id).length;
        return n + Math.max(0, expected - have);
      }, 0)
    : 0;
  const expectedTotal = p
    ? p.folderList.filter((f) => p.folders.includes(f.id)).reduce((n, f) => n + f.count, 0)
    : 0;

  const toggleFolder = (id: string) => {
    if (!ctx) return;
    ctx.setPickFolder("all");
    ctx.update((prev) => ({
      ...prev,
      folders: prev.folders.includes(id) ? prev.folders.filter((x) => x !== id) : [...prev.folders, id],
    }));
  };

  return (
    <div className={styles.scroll}>
      <div className={styles.column}>
        <div className={styles.intro}>
          <h1 className={styles.h1}>New painting proposal</h1>
          <p className={styles.sub}>Enter the quote number to fill in the job details.</p>
        </div>

        <div className={styles.quoteRow}>
          <div className={styles.quoteBox}>
            <span className={styles.quotePrefix}>Quote #</span>
            <input
              className={styles.quoteInput}
              value={quoteInput}
              inputMode="numeric"
              autoFocus={!p}
              onChange={(e) => setQuoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onLoad();
              }}
            />
          </div>
          <button className={styles.loadBtn} onClick={onLoad} disabled={loading || !quoteInput.trim()}>
            {loading ? "Loading…" : loaded ? "Reload" : "Load"}
          </button>
        </div>

        {loadError && <div className={styles.error}>{loadError}</div>}

        {p && ctx && (
          <>
            <div className={styles.card}>
              {JOB_ROWS.map(([label, key]) => (
                <label key={key} className={styles.row}>
                  <span className={styles.rowLabel}>{label}</span>
                  <input
                    className={styles.rowInput}
                    value={p.job[key]}
                    onChange={(e) => patch(ctx.update, "job", { [key]: e.target.value })}
                  />
                </label>
              ))}
              <div className={`${styles.row} ${styles.rowStatic}`}>
                <span className={styles.rowLabel}>Price</span>
                <span className={styles.rowValue}>
                  {fmtMoney(pricingSubtotal(p))} ex GST · {itemCount} line items
                </span>
              </div>
              <div className={`${styles.row} ${styles.rowStatic} ${styles.rowTop}`}>
                <span className={styles.rowLabel}>Photo folders</span>
                <div className={styles.folderCol}>
                  {p.folderList.length > 0 ? (
                    <div className={styles.chips}>
                      {p.folderList.map((f) => (
                        <button
                          key={f.id}
                          className={`${styles.chip} ${p.folders.includes(f.id) ? styles.chipOn : ""}`}
                          onClick={() => toggleFolder(f.id)}
                        >
                          <FolderIcon />
                          <span>{f.name}</span>
                          <span className={styles.chipCount}>{f.count}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className={styles.poolSummary}>No photos attached to this quote in SimPRO.</span>
                  )}
                  {(ctx.pool.length > 0 || pending > 0) && (
                    <div className={styles.thumbs}>
                      {ctx.pool.map((ph) => (
                        <div key={ph.id} className={styles.thumb} style={{ backgroundImage: `url("${ph.url}")` }} />
                      ))}
                      {Array.from({ length: Math.min(pending, 24) }, (_, i) => (
                        <div key={`pending-${i}`} className={`${styles.thumb} ${styles.thumbLoading}`} />
                      ))}
                    </div>
                  )}
                  {p.folderList.length > 0 && (
                    <span className={styles.poolSummary}>
                      {p.folders.length
                        ? `${expectedTotal} photos from ${p.folders.length} folder${p.folders.length === 1 ? "" : "s"} will be available in the proposal`
                        : "Select at least one folder"}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className={styles.actions}>
              <button className={`${shell.darkPill} ${styles.createBtn}`} onClick={onCreate}>
                Create proposal
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
