"use client";
// components/reports/inspection/InspectionReportPage.tsx
//
// Inspection Report builder. Enter a job number and pick a building or roof
// inspection (each has its own code library and copy): the job details load from
// SimPRO and the job's photos stream in. Each photo's filename is its label
// (D10 L2 SH LF - note), and the whole report is generated from those labels
// and the code library — see lib/reports/inspection/generate.ts.
//
// Left: label check (rejected labels can be fixed in place), the site map
// (uploaded, captured from Google Maps, a job photo, or automatically a
// photo labelled MAP / Aerial), the cover photo (upload or job photo,
// repositioned by dragging it in the preview), the quote contact and the
// scope. The cover layout and report layout are fixed. Right: the live A4 preview. Map pins can be dragged on the site
// plan. The draft autosaves against the job number.

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import styles from "./InspectionReportPage.module.css";
import AppleSelect from "./AppleSelect";
import MapCaptureModal, { type MapView } from "./MapCaptureModal";
import TagModal from "./TagModal";
import InspectionDocument, {
  InspectionMeasure,
  InspectionStyles,
  type InspectionAssets,
} from "./InspectionDocument";
import { streamPhotoImport } from "@/lib/reports/streamPhotoImport";
import { compressImageDataUrl, compressMapImageDataUrl } from "@/lib/reports/compressImage";
import { deleteReportPhoto, uploadReportPhoto } from "@/lib/reports/uploadPhoto";
import { createUploadQueue } from "@/lib/reports/uploadQueue";
import {
  CARD_IMAGES,
  LIBRARIES,
  LOGO_IMAGE,
  libraryFor,
  type ImageKey,
  type Library,
  type ReportKind,
} from "@/lib/reports/inspection/codes";
import { buildModel, paginate, PAGE_W } from "@/lib/reports/inspection/generate";
import {
  createInspectionReport,
  draftKey,
  isInspectionData,
  photoLabel,
  parseLabel,
  reportImages,
  CONTACTS,
  DEFAULT_COVER_POS,
  type CoverPos,
  type ImageChoice,
  type InspectionJob,
  type InspectionPhoto,
  type InspectionReportData,
} from "@/lib/reports/inspection/types";
import type { EnrichedJob } from "@/lib/simpro/types";

