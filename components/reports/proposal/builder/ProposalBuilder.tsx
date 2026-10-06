"use client";
// components/reports/proposal/builder/ProposalBuilder.tsx
//
// Painting proposal builder: Quote → Build → Review.
//   Quote  — load the SimPRO quote, confirm the job details, pick the photo
//            folders the proposal can draw from.
//   Build  — section rail, live 1440px preview, editor for the selected
//            section.
//   Review — checklist of anything missing, then Export PDF (which also
//            attaches the PDF to the quote).
// The draft autosaves against the quote number, and loading the same quote
// again resumes it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./ProposalBuilder.module.css";
import StartStep from "./StartStep";
import BuildStep from "./BuildStep";
import ReviewStep from "./ReviewStep";
import type { BuilderCtx } from "./context";
import { streamPhotoImport } from "@/lib/reports/streamPhotoImport";
import { compressMapImageDataUrl } from "@/lib/reports/compressImage";
import { uploadReportPhoto } from "@/lib/reports/uploadPhoto";
import {
  AERIAL_FOLDER_ID,
  centresFromPricing,
  createProposal,
  isProposalData,
  uid,
  type PhotoFolderInfo,
  type ProposalData,
  type ProposalStep,
  type QuoteHeader,
  type QuotePricingRow,
  type SectionId,
} from "@/lib/reports/proposal.types";

interface Props {
  onBack: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_RETRY_MS = 5000;

// Folders picked by default on a brand-new proposal.
const DEFAULT_FOLDER = /site|inspect|defect|photo/i;

const STEPS: [ProposalStep, string][] = [
  ["start", "Quote"],
  ["build", "Build"],
  ["review", "Review"],
];

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export default function ProposalBuilder({ onBack }: Props) {
  const [p, setP] = useState<ProposalData | null>(null);
  const [step, setStep] = useState<ProposalStep>("start");
  const [quoteInput, setQuoteInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sel, setSel] = useState<SectionId>("cover");
  const [scrollReq, setScrollReq] = useState<{ id: SectionId; n: number } | null>(null);
  const [pickFolder, setPickFolder] = useState("all");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loadingFolders, setLoadingFolders] = useState<string[]>([]);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadGen = useRef(0);
  const startedFolders = useRef(new Set<string>());

  const update = useCallback((fn: (prev: ProposalData) => ProposalData) => {
    setP((prev) => (prev ? fn(prev) : prev));
  }, []);

