"use client";
// components/reports/proposal/ProposalPage.tsx
//
// Manual-entry proposal builder — v1. SimPRO quote import, save-to-job, and
// the findings photo-picker are all planned but not built yet (see the
// approved Proposal plan); this covers the job-detail fields, findings,
// scope, access plan and pricing, and exports straight to PDF via
// proposal.print.ts.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import pageStyles from "../shared/ReportPage.module.css";
import styles from "./ProposalPage.module.css";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import TextInput from "@/components/ui/TextInput";
import TextArea from "@/components/ui/TextArea";
import JobImportInput from "../shared/JobImportInput";
import ToggleRow from "../shared/ToggleRow";
import AccessMapEditor from "./AccessMapEditor";
import PhotoPickerModal, { type PhotosImportStatus } from "./PhotoPickerModal";
import { compressImageDataUrl } from "@/lib/reports/compressImage";
import { streamPhotoImport } from "@/lib/reports/streamPhotoImport";
import { uploadReportPhoto } from "@/lib/reports/uploadPhoto";
import {
  DEFAULT_PROPOSAL,
  newAccessZone,
  pricingSubtotal,
  pricingGst,
  pricingTotal,
  type ProposalData,
  type ProposalSectionToggles,
  type ProposalFinding,
  type ProposalAccessMap,
  type ProposalAccessStage,
  type ProposalPricingItem,
  type ReportPhoto,
} from "@/lib/reports/proposal.types";
import type { EnrichedQuote, QuotePricingItem } from "@/lib/simpro/client";

interface Props {
  onBack: () => void;
}

type ImportStatus =
  | { phase: "idle" }
  | { phase: "fetching-job" }
  | { phase: "error"; message: string }
  | { phase: "done" };

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_RETRY_MS = 5000;

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

const currency = (n: number) =>
  n.toLocaleString("en-AU", { style: "currency", currency: "AUD" });

// Company email convention: firstname@rasvertex.com.au.
function deriveEmailFromName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const clean = first.toLowerCase().replace(/[^a-z]/g, "");
  return clean ? `${clean}@rasvertex.com.au` : "";
}

