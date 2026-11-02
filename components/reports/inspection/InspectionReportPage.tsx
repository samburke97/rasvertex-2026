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
import MapCaptureModal, { type MapView } from "@/components/reports/shared/MapCaptureModal";
import SaveReportModal from "@/components/reports/shared/SaveReportModal";
import BuilderHeader, { HeaderButton } from "@/components/reports/shared/builder/BuilderHeader";
import DocEditor from "@/components/workspace/DocEditor";
import PageRail, { type RailRow } from "@/components/reports/shared/builder/PageRail";
import RichBox from "@/components/reports/shared/builder/RichBox";
import { CodeChips, PhotoGrid, PhotoTray } from "@/components/reports/shared/builder/PhotoGrid";
import ToggleRow from "@/components/reports/shared/ToggleRow";
import { notesIsEmpty } from "@/lib/reports/richText";
import PanelResizer, { usePanelWidth } from "@/components/reports/shared/builder/PanelResizer";
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
  BANDS,
  PLAN_INTERVALS,
  type Library,
  type ReportKind,
} from "@/lib/reports/inspection/codes";
import { buildModel, paginate, PAGE_W, type Block, type PhotoView, type SectionKey } from "@/lib/reports/inspection/generate";
import {
  createInspectionReport,
  draftKey,
  isInspectionData,
  composeLabel,
  photoLabel,
  parseLabel,
  reportImages,
  CONTACTS,
  DEFAULT_COVER_POS,
  type CoverPos,
  type ImageChoice,
  type InspectionJob,
  type InspectionPhoto,
  type PlanItem,
  sectionHidden,
  type InspectionReportData,
} from "@/lib/reports/inspection/types";
import type { EnrichedJob } from "@/lib/simpro/types";
import { useDraftAutosave } from "@/components/reports/shared/builder/useDraftAutosave";
import Slider from "@/components/ui/Slider";
import CropModal from "@/components/reports/shared/builder/CropModal";
import InfoTip from "@/components/reports/shared/builder/InfoTip";

interface Props {
  onBack: () => void;
}

type ExportState =
  | { phase: "idle" }
  | { phase: "exporting" }
  | { phase: "done" }
  | { phase: "error"; message: string };


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

type Kept = Pick<InspectionPhoto, "label" | "title" | "desc" | "pos" | "off" | "order">;

type Sel = "cover" | SectionKey;
const SECTION_ORDER: SectionKey[] = ["about", "map", "defects", "findings", "index", "summary", "plan", "works"];
const SECTION_NAMES: Record<SectionKey, string> = {
  about: "About this report",
  map: "Site map",
  defects: "Defects explained",
  findings: "Findings",
  index: "Location index",
  summary: "Summary",
  plan: "Maintenance plan",
  works: "Recommended works",
};
/** Sections the builder can leave out (the rest always print). */
const HIDEABLE: Sel[] = ["map", "defects", "index", "summary", "plan"];

