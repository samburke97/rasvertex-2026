"use client";
// components/reports/anchor-inspection/AnchorInspectionPage.tsx

import React, { useState, useCallback, useRef, useEffect } from "react";
import styles from "../shared/ReportPage.module.css";
import Button from "@/components/ui/Button";
import IconButton from "@/components/ui/IconButton";
import SaveToJobModal from "../shared/SaveToJobModal";
import SavedBadge from "../shared/SavedBadge";
import AnchorOptionsPanel from "./AnchorOptionsPanel";
import ZoneMapEditor from "./ZoneMapEditor";
import AnchorCoverSection from "./sections/AnchorCoverSection";
import ZoneSummarySection from "./sections/ZoneSummarySection";
import CertificationSection from "./sections/CertificationSection";
import SummarySignoffSection from "./sections/SummarySignoffSection";
import {
  DEFAULT_ANCHOR_REPORT,
  generateId,
  type AnchorReportData,
  type AnchorReportJob,
  type Zone,
} from "@/lib/reports/anchor.types";
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

const AUTOSAVE_DEBOUNCE_MS = 1500;
const AUTOSAVE_RETRY_MS = 5000;

// "11th March 2026" from a Date
function formatOrdinalDate(d: Date): string {
  const day = d.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";
  const month = d.toLocaleDateString("en-AU", { month: "long" });
  return `${day}${suffix} ${month} ${d.getFullYear()}`;
}

// Parse en-AU "DD/MM/YYYY" → Date
function parseAuDate(s: string): Date | null {
  const p = s.split("/");
  if (p.length !== 3) return null;
  const d = new Date(+p[2], +p[1] - 1, +p[0]);
  return isNaN(d.getTime()) ? null : d;
}

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

  // ── Export PDF — builds clean print HTML via anchor.print.ts ──────────────
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const filename = report.job.address
        ? `Anchor Inspection Report - ${report.job.address}`
        : "Anchor Inspection Report";

      const res = await fetch("/api/reports/export-anchor-pdf", {
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
      console.error("[ExportPDF]", err);
      alert(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    } finally {
      setIsExporting(false);
    }
  }, [report]);

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
      const d = parseAuDate(jobData.date);
      if (d) {
        inspectionDate = formatOrdinalDate(d);
        const ny = new Date(d);
        ny.setFullYear(ny.getFullYear() + 1);
        nextInspectionDate = formatOrdinalDate(ny);
      }
      return {
        ...fallback,
        preparedFor: jobData.preparedFor || "",
        address: jobData.siteAddress || "",
        date: jobData.date || fallback.date,
        certNumber: jobData.jobNo?.replace(/^#/, "") || "",
        buildingName: jobData.siteName || "",
        inspectionDate,
        nextInspectionDate,
        authorisedBy: "Archer Dutch",
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
  useEffect(() => {
    if (!loadedJobId) return;
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
  }, [report, loadedJobId]);

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

  const deleteZone = useCallback((zoneId: string) => {
    setReport((prev) => ({
      ...prev,
      zones: prev.zones.filter((z) => z.id !== zoneId),
    }));
    setView("editor");
    setEditingZoneId(null);
  }, []);

  const handleZoneUpdate = useCallback((updatedZone: Zone) => {
    setReport((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => (z.id === updatedZone.id ? updatedZone : z)),
    }));
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────
  const totalAnchors = report.zones.reduce(
    (sum, z) => sum + z.anchors.length,
    0,
  );
  const totalPassed = report.zones.reduce(
    (sum, z) => sum + z.anchors.filter((a) => a.result === "PASSED").length,
    0,
  );

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
            onClick={() => setShowSaveModal(true)}
            disabled={!loadedJobId}
          >
            Save to Job
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

          <div className={styles.pageLabel}>Summary &amp; Sign-off</div>
          <SummarySignoffSection />
        </div>
      </div>

      {/* Save to Job Modal */}
      {showSaveModal && (
        <SaveToJobModal
          jobId={loadedJobId}
          jobNo={`#${loadedJobId}`}
          companyId={0}
          defaultFilename={`Anchor Inspection Report - ${report.job.address || "Draft"}`}
          saveEndpoint={`/api/simpro/jobs/${loadedJobId}/save-anchor-report`}
          prepareBody={(filename, companyId) => ({
            filename,
            companyId,
            report,
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