  // ── Load (or resume) a quote ─────────────────────────────────────────────
  const loadQuote = useCallback(async () => {
    const quote = quoteInput.trim();
    if (!quote || loading) return;
    setLoading(true);
    setLoadError(null);

    const safe = (url: string) => fetch(url).catch(() => null);
    const [qRes, prRes, dRes, fRes] = await Promise.all([
      safe(`/api/simpro/quotes/${quote}`),
      safe(`/api/simpro/quotes/${quote}/pricing`),
      safe(`/api/proposal-reports/${quote}`),
      safe(`/api/simpro/quotes/${quote}/attachments/folders`),
    ]);

    try {
      if (!qRes?.ok) {
        const data = await qRes?.json().catch(() => ({}));
        throw new Error(data?.error ?? `Couldn't find quote ${quote} in SimPRO.`);
      }
      const header: QuoteHeader = await qRes.json();
      const pricing: QuotePricingRow[] = prRes?.ok ? await prRes.json() : [];
      const draftJson = dRes?.ok ? await dRes.json().catch(() => null) : null;
      const draft: ProposalData | null = isProposalData(draftJson?.report) ? draftJson.report : null;
      const folderList: PhotoFolderInfo[] | null = fRes?.ok
        ? ((await fRes.json()).folders ?? [])
        : null;

      let next: ProposalData;
      if (draft) {
        // The draft is the rep's own work — keep it, and only fill job
        // details it's missing from the live quote.
        const fresh = createProposal(quote, header, pricing);
        const job = { ...draft.job };
        (Object.keys(job) as (keyof typeof job)[]).forEach((k) => {
          if (!job[k]) job[k] = fresh.job[k];
        });
        next = { ...draft, quote, job };
      } else {
        next = createProposal(quote, header, pricing);
      }

      if (folderList) {
        const ids = new Set(folderList.map((f) => f.id));
        next.folderList = folderList;
        next.folders = draft
          ? next.folders.filter((id) => ids.has(id))
          : folderList.length === 1
            ? [folderList[0].id]
            : folderList.filter((f) => DEFAULT_FOLDER.test(f.name)).map((f) => f.id);
      }

      loadGen.current++;
      startedFolders.current = new Set();
      setLoadingFolders([]);
      setPickFolder("all");
      setSaveStatus("idle");
      setP(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load quote");
    } finally {
      setLoading(false);
    }
  }, [quoteInput, loading]);

  // ── Stream photos for every selected folder not yet loaded ────────────────
  useEffect(() => {
    if (!p) return;
    const quote = p.quote;
    const gen = loadGen.current;
    for (const folderId of p.folders) {
      if (startedFolders.current.has(folderId)) continue;
      startedFolders.current.add(folderId);
      const expected = p.folderList.find((f) => f.id === folderId)?.count ?? 0;
      const have = p.photos.filter((ph) => ph.folderId === folderId).length;
      if (expected > 0 && have >= expected) continue; // resumed draft has them

      setLoadingFolders((l) => [...l, folderId]);
      const finish = () => {
        if (loadGen.current === gen) setLoadingFolders((l) => l.filter((x) => x !== folderId));
      };
      streamPhotoImport(
        `/api/simpro/quotes/${quote}/attachments?companyId=0&folderId=${encodeURIComponent(folderId)}`,
        (photoId) => `proposal-reports/${quote}/${photoId}.jpg`,
        {
          isStale: () => loadGen.current !== gen,
          onPhoto: (photo) =>
            setP((prev) =>
              !prev || prev.photos.some((x) => x.id === photo.id)
                ? prev
                : {
                    ...prev,
                    photos: [
                      ...prev.photos,
                      { id: photo.id, name: photo.name, url: photo.url, folderId },
                    ],
                  },
            ),
          onPhotoUploaded: (id, url) =>
            setP((prev) =>
              prev
                ? { ...prev, photos: prev.photos.map((x) => (x.id === id ? { ...x, url } : x)) }
                : prev,
            ),
          onProgress: () => {},
          onDone: finish,
          onError: finish,
        },
      );
    }
  }, [p]);

  // ── Autosave ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!p) return;
    // Never persist mid-import: photos are still on their large data: URLs
    // until their Blob uploads finish.
    if (loadingFolders.length) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const delay = saveStatus === "error" ? AUTOSAVE_RETRY_MS : AUTOSAVE_DEBOUNCE_MS;
    autosaveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/proposal-reports/${p.quote}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p),
        });
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, delay);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, loadingFolders.length]);

  // ── Derived photo pools ───────────────────────────────────────────────────
  const urlById = useMemo(
    () => new Map((p?.photos ?? []).map((ph) => [ph.id, ph.url])),
    [p?.photos],
  );
  const photoUrl = useCallback((id: string | null) => (id ? (urlById.get(id) ?? null) : null), [urlById]);
  const pool = useMemo(
    () => (p ? p.photos.filter((ph) => p.folders.includes(ph.folderId)) : []),
    [p],
  );
  const pickPool = useMemo(
    () => (pickFolder === "all" ? pool : pool.filter((ph) => ph.folderId === pickFolder)),
    [pool, pickFolder],
  );
  const folderName = useCallback(
    (folderId: string) =>
      folderId === AERIAL_FOLDER_ID
        ? "Satellite view"
        : (p?.folderList.find((f) => f.id === folderId)?.name ?? ""),
    [p?.folderList],
  );

  // ── Actions handed to the editors ─────────────────────────────────────────
  const select = useCallback((id: SectionId, scroll: boolean) => {
    setSel(id);
    if (scroll) setScrollReq((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  }, []);

  const goBuild = useCallback(
    (id?: SectionId) => {
      setStep("build");
      const target = id ?? sel;
      setSel(target);
      setScrollReq((r) => ({ id: target, n: (r?.n ?? 0) + 1 }));
    },
    [sel],
  );

  const refreshPricing = useCallback(async () => {
    if (!p) return;
    const res = await fetch(`/api/simpro/quotes/${p.quote}/pricing`).catch(() => null);
    if (!res?.ok) {
      alert("Couldn't refresh pricing from SimPRO. Try again in a moment.");
      return;
    }
    const rows: QuotePricingRow[] = await res.json();
    update((prev) => ({
      ...prev,
      pricing: { ...prev.pricing, centres: centresFromPricing(rows, prev.pricing.centres) },
    }));
  }, [p, update]);

  const captureAerial = useCallback(async () => {
    if (!p) return;
    const quote = p.quote;
    const params = new URLSearchParams({ address: p.job.site, zoom: "19", size: "640x360" });
    const res = await fetch(`/api/maps/static-map?${params}`).catch(() => null);
    if (!res?.ok) {
      alert("Couldn't capture a satellite view for this address.");
      return;
    }
    const dataUrl = await compressMapImageDataUrl(await readBlobAsDataUrl(await res.blob()));
    const id = `aerial_${uid()}`;
    const url = await uploadReportPhoto(dataUrl, `proposal-reports/${quote}/${id}.jpg`);
    update((prev) => ({
      ...prev,
      photos: [...prev.photos, { id, name: "Satellite view", url, folderId: AERIAL_FOLDER_ID }],
      access: { ...prev.access, aerial: id },
    }));
  }, [p, update]);

  const ctx: BuilderCtx | null = p
    ? {
        p,
        update,
        photoUrl,
        pool,
        pickPool,
        pickFolder,
        setPickFolder,
        folderName,
        goStart: () => setStep("start"),
        refreshPricing,
        captureAerial,
        select,
      }
    : null;

  const stepIdx = STEPS.findIndex(([id]) => id === step);

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button className={styles.back} onClick={onBack} aria-label="Back to report types">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        <div className={styles.titleBlock}>
          <span className={styles.title}>{p ? `${p.job.building} · Painting proposal` : "New proposal"}</span>
          <span className={styles.subtitle}>{p ? `Quote ${p.quote} · ${p.job.client}` : "Not started"}</span>
        </div>
        <div className={styles.stepsWrap}>
          <div className={styles.steps}>
            {STEPS.map(([id, label], i) => {
              const cur = i === stepIdx;
              const done = i < stepIdx;
              return (
                <button
                  key={id}
                  className={`${styles.stepPill} ${cur ? styles.stepPillActive : ""} ${p ? styles.stepPillEnabled : ""}`}
                  onClick={() => {
                    if (!p) return;
                    if (id === "build") goBuild();
                    else setStep(id);
                  }}
                >
                  <span className={`${styles.stepDot} ${done ? styles.stepDotDone : ""}`}>{done ? "✓" : i + 1}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className={styles.headerRight}>
          {step === "build" && p && (
            <>
              <span className={styles.saveState}>
                <span
                  className={`${styles.saveDot} ${
                    saveStatus === "error"
                      ? styles.saveDotError
                      : saveStatus === "saved"
                        ? ""
                        : styles.saveDotPending
                  }`}
                />
                {saveStatus === "error"
                  ? "Save failed, retrying"
                  : saveStatus === "saved"
                    ? "Draft saved"
                    : loadingFolders.length
                      ? "Loading photos…"
                      : "Saving…"}
              </span>
              <button className={styles.darkPill} onClick={() => setStep("review")}>
                Review &amp; export
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M5 12h14M13 6l6 6-6 6" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      <div className={styles.body}>
        {step === "start" && (
          <StartStep
            ctx={ctx}
            quoteInput={quoteInput}
            setQuoteInput={setQuoteInput}
            loading={loading}
            loadError={loadError}
            onLoad={loadQuote}
            loadingFolders={loadingFolders}
            onCreate={() => goBuild("cover")}
          />
        )}
        {step === "build" && ctx && <BuildStep ctx={ctx} sel={sel} scrollReq={scrollReq} />}
        {step === "review" && ctx && <ReviewStep ctx={ctx} onFix={(id) => goBuild(id)} onBackToBuild={() => goBuild()} />}
      </div>
    </div>
  );
}