interface Props {
  onBack: () => void;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";
type ExportState =
  | { phase: "idle" }
  | { phase: "exporting" }
  | { phase: "done"; savedToJob: boolean }
  | { phase: "error"; message: string };

const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_RETRY_MS = 5000;

const pub = (rel: string) => "/" + rel;
const ASSETS: InspectionAssets = {
  logo: pub(LOGO_IMAGE),
  images: Object.fromEntries(
    Object.entries(CARD_IMAGES).map(([k, rel]) => [k, pub(rel)]),
  ) as Record<ImageKey, string>,
};

const KIND_HINTS: Record<ReportKind, string> = {
  building: "Facade, awnings, joints, fixings and height safety.",
  roof: "Roof membrane: laps, upturns, penetrations and drainage.",
};

function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

const CONTACT_OPTIONS = CONTACTS.map((c) => ({ value: c.name, label: c.name, detail: c.title || undefined }));

export default function InspectionReportPage({ onBack }: Props) {
  const [r, setR] = useState<InspectionReportData | null>(null);
  const [jobInput, setJobInput] = useState("");
  const [kind, setKind] = useState<ReportKind>("building");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ id: number; name: string }[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [importError, setImportError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveToJob, setSaveToJob] = useState(true);
  const [exp, setExp] = useState<ExportState>({ phase: "idle" });

  const importGen = useRef(0);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = useCallback((fn: (prev: InspectionReportData) => InspectionReportData) => {
    setR((prev) => (prev ? fn(prev) : prev));
  }, []);
  const setJob = (patch: Partial<InspectionJob>) => update((p) => ({ ...p, job: { ...p.job, ...patch } }));

  // ── Photo import ──────────────────────────────────────────────────────────
  // Replaces the draft's SimPRO photos with the job's current attachments,
  // keeping photos uploaded in the builder and any label already fixed.
  const importPhotos = useCallback((jobId: string, folder: string, keepLabels: Map<string, string>) => {
    const gen = ++importGen.current;
    setImporting(true);
    setImportError(null);
    setProgress({ loaded: 0, total: 0 });
    setR((prev) => (prev ? { ...prev, photos: prev.photos.filter((p) => p.uploaded) } : prev));
    const folderQ = folder !== "all" ? `&folderId=${encodeURIComponent(folder)}` : "";
    const finish = () => {
      if (importGen.current === gen) setImporting(false);
    };
    streamPhotoImport(
      `/api/simpro/jobs/${jobId}/attachments?companyId=0${folderQ}`,
      (photoId) => `inspection-reports/${jobId}/${photoId}.jpg`,
      {
        isStale: () => importGen.current !== gen,
        onPhoto: (photo) =>
          setR((prev) =>
            !prev || prev.photos.some((x) => x.id === photo.id)
              ? prev
              : {
                  ...prev,
                  photos: [
                    ...prev.photos,
                    {
                      id: photo.id,
                      name: photo.name,
                      url: photo.url,
                      dateAdded: photo.dateAdded,
                      ...(keepLabels.has(photo.id) ? { label: keepLabels.get(photo.id) } : {}),
                    },
                  ],
                },
          ),
        onPhotoUploaded: (id, url) =>
          setR((prev) =>
            prev ? { ...prev, photos: prev.photos.map((x) => (x.id === id ? { ...x, url } : x)) } : prev,
          ),
        onProgress: (loaded, total) => setProgress({ loaded, total }),
        onDone: finish,
        onError: (message) => {
          if (importGen.current === gen) setImportError(message);
          finish();
        },
      },
    );
  }, []);

  const reimport = (folder?: string) => {
    if (!r) return;
    const f = folder ?? r.folder;
    const keep = new Map(r.photos.filter((p) => p.label != null).map((p) => [p.id, p.label!]));
    if (folder != null) update((p) => ({ ...p, folder: f }));
    importPhotos(r.jobId, f, keep);
  };

  // ── Load (or resume) a job ────────────────────────────────────────────────
  const loadJob = useCallback(async () => {
    const jobId = jobInput.trim().replace(/^#/, "");
    if (!jobId || loading) return;
    setLoading(true);
    setLoadError(null);
    const safe = (url: string) => fetch(url).catch(() => null);
    const [jRes, dRes, fRes] = await Promise.all([
      safe(`/api/simpro/jobs/${jobId}`),
      safe(`/api/inspection-reports/${draftKey(jobId, kind)}`),
      safe(`/api/simpro/jobs/${jobId}/attachments/folders?companyId=0`),
    ]);
    try {
      if (!jRes?.ok) {
        const data = await jRes?.json().catch(() => ({}));
        throw new Error(data?.error ?? `Couldn't find job ${jobId} in SimPRO.`);
      }
      const job: EnrichedJob = await jRes.json();
      const draftJson = dRes?.ok ? await dRes.json().catch(() => null) : null;
      const draft = isInspectionData(draftJson?.report) ? draftJson.report : null;
      const folderList = fRes?.ok ? ((await fRes.json()).folders ?? []) : [];

      let next: InspectionReportData;
      if (draft) {
        // Keep the draft's edits; only fill fields it's missing.
        const fresh = createInspectionReport(jobId, job, kind);
        const j = { ...draft.job };
        (Object.keys(j) as (keyof InspectionJob)[]).forEach((k) => {
          if (!j[k]) j[k] = fresh.job[k];
        });
        next = { ...draft, kind, jobId, job: j };
      } else {
        next = createInspectionReport(jobId, job, kind);
      }

      importGen.current++; // drop any import still running for another job
      setImporting(false);
      setFolders(folderList);
      setSaveStatus("idle");
      setExp({ phase: "idle" });
      setR(next);
      if (!next.photos.some((p) => !p.uploaded)) importPhotos(jobId, next.folder, new Map());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  }, [jobInput, kind, loading, importPhotos]);

  // ── Autosave ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!r) return;
    // Never persist mid-import: photos sit on large data: URLs until their
    // Blob uploads finish.
    if (importing || uploading) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    const delay = saveStatus === "error" ? AUTOSAVE_RETRY_MS : AUTOSAVE_DEBOUNCE_MS;
    autosaveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/inspection-reports/${draftKey(r.jobId, r.kind ?? "building")}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r),
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
  }, [r, importing, uploading]);