/** The section a clicked key on the page belongs to. */
function sectionOfKey(key: string): Sel {
  const [a, b] = key.split(".");
  if (a === "sec") return b as SectionKey;
  if (key === "job.scope" || a === "about" || a === "ex") return "about";
  if (key === "job.technicianNotes") return "findings";
  if (key === "job.contact" || a === "works" || a === "extra") return "works";
  if (a === "job") return "cover";
  if (a === "map") return "map";
  if (a === "defect") return "defects";
  if (a === "sum") return "summary";
  if (a === "plan") return "plan";
  return "cover";
}



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
  const [saving, setSaving] = useState(false);
  const [exp, setExp] = useState<ExportState>({ phase: "idle" });

  const importGen = useRef(0);

  const update = useCallback((fn: (prev: InspectionReportData) => InspectionReportData) => {
    setR((prev) => (prev ? fn(prev) : prev));
  }, []);
  const setJob = (patch: Partial<InspectionJob>) => update((p) => ({ ...p, job: { ...p.job, ...patch } }));

  // ── Photo import ──────────────────────────────────────────────────────────
  // Replaces the draft's SimPRO photos with the job's current attachments,
  // keeping photos uploaded in the builder and any label already fixed.
  const importPhotos = useCallback((jobId: string, folder: string, keepLabels: Map<string, Kept>) => {
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
                      ...keepLabels.get(photo.id),
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
    // Labels, titles and descriptions typed here survive a re-import.
    const keep = new Map<string, Kept>(
      r.photos
        .filter((p) => p.label != null || p.title != null || p.desc != null || p.pos != null || p.off || p.order != null)
        .map((p) => [p.id, { label: p.label, title: p.title, desc: p.desc, pos: p.pos, off: p.off, order: p.order }]),
    );
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

  // ── Autosave (never mid-import: photos sit on data: URLs until uploaded) ──
  const { status: saveStatus, setStatus: setSaveStatus } = useDraftAutosave(
    r ? `/api/inspection-reports/${draftKey(r.jobId, r.kind ?? "building")}` : null,
    r,
    { ready: !importing && !uploading },
  );

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
  }, [r?.photos, r?.job, r?.text, r?.hidden, !!model?.mapPhotoId, fontsReady, !!model]);
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
  };

  const removePhoto = (photo: InspectionPhoto) => {
    update((p) => ({ ...p, photos: p.photos.filter((x) => x.id !== photo.id) }));
    deleteReportPhoto(photo.url);
  };

  // ── Labels needing attention ──────────────────────────────────────────────

  const setPhoto = (id: string, patch: Partial<Kept>) =>
    update((p) => ({ ...p, photos: p.photos.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  // Click a photo on the page to edit it; the panel shows just that photo.
  const [editing, setEditing] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);
  const photoViews = useMemo(() => {
    const out: PhotoView[] = [];
    for (const b of model?.blocks ?? [])
      if (b.type === "row") for (const v of b.photos) if (!out.some((x) => x.id === v.id)) out.push(v);
    return out;
  }, [model]);
  const offPhotos = r?.photos.filter((p) => p.off) ?? [];
  /** Drag in the grid: the new order, kept within each zone and code. */
  const movePhoto = (from: number, to: number) => {
    const ids = photoViews.map((v) => v.id);
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    update((p) => ({ ...p, photos: p.photos.map((x) => (ids.includes(x.id) ? { ...x, order: ids.indexOf(x.id) } : x)) }));
  };
  const pickPhoto = (id: string | null, scroll = false) => {
    setEditing(id);
    if (id && scroll)
      requestAnimationFrame(() =>
        docRef.current?.querySelector(`[data-photo="${id}"]`)?.scrollIntoView({ block: "center" }),
      );
  };

  // ── Sections: rail, panel and click-to-edit ───────────────────────────────
  const [sel, setSel] = useState<Sel>("cover");
  const [focusKey, setFocusKey] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);
  const panel = usePanelWidth("ir-panel-width", 360);
  const secOf = (k: SectionKey) => model?.sections.find((s) => s.key === k);
  const pageOf = (k: Sel) => (k === "cover" ? 1 : layout?.secPage[k]);
  const railRows: RailRow[] = (["cover", ...SECTION_ORDER] as Sel[]).map((key) => {
    if (key === "cover") return { id: key, name: "Cover", num: "C" };
    const s = secOf(key);
    const hidden = !!r && sectionHidden(r, key);
    // Site map needs zones, the index needs locations: without them the
    // section is left out on its own.
    const absent = !s && !hidden;
    return {
      id: key,
      name: s?.title ?? SECTION_NAMES[key],
      num: pageOf(key) != null ? String(pageOf(key)).padStart(2, "0") : "",
      hideable: HIDEABLE.includes(key),
      hidden,
      absent,
      title: absent ? (key === "plan" ? "No services picked yet" : "Nothing to show: no photo is tagged with a location") : undefined,
    };
  });
  const scrollToPage = (n: number | undefined) =>
    n && requestAnimationFrame(() => docRef.current?.querySelector(`[data-pageno="${n}"]`)?.scrollIntoView({ block: "start" }));
  const pickSection = (k: Sel, scroll = false) => {
    setSel(k);
    setEditing(null);
    setFocusKey(null);
    if (scroll) scrollToPage(pageOf(k));
  };
  const editKey = (key: string) => {
    setSel(sectionOfKey(key));
    setEditing(null);
    setFocusKey(key);
  };
  // Clicked text on the page: bring its field into view and focus it.
  useEffect(() => {
    if (!focusKey) return;
    const id = requestAnimationFrame(() => {
      const el = panelRef.current?.querySelector<HTMLElement>(`[data-field="${focusKey}"]`);
      if (!el) return;
      el.scrollIntoView({ block: "center" });
      el.querySelector<HTMLElement>("input, textarea, .tiptap")?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [focusKey, sel]);

  const setText = (key: string, v: string | undefined) =>
    update((p) => {
      const text = { ...p.text };
      if (v === undefined) delete text[key];
      else text[key] = v;
      return { ...p, text };
    });
  /** An editable wording: the edit if there is one, else what's printed. */
  const txt = (key: string, printed: string) => ({
    fieldKey: key,
    value: r?.text?.[key] ?? printed,
    onChange: (v: string) => setText(key, v),
    onReset: r?.text?.[key] != null ? () => setText(key, undefined) : undefined,
  });
  const exBlock = model?.blocks.find((b): b is Extract<Block, { type: "ex" }> => b.type === "ex");
  const sumBlock = model?.blocks.find((b): b is Extract<Block, { type: "sum" }> => b.type === "sum");
  const defectBlocks = (model?.blocks ?? []).filter((b): b is Extract<Block, { type: "defect" }> => b.type === "defect");

  const editPhoto = editing ? r?.photos.find((p) => p.id === editing) : undefined;
  // A photo whose label stops parsing drops off the page; keep editing it.
  const editView: PhotoView | undefined = editPhoto
    ? (photoViews.find((v) => v.id === editPhoto.id) ?? { id: editPhoto.id, num: "—", chips: [], gname: "", where: "", note: "", autoName: "", autoNote: "" })
    : undefined;

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
        body: JSON.stringify({ report: r }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const filename =
        decodeURIComponent(res.headers.get("X-Filename") ?? "") || `Inspection Report J${r.jobId}.pdf`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExp({ phase: "done" });
    } catch (err) {
      setExp({ phase: "error", message: err instanceof Error ? err.message : "Export failed" });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const lib = libraryFor(r?.kind);

  return (
    <div className={styles.root}>
      <InspectionStyles />
      <BuilderHeader
        onBack={onBack}
        title={r ? `${r.job.site} · ${lib.label}` : "New inspection report"}
        subtitle={r ? `Job ${r.jobId} · ${r.job.forName}` : "Not started"}
        status={r ? (importing ? { text: "Loading photos…", busy: true } : saveStatus) : undefined}
      >
        {r && (
          <>
            <HeaderButton onClick={exportPdf} disabled={!canExport || exp.phase === "exporting"}>
              {exp.phase === "exporting" ? "Exporting…" : "Download PDF"}
            </HeaderButton>
            <HeaderButton primary onClick={() => setSaving(true)} disabled={!canExport}>
              Save to SimPRO
            </HeaderButton>
          </>
        )}
      </BuilderHeader>

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
          <PageRail
            rows={railRows}
            sel={sel}
            onPick={(k) => pickSection(k as Sel, true)}
            onToggle={(k) => update((p) => ({ ...p, hidden: { ...p.hidden, [k]: !sectionHidden(p, k as SectionKey) } }))}
          />

          <main ref={previewRef} className={styles.preview}>
            <div ref={measureRef}>
              <InspectionMeasure model={model} assets={ASSETS} />
            </div>
            <div ref={docRef} style={{ zoom }}>
              <InspectionDocument
                onPhotoClick={(id) => {
                  setSel("findings");
                  pickPhoto(id);
                }}
                onEdit={editKey}
                onPickSection={(k) => pickSection(k as Sel)}
                selectedSection={sel}
                editing={editing}
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

          <PanelResizer panel={panel} />

          <aside ref={panelRef} className={styles.panel} style={{ width: panel.w }}>
            <div className={styles.panelHead}>
              <span className={styles.panelTitle}>{railRows.find((x) => x.id === sel)?.name}</span>
            </div>
            {exp.phase === "done" && (
              <div className={styles.notice}>
                PDF downloaded.
              </div>
            )}
            {exp.phase === "error" && <div className={styles.error}>{exp.message}</div>}
            <input ref={mapFileRef} type="file" accept="image/*" hidden onChange={onFile("map")} />
            <input ref={coverFileRef} type="file" accept="image/*" hidden onChange={onFile("cover")} />


            {sel === "cover" && (
              <>
                <section className={styles.group}>
                  <Field label="Building name" fieldKey="job.site" value={r.job.site} onChange={(site) => setJob({ site })} />
                  <Field label="Intro" fieldKey="job.blurb" value={r.job.blurb} multiline onChange={(blurb) => setJob({ blurb })} />
                  <Field label="Prepared for" fieldKey="job.forName" value={r.job.forName} onChange={(forName) => setJob({ forName })} />
                  <Field label="Prepared by" fieldKey="job.by" value={r.job.by} onChange={(by) => setJob({ by })} />
                  <Field label="Their title" fieldKey="job.byTitle" value={r.job.byTitle} onChange={(byTitle) => setJob({ byTitle })} />
                  <Field label="Date" fieldKey="job.date" value={r.job.date} onChange={(date) => setJob({ date })} />
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
                    <Slider
                      className={styles.range}
                      min={1}
                      max={3}
                      step={0.05}
                      value={model.coverPos.zoom}
                      onChange={(zoom) => setCoverPos({ zoom })}
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

              </>
            )}

            {sel === "about" && (
              <>
                <section className={styles.group}>
                  <Field {...txt("sec.about.title", secOf("about")?.title ?? "")} label="Title" />
                  <Field label="Intro" fieldKey="job.scope" value={r.job.scope} multiline onChange={(scope) => setJob({ scope })} />
                </section>
                {model.about.map((a, i) => (
                  <section key={i} className={styles.group}>
                    <Field {...txt(`about.${i}.t`, a.t)} label={`Card ${i + 1} title`} />
                    <Field {...txt(`about.${i}.d`, a.d)} label="Text" multiline />
                  </section>
                ))}
                {exBlock && (
                  <section className={styles.group}>
                    <Field {...txt("ex.title", exBlock.title)} label="Reading a photo · title" />
                    <Field {...txt("ex.intro", exBlock.intro)} label="Text" multiline />
                    {exBlock.legend.map((l, i) => (
                      <Field key={l.part} {...txt(`ex.mean.${i}`, l.mean)} label={l.part} multiline />
                    ))}
                  </section>
                )}
              </>
            )}

            {sel === "map" && (
              <>
                {secOf("map") ? (
                  <section className={styles.group}>
                    <Field {...txt("sec.map.title", secOf("map")!.title)} label="Title" />
                    <Field {...txt("sec.map.intro", secOf("map")!.intro)} label="Intro" multiline />
                  </section>
                ) : (
                  <section className={styles.group}>
                    <p className={styles.hint}>
                      {model.zoneRows.length
                        ? "Hidden. Show it from the eye in the page list."
                        : "Left out: no photo is tagged with a drop (D#) or section (S#). Tag one and the site map comes back."}
                    </p>
                  </section>
                )}
            {/* Site map */}
            <section className={styles.group} data-field="map">
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

              </>
            )}

            {sel === "defects" && (
              <>
                {secOf("defects") ? (
                  <>
                    <section className={styles.group}>
                      <Field {...txt("sec.defects.title", secOf("defects")!.title)} label="Title" />
                      <Field {...txt("sec.defects.intro", secOf("defects")!.intro)} label="Intro" multiline />
                    </section>
                    {defectBlocks.map((b) => (
                      <section key={b.chip.code} className={styles.group}>
                        <h2 className={styles.groupTitle}>
                          {b.chip.code} · {b.name}
                        </h2>
                        <Field {...txt(`defect.${b.chip.code}.what`, b.what)} label="What it is" multiline />
                        <Field {...txt(`defect.${b.chip.code}.act`, b.act)} label="Recommended action" multiline />
                      </section>
                    ))}
                  </>
                ) : (
                  <section className={styles.group}>
                    <p className={styles.hint}>Hidden. Show it from the eye in the page list.</p>
                  </section>
                )}
              </>
            )}

            {sel === "findings" &&
              (editPhoto && editView ? (
                <PhotoEditor
                  key={editPhoto.id}
                  photo={editPhoto}
                  view={editView}
                  index={photoViews.indexOf(editView)}
                  count={photoViews.length}
                  lib={lib}
                  onBack={() => pickPhoto(null)}
                  onStep={(by) => pickPhoto(photoViews[photoViews.indexOf(editView) + by]?.id ?? editView.id, true)}
                  onChange={(patch) => setPhoto(editPhoto.id, patch)}
                  onRemove={() => {
                    if (editPhoto.uploaded) removePhoto(editPhoto);
                    else setPhoto(editPhoto.id, { off: true });
                    pickPhoto(null);
                  }}
                />
              ) : (
                <>
                  <section className={styles.group}>
                    <Field {...txt("sec.findings.title", secOf("findings")?.title ?? "")} label="Title" />
                    <Field {...txt("sec.findings.intro", secOf("findings")?.intro ?? "")} label="Intro" multiline />
                  </section>
            {/* Photos & labels */}
            <section className={styles.group}>
              <div className={styles.groupHead}>
                <h2 className={styles.groupTitle}>
                  Photos <InfoTip>Click a photo to edit its codes, location, title and description. Drag to reorder it within its section and code.</InfoTip>
                </h2>
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
              {photoViews.length > 0 && (
                <PhotoGrid
                  items={photoViews.map((v) => ({ id: v.id, src: photoUrl(v.id) ?? "", title: v.gname }))}
                  onOpen={(i) => pickPhoto(photoViews[i].id, true)}
                  onMove={movePhoto}
                />
              )}
              {offPhotos.length > 0 && (
                <>
                  <h2 className={styles.groupTitle}>Not on the page · {offPhotos.length}</h2>
                  <PhotoTray
                    items={offPhotos.map((p) => ({ id: p.id, src: p.url, title: `Add “${photoLabel(p)}”` }))}
                    onAdd={(i) => setPhoto(offPhotos[i].id, { off: undefined })}
                  />
                </>
              )}
              {!importing && r.photos.length === 0 && !importError && (
                <p className={styles.hint}>No photos are attached to this job in SimPRO. Upload them here instead.</p>
              )}
            </section>

            <section className={styles.group} data-field="job.technicianNotes">
              <h2 className={styles.groupTitle}>
                Technician comments <InfoTip>Type / for headings and lists. Printed after the findings.</InfoTip>
              </h2>
              <div className={styles.editorBox}>
                <DocEditor value={r.job.technicianNotes ?? ""} onChange={(technicianNotes) => setJob({ technicianNotes })} />
              </div>
            </section>

                </>
              ))}

            {sel === "index" && (
              <section className={styles.group}>
                {secOf("index") ? (
                  <>
                    <Field {...txt("sec.index.title", secOf("index")!.title)} label="Title" />
                    <Field {...txt("sec.index.intro", secOf("index")!.intro)} label="Intro" multiline />
                  </>
                ) : (
                  <p className={styles.hint}>
                    {r.hidden?.index
                      ? "Hidden. Show it from the eye in the page list."
                      : "Left out: no photo has a zone, level or unit, so there are no locations to list."}
                  </p>
                )}
              </section>
            )}

            {sel === "plan" && r && (
              <PlanEditor
                lib={lib}
                plan={r.plan}
                on={!sectionHidden(r, "plan")}
                present={model.works.items.map((w) => w.chip.code)}
                title={txt("sec.plan.title", secOf("plan")?.title ?? "Maintenance plan")}
                intro={txt("sec.plan.intro", secOf("plan")?.intro ?? "Future maintenance considerations and lifecycle planning to assist with ongoing asset management and budgeting.")}
                onOn={(v) => update((p) => ({ ...p, hidden: { ...p.hidden, plan: !v } }))}
                onPlan={(plan) => update((p) => ({ ...p, plan }))}
              />
            )}

            {sel === "summary" && (
              <section className={styles.group}>
                {secOf("summary") ? (
                  <>
                    <Field {...txt("sec.summary.title", secOf("summary")!.title)} label="Title" />
                    <Field {...txt("sec.summary.intro", secOf("summary")!.intro)} label="Intro" multiline />
                    {sumBlock?.rows.map((row) => (
                      <Field key={row.band} {...txt(`sum.${row.band}`, row.text)} label={row.name} multiline />
                    ))}
                    {sumBlock && <Field {...txt("sum.note", sumBlock.note)} label="Please note" multiline />}
                  </>
                ) : (
                  <p className={styles.hint}>Hidden. Show it from the eye in the page list.</p>
                )}
              </section>
            )}

            {sel === "works" && (
              <>
                <section className={styles.group}>
                  <Field {...txt("sec.works.title", secOf("works")?.title ?? "")} label="Title" />
                </section>
                {model.works.items.map((w) => (
                  <section key={w.chip.code} className={styles.group}>
                    <h2 className={styles.groupTitle}>{w.chip.code}</h2>
                    <Field {...txt(`works.${w.chip.code}.name`, w.name)} label="Work" />
                    <Field {...txt(`works.${w.chip.code}.why`, w.why)} label="Why" multiline />
                  </section>
                ))}
                {model.works.extras.map((x) => (
                  <section key={x.n} className={styles.group}>
                    <Field {...txt(`extra.${x.n}.t`, x.t)} label="Also worth adding · title" />
                    <Field {...txt(`extra.${x.n}.d`, x.d)} label="Text" multiline />
                  </section>
                ))}
            <section className={styles.group} data-field="job.contact">
              <h2 className={styles.groupTitle}>Contact for quotes</h2>
              <AppleSelect value={r.job.contact} options={CONTACT_OPTIONS} onChange={(contact) => setJob({ contact })} />
            </section>

              </>
            )}
          </aside>
        </div>
      )}

      {saving && r && (
        <SaveReportModal
          owner={{ kind: "Job", no: `#${r.jobId}` }}
          siteId={r.job.siteId}
          defaultFilename={`${lib.label} Report - ${r.job.site || "Building"} - J${r.jobId}`}
          save={async (filename, d) => {
            const res = await fetch("/api/reports/export-inspection-pdf", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ report: r, filename, destinations: { job: d.owner, site: d.site } }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "PDF generation failed.");
            const out = (want: boolean, v: string | null) =>
              want ? { success: v === "yes", error: v === "yes" ? undefined : "Upload failed" } : undefined;
            return {
              filename: decodeURIComponent(res.headers.get("X-Filename") ?? filename),
              owner: out(d.owner, res.headers.get("X-Saved-To-Job")),
              site: out(d.site, res.headers.get("X-Saved-To-Site")),
            };
          }}
          onClose={() => setSaving(false)}
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

/** One photo, picked on the page: its label (tags), and the title and
 *  description the card prints. Left blank, the card uses the defect names
 *  and the label's note. */
function PhotoEditor({
  photo,
  view,
  index,
  count,
  lib,
  onBack,
  onStep,
  onChange,
  onRemove,
}: {
  photo: InspectionPhoto;
  view: PhotoView;
  index: number;
  count: number;
  lib: Library;
  onBack: () => void;
  onStep: (by: number) => void;
  onChange: (patch: Partial<Kept>) => void;
  onRemove: () => void;
}) {
  const parsed = parseLabel(photoLabel(photo), lib);
  const tags = parsed.kind === "photo" ? parsed : { zone: "", level: "", unit: null, codes: [] as string[], note: "" };
  const [adjusting, setAdjusting] = useState(false);
  // Typed freely; only complete tags (D10, L2, U403) reach the label.
  const [where, setWhere] = useState([tags.zone, tags.level, tags.unit].filter(Boolean).join(" "));
  const setLocation = (v: string) => {
    setWhere(v);
    const t = v.toUpperCase().split(/\s+/);
    onChange({
      label: composeLabel({
        ...tags,
        zone: t.find((x) => /^[DS]\d+$/.test(x)) ?? "",
        level: t.find((x) => /^L(\d+|G|R)$/.test(x)) ?? "",
        unit: t.find((x) => /^U\d+$/.test(x)) ?? null,
      }),
    });
  };
  const toggle = (c: string) =>
    onChange({ label: composeLabel({ ...tags, codes: tags.codes.includes(c) ? tags.codes.filter((x) => x !== c) : [...tags.codes, c] }) });
  return (
    <section className={styles.group}>
      <div className={styles.focusBar}>
        <button className={styles.linkBtn} onClick={onBack}>
          ‹ Back
        </button>
        <span className={styles.focusCount}>
          {index + 1} / {count}
        </span>
        <button className={styles.stepBtn} title="Previous photo" disabled={index <= 0} onClick={() => onStep(-1)}>
          ↑
        </button>
        <button className={styles.stepBtn} title="Next photo" disabled={index >= count - 1} onClick={() => onStep(1)}>
          ↓
        </button>
      </div>
      <div className={styles.editThumb} style={{ backgroundImage: `url("${photo.url}")` }} />
      <div className={styles.btnRow}>
        <button className={styles.smallBtn} onClick={() => setAdjusting(true)} title="Drag to move the photo in its frame; zoom in to crop">
          Adjust
        </button>
      </div>
      {adjusting && (
        <CropModal
          src={photo.url}
          aspect={4 / 3}
          pos={photo.pos}
          onDone={(pos) => {
            onChange({ pos });
            setAdjusting(false);
          }}
          onClose={() => setAdjusting(false)}
        />
      )}

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Codes</span>
        <CodeChips
          codes={lib.codes.map((c) => ({ code: c.code, name: c.name, bg: BANDS[c.band].bg, fg: BANDS[c.band].fg }))}
          on={tags.codes}
          onToggle={toggle}
        />
        <span className={styles.editHint}>
          {tags.codes.length ? tags.codes.map((c) => lib.codeMap[c].name).join(" · ") : "No code: shown under Other items of note"}
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Location <InfoTip>Optional. Zone (S# or D#), level (LG, L2, LR) and unit.</InfoTip>
        </span>
        <input className={styles.input} value={where} placeholder="e.g. D10 L2 U403" onChange={(e) => setLocation(e.target.value)} />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Title</span>
        <input
          className={styles.input}
          value={photo.title ?? ""}
          placeholder={view.autoName}
          onChange={(e) => onChange({ title: e.target.value || undefined })}
        />
      </label>

      <div className={styles.field}>
        <span className={styles.fieldLabel}>Description</span>
        <RichBox
          value={photo.desc ?? ""}
          placeholder="Optional: anything the client should know about this photo"
          onChange={(html) => onChange({ desc: notesIsEmpty(html) ? undefined : html })}
        />
      </div>
      <div className={styles.btnRow}>
        <button className={styles.smallBtn} onClick={onRemove}>
          Remove from page
        </button>
      </div>
    </section>
  );
}

/** A text field in the panel. data-field lets a click on the page find it. */
function Field({
  label,
  fieldKey,
  value,
  onChange,
  onReset,
  multiline,
}: {
  label: string;
  fieldKey: string;
  value: string;
  onChange: (v: string) => void;
  onReset?: () => void;
  multiline?: boolean;
}) {
  return (
    <div className={styles.field} data-field={fieldKey}>
      <span className={styles.fieldLabel}>
        {label}
        {onReset && (
          <button className={styles.linkBtn} onClick={onReset} title="Back to the standard wording">
            Reset
          </button>
        )}
      </span>
      {multiline ? (
        <RichBox value={value} onChange={onChange} />
      ) : (
        <input className={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

/** Maintenance plan: on or off, the wording, then the services. Tick a
 *  preset (or add your own), set how often and whether it's required; the
 *  technician's comments print under the table. Switching it on the first
 *  time ticks the required services and any that match defects found. */
type TextProps = { fieldKey: string; value: string; onChange: (v: string) => void; onReset?: () => void };

function PlanEditor({
  lib,
  plan,
  on,
  present,
  title,
  intro,
  onOn,
  onPlan,
}: {
  lib: Library;
  plan: InspectionReportData["plan"];
  on: boolean;
  present: string[];
  /** Editable wordings, as txt() gives them. */
  title: TextProps;
  intro: TextProps;
  onOn: (v: boolean) => void;
  onPlan: (plan: NonNullable<InspectionReportData["plan"]>) => void;
}) {
  const items = plan?.items ?? [];
  const set = (next: PlanItem[]) => onPlan({ ...plan, items: next });
  const patch = (i: number, p: Partial<PlanItem>) => set(items.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const custom = items.filter((x) => !lib.plan.some((s) => s.service === x.service));
  const switchOn = (v: boolean) => {
    if (v && !items.length)
      onPlan({
        ...plan,
        items: lib.plan
          .filter((s) => s.priority === "required" || s.whenAny?.some((c) => present.includes(c)))
          .map(({ service, interval, priority }) => ({ service, interval, priority })),
      });
    onOn(v);
  };
  const row = (x: PlanItem, i: number, own: boolean) => (
    <div key={own ? `own-${i}` : x.service} className={styles.planItem}>
      {own && <input className={styles.input} value={x.service} placeholder="Service" onChange={(e) => patch(i, { service: e.target.value })} />}
      <div className={styles.planControls}>
        <select className={styles.input} value={x.interval} onChange={(e) => patch(i, { interval: e.target.value })}>
          {[...new Set([x.interval, ...PLAN_INTERVALS])].map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <div className={styles.planPrio}>
          {(["required", "recommended"] as const).map((p) => (
            <button key={p} className={x.priority === p ? styles.planPrioOn : ""} onClick={() => patch(i, { priority: p })}>
              {p === "required" ? "Required" : "Recommended"}
            </button>
          ))}
        </div>
      </div>
      <input className={styles.input} value={x.next ?? ""} placeholder="Next due (optional), e.g. March 2027" onChange={(e) => patch(i, { next: e.target.value || undefined })} />
      {own && (
        <button className={styles.linkBtn} onClick={() => set(items.filter((_, j) => j !== i))}>
          Remove
        </button>
      )}
    </div>
  );
  return (
    <>
      <section className={styles.group}>
        <ToggleRow label="Include a maintenance plan" sub="Services, how often, and what's required" checked={on} onChange={switchOn} />
      </section>
      {on && (
        <>
          <section className={styles.group}>
            <Field {...title} label="Title" />
            <Field {...intro} label="Intro" multiline />
          </section>
          <section className={styles.group}>
            <h2 className={styles.groupTitle}>
              Services <InfoTip>Tick each service the plan includes. Required ones print first.</InfoTip>
            </h2>
            {lib.plan.map((s) => {
              const i = items.findIndex((x) => x.service === s.service);
              return (
                <div key={s.service} className={styles.planService}>
                  <label className={styles.planTick}>
                    <input
                      type="checkbox"
                      checked={i >= 0}
                      onChange={(e) =>
                        set(
                          e.target.checked
                            ? [...items, { service: s.service, interval: s.interval, priority: s.priority }]
                            : items.filter((x) => x.service !== s.service),
                        )
                      }
                    />
                    <span>{s.service}</span>
                  </label>
                  {i >= 0 && row(items[i], i, false)}
                </div>
              );
            })}
            {custom.map((x) => row(x, items.indexOf(x), true))}
            <div className={styles.btnRow}>
              <button className={styles.smallBtn} onClick={() => set([...items, { service: "", interval: "Annually", priority: "recommended" }])}>
                Add a service
              </button>
            </div>
          </section>
          <section className={styles.group} data-field="plan.notes">
            <h2 className={styles.groupTitle}>
              Technician comments <InfoTip>What this plan looks like in practice: priorities, budgeting, anything to watch. Printed under the table.</InfoTip>
            </h2>
            <RichBox value={plan?.notes ?? ""} onChange={(notes) => onPlan({ items, ...plan, notes })} />
          </section>
        </>
      )}
    </>
  );
}
