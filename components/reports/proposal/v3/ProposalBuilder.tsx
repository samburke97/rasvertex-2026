"use client";
// components/reports/proposal/v3/ProposalBuilder.tsx
//
// Painting proposal builder: Quote → Build → Review & export.
//   Quote  — load the SimPRO quote, confirm the job details, choose photo
//            folders (standard library + the quote's own), and optionally
//            fill the survey pages from tagged inspection photos.
//   Build  — pages rail | live A4 preview | section panel.
//   Review — checks, then Export PDF (also attached to the SimPRO quote).
// The draft autosaves against the quote number; loading the same quote
// again resumes it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./Builder.module.css";
import QuoteStep from "./QuoteStep";
import BuildStep from "./BuildStep";
import ReviewStep from "./ReviewStep";
import type { BuilderCtx, Path, PhotoFolderOption } from "./ctx";
import { getIn, setIn } from "./ctx";
import { streamPhotoImport } from "@/lib/reports/streamPhotoImport";
import { compressMapImageDataUrl } from "@/lib/reports/compressImage";
import { deleteReportPhoto, uploadReportPhoto } from "@/lib/reports/uploadPhoto";
import { derive } from "@/lib/reports/proposal/v3/derive";
import { enabledPhotos, standardFromPhotos, syncSurvey } from "@/lib/reports/proposal/v3/survey";
import {
  LIBRARY_FOLDERS,
  LIMITS,
  PAGE,
  createProposal,
  isProposal,
  jobFromQuote,
  mergeDraft,
  resolvePhoto,
  type PageId,
  type Proposal,
  type QuoteHeader,
  type QuotePricingRow,
  type SimproFolder,
  TRADES,
  switchTrade,
  type Trade,
} from "@/lib/reports/proposal/v3/types";

type Step = "start" | "build" | "review";
export type ScrollReq = { id: PageId; n: number; finding?: number };
type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 500;
const RETRY_MS = 5000;
const TOAST_MS = 4500;
// Unfiled photos are often the important ones; it's always switched on.
const UNFILED = "sp:none";

const STEPS: [Step, string][] = [
  ["start", "Quote"],
  ["build", "Build"],
  ["review", "Review"],
];

const uid = () => Math.random().toString(36).slice(2, 10);

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Downsizes an upload to ≤1800px JPEG q0.86. */
async function downsize(file: File): Promise<string> {
  const src = await readAsDataUrl(file);
  return new Promise((resolve) => {
    const im = new Image();
    im.onload = () => {
      const k = Math.min(1, 1800 / Math.max(im.width, im.height));
      const c = document.createElement("canvas");
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      c.getContext("2d")?.drawImage(im, 0, 0, c.width, c.height);
      try {
        resolve(c.toDataURL("image/jpeg", 0.86));
      } catch {
        resolve(src);
      }
    };
    im.onerror = () => resolve(src);
    im.src = src;
  });
}

