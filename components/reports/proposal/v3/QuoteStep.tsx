"use client";
// Step 1 — Quote: load the quote, confirm the job, pick the photo folders.

import { useMemo } from "react";
import styles from "./Builder.module.css";
import type { BuilderCtx } from "./ctx";
import { InfoTip } from "./fields";
import { JOB_FIELDS, LIBRARY_FOLDERS, TRADES, type Trade } from "@/lib/reports/proposal/v3/types";
import { applySurvey, enabledPhotos, taggedPhotos, untaggedExamples } from "@/lib/reports/proposal/v3/survey";

interface Props {
  ctx: BuilderCtx | null;
  quoteInput: string;
  setQuoteInput: (v: string) => void;
  loading: boolean;
  loadError: string | null;
  onLoad: () => void;
  onReset: () => void;
  loadingFolders: string[];
  onOpen: () => void;
  trade: Trade;
  onTrade: (t: Trade) => void;
}

export default function QuoteStep({ ctx, quoteInput, setQuoteInput, loading, loadError, onLoad, onReset, loadingFolders, onOpen, trade, onTrade }: Props) {
  const p = ctx?.p;
  const tagged = useMemo(() => (p ? taggedPhotos(p) : []), [p]);

  const chips = p
    ? [
        ...p.simpro.folders.map((f) => ({ id: f.id, name: f.name, count: f.count })),
        ...LIBRARY_FOLDERS.map((f) => ({ id: f.id, name: f.name, count: f.photos.length })),
      ]
    : [];
  const available = ctx ? ctx.folders.reduce((a, f) => a + f.photos.length, 0) + ctx.p.uploads.length : 0;
  const read = p ? enabledPhotos(p).length : 0;
  const examples = useMemo(() => (p ? untaggedExamples(p) : []), [p]);
  const reportOn = p?.d.findings.style === "report";
  const surveyHint = loadingFolders.length
    ? "Reading photo tags…"
    : !read
      ? "Findings use standard style: a photo, a title and points. Turn on the quote’s survey folder to use its photos."
      : tagged.length
        ? reportOn
          ? `Findings in report style, from ${tagged.length} of ${read} photos that are tagged.`
          : `${tagged.length} of ${read} photos are tagged. Use report style to add defect codes, Flagged issues and Pre-start pages.`
        : `None of the ${read} photos are tagged, so findings use standard style. Tags are read from the file name, like “D1 L2 U403 SH - comment”.`;

  return (
    <div className={styles.quote}>
      <div className={styles.quoteCol}>
        <div>
          <h1 className={styles.h1}>New proposal</h1>
          <p className={styles.lead}>Choose the proposal type, then enter the quote number to fill in the job details.</p>
        </div>

        <div className={styles.tradeRow}>
          <div className={styles.seg}>
            {(["painting", "waterproofing"] as Trade[]).map((t) => (
              <button key={t} className={trade === t ? styles.segOn : ""} onClick={() => onTrade(t)}>
                {TRADES[t].label}
              </button>
            ))}
          </div>
          <InfoTip>
            Sets the wording, photos, products and warranty: painting 8 years, waterproofing 7. You can switch later; anything you’ve already edited is kept.
          </InfoTip>
        </div>

        <form
          className={styles.quoteRow}
          onSubmit={(e) => {
            e.preventDefault();
            onLoad();
          }}
        >
          <label className={styles.quoteBox}>
            <span>Quote #</span>
            <input value={quoteInput} onChange={(e) => setQuoteInput(e.target.value)} inputMode="numeric" autoFocus />
          </label>
          <button type="submit" className={styles.reload} disabled={loading}>
            {loading ? "Loading…" : "Reload"}
          </button>
        </form>
        {loadError && <span className={styles.error}>{loadError}</span>}

        {ctx && p && (
          <>
            <div className={styles.jobCard}>
              {JOB_FIELDS.map((f) => (
                <label key={f.key} className={styles.jobRow}>
                  <span>{f.label}</span>
                  <input
                    type={f.type}
                    value={p.job[f.key] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      ctx.update((prev) => ({ ...prev, job: { ...prev.job, [f.key]: v } }));
                    }}
                  />
                </label>
              ))}
              <div className={styles.folderRow}>
                <span>
                  Photo folders{" "}
                  <InfoTip>
                    Blue-dot folders are the quote’s photos in SimPRO, Unfiled included. Building and Team are our standard photos. Switch on any folder you want to pick from. You can change this later from any photo.
                  </InfoTip>
                </span>
                <div className={styles.folderCol}>
                  <div className={styles.chips}>
                    {chips.map((c) => {
                      const on = p.folders.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                          onClick={() =>
                            ctx.update((prev) => ({
                              ...prev,
                              folders: on ? prev.folders.filter((x) => x !== c.id) : [...prev.folders, c.id],
                            }))
                          }
                        >
                          {c.id.startsWith("sp:") && <span className={styles.spDot} />}
                          <span>{c.name}</span>
                          <span className={styles.chipCount}>{c.count}</span>
                        </button>
                      );
                    })}
                  </div>
                  <span className={styles.hint}>
                    {loadingFolders.length ? "Loading photos from SimPRO…" : `${available} photos available in the proposal`}
                  </span>
                  <span className={styles.hint}>
                    <button className={styles.linkBtn} disabled={ctx.reloading} onClick={() => ctx.reloadSimpro()}>
                      {ctx.reloading ? "Reloading…" : "↻ Reload photos from SimPRO"}
                    </button>
                  </span>
                </div>
              </div>
              <div className={styles.folderRow}>
                <span>Site survey</span>
                <div className={styles.folderCol}>
                  <span className={styles.hint}>{surveyHint}</span>
                  {!loadingFolders.length && !tagged.length && examples.length > 0 && (
                    <span className={styles.hint}>
                      {examples.map((x) => (
                        <span key={x.label} style={{ display: "block" }}>
                          “{x.label}”: {x.reason.toLowerCase()}
                        </span>
                      ))}
                    </span>
                  )}
                  {tagged.length > 0 && (
                    <button className={styles.surveyBtn} disabled={!!loadingFolders.length} onClick={() => ctx.update((prev) => applySurvey(prev))}>
                      {reportOn ? "Refill in report style" : "Use report style"}
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.quoteFoot}>
              <span className={styles.resetWrap}>
                <button className={`${styles.linkBtn} ${styles.danger}`} disabled={loading} onClick={onReset}>
                  Start again from SimPRO
                </button>
                <InfoTip>
                  Wipes every change on this quote (wording, photos, findings, prices and uploads) and builds the proposal fresh from SimPRO. “Reload” above only refreshes the job details and keeps your work.
                </InfoTip>
              </span>
              <button className={`${styles.darkPill} ${styles.openBtn}`} onClick={onOpen}>
                Open proposal
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
