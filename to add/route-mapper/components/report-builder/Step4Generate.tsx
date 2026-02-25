"use client";
// components/report-builder/Step4Generate.tsx
// Final step: generate PDF via Puppeteer API route, download, then save to SimPRO.

import React, { useState } from "react";
import {
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  FileText,
  Loader2,
} from "lucide-react";
import type { CoverData, WizardPhoto } from "./ReportWizard";
import type { ReportData } from "@/lib/report/templates/variation";

interface Props {
  coverData: CoverData;
  photos: WizardPhoto[];
  groupByDate: boolean;
  jobId: number;
  onBack: () => void;
}

type Status =
  | "idle"
  | "generating"
  | "generated"
  | "uploading"
  | "uploaded"
  | "error";

export default function Step4Generate({
  coverData,
  photos,
  groupByDate,
  jobId,
  onBack,
}: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState("");

  const buildFilename = () => {
    const safe = coverData.projectTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    return `${safe}-${coverData.reportType}-report.pdf`;
  };

  const handleGenerate = async () => {
    setStatus("generating");
    setError("");
    setPdfBase64(null);

    try {
      // Build the payload matching ReportData interface
      const payload: ReportData = {
        preparedFor: coverData.preparedFor,
        preparedBy: coverData.preparedBy,
        projectTitle: coverData.projectTitle,
        address: coverData.address,
        reportDate: coverData.reportDate,
        reportType: coverData.reportType,
        heroImageDataUrl: coverData.heroImageDataUrl,
        photos: photos.map((p) => ({
          id: p.id,
          name: p.name,
          base64: p.base64,
          mimeType: p.mimeType,
          displayDate: p.displayDate,
          dateSource: p.dateSource,
        })),
        groupByDate,
        comments: coverData.comments,
        recommendations: coverData.recommendations,
      };

      const res = await fetch("/api/report/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "PDF generation failed");
      }

      // Get PDF as blob, convert to base64 for upload step
      const blob = await res.blob();
      const base64 = await blobToBase64(blob);
      setPdfBase64(base64);

      // Auto-download
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = buildFilename();
      a.click();
      URL.revokeObjectURL(url);

      setStatus("generated");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const handleSaveToSimPRO = async () => {
    if (!pdfBase64) return;
    setStatus("uploading");
    setError("");

    try {
      const filename = buildFilename();
      const res = await fetch("/api/report/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          companyId: 0,
          pdfBase64,
          filename,
          folderName: "Reports",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = await res.json();
      setUploadedFilename(result.filename || filename);
      setStatus("uploaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStatus("error");
    }
  };

  const handleDownloadAgain = () => {
    if (!pdfBase64) return;
    const bytes = atob(pdfBase64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const blob = new Blob([arr], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFilename();
    a.click();
    URL.revokeObjectURL(url);
  };

  const REPORT_LABEL: Record<string, string> = {
    variation: "Variation Report",
    inspection: "Inspection Report",
    completion: "Completion Report",
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Generate Report
        </h2>
        <p className="text-gray-500 text-sm">
          {photos.length} photos · {REPORT_LABEL[coverData.reportType]} ·{" "}
          {coverData.projectTitle}
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
          Report Summary
        </h3>
        <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
          {[
            ["Report Type", REPORT_LABEL[coverData.reportType]],
            ["Project", coverData.projectTitle],
            ["Prepared For", coverData.preparedFor],
            ["Prepared By", coverData.preparedBy],
            ["Date", coverData.reportDate],
            ["Photos", `${photos.length} selected`],
            ["Grouping", groupByDate ? "Grouped by date" : "No grouping"],
            ["Address", coverData.address],
          ].map(([label, value]) => (
            <div key={label}>
              <div className="text-xs text-gray-400 mb-0.5">{label}</div>
              <div className="font-medium text-gray-800">{value || "—"}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Action area */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        {/* Step 1: Generate */}
        <div
          className={`flex items-center gap-4 pb-5 mb-5 border-b border-gray-100 ${status !== "idle" && status !== "generating" ? "opacity-60" : ""}`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              status === "generated" ||
              status === "uploading" ||
              status === "uploaded"
                ? "bg-green-100 text-green-600"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {status === "generated" ||
            status === "uploading" ||
            status === "uploaded" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">
              Generate PDF
            </div>
            <div className="text-xs text-gray-400">
              Rendered by Puppeteer · downloads automatically
            </div>
          </div>
          <button
            onClick={
              status === "idle" || status === "error"
                ? handleGenerate
                : handleDownloadAgain
            }
            disabled={status === "generating" || status === "uploading"}
            className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-colors ${
              status === "generated" || status === "uploaded"
                ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "bg-blue-900 hover:bg-blue-800 text-white disabled:opacity-50 disabled:cursor-not-allowed"
            }`}
          >
            {status === "generating" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Generating…
              </>
            ) : status === "generated" || status === "uploaded" ? (
              <>
                <Download className="w-4 h-4" /> Download again
              </>
            ) : (
              <>
                <Download className="w-4 h-4" /> Generate & Download
              </>
            )}
          </button>
        </div>

        {/* Step 2: Save to SimPRO */}
        <div
          className={`flex items-center gap-4 ${status !== "generated" && status !== "uploading" && status !== "uploaded" ? "opacity-40" : ""}`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              status === "uploaded"
                ? "bg-green-100 text-green-600"
                : "bg-gray-50 text-gray-400"
            }`}
          >
            {status === "uploaded" ? (
              <CheckCircle className="w-5 h-5" />
            ) : (
              <Upload className="w-5 h-5" />
            )}
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">
              Save to SimPRO Job
            </div>
            <div className="text-xs text-gray-400">
              {status === "uploaded"
                ? `Saved as "${uploadedFilename}" in the Reports folder`
                : `Uploads to job #${jobId} · Reports folder`}
            </div>
          </div>
          <button
            onClick={handleSaveToSimPRO}
            disabled={status !== "generated" || !pdfBase64}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 bg-green-700 hover:bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {status === "uploading" ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving…
              </>
            ) : status === "uploaded" ? (
              <>
                <CheckCircle className="w-4 h-4" /> Saved
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" /> Save to Job
              </>
            )}
          </button>
        </div>
      </div>

      {/* Error */}
      {status === "error" && error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-800 mb-0.5">
              Something went wrong
            </div>
            <div className="text-xs text-red-600">{error}</div>
          </div>
        </div>
      )}

      {/* Success */}
      {status === "uploaded" && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-5 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-green-800 mb-0.5">
              All done!
            </div>
            <div className="text-xs text-green-600">
              The PDF has been saved to SimPRO job #{jobId} in the Reports
              folder.
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <button
        onClick={onBack}
        disabled={status === "generating" || status === "uploading"}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors disabled:opacity-40"
      >
        <ChevronLeft className="w-4 h-4" /> Back to photo selection
      </button>
    </div>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix — we only want the base64 bytes
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
