"use client";
// components/reports/anchor-inspection/AnchorInspectionPage.tsx

import React, { useState, useCallback, useRef, useEffect } from "react";
import styles from "../shared/ReportPage.module.css";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import SaveReportModal from "../shared/SaveReportModal";
import {
  compressImageDataUrl,
  compressMapImageDataUrl,
} from "@/lib/reports/compressImage";
import { streamPhotoImport } from "@/lib/reports/streamPhotoImport";
import { uploadReportPhoto, deleteReportPhoto } from "@/lib/reports/uploadPhoto";
import SavedBadge from "../shared/SavedBadge";
import AnchorOptionsPanel from "./AnchorOptionsPanel";
import ZoneMapEditor from "./ZoneMapEditor";
import AnchorCoverSection from "./sections/AnchorCoverSection";
import ZoneSummarySection from "./sections/ZoneSummarySection";
import CertificationSection from "./sections/CertificationSection";
import SummarySignoffSection from "./sections/SummarySignoffSection";
import PhotoSection from "../shared/PhotoSection";
import {
  DEFAULT_ANCHOR_REPORT,
  generateId,
  type AnchorReportData,
  type AnchorReportJob,
  type PhotoFolder,
  type ReportPhoto,
  type Zone,
} from "@/lib/reports/anchor.types";
import { filterPhotosByDateRange } from "@/lib/reports/photos";
import {
  formatReportDate,
  formatReportDateText,
  parseReportDate,
} from "@/lib/reports/format-report-date";
import type { EnrichedJob } from "@/lib/simpro/types";

interface AnchorInspectionPageProps {
  onBack: () => void;
}

type View = "editor" | "zone-map";
type SaveStatus = "idle" | "saving" | "saved" | "error";

export type AnchorImportStatus =
  | { phase: "idle" }
  | { phase: "fetching-job" }
  | { phase: "done" }
  | { phase: "error"; message: string };

type PhotoLoadStatus =
  | { phase: "idle" }
  | { phase: "fetching-photos"; loaded: number; total: number }
  | { phase: "done" }
  | { phase: "error"; message: string };

const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_RETRY_MS = 5000;