  // ── Generate, measure, paginate ───────────────────────────────────────────
  const model = useMemo(() => (r ? buildModel(r) : null), [r]);
  const measureRef = useRef<HTMLDivElement>(null);
  const [heights, setHeights] = useState<Record<string, number>>({});
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let live = true;
    document.fonts.ready.then(() => live && setFontsReady(true));
    return () => {
      live = false;
    };
  }, []);
  // Pins don't change any block's height, so dragging one doesn't re-measure.
  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const next: Record<string, number> = {};
    let changed = false;
    el.querySelectorAll<HTMLElement>("[data-bk]").forEach((n) => {
      const k = n.dataset.bk!;
      next[k] = n.offsetHeight;
      if (!(k in heights) || Math.abs(heights[k] - next[k]) > 1) changed = true;
    });
    if (changed) setHeights(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r?.photos, r?.job, !!model?.mapPhotoId, fontsReady, !!model]);
  const layout = useMemo(() => (model ? paginate(model.blocks, heights) : null), [model, heights]);

  const urlById = useMemo(() => new Map((r ? reportImages(r) : []).map((p) => [p.id, p.url])), [r]);
  const photoUrl = useCallback((id: string | null) => (id ? (urlById.get(id) ?? null) : null), [urlById]);

  // ── Preview zoom (fixed 1280px pages, scaled to the column) ───────────────
  const previewRef = useRef<HTMLElement>(null);
  const [zoom, setZoom] = useState(0.5);
  useLayoutEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const fit = () => {
      const z = Math.max(0.15, Math.min(0.75, (el.clientWidth - 64) / PAGE_W));
      setZoom((prev) => (Math.abs(prev - z) > 0.003 ? z : prev));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!r]);

  // ── Map pins ──────────────────────────────────────────────────────────────
  const onPinPointerDown = useCallback(
    (zone: string, e: ReactPointerEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const box = e.currentTarget.parentElement!.getBoundingClientRect();
      const move = (ev: PointerEvent) => {
        const x = Math.min(97, Math.max(3, ((ev.clientX - box.left) / box.width) * 100));
        const y = Math.min(96, Math.max(4, ((ev.clientY - box.top) / box.height) * 100));
        update((p) => ({
          ...p,
          pins: { ...p.pins, [zone]: [Math.round(x * 10) / 10, Math.round(y * 10) / 10] },
        }));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [update],
  );

  // ── Site map & cover images ───────────────────────────────────────────────
  const [imgBusy, setImgBusy] = useState<null | "map" | "cover">(null);
  const [imgError, setImgError] = useState<{ which: "map" | "cover"; message: string } | null>(null);
  const [mapModal, setMapModal] = useState(false);
  const [picker, setPicker] = useState<null | "map" | "cover">(null);
  const mapFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);

  const setChoice = (which: "map" | "cover", c: ImageChoice | null) =>
    update((p) =>
      which === "map" ? { ...p, siteMap: c } : { ...p, cover: c, coverPos: { ...DEFAULT_COVER_POS } },
    );

  // Compress + upload to Blob, then make it the site map or cover.
  const saveImage = async (
    which: "map" | "cover",
    dataUrl: string,
    source: "upload" | "satellite",
    view?: MapView,
  ) => {
    if (!r) return;
    setImgBusy(which);
    setImgError(null);
    try {
      const url = await uploadReportPhoto(
        await compressMapImageDataUrl(dataUrl),
        `inspection-reports/${r.jobId}/${which}_${Date.now()}.jpg`,
      );
      setChoice(which, { source, url, ...(view ?? {}) });
      setPicker(null);
    } catch (err) {
      setImgError({ which, message: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setImgBusy(null);
    }
  };

  const onFile = (which: "map" | "cover") => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) await saveImage(which, await readBlobAsDataUrl(f), "upload");
  };

  // ── Cover reposition: drag on the preview's cover, zoom in the panel ──────
  const setCoverPos = (patch: Partial<CoverPos>) =>
    update((p) => ({ ...p, coverPos: { ...(p.coverPos ?? DEFAULT_COVER_POS), ...patch } }));

  const onCoverPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (!model?.coverPhotoId) return;
      e.preventDefault();
      const box = e.currentTarget.getBoundingClientRect();
      const start = { cx: e.clientX, cy: e.clientY, ...model.coverPos };
      const clamp = (v: number) => Math.min(100, Math.max(0, v));
      const move = (ev: PointerEvent) => {
        // Dragging right moves the photo right, i.e. the focal point left.
        const dx = ((ev.clientX - start.cx) / box.width) * 100 * 1.5;
        const dy = ((ev.clientY - start.cy) / box.height) * 100 * 1.5;
        update((p) => ({
          ...p,
          coverPos: {
            zoom: start.zoom,
            x: Math.round(clamp(start.x - dx / start.zoom) * 10) / 10,
            y: Math.round(clamp(start.y - dy / start.zoom) * 10) / 10,
          },
        }));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [model?.coverPhotoId, model?.coverPos, update],
  );

  // ── Upload & tag photos ───────────────────────────────────────────────────
  const [tagQueue, setTagQueue] = useState<string[] | null>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  const uploadPhotos = async (files: File[]) => {
    if (!r || !files.length) return;
    const jobId = r.jobId;
    const stamp = Date.now();
    const schedule = createUploadQueue(4);
    let done = 0;
    setUploading({ done, total: files.length });
    const added = await Promise.all(
      files.map((file, n) =>
        schedule(async () => {
          // The trailing number keeps upload order (see uploadOrd in generate.ts).
          const id = `upload_${stamp}${String(n).padStart(3, "0")}`;
          const dataUrl = await compressImageDataUrl(await readBlobAsDataUrl(file));
          const url = await uploadReportPhoto(dataUrl, `inspection-reports/${jobId}/${id}.jpg`);
          const photo: InspectionPhoto = { id, name: file.name, url, uploaded: true };
          setR((prev) => (prev ? { ...prev, photos: [...prev.photos, photo] } : prev));
          setUploading({ done: ++done, total: files.length });
          return photo;
        }),
      ),
    );
    setUploading(null);
    // Anything whose filename isn't already a valid label needs tagging.
    const untagged = added.filter((p) => parseLabel(photoLabel(p), libraryFor(r.kind)).kind === "rejected");
    if (untagged.length) setTagQueue(untagged.map((p) => p.id));
  };

  const removePhoto = (photo: InspectionPhoto) => {
    update((p) => ({ ...p, photos: p.photos.filter((x) => x.id !== photo.id) }));
    deleteReportPhoto(photo.url);
  };

  // ── Labels needing attention ──────────────────────────────────────────────
  const labelRows = useMemo(() => {
    if (!r || !model) return [];
    const rejected = new Map(model.rejected.map((x) => [x.photo.id, x.reason]));
    const warned = new Map(model.warnings.map((x) => [x.photo.id, x.ignored]));
    return r.photos
      .filter((p) => rejected.has(p.id) || warned.has(p.id) || p.label != null || p.uploaded)
      .map((p) => ({
        photo: p,
        reason: rejected.get(p.id) ?? null,
        ignored: warned.get(p.id) ?? null,
      }));
  }, [r, model]);

  const setLabel = (id: string, label: string | undefined) =>
    update((p) => ({
      ...p,
      // undefined drops the override (and the key, once saved as JSON).
      photos: p.photos.map((x) => (x.id === id ? { ...x, label } : x)),
    }));

  // ── Export ────────────────────────────────────────────────────────────────
  const canExport = !!r && !!model && model.parsed.length > 0 && !importing && !uploading;
  const exportPdf = async () => {
    if (!r || !canExport || exp.phase === "exporting") return;
    setExp({ phase: "exporting" });
    try {
      const res = await fetch("/api/reports/export-inspection-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: r, saveToJob }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const filename =
        decodeURIComponent(res.headers.get("X-Filename") ?? "") || `Inspection Report J${r.jobId}.pdf`;
      const savedToJob = res.headers.get("X-Saved-To-Job") === "yes";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExp({ phase: "done", savedToJob });
    } catch (err) {
      setExp({ phase: "error", message: err instanceof Error ? err.message : "Export failed" });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const lib = libraryFor(r?.kind);

  return (
    <div className={styles.root}>
      <InspectionStyles />
      <header className={styles.header}>
        <button className={styles.back} onClick={onBack} aria-label="Back to report types">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M11 6l-6 6 6 6" />
          </svg>
        </button>
        <div className={styles.titleBlock}>
          <span className={styles.title}>{r ? `${r.job.site} · ${lib.label}` : "New inspection report"}</span>
          <span className={styles.subtitle}>{r ? `Job ${r.jobId} · ${r.job.forName}` : "Not started"}</span>
        </div>
        <div className={styles.spacer} />
        {r && (
          <div className={styles.headerRight}>
            <span className={styles.saveState}>
              <span
                className={`${styles.saveDot} ${
                  saveStatus === "error" ? styles.saveDotError : saveStatus === "saved" ? "" : styles.saveDotPending
                }`}
              />
              {importing
                ? "Loading photos…"
                : saveStatus === "error"
                  ? "Save failed, retrying"
                  : saveStatus === "saved"
                    ? "Draft saved"
                    : "Saving…"}
            </span>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={saveToJob} onChange={(e) => setSaveToJob(e.target.checked)} />
              Attach to job
            </label>
            <button className={styles.darkPill} onClick={exportPdf} disabled={!canExport || exp.phase === "exporting"}>
              {exp.phase === "exporting" ? "Exporting…" : "Export PDF"}
            </button>
          </div>
        )}
      </header>

      {!r && (
        <div className={styles.start}>
          <h1 className={styles.h1}>New inspection report</h1>
          <p className={styles.sub}>
            Enter the job number. The report is generated from the job&rsquo;s photo labels, e.g.{" "}
            <code>D10 L2 SH LF - awning screws backing out</code>.
          </p>
          <div className={styles.kinds} role="radiogroup" aria-label="Report type">
            {(Object.values(LIBRARIES) as Library[]).map((l) => (
              <button
                key={l.kind}
                role="radio"
                aria-checked={kind === l.kind}
                className={`${styles.kind} ${kind === l.kind ? styles.kindOn : ""}`}
                onClick={() => setKind(l.kind)}
              >
                <span className={styles.kindRadio} />
                <span className={styles.kindText}>
                  <span className={styles.kindLabel}>{l.label}</span>
                  <span className={styles.kindHint}>{KIND_HINTS[l.kind]}</span>
                </span>
              </button>
            ))}
          </div>
          <div className={styles.jobRow}>
            <div className={styles.jobBox}>
              <span className={styles.jobPrefix}>Job #</span>
              <input
                className={styles.jobInput}
                value={jobInput}
                inputMode="numeric"
                autoFocus
                onChange={(e) => setJobInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadJob();
                }}
              />
            </div>
            <button className={styles.darkPill} onClick={loadJob} disabled={loading || !jobInput.trim()}>
              {loading ? "Loading…" : "Generate"}
            </button>
          </div>
          {loadError && <div className={styles.error}>{loadError}</div>}
        </div>
      )}

      {r && model && layout && (
        <div className={styles.body}>
          <aside className={styles.panel}>
            {exp.phase === "done" && (
              <div className={styles.notice}>
                PDF downloaded{exp.savedToJob ? " and attached to the job." : saveToJob ? ", but attaching it to the job failed." : "."}
              </div>
            )}
            {exp.phase === "error" && <div className={styles.error}>{exp.message}</div>}

            {/* Photos & labels */}
            <section className={styles.group}>
              <div className={styles.groupHead}>
                <h2 className={styles.groupTitle}>Photos</h2>
                <button className={styles.linkBtn} onClick={() => reimport()} disabled={importing}>
                  Re-import
                </button>
              </div>
              <input
                ref={photoFileRef}
                type="file"
                accept="image/*"
                multiple
                hidden
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  uploadPhotos(files);
                }}
              />
              <div className={styles.btnRow}>
                <button
                  className={`${styles.smallBtn} ${styles.smallBtnPrimary}`}
                  disabled={!!uploading}
                  onClick={() => photoFileRef.current?.click()}
                >
                  Upload photos
                </button>
                {model.rejected.length > 0 && (
                  <button className={styles.smallBtn} onClick={() => setTagQueue(model.rejected.map((x) => x.photo.id))}>
                    Tag {model.rejected.length} untagged
                  </button>
                )}
              </div>
              {uploading && (
                <div className={styles.progress}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${(uploading.done / uploading.total) * 100}%` }}
                  />
                  <span>
                    Uploading {uploading.done} of {uploading.total}
                  </span>
                </div>
              )}
              {folders.length > 0 && (
                <div className={styles.field}>
                  <span className={styles.fieldLabel}>Folder</span>
                  <AppleSelect
                    value={r.folder}
                    disabled={importing}
                    options={[
                      { value: "all", label: "All photos" },
                      ...folders.map((f) => ({ value: String(f.id), label: f.name })),
                    ]}
                    onChange={(v) => v !== r.folder && reimport(v)}
                  />
                </div>
              )}
              {importing && (
                <div className={styles.progress}>
                  <div
                    className={styles.progressBar}
                    style={{ width: progress.total ? `${(progress.loaded / progress.total) * 100}%` : "4%" }}
                  />
                  <span>
                    {progress.total ? `${progress.loaded} of ${progress.total} photos` : "Connecting to SimPRO…"}
                  </span>
                </div>
              )}
              {importError && <div className={styles.error}>{importError}</div>}
              <div className={styles.stats}>
                <span>
                  <b>{model.parsed.length}</b> in report
                </span>
                <span className={model.rejected.length ? styles.statBad : ""}>
                  <b>{model.rejected.length}</b> rejected
                </span>
                <span>{model.mapPhotoId ? "Site plan found" : "No MAP photo"}</span>
              </div>

              {labelRows.length > 0 && (
                <div className={styles.labels}>
                  {labelRows.map(({ photo, reason, ignored }) => (
                    <LabelRow
                      key={photo.id}
                      photo={photo}
                      reason={reason}
                      ignored={ignored}
                      lib={lib}
                      onChange={(v) => setLabel(photo.id, v)}
                      onTag={() => setTagQueue([photo.id])}
                      onRemove={photo.uploaded ? () => removePhoto(photo) : undefined}
                    />
                  ))}
                </div>
              )}
              {!importing && r.photos.length > 0 && model.rejected.length === 0 && (
                <p className={styles.hint}>All labels are valid.</p>
              )}
              {!importing && r.photos.length === 0 && !importError && (
                <p className={styles.hint}>No photos are attached to this job in SimPRO. Upload them here instead.</p>
              )}
            </section>

            <input ref={mapFileRef} type="file" accept="image/*" hidden onChange={onFile("map")} />
            <input ref={coverFileRef} type="file" accept="image/*" hidden onChange={onFile("cover")} />

            {/* Site map */}
            <section className={styles.group}>
              <div className={styles.groupHead}>
                <h2 className={styles.groupTitle}>Site map</h2>
                {r.siteMap && (
                  <button className={styles.linkBtn} onClick={() => setChoice("map", null)}>
                    {model.labelMapPhotoId ? "Use photo labelled Aerial" : "Remove"}
                  </button>
                )}
              </div>
              {model.mapPhotoId && (
                <div className={styles.mapThumb} style={{ backgroundImage: `url("${photoUrl(model.mapPhotoId)}")` }} />
              )}
              <p className={styles.hint}>
                {model.mapSource === "label"
                  ? `Using the job photo labelled “${photoLabel(r.photos.find((p) => p.id === model.mapPhotoId) ?? r.photos[0])}”.`
                  : model.mapSource === "upload"
                    ? "Using an uploaded image."
                    : model.mapSource === "satellite"
                      ? "Using a Google Maps capture."
                      : model.mapSource === "photo"
                        ? "Using a job photo."
                        : "No photo labelled “Aerial” on this job. Upload a site map or capture one from Google Maps."}
              </p>
              <div className={styles.btnRow}>
                <button
                  className={`${styles.smallBtn} ${styles.smallBtnPrimary}`}
                  disabled={!!imgBusy}
                  onClick={() => mapFileRef.current?.click()}
                >
                  Upload image
                </button>
                <button
                  className={styles.smallBtn}
                  disabled={!!imgBusy || !r.job.address}
                  onClick={() => setMapModal(true)}
                >
                  Capture from map
                </button>
                <button
                  className={`${styles.smallBtn} ${picker === "map" ? styles.smallBtnOn : ""}`}
                  disabled={!!imgBusy || !r.photos.length}
                  onClick={() => setPicker(picker === "map" ? null : "map")}
                >
                  Job photo
                </button>
              </div>
              {picker === "map" && (
                <PhotoPicker
                  photos={r.photos}
                  selected={r.siteMap?.source === "photo" ? r.siteMap.photoId : null}
                  onPick={(id) => {
                    setChoice("map", { source: "photo", photoId: id });
                    setPicker(null);
                  }}
                />
              )}
              {imgBusy === "map" && <p className={styles.hint}>Adding site map…</p>}
              {imgError?.which === "map" && <div className={styles.error}>{imgError.message}</div>}
              {model.zoneRows.length > 0 && (
                <p className={styles.hint}>
                  {model.zoneRows.length} tag{model.zoneRows.length === 1 ? "" : "s"} from the photo labels (
                  {model.zoneRows.map((z) => z.zone).join(", ")})
                  {model.mapPhotoId ? ". Drag them into place on the map in the preview." : "."}
                </p>
              )}
            </section>

            {/* Cover photo */}
            <section className={styles.group}>
              <div className={styles.groupHead}>
                <h2 className={styles.groupTitle}>Cover photo</h2>
                {r.cover && (
                  <button className={styles.linkBtn} onClick={() => setChoice("cover", null)}>
                    Use first overview
                  </button>
                )}
              </div>
              <div className={styles.btnRow}>
                <button
                  className={`${styles.smallBtn} ${styles.smallBtnPrimary}`}
                  disabled={!!imgBusy}
                  onClick={() => coverFileRef.current?.click()}
                >
                  Upload photo
                </button>
                <button
                  className={`${styles.smallBtn} ${picker === "cover" ? styles.smallBtnOn : ""}`}
                  disabled={!!imgBusy || !r.photos.length}
                  onClick={() => setPicker(picker === "cover" ? null : "cover")}
                >
                  Job photo
                </button>
              </div>
              {picker === "cover" && (
                <PhotoPicker
                  photos={r.photos}
                  selected={model.coverPhotoId}
                  onPick={(id) => {
                    setChoice("cover", { source: "photo", photoId: id });
                    setPicker(null);
                  }}
                />
              )}
              {imgBusy === "cover" && <p className={styles.hint}>Uploading cover photo…</p>}
              {imgError?.which === "cover" && <div className={styles.error}>{imgError.message}</div>}
              {model.coverPhotoId && (
                <>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>
                      Zoom <span className={styles.fieldValue}>{Math.round(model.coverPos.zoom * 100)}%</span>
                    </span>
                    <input
                      className={styles.range}
                      type="range"
                      min={1}
                      max={3}
                      step={0.05}
                      value={model.coverPos.zoom}
                      onChange={(e) => setCoverPos({ zoom: Number(e.target.value) })}
                    />
                  </label>
                  <p className={styles.hint}>
                    Drag the photo on the cover in the preview to reposition it.{" "}
                    {(model.coverPos.x !== 50 || model.coverPos.y !== 50 || model.coverPos.zoom !== 1) && (
                      <button className={styles.linkBtn} onClick={() => setCoverPos({ ...DEFAULT_COVER_POS })}>
                        Reset
                      </button>
                    )}
                  </p>
                </>
              )}
            </section>

            <section className={styles.group}>
              <h2 className={styles.groupTitle}>Contact for quotes</h2>
              <AppleSelect value={r.job.contact} options={CONTACT_OPTIONS} onChange={(contact) => setJob({ contact })} />
            </section>

            <section className={styles.group}>
              <h2 className={styles.groupTitle}>Scope</h2>
              <textarea
                className={styles.input}
                rows={4}
                value={r.job.scope}
                onChange={(e) => setJob({ scope: e.target.value })}
              />
            </section>
          </aside>

          <main ref={previewRef} className={styles.preview}>
            <div ref={measureRef}>
              <InspectionMeasure model={model} assets={ASSETS} />
            </div>
            <div style={{ zoom }}>
              <InspectionDocument
                model={model}
                layout={layout}
                job={r.job}
                photoUrl={photoUrl}
                assets={ASSETS}
                screen
                onPinPointerDown={onPinPointerDown}
                onCoverPointerDown={onCoverPointerDown}
              />
            </div>
          </main>
        </div>
      )}

      {tagQueue && r && model && (
        <TagModal
          photos={tagQueue.map((id) => r.photos.find((p) => p.id === id)).filter((p): p is InspectionPhoto => !!p)}
          lib={lib}
          zones={model.zoneRows.map((z) => z.zone)}
          onSave={(id, label) => setLabel(id, label)}
          onClose={() => setTagQueue(null)}
        />
      )}

      {mapModal && r && (
        <MapCaptureModal
          address={r.job.address}
          initial={
            r.siteMap?.source === "satellite" && r.siteMap.zoom
              ? { lat: r.siteMap.lat, lng: r.siteMap.lng, zoom: r.siteMap.zoom }
              : undefined
          }
          onCancel={() => setMapModal(false)}
          onCapture={async (dataUrl, view) => {
            await saveImage("map", dataUrl, "satellite", view);
            setMapModal(false);
          }}
        />
      )}
    </div>
  );
}

function PhotoPicker({
  photos,
  selected,
  onPick,
}: {
  photos: InspectionPhoto[];
  selected: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className={styles.thumbs}>
      {photos.map((p) => (
        <button
          key={p.id}
          className={`${styles.thumb} ${selected === p.id ? styles.thumbOn : ""}`}
          style={{ backgroundImage: `url("${p.url}")` }}
          title={photoLabel(p)}
          onClick={() => onPick(p.id)}
        />
      ))}
    </div>
  );
}

function LabelRow({
  photo,
  reason,
  ignored,
  lib,
  onChange,
  onTag,
  onRemove,
}: {
  photo: InspectionPhoto;
  reason: string | null;
  ignored: string[] | null;
  lib: Library;
  onChange: (label: string | undefined) => void;
  onTag: () => void;
  /** Uploaded photos only. */
  onRemove?: () => void;
}) {
  const label = photoLabel(photo);
  const ok = parseLabel(label, lib).kind !== "rejected";
  return (
    <div className={styles.labelRow}>
      <div className={styles.labelThumb} style={{ backgroundImage: `url("${photo.url}")` }} />
      <div className={styles.labelBody}>
        <input
          className={`${styles.input} ${styles.labelInput} ${ok ? "" : styles.inputBad}`}
          value={label}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className={reason ? styles.labelBad : ignored ? styles.labelWarn : styles.labelOk}>
          <span>{reason ?? (ignored ? `Ignored: ${ignored.join(", ")}` : photo.uploaded ? "Uploaded" : "Fixed in app")}</span>
          <span className={styles.labelActions}>
            <button className={styles.linkBtn} onClick={onTag}>
              Tag
            </button>
            {photo.label != null && !photo.uploaded && (
              <button className={styles.linkBtn} onClick={() => onChange(undefined)} title={photo.name}>
                Use filename
              </button>
            )}
            {onRemove && (
              <button className={styles.linkBtn} onClick={onRemove}>
                Remove
              </button>
            )}
          </span>
        </span>
      </div>
    </div>
  );
}