export default function ProposalPage({ onBack }: Props) {
  const [report, setReport] = useState<ProposalData>(DEFAULT_PROPOSAL);
  const [isExporting, setIsExporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus>({
    phase: "idle",
  });
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── Photo pool (shared by the cover photo and every finding's photo) ────
  const [photosImportStatus, setPhotosImportStatus] =
    useState<PhotosImportStatus>({ phase: "idle" });
  const photoLoadId = useRef(0);

  // ── Import from SimPRO quote — resumes an existing draft if one exists ──
  const handleImport = useCallback(async (quoteIdInput: string) => {
    const quoteId = quoteIdInput.trim();
    if (!quoteId) return;

    setImportStatus({ phase: "fetching-job" });
    setSaveStatus("idle");

    // Quote header, pricing, and any in-progress draft don't depend on each
    // other — fire all three now. Checking for a draft here (not just on
    // page load) is what makes typing the same quote number again resume
    // the rep's own work instead of silently re-importing a blank slate.
    const pricingPromise = fetch(`/api/simpro/quotes/${quoteId}/pricing`).catch(
      () => null,
    );
    const draftPromise = fetch(`/api/proposal-reports/${quoteId}`).catch(
      () => null,
    );

    try {
      const res = await fetch(`/api/simpro/quotes/${quoteId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Quote fetch failed: HTTP ${res.status}`);
      }
      const quote: EnrichedQuote = await res.json();

      const draftRes = await draftPromise;
      const draft: ProposalData | null = draftRes?.ok
        ? ((await draftRes.json()) as { report: ProposalData }).report
        : null;

      // Live quote fields win over the draft's (a rep might have fixed the
      // client name in SimPRO since this draft was last saved), but fall
      // back to whatever the draft had if the quote is missing something.
      const jobFields = {
        buildingName: quote.siteName || draft?.job.buildingName || "",
        siteAddress: quote.siteAddress || draft?.job.siteAddress || "",
        clientName: quote.clientName || draft?.job.clientName || "",
        contactName: quote.contactName || draft?.job.contactName || "",
        preparedByName:
          quote.salespersonName || draft?.job.preparedByName || "",
        preparedByEmail: quote.salespersonName
          ? deriveEmailFromName(quote.salespersonName)
          : draft?.job.preparedByEmail || "",
        quoteId,
      };

      if (draft) {
        // Backfills fields added after this draft was first saved — an old
        // draft's JSON simply doesn't have them, so without this a resumed
        // draft crashes on whatever new field the rest of the page assumes
        // exists. Findings/scope/access plan/pricing edits/photos are the
        // rep's own work — kept from the draft; only the job header
        // refreshes from the live quote.
        setReport({
          ...DEFAULT_PROPOSAL,
          ...draft,
          job: { ...DEFAULT_PROPOSAL.job, ...draft.job, ...jobFields },
        });
      } else {
        setReport((prev) => ({ ...prev, job: { ...prev.job, ...jobFields } }));
      }
    } catch (err) {
      setImportStatus({
        phase: "error",
        message: err instanceof Error ? err.message : "Failed to fetch quote",
      });
      return;
    }

    // Pricing rows come from the quote's cost centers (one row per priced
    // line, each carrying its own $ total) — see fetchQuotePricingItems.
    try {
      const pricingRes = await pricingPromise;
      if (pricingRes?.ok) {
        const pricingItems: QuotePricingItem[] = await pricingRes.json();
        setReport((prev) => ({
          ...prev,
          pricing: {
            ...prev.pricing,
            items: [
              ...prev.pricing.items.filter((i) => i.source !== "simpro"),
              ...pricingItems.map((p) => ({
                id: uid(),
                groupLabel: p.groupLabel,
                label: p.label,
                amountExTax: p.amountExTax,
                source: "simpro" as const,
              })),
            ],
          },
        }));
      }
    } catch {
      // Pricing is a nice-to-have prefill — quote header import above is
      // what actually matters, so don't surface this as an error.
    }

    setImportStatus({ phase: "done" });
  }, []);

  // ── Autosave the draft, debounced, whenever the report changes ───────────
  // Keyed on the quote number (the proposal's natural id, editable directly
  // via the "SimPRO quote #" field) rather than a separate loaded-job flag —
  // it's the single source of truth already, so there's nothing to keep in
  // sync. Retries at a longer interval after a failed save.
  useEffect(() => {
    const quoteId = report.job.quoteId.trim();
    if (!quoteId) return;
    // Same guard as Condition/Anchor Inspection's autosave — never persist
    // while the quote's photo pool is still streaming in, or a save could
    // catch it mid-import (partial pool, or a photo still on its large
    // pre-upload data: URL).
    if (photosImportStatus.phase === "loading") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    const delay = saveStatus === "error" ? AUTOSAVE_RETRY_MS : AUTOSAVE_DEBOUNCE_MS;
    autosaveTimer.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/proposal-reports/${quoteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report),
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
  }, [report, photosImportStatus.phase]);

  const updateJob = useCallback(
    (patch: Partial<ProposalData["job"]>) => {
      setReport((prev) => ({ ...prev, job: { ...prev.job, ...patch } }));
    },
    [],
  );

  const updateSections = useCallback(
    (patch: Partial<ProposalSectionToggles>) => {
      setReport((prev) => ({ ...prev, sections: { ...prev.sections, ...patch } }));
    },
    [],
  );

  // Editing the name re-derives the email (firstname@rasvertex.com.au) —
  // still separately editable after, for the rare exception.
  const updatePreparedByName = useCallback((name: string) => {
    setReport((prev) => ({
      ...prev,
      job: {
        ...prev.job,
        preparedByName: name,
        preparedByEmail: deriveEmailFromName(name),
      },
    }));
  }, []);

  function readFileAsPhoto(file: File): Promise<ReportPhoto> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (ev) => {
        const raw = ev.target?.result as string;
        const url = await compressImageDataUrl(raw);
        resolve({
          id: uid(),
          name: file.name,
          url,
          size: file.size,
          dateAdded: new Date().toISOString(),
        });
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  const addPhotoToPool = useCallback((photo: ReportPhoto) => {
    setReport((prev) => ({ ...prev, photos: [...prev.photos, photo] }));
  }, []);

  // Fetches the quote's image attachments via SSE (see the API route for
  // why — large jobs/quotes can have a lot of photos, so they stream in
  // rather than one big blocking response) and appends any not already in
  // the pool.
  const fetchQuotePhotos = useCallback(() => {
    const quoteId = report.job.quoteId.trim();
    if (!quoteId) return Promise.resolve();
    const myGen = ++photoLoadId.current;
    const isStale = () => photoLoadId.current !== myGen;

    setPhotosImportStatus({ phase: "loading", loaded: 0, total: 0 });
    return streamPhotoImport(
      `/api/simpro/quotes/${quoteId}/attachments?companyId=0`,
      (photoId) => `proposal-reports/${quoteId}/${photoId}.jpg`,
      {
        isStale,
        onPhoto: (photo) =>
          setReport((prev) =>
            prev.photos.some((p) => p.id === photo.id)
              ? prev
              : { ...prev, photos: [...prev.photos, photo] },
          ),
        onPhotoUploaded: (id, blobUrl) =>
          setReport((prev) => ({
            ...prev,
            photos: prev.photos.map((p) =>
              p.id === id ? { ...p, url: blobUrl } : p,
            ),
          })),
        onProgress: (loaded, total) =>
          setPhotosImportStatus({ phase: "loading", loaded, total }),
        onDone: () => setPhotosImportStatus({ phase: "done" }),
        onError: (message) =>
          setPhotosImportStatus({ phase: "error", message }),
      },
    );
  }, [report.job.quoteId]);

  // ── Photo picker (shared modal — targets either the cover or a finding) ──
  type PickerTarget = { type: "cover" } | { type: "finding"; findingId: string };
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);

  const pickerSelectedId =
    pickerTarget?.type === "cover"
      ? report.job.sitePhotoId
      : pickerTarget
        ? (report.findings.find((f) => f.id === pickerTarget.findingId)?.photoId ?? null)
        : null;

  const handlePickerSelect = useCallback(
    (photoId: string) => {
      if (!pickerTarget) return;
      if (pickerTarget.type === "cover") {
        setReport((prev) => ({ ...prev, job: { ...prev.job, sitePhotoId: photoId } }));
      } else {
        setReport((prev) => ({
          ...prev,
          findings: prev.findings.map((f) =>
            f.id === pickerTarget.findingId ? { ...f, photoId } : f,
          ),
        }));
      }
      setPickerTarget(null);
    },
    [pickerTarget],
  );

  const handlePickerUpload = useCallback(
    async (file: File) => {
      const photo = await readFileAsPhoto(file);
      addPhotoToPool(photo);
      handlePickerSelect(photo.id);

      // Same instant-display-then-background-upload pattern as
      // fetchQuotePhotos above — swap in the Blob URL once it's ready.
      const blobUrl = await uploadReportPhoto(
        photo.url,
        `proposal-reports/${report.job.quoteId.trim() || "manual"}/${photo.id}.jpg`,
      );
      setReport((prev) => ({
        ...prev,
        photos: prev.photos.map((p) =>
          p.id === photo.id ? { ...p, url: blobUrl } : p,
        ),
      }));
    },
    [addPhotoToPool, handlePickerSelect, report.job.quoteId],
  );

  // ── Findings ────────────────────────────────────────────────────────────
  const addFinding = useCallback(() => {
    setReport((prev) =>
      prev.findings.length >= 6
        ? prev
        : {
            ...prev,
            findings: [
              ...prev.findings,
              { id: uid(), photoId: null, title: "", description: "" },
            ],
          },
    );
  }, []);

  const updateFinding = useCallback(
    (id: string, patch: Partial<ProposalFinding>) => {
      setReport((prev) => ({
        ...prev,
        findings: prev.findings.map((f) =>
          f.id === id ? { ...f, ...patch } : f,
        ),
      }));
    },
    [],
  );

  const removeFinding = useCallback((id: string) => {
    setReport((prev) => ({
      ...prev,
      findings: prev.findings.filter((f) => f.id !== id),
    }));
  }, []);

  // ── Scope ───────────────────────────────────────────────────────────────
  const updateScope = useCallback(
    (key: "included" | "excluded", text: string) => {
      setReport((prev) => ({
        ...prev,
        scope: { ...prev.scope, [key]: text.split("\n") },
      }));
    },
    [],
  );

  // ── Access plan ─────────────────────────────────────────────────────────
  const addStage = useCallback(() => {
    setReport((prev) => ({
      ...prev,
      accessPlan: {
        ...prev.accessPlan,
        stages: [
          ...prev.accessPlan.stages,
          { id: uid(), label: "", description: "" },
        ],
      },
    }));
  }, []);

  const updateStage = useCallback(
    (id: string, patch: Partial<ProposalAccessStage>) => {
      setReport((prev) => ({
        ...prev,
        accessPlan: {
          ...prev.accessPlan,
          stages: prev.accessPlan.stages.map((s) =>
            s.id === id ? { ...s, ...patch } : s,
          ),
        },
      }));
    },
    [],
  );

  const removeStage = useCallback((id: string) => {
    setReport((prev) => ({
      ...prev,
      accessPlan: {
        ...prev.accessPlan,
        stages: prev.accessPlan.stages.filter((s) => s.id !== id),
      },
    }));
  }, []);

  // A site can have more than one building/zone — same idea as Anchor
  // Inspection's zones. Each carries its own aerial capture and drop points;
  // stages (the project timeline) stay shared across all of them.
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(
    DEFAULT_PROPOSAL.accessPlan.zones[0]?.id ?? null,
  );

  const addZone = useCallback(() => {
    const zone = newAccessZone(`Building ${report.accessPlan.zones.length + 1}`);
    setReport((prev) => ({
      ...prev,
      accessPlan: { ...prev.accessPlan, zones: [...prev.accessPlan.zones, zone] },
    }));
    setExpandedZoneId(zone.id);
  }, [report.accessPlan.zones.length]);

  const renameZone = useCallback((id: string, name: string) => {
    setReport((prev) => ({
      ...prev,
      accessPlan: {
        ...prev.accessPlan,
        zones: prev.accessPlan.zones.map((z) => (z.id === id ? { ...z, name } : z)),
      },
    }));
  }, []);

  const removeZone = useCallback(
    (id: string) => {
      setReport((prev) => ({
        ...prev,
        accessPlan: {
          ...prev.accessPlan,
          zones: prev.accessPlan.zones.filter((z) => z.id !== id),
        },
      }));
      setExpandedZoneId((current) => (current === id ? null : current));
    },
    [],
  );

  const updateZoneMap = useCallback((id: string, map: ProposalAccessMap) => {
    setReport((prev) => ({
      ...prev,
      accessPlan: {
        ...prev.accessPlan,
        zones: prev.accessPlan.zones.map((z) => (z.id === id ? { ...z, map } : z)),
      },
    }));
  }, []);

  // ── Pricing ─────────────────────────────────────────────────────────────
  const addPricingItem = useCallback(() => {
    setReport((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        items: [
          ...prev.pricing.items,
          { id: uid(), groupLabel: "", label: "", amountExTax: 0, source: "manual" },
        ],
      },
    }));
  }, []);

  const updatePricingItem = useCallback(
    (id: string, patch: Partial<ProposalPricingItem>) => {
      setReport((prev) => ({
        ...prev,
        pricing: {
          ...prev.pricing,
          items: prev.pricing.items.map((p) =>
            p.id === id ? { ...p, ...patch } : p,
          ),
        },
      }));
    },
    [],
  );

  const removePricingItem = useCallback((id: string) => {
    setReport((prev) => ({
      ...prev,
      pricing: {
        ...prev.pricing,
        items: prev.pricing.items.filter((p) => p.id !== id),
      },
    }));
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const filename = report.job.quoteId
        ? `Proposal ${report.job.quoteId}`
        : "Proposal";

      const res = await fetch("/api/reports/export-proposal-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, report }),
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
      console.error("[ExportProposalPDF]", err);
      alert(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [report]);

  const hasReport = !!report.job.buildingName || !!report.job.quoteId;
  const subtotal = pricingSubtotal(report.pricing.items);

  // Group pricing rows by cost centre for display — manual rows (no
  // groupLabel) render together, ungrouped, in insertion order.
  const pricingGroups = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, ProposalPricingItem[]>();
    for (const item of report.pricing.items) {
      const key = item.groupLabel || "";
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(item);
    }
    return order.map((groupLabel) => ({
      groupLabel,
      items: map.get(groupLabel)!,
    }));
  }, [report.pricing.items]);

  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.topBar}>
        <IconButton
          variant="secondary"
          size="sm"
          onClick={onBack}
          aria-label="Back to report types"
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/icons/utility-outline/back.svg"
              alt=""
              width={18}
              height={18}
            />
          }
        />
        <div className={pageStyles.topBarRight}>
          <span className={pageStyles.topBarTitle}>Proposal</span>
          <JobImportInput
            onImport={handleImport}
            importStatus={importStatus}
            placeholder="SimPRO quote number"
          />
          {report.job.quoteId.trim() && saveStatus !== "idle" && (
            <span
              className={`${pageStyles.draftStatus} ${
                saveStatus === "error" ? pageStyles.draftStatusError : ""
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
            variant="primary"
            size="sm"
            onClick={handleExportPDF}
            disabled={!hasReport || isExporting}
          >
            {isExporting ? "Exporting…" : "Export PDF"}
          </Button>
        </div>
      </div>

      <div className={pageStyles.editorBody}>
        <div className={pageStyles.canvas}>
          {importStatus.phase === "error" && (
            <div className={styles.notice}>{importStatus.message}</div>
          )}
          {importStatus.phase === "done" && (
            <div className={styles.notice}>
              Imported client, contact and site address, and pulled in
              pricing line items and amounts from the quote below — review
              them before exporting.
            </div>
          )}

          {!report.job.quoteId.trim() && (
            <div className={styles.notice}>
              Enter a SimPRO quote number above to save a draft as you
              go — until then this only exists in the browser.
            </div>
          )}

          {/* ── Site photo ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Site Photo</div>
            {(() => {
              const sitePhoto = report.photos.find((p) => p.id === report.job.sitePhotoId);
              return sitePhoto ? (
                <div className={styles.row}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={sitePhoto.url} alt="Site" className={styles.sitePhotoPreview} />
                  <div className={styles.rowActions}>
                    <Button variant="outline" size="sm" onClick={() => setPickerTarget({ type: "cover" })}>
                      Change
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateJob({ sitePhotoId: null })}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setPickerTarget({ type: "cover" })}>
                  Choose site photo
                </Button>
              );
            })()}
          </div>

          {/* ── Project details ── */}
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Project Details</div>
            <div className={styles.grid2}>
              <TextInput id="buildingName" label="Building name" value={report.job.buildingName} onChange={(e) => updateJob({ buildingName: e.target.value })} />
              <TextInput id="siteAddress" label="Site address" value={report.job.siteAddress} onChange={(e) => updateJob({ siteAddress: e.target.value })} />
              <TextInput id="clientName" label="Client name" value={report.job.clientName} onChange={(e) => updateJob({ clientName: e.target.value })} />
              <TextInput id="contactName" label="Contact name" value={report.job.contactName} onChange={(e) => updateJob({ contactName: e.target.value })} />
              <TextInput id="preparedByName" label="Prepared by (salesperson)" value={report.job.preparedByName} onChange={(e) => updatePreparedByName(e.target.value)} />
              <TextInput id="preparedByEmail" label="Prepared by — email" value={report.job.preparedByEmail} onChange={(e) => updateJob({ preparedByEmail: e.target.value })} />
              <TextInput id="date" label="Proposal date" value={report.job.date} onChange={(e) => updateJob({ date: e.target.value })} />
              <TextInput id="quoteId" label="SimPRO quote # (also the proposal ref)" value={report.job.quoteId} onChange={(e) => updateJob({ quoteId: e.target.value })} />
              <TextInput id="inspectionDate" label="Inspection date" value={report.job.inspectionDate} onChange={(e) => updateJob({ inspectionDate: e.target.value })} />
              <TextInput id="distanceFromCoast" label="Distance from coast" value={report.job.distanceFromCoast} onChange={(e) => updateJob({ distanceFromCoast: e.target.value })} />
              <TextInput id="buildingType" label="Building type" value={report.job.buildingType} onChange={(e) => updateJob({ buildingType: e.target.value })} />
              <TextInput id="storeys" label="Storeys" value={report.job.storeys} onChange={(e) => updateJob({ storeys: e.target.value })} />
              <TextInput id="targetStart" label="Target start" value={report.job.targetStart} onChange={(e) => updateJob({ targetStart: e.target.value })} />
            </div>
            <TextArea id="conditionSummary" label="Condition summary" rows={3} value={report.job.conditionSummary} onChange={(e) => updateJob({ conditionSummary: e.target.value })} />
            <TextArea id="accessConstraint" label="Access constraints" rows={2} value={report.job.accessConstraint} onChange={(e) => updateJob({ accessConstraint: e.target.value })} />
          </div>

          {/* ── Findings ── */}
          <div className={styles.toggleCard}>
            <ToggleRow
              label="Include Findings in proposal"
              sub={report.sections.findings ? "Shown in the exported PDF" : "Hidden from the exported PDF"}
              checked={report.sections.findings}
              onChange={(v) => updateSections({ findings: v })}
            />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Findings ({report.findings.length}/6)</div>
            <div className={styles.list}>
              {report.findings.length === 0 && (
                <div className={styles.emptyHint}>No findings added yet.</div>
              )}
              {report.findings.map((f, i) => {
                const findingPhoto = report.photos.find((p) => p.id === f.photoId);
                return (
                  <div key={f.id} className={styles.listItem}>
                    <div className={styles.findingPhoto}>
                      {findingPhoto ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={findingPhoto.url} alt="" className={styles.findingPhotoThumb} />
                      ) : (
                        <div className={styles.findingPhotoThumb} />
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPickerTarget({ type: "finding", findingId: f.id })}
                      >
                        {findingPhoto ? "Change" : "Choose"}
                      </Button>
                      {findingPhoto && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateFinding(f.id, { photoId: null })}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                    <div className={styles.listItemBody}>
                      <TextInput
                        id={`finding-title-${f.id}`}
                        label={`Finding ${i + 1} — title`}
                        value={f.title}
                        onChange={(e) => updateFinding(f.id, { title: e.target.value })}
                      />
                      <TextArea
                        id={`finding-desc-${f.id}`}
                        label="Description"
                        rows={2}
                        value={f.description}
                        onChange={(e) => updateFinding(f.id, { description: e.target.value })}
                      />
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeFinding(f.id)}>Remove</Button>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" onClick={addFinding} disabled={report.findings.length >= 6}>
              Add finding
            </Button>
          </div>

          {/* ── Scope ── */}
          <div className={styles.toggleCard}>
            <ToggleRow
              label="Include Scope of Works in proposal"
              sub={report.sections.scope ? "Shown in the exported PDF" : "Hidden from the exported PDF"}
              checked={report.sections.scope}
              onChange={(v) => updateSections({ scope: v })}
            />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Scope of Works</div>
            <div className={styles.grid2}>
              <TextArea
                id="scopeIncluded"
                label="Included (one per line)"
                rows={6}
                value={report.scope.included.join("\n")}
                onChange={(e) => updateScope("included", e.target.value)}
              />
              <TextArea
                id="scopeExcluded"
                label="Excluded (one per line)"
                rows={6}
                value={report.scope.excluded.join("\n")}
                onChange={(e) => updateScope("excluded", e.target.value)}
              />
            </div>
          </div>

          {/* ── Access plan ── */}
          <div className={styles.toggleCard}>
            <ToggleRow
              label="Include Access Plan in proposal"
              sub={report.sections.accessPlan ? "Shown in the exported PDF" : "Hidden from the exported PDF"}
              checked={report.sections.accessPlan}
              onChange={(v) => updateSections({ accessPlan: v })}
            />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Access Plan</div>
            <div className={styles.list}>
              {report.accessPlan.stages.map((s) => (
                <div key={s.id} className={styles.row}>
                  <TextInput id={`stage-label-${s.id}`} label="Timing" value={s.label} onChange={(e) => updateStage(s.id, { label: e.target.value })} className={styles.rowGrow} />
                  <TextInput id={`stage-desc-${s.id}`} label="Description" value={s.description} onChange={(e) => updateStage(s.id, { description: e.target.value })} className={styles.rowGrow} />
                  <div className={styles.rowActions}>
                    <Button variant="ghost" size="sm" onClick={() => removeStage(s.id)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addStage}>Add stage</Button>

            <div className={styles.sectionTitle}>Buildings &amp; Drop Points</div>
            <div className={styles.list}>
              {report.accessPlan.zones.map((zone) => {
                const expanded = expandedZoneId === zone.id;
                return (
                  <div key={zone.id} className={styles.zoneCard}>
                    <div className={styles.row}>
                      <TextInput
                        id={`zone-name-${zone.id}`}
                        label="Building / Zone name"
                        value={zone.name}
                        onChange={(e) => renameZone(zone.id, e.target.value)}
                        className={styles.rowGrow}
                      />
                      <div className={styles.rowActions}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedZoneId(expanded ? null : zone.id)}
                        >
                          {expanded ? "Collapse" : "Edit"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete "${zone.name || "this building"}" and its drop points?`)) {
                              removeZone(zone.id);
                            }
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {expanded && (
                      <AccessMapEditor
                        map={zone.map}
                        stages={report.accessPlan.stages}
                        siteAddress={report.job.siteAddress}
                        onChange={(map) => updateZoneMap(zone.id, map)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <Button variant="outline" size="sm" onClick={addZone}>Add building</Button>
          </div>

          {/* ── Pricing ── */}
          <div className={styles.toggleCard}>
            <ToggleRow
              label="Include Pricing in proposal"
              sub={report.sections.pricing ? "Shown in the exported PDF" : "Hidden from the exported PDF"}
              checked={report.sections.pricing}
              onChange={(v) => updateSections({ pricing: v })}
            />
          </div>
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Pricing</div>
            {pricingGroups.map((group) => (
              <div key={group.groupLabel || "__ungrouped"} className={styles.priceGroup}>
                {group.groupLabel && (
                  <div className={styles.priceGroupHeader}>
                    <span>{group.groupLabel}</span>
                    <span>{currency(pricingSubtotal(group.items))}</span>
                  </div>
                )}
                <div className={styles.list}>
                  {group.items.map((p) => (
                    <div key={p.id} className={styles.priceRow}>
                      <TextInput id={`price-label-${p.id}`} label="Item" value={p.label} onChange={(e) => updatePricingItem(p.id, { label: e.target.value })} />
                      <TextInput
                        id={`price-amount-${p.id}`}
                        label="Amount (ex GST)"
                        type="number"
                        value={String(p.amountExTax)}
                        onChange={(e) => updatePricingItem(p.id, { amountExTax: parseFloat(e.target.value) || 0 })}
                      />
                      <div className={styles.rowActions}>
                        <Button variant="ghost" size="sm" onClick={() => removePricingItem(p.id)}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPricingItem}>Add line item</Button>

            <ToggleRow
              label="Break into line items"
              sub="Off shows one total per cost centre in the PDF; on lists every individual line item"
              checked={report.pricing.showLineItems}
              onChange={(v) =>
                setReport((prev) => ({
                  ...prev,
                  pricing: { ...prev.pricing, showLineItems: v },
                }))
              }
            />

            <div className={styles.pricingSummary}>
              <div className={styles.pricingSummaryRow}><span>Subtotal (ex GST)</span><span>{currency(subtotal)}</span></div>
              <div className={styles.pricingSummaryRow}><span>GST</span><span>{currency(pricingGst(report.pricing.items))}</span></div>
              <div className={styles.pricingSummaryTotal}><span>Total (inc GST)</span><span>{currency(pricingTotal(report.pricing.items))}</span></div>
            </div>

            <div className={styles.grid2}>
              <TextInput
                id="depositPct"
                label="Deposit %"
                type="number"
                value={String(report.pricing.depositPct)}
                onChange={(e) =>
                  setReport((prev) => ({
                    ...prev,
                    pricing: { ...prev.pricing, depositPct: parseFloat(e.target.value) || 0 },
                  }))
                }
              />
              <TextInput
                id="progressTerms"
                label="Progress payment terms"
                value={report.pricing.progressTerms}
                onChange={(e) =>
                  setReport((prev) => ({
                    ...prev,
                    pricing: { ...prev.pricing, progressTerms: e.target.value },
                  }))
                }
              />
            </div>
          </div>
        </div>
      </div>

      <PhotoPickerModal
        isOpen={pickerTarget !== null}
        onClose={() => setPickerTarget(null)}
        photos={report.photos}
        selectedId={pickerSelectedId}
        onSelect={handlePickerSelect}
        onUploadFile={handlePickerUpload}
        onImportFromQuote={fetchQuotePhotos}
        canImportFromQuote={!!report.job.quoteId}
        importStatus={photosImportStatus}
      />
    </div>
  );
}