export default function AnchorInspectionPage({
  onBack,
}: AnchorInspectionPageProps) {
  const [report, setReport] = useState<AnchorReportData>(DEFAULT_ANCHOR_REPORT);
  const [view, setView] = useState<View>("editor");
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [importStatus, setImportStatus] = useState<AnchorImportStatus>({
    phase: "idle",
  });
  const [loadedJobId, setLoadedJobId] = useState<string>("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [savedFilename, setSavedFilename] = useState<string | null>(null);
  const currentLoadId = useRef(0);
  const [isExporting, setIsExporting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Supporting photos (optional) ───────────────────────────────────────
  const [photoImportStatus, setPhotoImportStatus] = useState<PhotoLoadStatus>({
    phase: "idle",
  });
  const [photoFolders, setPhotoFolders] = useState<PhotoFolder[]>([]);
  const [selectedPhotoFolderId, setSelectedPhotoFolderId] = useState<
    number | null
  >(null);
  const photoLoadId = useRef(0);

  // Self-healing safety net for reports saved before zone-map images were
  // compressed at capture/upload time (see ZoneMapEditor.tsx) — re-compresses
  // whatever is currently in state right before it leaves the browser, so an
  // old draft with a multi-MB uncompressed map doesn't need a manual
  // re-upload to export or save cleanly. Cheap when already small: both
  // compressors skip their own re-encode below ~150KB. Map images use the
  // higher-quality compressMapImageDataUrl (not the photo-thumbnail
  // compressImageDataUrl) — the map is a full-bleed background shown near
  // page width, not a small grid cell, so re-running it through the
  // thumbnail settings here would silently undo ZoneMapEditor's capture
  // quality on every save/export.
  const compressReportForTransfer = useCallback(
    async (r: AnchorReportData): Promise<AnchorReportData> => ({
      ...r,
      zones: await Promise.all(
        r.zones.map(async (zone) => ({
          ...zone,
          mapImageUrl: zone.mapImageUrl
            ? await compressMapImageDataUrl(zone.mapImageUrl)
            : zone.mapImageUrl,
        })),
      ),
      photos: await Promise.all(
        r.photos.map(async (photo) => ({
          ...photo,
          url: await compressImageDataUrl(photo.url),
        })),
      ),
    }),
    [],
  );

  // ── Export PDF — builds clean print HTML via anchor.print.ts ──────────────
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const filename = report.job.address
        ? `Anchor Inspection Report - ${report.job.address}`
        : "Anchor Inspection Report";

      // Match what's actually shown on screen — export the same
      // enabled/date-filtered photo set as the live preview (filteredPhotos
      // below), not the full unfiltered pool. Also means the server only
      // has to resolve/inline photos that will actually appear in the PDF.
      const photosToExport = !report.photoSettings.enabled
        ? []
        : report.photoSettings.filterByDate
          ? filterPhotosByDateRange(
              report.photos,
              report.photoSettings.dateFrom,
              report.photoSettings.dateTo,
            )
          : report.photos;

      const exportReport = await compressReportForTransfer({
        ...report,
        photos: photosToExport,
      });
      const res = await fetch("/api/reports/export-anchor-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, report: exportReport }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename + ".pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[ExportPDF]", err);
      alert(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [report, compressReportForTransfer]);

  // ── Job detail handlers ────────────────────────────────────────────────
  const updateJob = useCallback(
    (field: keyof AnchorReportJob, value: string | null) => {
      setReport((prev) => ({ ...prev, job: { ...prev.job, [field]: value } }));
    },
    [],
  );

  // Builds the SimPRO-sourced admin fields (address, prepared-for, dates,
  // etc.) fresh from a job fetch. These always come from SimPRO — never
  // trusted from a stale draft snapshot — so a resumed draft can't get
  // stuck showing site data that's since been corrected upstream.
  const buildJobFields = useCallback(
    (jobData: EnrichedJob, fallback: AnchorReportJob): AnchorReportJob => {
      let inspectionDate = fallback.inspectionDate;
      let nextInspectionDate = fallback.nextInspectionDate;
      const d = parseReportDate(jobData.date);
      if (d) {
        inspectionDate = formatReportDate(d);
        const ny = new Date(d);
        ny.setFullYear(ny.getFullYear() + 1);
        nextInspectionDate = formatReportDate(ny);
      }
      return {
        ...fallback,
        preparedFor: jobData.preparedFor || "",
        address: jobData.siteAddress || "",
        date: jobData.date
          ? formatReportDateText(jobData.date)
          : fallback.date,
        certNumber: jobData.jobNo?.replace(/^#/, "") || "",
        buildingName: jobData.siteName || "",
        inspectionDate,
        nextInspectionDate,
        authorisedBy: "Archer Dutch",
        siteId: jobData.siteId || "",
      };
    },
    [],
  );

  // ── Load job from SimPRO — resuming an existing draft if one exists ───────
  const handleImport = useCallback(
    async (jobNumber: string) => {
      const loadId = ++currentLoadId.current;
      const isStale = () => currentLoadId.current !== loadId;

      setImportStatus({ phase: "fetching-job" });
      setSaveStatus("idle");
      setSavedFilename(null);
      setPhotoImportStatus({ phase: "idle" });
      setPhotoFolders([]);
      setSelectedPhotoFolderId(null);

      try {
        // Fetch the SimPRO job details and check for an in-progress draft in
        // parallel — typing the same job number a tech already started is
        // the entire "resume" UX, no extra list/search UI needed.
        const [jobRes, draftRes] = await Promise.all([
          fetch(`/api/simpro/jobs/${jobNumber}?companyId=0`),
          fetch(`/api/anchor-inspection-reports/${jobNumber}`),
        ]);
        if (isStale()) return;

        const jobData: EnrichedJob | null = jobRes.ok
          ? await jobRes.json()
          : null;
        if (isStale()) return;

        if (draftRes.ok) {
          const { report: draft } = (await draftRes.json()) as {
            report: AnchorReportData;
          };
          if (isStale()) return;
          setReport({
            // Backfills fields added after this draft was first saved (e.g.
            // photos/photoSettings) — an old draft's JSON simply doesn't
            // have them, so without this a resumed draft crashes on
            // whatever new field the rest of the page assumes exists.
            ...DEFAULT_ANCHOR_REPORT,
            ...draft,
            // Zones/anchors/comments are the tech's own work — keep them
            // from the draft. Admin fields refresh from SimPRO so a fixed
            // address (or any other corrected site detail) actually shows
            // up next time the draft is opened, instead of staying frozen
            // at whatever was true when the draft was first created.
            job: jobData ? buildJobFields(jobData, draft.job) : draft.job,
          });
          setLoadedJobId(jobNumber);
          setImportStatus({ phase: "done" });
          return;
        }

        if (!jobData)
          throw new Error(`Job fetch failed: HTTP ${jobRes.status}`);

        // Start from a clean report (not the previous job's zones/anchors —
        // only merge job fields on top of a fresh draft).
        setReport({
          ...DEFAULT_ANCHOR_REPORT,
          job: buildJobFields(jobData, DEFAULT_ANCHOR_REPORT.job),
        });

        setLoadedJobId(jobNumber);
        setImportStatus({ phase: "done" });
      } catch (err) {
        if (isStale()) return;
        setImportStatus({
          phase: "error",
          message: err instanceof Error ? err.message : "Failed to fetch job",
        });
      }
    },
    [buildJobFields],
  );

  // ── Autosave the draft, debounced, whenever the report changes ───────────
  // Never persist while photos are still streaming in — see the identical
  // guard + explanation in ConditionReportPage.tsx's autosave effect. A
  // draft saved mid-stream here would resume with a partial photo set next
  // time, exactly like the bug that hit Condition Report job 10970.
  useEffect(() => {
    if (!loadedJobId) return;
    if (photoImportStatus.phase === "fetching-photos") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    const delay = saveStatus === "error" ? AUTOSAVE_RETRY_MS : AUTOSAVE_DEBOUNCE_MS;
    autosaveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(
          `/api/anchor-inspection-reports/${loadedJobId}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(report),
          },
        );
        setSaveStatus(res.ok ? "saved" : "error");
      } catch {
        setSaveStatus("error");
      }
    }, delay);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [report, loadedJobId, photoImportStatus.phase]);

  // ── Zone handlers ──────────────────────────────────────────────────────
  const addZone = useCallback(() => {
    const newZone: Zone = {
      id: generateId(),
      name: `Zone ${report.zones.length + 1}`,
      mapImageUrl: null,
      anchors: [],
    };
    setReport((prev) => ({ ...prev, zones: [...prev.zones, newZone] }));
  }, [report.zones.length]);

  const openZoneMap = useCallback((zoneId: string) => {
    setEditingZoneId(zoneId);
    setView("zone-map");
  }, []);

  const deleteZone = useCallback(
    (zoneId: string) => {
      const zone = report.zones.find((z) => z.id === zoneId);
      if (zone?.mapImageUrl) deleteReportPhoto(zone.mapImageUrl);
      setReport((prev) => ({
        ...prev,
        zones: prev.zones.filter((z) => z.id !== zoneId),
      }));
      setView("editor");
      setEditingZoneId(null);
    },
    [report.zones],
  );

  // Zone maps go through the same Blob pipeline as every other photo — see
  // uploadPhoto.ts. ZoneMapEditor always hands back a fresh data: URL
  // (freshly captured or uploaded, already compressed) via this one update
  // path, so it's the single place to upload it and swap the field over.
  // The mapImageUrl === dataUrl check on the swap-back guards against a
  // second update landing (e.g. re-cropping again) before the first
  // upload finishes — don't clobber newer state with a stale result.
  const handleZoneUpdate = useCallback(
    (updatedZone: Zone) => {
      const prevMapUrl = report.zones.find((z) => z.id === updatedZone.id)
        ?.mapImageUrl;

      setReport((prev) => ({
        ...prev,
        zones: prev.zones.map((z) => (z.id === updatedZone.id ? updatedZone : z)),
      }));

      if (updatedZone.mapImageUrl?.startsWith("data:")) {
        if (prevMapUrl && prevMapUrl !== updatedZone.mapImageUrl)
          deleteReportPhoto(prevMapUrl);
        const dataUrl = updatedZone.mapImageUrl;
        uploadReportPhoto(
          dataUrl,
          `anchor-reports/${loadedJobId || "manual"}/zone-${updatedZone.id}-${Date.now()}.jpg`,
        ).then((blobUrl) => {
          setReport((prev) => ({
            ...prev,
            zones: prev.zones.map((z) =>
              z.id === updatedZone.id && z.mapImageUrl === dataUrl
                ? { ...z, mapImageUrl: blobUrl }
                : z,
            ),
          }));
        });
      } else if (!updatedZone.mapImageUrl && prevMapUrl) {
        deleteReportPhoto(prevMapUrl);
      }
    },
    [report.zones, loadedJobId],
  );

  // ── Supporting photos ──────────────────────────────────────────────────
  // Entirely optional — nothing here fires until the tech turns on "Add
  // Photos" in the options panel, unlike the condition report where photos
  // load automatically on import.

  const updatePhotoSettings = useCallback(
    (s: AnchorReportData["photoSettings"]) => {
      setReport((prev) => ({ ...prev, photoSettings: s }));
    },
    [],
  );

  const removePhoto = useCallback(
    (id: string) => {
      const removed = report.photos.find((p) => p.id === id);
      if (removed) deleteReportPhoto(removed.url);
      setReport((prev) => ({
        ...prev,
        photos: prev.photos.filter((p) => p.id !== id),
      }));
    },
    [report.photos],
  );

  const renamePhoto = useCallback((id: string, name: string) => {
    setReport((prev) => ({
      ...prev,
      photos: prev.photos.map((p) => (p.id !== id ? p : { ...p, name })),
    }));
  }, []);

  // Manual upload — compresses each file, shows it immediately, then
  // uploads it to Blob in the background and swaps in that URL once ready.
  // Same reasoning as fetchPhotos below: uncompressed camera photos here
  // were the worst offender for payload size (SimPRO photos at least got
  // compressed on the way in) since this stored the raw FileReader result
  // straight into state with no compression at all.
  const handleUploadPhotos = useCallback(
    (files: FileList) => {
      Array.from(files).forEach((file) => {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const result = ev.target?.result;
          if (typeof result !== "string") return;
          const compressedUrl = await compressImageDataUrl(result);
          const photoId = generateId();
          const photo: ReportPhoto = {
            id: photoId,
            name: file.name,
            url: compressedUrl,
            size: file.size,
            dateAdded: new Date().toISOString(),
          };
          setReport((prev) => ({ ...prev, photos: [...prev.photos, photo] }));

          const blobUrl = await uploadReportPhoto(
            compressedUrl,
            `anchor-reports/${loadedJobId || "manual"}/${photoId}.jpg`,
          );
          setReport((prev) => ({
            ...prev,
            photos: prev.photos.map((p) =>
              p.id === photoId ? { ...p, url: blobUrl } : p,
            ),
          }));
        };
        reader.readAsDataURL(file);
      });
    },
    [loadedJobId],
  );

  // Pull from job — streams photos in via SSE, same protocol/endpoint as
  // Condition Report's photo import (lib/reports/condition.types.ts's
  // ImportStatus "fetching-photos" phase mirrors this one).
  const fetchPhotos = useCallback(
    (jobNumber: string, folderId: number | null) => {
      const myGen = ++photoLoadId.current;
      const isStale = () => photoLoadId.current !== myGen;
      setReport((prev) => ({ ...prev, photos: [] }));
      setPhotoImportStatus({ phase: "fetching-photos", loaded: 0, total: 0 });
      const folderQuery = folderId != null ? `&folderId=${folderId}` : "";
      return streamPhotoImport(
        `/api/simpro/jobs/${jobNumber}/attachments?companyId=0${folderQuery}`,
        (photoId) => `anchor-reports/${jobNumber}/${photoId}.jpg`,
        {
          isStale,
          onPhoto: (photo) =>
            setReport((prev) => ({ ...prev, photos: [...prev.photos, photo] })),
          onPhotoUploaded: (id, blobUrl) =>
            setReport((prev) => ({
              ...prev,
              photos: prev.photos.map((p) =>
                p.id === id ? { ...p, url: blobUrl } : p,
              ),
            })),
          onProgress: (loaded, total) =>
            setPhotoImportStatus({ phase: "fetching-photos", loaded, total }),
          onDone: () => setPhotoImportStatus({ phase: "done" }),
          onError: (message) =>
            setPhotoImportStatus({ phase: "error", message }),
        },
      );
    },
    [],
  );

  const handleSelectPhotoFolder = useCallback(
    (folderId: number | null) => {
      setSelectedPhotoFolderId(folderId);
      if (loadedJobId) fetchPhotos(loadedJobId, folderId);
    },
    [loadedJobId, fetchPhotos],
  );

  // Discards the saved draft for the current job and re-imports everything
  // fresh from SimPRO — see the identical handler in ConditionReportPage.tsx.
  const handleResetDraft = useCallback(async () => {
    if (!loadedJobId) return;
    if (
      !window.confirm(
        "Discard the saved draft and reload this job fresh from SimPRO? Any zones, anchors, or comments typed here will be lost.",
      )
    )
      return;
    try {
      await fetch(`/api/anchor-inspection-reports/${loadedJobId}`, {
        method: "DELETE",
      });
    } catch {
      // Even if the delete fails, re-importing below will just overwrite
      // the stale draft on the next autosave — not a blocker either way.
    }
    handleImport(loadedJobId);
  }, [loadedJobId, handleImport]);

  // "Pull From Job" button — fetches the folder list (if not already
  // fetched) and either shows a folder picker (more than one folder) or
  // imports everything straight away (0 or 1 folder, nothing to choose).
  const handleLoadPhotosFromJob = useCallback(async () => {
    if (!loadedJobId) return;
    if (photoFolders.length > 0) {
      fetchPhotos(loadedJobId, selectedPhotoFolderId);
      return;
    }
    try {
      const res = await fetch(
        `/api/simpro/jobs/${loadedJobId}/attachments/folders?companyId=0`,
      );
      const data = res.ok ? await res.json() : {};
      const folders: PhotoFolder[] = data.folders ?? [];
      if (folders.length > 1) {
        setPhotoFolders(folders);
        return;
      }
    } catch {
      // Treat as "no folders" — fall through to importing everything.
    }
    fetchPhotos(loadedJobId, null);
  }, [loadedJobId, photoFolders, selectedPhotoFolderId, fetchPhotos]);

  // ── Derived ────────────────────────────────────────────────────────────
  const totalAnchors = report.zones.reduce(
    (sum, z) => sum + z.anchors.length,
    0,
  );
  const totalPassed = report.zones.reduce(
    (sum, z) => sum + z.anchors.filter((a) => a.result === "PASSED").length,
    0,
  );
  const filteredPhotos = report.photoSettings.filterByDate
    ? filterPhotosByDateRange(
        report.photos,
        report.photoSettings.dateFrom,
        report.photoSettings.dateTo,
      )
    : report.photos;

  // ── Zone map view ──────────────────────────────────────────────────────
  if (view === "zone-map" && editingZoneId) {
    const zone = report.zones.find((z) => z.id === editingZoneId);
    if (zone) {
      return (
        <ZoneMapEditor
          zone={zone}
          jobAddress={report.job.address}
          defaultInspectionDate={report.job.inspectionDate}
          defaultNextInspection={report.job.nextInspectionDate}
          onUpdate={handleZoneUpdate}
          onBack={() => {
            setView("editor");
            setEditingZoneId(null);
          }}
          onDelete={() => deleteZone(editingZoneId)}
        />
      );
    }
  }

  return (
    <div className={styles.page}>
      {/* ── Top bar ── */}
      <div className={styles.topBar}>
        <IconButton
          variant="secondary"
          size="sm"
          onClick={onBack}
          aria-label="Back to report types"
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/icons/utility-outline/back.svg" alt="" width={18} height={18} />
          }
        />
        <div className={styles.topBarRight}>
          <span className={styles.topBarTitle}>Anchor Inspection</span>
          <span className={styles.badge}>
            {report.zones.length} zone{report.zones.length !== 1 ? "s" : ""}
          </span>
          {totalAnchors > 0 && (
            <span className={styles.badge}>
              {totalAnchors} anchor{totalAnchors !== 1 ? "s" : ""}
            </span>
          )}
          {savedFilename && <SavedBadge />}
          {loadedJobId && saveStatus !== "idle" && (
            <span
              className={`${styles.draftStatus} ${
                saveStatus === "error" ? styles.draftStatusError : ""
              }`}
            >
              {saveStatus === "saving"
                ? "Saving draft…"
                : saveStatus === "error"
                  ? "Draft save failed — retrying"
                  : "Draft saved"}
            </span>
          )}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleResetDraft}
            disabled={!loadedJobId}
          >
            Reload from SimPRO
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowSaveModal(true)}
            disabled={!loadedJobId}
          >
            Save
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.editorBody}>
        <AnchorOptionsPanel
          zones={report.zones}
          onAddZone={addZone}
          onOpenZone={openZoneMap}
          onDeleteZone={deleteZone}
          totalAnchors={totalAnchors}
          totalPassed={totalPassed}
          importStatus={importStatus}
          onImport={handleImport}
          hasLoadedJob={!!loadedJobId}
          photos={report.photos}
          photoSettings={report.photoSettings}
          onPhotoSettings={updatePhotoSettings}
          photoImportStatus={photoImportStatus}
          photoFolders={photoFolders}
          selectedPhotoFolderId={selectedPhotoFolderId}
          onSelectPhotoFolder={handleSelectPhotoFolder}
          onLoadPhotosFromJob={handleLoadPhotosFromJob}
          onUploadPhotos={handleUploadPhotos}
        />

        {/* ── Canvas ── */}
        <div className={styles.canvas}>
          <div className={styles.pageLabel}>Cover Page</div>
          <AnchorCoverSection job={report.job} onUpdate={updateJob} />

          {report.zones.length > 0 && (
            <>
              <div className={styles.pageLabel}>
                Zones &middot; {report.zones.length} zone
                {report.zones.length !== 1 ? "s" : ""}
              </div>
              {report.zones.map((zone) => (
                <ZoneSummarySection
                  key={zone.id}
                  zone={zone}
                  onEditZone={() => openZoneMap(zone.id)}
                />
              ))}
            </>
          )}

          <div className={styles.pageLabel}>Certification</div>
          <CertificationSection
            job={report.job}
            zones={report.zones}
            onUpdate={updateJob}
          />

          {report.photoSettings.enabled && (
            <>
              <div className={styles.pageLabel}>
                Supporting Photos
                {filteredPhotos.length > 0 &&
                  ` · ${filteredPhotos.length} photo${filteredPhotos.length !== 1 ? "s" : ""}`}
              </div>
              <PhotoSection
                photos={filteredPhotos}
                importStatus={photoImportStatus}
                showDates={report.photoSettings.showDates}
                layout={report.photoSettings.photoLayout}
                onPhotoRemove={removePhoto}
                onPhotoRename={renamePhoto}
                emptyMessage="No photos yet — upload some or pull them from the job."
              />
            </>
          )}

          <div className={styles.pageLabel}>Summary &amp; Sign-off</div>
          <SummarySignoffSection />
        </div>
      </div>

      {/* Save Report Modal */}
      {showSaveModal && (
        <SaveReportModal
          jobId={loadedJobId}
          jobNo={`#${loadedJobId}`}
          companyId={0}
          siteId={report.job.siteId}
          defaultFilename={`Anchor Inspection Report - ${new Date().getFullYear()}`}
          saveEndpoint={`/api/simpro/jobs/${loadedJobId}/save-anchor-report`}
          prepareBody={async (filename, companyId, destinations) => ({
            filename,
            companyId,
            siteId: report.job.siteId,
            destinations,
            report: await compressReportForTransfer(report),
          })}
          onClose={() => setShowSaveModal(false)}
          onSuccess={(filename) => {
            setSavedFilename(filename);
            setShowSaveModal(false);
          }}
        />
      )}
    </div>
  );
}