export default function ProposalBuilder({ onBack }: { onBack: () => void }) {
  const [p, setP] = useState<Proposal | null>(null);
  // Chosen in the Quote step; a resumed draft brings its own.
  const [trade, setTrade] = useState<Trade>("painting");
  const [step, setStep] = useState<Step>("start");
  const [quoteInput, setQuoteInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sel, setSel] = useState<PageId>("cover");
  const [scrollReq, setScrollReq] = useState<ScrollReq | null>(null);
  const [focusFinding, setFocusFinding] = useState<number | null>(null);
  const [picker, setPicker] = useState<string | null>(null);
  const [pickFolder, setPickFolder] = useState("all");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [loadingFolders, setLoadingFolders] = useState<string[]>([]);
  const [toast, setToast] = useState<{ msg: string; undo: () => void } | null>(null);
  const [focusField, setFocusField] = useState<{ path: string; n: number } | null>(null);
  const [reloading, setReloading] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadGen = useRef(0);
  const startedFolders = useRef(new Set<string>());
  const dirty = useRef(false);
  const autoFilled = useRef(-1); // loadGen the findings were auto-filled for

  // Every edit goes through here; in report style Flagged issues and
  // Pre-start follow the findings' codes.
  const update = useCallback((fn: (prev: Proposal) => Proposal) => {
    dirty.current = true;
    setP((prev) => (prev ? syncSurvey(fn(prev)) : prev));
  }, []);

  // ── Load (or resume) a quote ─────────────────────────────────────────────
  // reset: ignore the saved draft and every change — a brand-new proposal
  // straight from SimPRO, which then overwrites the draft.
  const loadQuote = useCallback(async (opts?: { reset?: boolean }) => {
    const reset = !!opts?.reset;
    const quote = (reset && p ? p.quote : quoteInput).trim();
    if (!quote || loading) return;
    setLoading(true);
    setLoadError(null);

    const safe = (url: string) => fetch(url).catch(() => null);
    const sameQuote = !reset && p?.quote === quote;
    const [qRes, prRes, dRes, fRes] = await Promise.all([
      safe(`/api/simpro/quotes/${quote}`),
      sameQuote ? Promise.resolve(null) : safe(`/api/simpro/quotes/${quote}/pricing`),
      sameQuote || reset ? Promise.resolve(null) : safe(`/api/proposal-reports/${quote}`),
      safe(`/api/simpro/quotes/${quote}/attachments/folders`),
    ]);

    try {
      if (!qRes?.ok) {
        const data = await qRes?.json().catch(() => ({}));
        throw new Error(data?.error ?? `Couldn't find quote ${quote} in SimPRO.`);
      }
      const header: QuoteHeader = await qRes.json();
      const folderList: SimproFolder[] | null = fRes?.ok
        ? ((await fRes.json()).folders ?? []).map((f: { id: string; name: string; count: number }) => ({
            ...f,
            id: "sp:" + f.id,
          }))
        : null;

      let next: Proposal;
      if (sameQuote && p) {
        // Reload: refresh the job record from SimPRO, keep everything else.
        next = { ...p, siteId: header.siteId ?? p.siteId, job: { ...p.job, ...jobFromQuote(quote, header) } };
      } else {
        const pricing: QuotePricingRow[] = prRes?.ok ? await prRes.json() : [];
        const draftJson = dRes?.ok ? await dRes.json().catch(() => null) : null;
        // A resumed draft keeps its own trade.
        const fresh = createProposal(
          quote,
          header,
          pricing,
          reset ? (p?.trade ?? trade) : isProposal(draftJson?.report) ? (draftJson.report.trade ?? "painting") : trade,
        );
        next = isProposal(draftJson?.report) ? { ...mergeDraft(draftJson.report, fresh), siteId: fresh.siteId } : fresh;
        // A new proposal brings in every SimPRO folder; a resumed one keeps
        // the rep's choice, plus Unfiled.
        if (folderList) {
          const add = isProposal(draftJson?.report) ? folderList.filter((f) => f.id === UNFILED) : folderList;
          next.folders = [...new Set([...next.folders, ...add.map((f) => f.id)])];
        }
        loadGen.current++;
        startedFolders.current = new Set();
        setLoadingFolders([]);
        setPickFolder("all");
        setSel("cover");
        setSaveStatus("idle");
        setFocusFinding(null);
        setPicker(null);
        // A reset re-imports the SimPRO photos as new copies, so the old
        // copies and the rep's uploads are deleted from storage.
        if (reset && p) for (const u of [...p.uploads, ...p.simpro.photos.map((x) => x.url)]) void deleteReportPhoto(u);
      }
      if (folderList) {
        const ids = new Set(folderList.map((f) => f.id));
        next = {
          ...next,
          simpro: { ...next.simpro, folders: folderList },
          folders: next.folders.filter((id) => !id.startsWith("sp:") || ids.has(id)),
        };
      }
      // A reset is saved straight away, replacing the old draft.
      dirty.current = sameQuote || reset;
      setP(next);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load quote");
    } finally {
      setLoading(false);
    }
  }, [quoteInput, loading, p, trade]);

  // ── Stream photos for each enabled SimPRO folder not yet loaded ───────────
  useEffect(() => {
    if (!p) return;
    const quote = p.quote;
    const gen = loadGen.current;
    for (const fid of p.folders) {
      if (!fid.startsWith("sp:") || startedFolders.current.has(fid)) continue;
      startedFolders.current.add(fid);
      const expected = p.simpro.folders.find((f) => f.id === fid)?.count ?? 0;
      const have = p.simpro.photos.filter((ph) => ph.folderId === fid).length;
      if (expected > 0 && have >= expected) continue; // resumed draft has them

      setLoadingFolders((l) => [...l, fid]);
      const finish = () => {
        if (loadGen.current === gen) setLoadingFolders((l) => l.filter((x) => x !== fid));
      };
      const setPhotos = (fn: (ph: Proposal["simpro"]["photos"]) => Proposal["simpro"]["photos"]) =>
        setP((prev) => (prev ? { ...prev, simpro: { ...prev.simpro, photos: fn(prev.simpro.photos) } } : prev));
      streamPhotoImport(
        `/api/simpro/quotes/${quote}/attachments?companyId=0&folderId=${encodeURIComponent(fid.slice(3))}`,
        (photoId) => `proposal-reports/${quote}/${photoId}.jpg`,
        {
          isStale: () => loadGen.current !== gen,
          onPhoto: (photo) =>
            setPhotos((list) =>
              list.some((x) => x.id === photo.id)
                ? list
                : [...list, { id: photo.id, name: photo.name, url: photo.url, folderId: fid }],
            ),
          onPhotoUploaded: (id, url) => setPhotos((list) => list.map((x) => (x.id === id ? { ...x, url } : x))),
          onProgress: () => {},
          onDone: () => {
            dirty.current = true;
            finish();
          },
          onError: finish,
        },
      );
    }
  }, [p]);

  // ── Findings fill themselves from the quote's photos ─────────────────────
  // Once per loaded quote: when the photos have finished loading and the
  // findings page is still empty. After that it's the rep's — clearing it
  // doesn't refill it ("Fill from quote photos" in the panel does).
  useEffect(() => {
    if (!p || loadingFolders.length || autoFilled.current === loadGen.current) return;
    if (p.d.findings.items.length) {
      autoFilled.current = loadGen.current;
      return;
    }
    if (!enabledPhotos(p).length) return;
    autoFilled.current = loadGen.current;
    update((prev) => {
      const next = standardFromPhotos(prev);
      // Standard style has no use for empty Flagged / Pre-start pages.
      const hidden = { ...next.hidden };
      if (!prev.d.flagged.rows.length) hidden.flagged = true;
      if (!prev.d.prestart.rows.length) hidden.prestart = true;
      return { ...next, hidden };
    });
  }, [p, loadingFolders.length, update]);

  // ── Autosave (debounced; never mid-import, photos are still data: URLs) ───
  useEffect(() => {
    if (!p || !dirty.current || loadingFolders.length) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (saveStatus !== "saving") setSaveStatus("saving");
    const body = p;
    saveTimer.current = setTimeout(
      async () => {
        try {
          const res = await fetch(`/api/proposal-reports/${body.quote}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (res.ok) dirty.current = false;
          setSaveStatus(res.ok ? "saved" : "error");
        } catch {
          setSaveStatus("error");
        }
      },
      saveStatus === "error" ? RETRY_MS : AUTOSAVE_MS,
    );
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p, loadingFolders.length]);

  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const D = useMemo(() => (p ? derive(p) : null), [p]);
  const img = useCallback((ref: string) => (p ? resolvePhoto(p, ref) : ref), [p]);

  const folders = useMemo<PhotoFolderOption[]>(() => {
    if (!p) return [];
    const lib = LIBRARY_FOLDERS.filter((f) => p.folders.includes(f.id));
    const sp = p.simpro.folders
      .filter((f) => p.folders.includes(f.id))
      .map((f) => ({
        id: f.id,
        name: f.name,
        photos: p.simpro.photos.filter((ph) => ph.folderId === f.id).map((ph) => "ph:" + ph.id),
      }));
    return [...sp, ...lib];
  }, [p]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const select = useCallback((id: PageId, scroll: boolean) => {
    setSel(id);
    setPicker(null);
    if (id !== "findings") setFocusFinding(null);
    if (scroll) setScrollReq((r) => ({ id, n: (r?.n ?? 0) + 1 }));
  }, []);

  const pickField = useCallback((id: PageId, path: string) => {
    setSel(id);
    setFocusField((f) => ({ path, n: (f?.n ?? 0) + 1 }));
    // A photo's own fields open that photo; anything else on the findings
    // pages (site map, intro, "How we fix it") goes back to the overview,
    // where those fields live.
    const m = path.match(/^findings\.items\.(\d+)/);
    if (m) setFocusFinding(Number(m[1]));
    else if (path.startsWith("findings.")) setFocusFinding(null);
  }, []);

  const enableFolder = useCallback(
    (id: string, on = true) =>
      update((prev) => ({
        ...prev,
        folders: on ? [...new Set([...prev.folders, id])] : prev.folders.filter((x) => x !== id),
      })),
    [update],
  );

  // Fetch the folder list again, and re-stream every switched-on folder.
  // Photos already here are skipped by id, so only new ones arrive.
  const reloadSimpro = useCallback(async () => {
    if (!p || reloading) return;
    setReloading(true);
    try {
      const res = await fetch(`/api/simpro/quotes/${p.quote}/attachments/folders`).catch(() => null);
      if (!res?.ok) {
        alert("Couldn't reach SimPRO. Check the connection and try again.");
        return;
      }
      const list: SimproFolder[] = ((await res.json()).folders ?? []).map((f: SimproFolder) => ({ ...f, id: "sp:" + f.id }));
      for (const f of list) startedFolders.current.delete(f.id);
      update((prev) => ({
        ...prev,
        simpro: { ...prev.simpro, folders: list },
        folders: [...new Set([...prev.folders, ...list.filter((f) => f.id === UNFILED).map((f) => f.id)])],
      }));
    } finally {
      setReloading(false);
    }
  }, [p, reloading, update]);

  const pickFinding = useCallback((i: number | null, scroll: boolean) => {
    setSel("findings");
    setPicker(null);
    setFocusFinding(i);
    if (scroll && i != null) setScrollReq((r) => ({ id: "findings", n: (r?.n ?? 0) + 1, finding: i }));
  }, []);

  const goBuild = useCallback((id?: PageId) => {
    setStep("build");
    if (id) {
      setSel(id);
      setScrollReq((r) => ({ id, n: (r?.n ?? 0) + 1 }));
    }
  }, []);

  const toggleHide = useCallback(
    (id: PageId) => {
      if (!p) return;
      const was = !!p.hidden[id];
      update((prev) => ({ ...prev, hidden: { ...prev.hidden, [id]: !was } }));
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (was) {
        setToast(null);
        return;
      }
      setToast({
        msg: `${PAGE[id].name} hidden`,
        undo: () => update((prev) => ({ ...prev, hidden: { ...prev.hidden, [id]: false } })),
      });
      toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
    },
    [p, update],
  );

  const upload = useCallback(
    async (file: File) => {
      if (!p) return "";
      const data = await downsize(file);
      const url = await uploadReportPhoto(data, `proposal-reports/${p.quote}/upload-${uid()}.jpg`);
      update((prev) => ({ ...prev, uploads: [url, ...prev.uploads.filter((u) => u !== url)].slice(0, LIMITS.uploads) }));
      return url;
    },
    [p, update],
  );

  const removeUpload = useCallback(
    (url: string) => {
      if (!p) return;
      const used = JSON.stringify(p.d).includes(JSON.stringify(url).slice(1, -1));
      if (used && !confirm("This photo is used in the proposal. Remove it from the page too?")) return;
      // Clears every photo field that points at it; findings using it go.
      const clear = (v: unknown): unknown =>
        v === url
          ? ""
          : Array.isArray(v)
            ? v.filter((x) => !(x && typeof x === "object" && (x as { photo?: string }).photo === url)).map(clear)
            : v && typeof v === "object"
              ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clear(x)]))
              : v;
      update((prev) => ({
        ...prev,
        uploads: prev.uploads.filter((u) => u !== url),
        d: clear(prev.d) as Proposal["d"],
      }));
      void deleteReportPhoto(url);
    },
    [p, update],
  );

  const uploadData = useCallback(
    async (dataUrl: string, name: string) => {
      if (!p) return "";
      const data = await compressMapImageDataUrl(dataUrl);
      const url = await uploadReportPhoto(data, `proposal-reports/${p.quote}/${name}-${uid()}.jpg`);
      update((prev) => ({ ...prev, uploads: [url, ...prev.uploads].slice(0, LIMITS.uploads) }));
      return url;
    },
    [p, update],
  );

  const saveAerial = useCallback(
    async (dataUrl: string, view: { lat?: number; lng?: number; zoom: number }) => {
      if (!p) return;
      const data = await compressMapImageDataUrl(dataUrl);
      const url = await uploadReportPhoto(data, `proposal-reports/${p.quote}/aerial-${uid()}.jpg`);
      update((prev) => ({
        ...prev,
        uploads: [url, ...prev.uploads].slice(0, LIMITS.uploads),
        d: { ...prev.d, access: { ...prev.d.access, aerial: url, aerialView: view } },
      }));
    },
    [p, update],
  );

  const ctx: BuilderCtx | null =
    p && D
      ? {
          p,
          D,
          update,
          get: (path: Path) => getIn(p.d, path),
          set: (path: Path, v: unknown) =>
            update((prev) => {
              let d = setIn(prev.d, path, v);
              // Editing a Flagged / Pre-start row makes it the rep's own.
              if ((path[0] === "flagged" || path[0] === "prestart") && path[1] === "rows" && path.length > 3)
                d = setIn(d, [path[0], "rows", path[2], "auto"], false);
              return { ...prev, d };
            }),
          img,
          folders,
          picker,
          setPicker,
          pickFolder,
          setPickFolder,
          upload,
          removeUpload,
          saveAerial,
          uploadData,
          sel,
          select,
          toggleHide,
          focusFinding,
          pickFinding,
          allFolders: [
            ...p.simpro.folders.map((f) => ({ ...f, on: p.folders.includes(f.id), sp: true })),
            ...LIBRARY_FOLDERS.map((f) => ({ id: f.id, name: f.name, count: f.photos.length, on: p.folders.includes(f.id), sp: false })),
          ],
          enableFolder,
          reloadSimpro,
          reloading,
          loadingFolders,
          focusField,
          pickField,
        }
      : null;

  const stepIdx = STEPS.findIndex(([id]) => id === step);
  const showDoc = step !== "start" && !!ctx;
  const saveLabel =
    saveStatus === "error"
      ? "Save failed, retrying"
      : loadingFolders.length
        ? "Loading photos…"
        : saveStatus === "saving"
          ? "Saving…"
          : "Draft saved";
  const saveDot = saveStatus === "error" ? "#a83a3a" : saveStatus === "saving" || loadingFolders.length ? "#b8860b" : "#3f8f68";

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <button className={styles.back} onClick={onBack} aria-label="Back to report types">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        <div className={styles.titleBlock}>
          <span className={styles.title}>
            {p ? `${p.job.building} · ${TRADES[p.trade].label} proposal` : "New proposal"}
          </span>
          <span className={styles.subtitle}>{p ? `Quote ${p.job.quote} · ${p.job.client}` : "Not started"}</span>
        </div>
        <div className={styles.stepsWrap}>
          <div className={styles.steps}>
            {STEPS.map(([id, label], i) => (
              <button
                key={id}
                disabled={!p}
                className={`${styles.step} ${i === stepIdx ? styles.stepOn : ""} ${i < stepIdx ? styles.stepDone : ""}`}
                onClick={() => (id === "build" ? goBuild() : setStep(id))}
              >
                <span className={styles.stepDot}>{i < stepIdx ? "✓" : i + 1}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={styles.headerRight}>
          {showDoc && (
            <span className={styles.save}>
              <span className={styles.saveDot} style={{ background: saveDot }} />
              {saveLabel}
            </span>
          )}
          {step === "build" && ctx && (
            <button className={styles.darkPill} onClick={() => setStep("review")}>
              Review &amp; export
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <div className={styles.body}>
        {step === "start" && (
          <QuoteStep
            ctx={ctx}
            quoteInput={quoteInput}
            setQuoteInput={setQuoteInput}
            loading={loading}
            loadError={loadError}
            onLoad={() => loadQuote()}
            onReset={() => {
              if (
                confirm(
                  `Start again from SimPRO?\n\nEverything you've changed on quote ${p?.quote} is wiped: wording, photos, findings, prices and uploads. The job details, prices and photos are loaded fresh from SimPRO. This can't be undone.`,
                )
              )
                void loadQuote({ reset: true });
            }}
            loadingFolders={loadingFolders}
            onOpen={() => goBuild("cover")}
            trade={p?.trade ?? trade}
            onTrade={(t) => {
              setTrade(t);
              if (p) update((prev) => switchTrade(prev, t));
            }}
          />
        )}
        {showDoc && ctx && (
          <BuildStep ctx={ctx} review={step === "review"} scrollReq={scrollReq}>
            {step === "review" && <ReviewStep ctx={ctx} onFix={(id) => goBuild(id)} onBack={() => setStep("build")} />}
          </BuildStep>
        )}
      </div>

      {toast && (
        <div className={styles.toast}>
          <span>{toast.msg}</span>
          <button
            onClick={() => {
              toast.undo();
              setToast(null);
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
