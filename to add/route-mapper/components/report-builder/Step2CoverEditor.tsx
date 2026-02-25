"use client";
// components/report-builder/Step2CoverEditor.tsx
// Live cover page preview with click-to-edit fields and hero image upload.
// What you see on the left = what Puppeteer prints.

import React, { useRef, useState } from "react";
import { Upload, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import type { CoverData, ReportType } from "./ReportWizard";

interface Props {
  coverData: CoverData;
  onUpdate: (partial: Partial<CoverData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  variation: "Variation Report",
  inspection: "Inspection Report",
  completion: "Completion Report",
};

const TYPE_ACCENT: Record<ReportType, string> = {
  variation: "#1a3a6b",
  inspection: "#065f46",
  completion: "#92400e",
};

export default function Step2CoverEditor({
  coverData,
  onUpdate,
  onNext,
  onBack,
}: Props) {
  const heroInputRef = useRef<HTMLInputElement>(null);
  const [draggingHero, setDraggingHero] = useState(false);

  const handleHeroUpload = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      onUpdate({ heroImageDataUrl: e.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggingHero(false);
    const file = e.dataTransfer.files[0];
    if (file) handleHeroUpload(file);
  };

  const accent = TYPE_ACCENT[coverData.reportType];
  const heroStyle: React.CSSProperties = coverData.heroImageDataUrl
    ? {
        backgroundImage: `url(${coverData.heroImageDataUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : { background: `linear-gradient(160deg, #0a1628 0%, ${accent} 100%)` };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Cover Page</h2>
        <p className="text-gray-500 text-sm">
          Edit the fields on the right. The preview on the left updates live.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_340px] gap-6 items-start">
        {/* ── LEFT: LIVE PREVIEW ── */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
            <span className="ml-2 text-xs text-gray-400 font-mono">
              Cover Preview
            </span>
          </div>

          {/* Cover preview — scaled to fit, matches PDF proportions */}
          <div className="p-4">
            <div
              className="w-full rounded-lg overflow-hidden shadow-md"
              style={{ aspectRatio: "210/297", position: "relative" }}
            >
              {/* Hero area ~62% height */}
              <div
                className="relative cursor-pointer group"
                style={{ ...heroStyle, height: "62%" }}
                onClick={() => heroInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDraggingHero(true);
                }}
                onDragLeave={() => setDraggingHero(false)}
                onDrop={handleDrop}
              >
                {/* Overlay */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(to bottom, rgba(10,22,40,0.35) 0%, rgba(10,22,40,0.65) 100%)",
                  }}
                />

                {/* Upload hint */}
                <div
                  className={`absolute inset-0 flex items-center justify-center transition-opacity ${draggingHero || !coverData.heroImageDataUrl ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                >
                  <div className="bg-black/50 rounded-xl px-4 py-3 flex items-center gap-2 text-white text-xs">
                    <ImageIcon className="w-4 h-4" />
                    {coverData.heroImageDataUrl
                      ? "Change hero image"
                      : "Click or drop image"}
                  </div>
                </div>

                {/* Logo */}
                <div className="absolute top-3 left-4 right-4 flex items-center justify-between">
                  <div>
                    <div
                      style={{
                        color: "white",
                        fontWeight: 800,
                        fontSize: 13,
                        letterSpacing: 1,
                        fontFamily: "sans-serif",
                      }}
                    >
                      <span>RAS</span>
                      <span style={{ fontWeight: 300, letterSpacing: 3 }}>
                        {" "}
                        VERTEX
                      </span>
                    </div>
                    <div
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 6,
                        letterSpacing: 2,
                        textTransform: "uppercase",
                      }}
                    >
                      MAINTENANCE SOLUTIONS · SUNSHINE COAST
                    </div>
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.8)", fontSize: 7 }}>
                    rasvertex.com.au
                  </div>
                </div>

                {/* Credentials */}
                <div className="absolute bottom-3 right-4 text-right">
                  <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 7 }}>
                    QBCC: 1307234
                  </div>
                  <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 7 }}>
                    ABN: 53 167 652 637
                  </div>
                </div>
              </div>

              {/* Title band */}
              <div
                style={{
                  background: "white",
                  padding: "14px 18px",
                  height: "38%",
                }}
              >
                <div
                  style={{
                    fontFamily: "sans-serif",
                    fontWeight: 800,
                    fontSize: 14,
                    textTransform: "uppercase",
                    color: "#0a1628",
                    marginBottom: 5,
                    letterSpacing: 0.5,
                  }}
                >
                  {coverData.projectTitle.toLowerCase().replace(/\s+/g, "-")} —{" "}
                  {REPORT_TYPE_LABELS[coverData.reportType].toLowerCase()}
                </div>
                <div
                  style={{
                    fontSize: 7,
                    color: "#9ca3af",
                    marginBottom: 10,
                    lineHeight: 1.5,
                  }}
                >
                  This report documents changes to the original{" "}
                  {coverData.projectTitle} scope.
                </div>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 3 }}
                >
                  {[
                    ["PREPARED FOR:", coverData.preparedFor],
                    ["PREPARED BY:", coverData.preparedBy],
                    ["ADDRESS:", coverData.address],
                    ["PROJECT:", coverData.projectTitle],
                    ["DATE:", coverData.reportDate],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "baseline",
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 6,
                          letterSpacing: 1,
                          color: "#0a1628",
                          minWidth: 64,
                          flexShrink: 0,
                        }}
                      >
                        {label}
                      </span>
                      <span style={{ fontSize: 7, color: "#374151" }}>
                        {value || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <input
            ref={heroInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleHeroUpload(f);
            }}
          />
        </div>

        {/* ── RIGHT: EDIT FIELDS ── */}
        <div className="flex flex-col gap-4">
          {/* Hero image */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Hero Image
            </h3>
            <button
              onClick={() => heroInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 hover:border-blue-400 rounded-xl p-4 flex flex-col items-center gap-2 text-gray-500 hover:text-blue-600 transition-colors"
            >
              <Upload className="w-5 h-5" />
              <span className="text-xs font-medium">
                {coverData.heroImageDataUrl
                  ? "Replace hero image"
                  : "Upload hero image"}
              </span>
              <span className="text-xs text-gray-400">
                JPG, PNG — recommended 1920×1080
              </span>
            </button>
            {coverData.heroImageDataUrl && (
              <button
                onClick={() => onUpdate({ heroImageDataUrl: null })}
                className="mt-2 w-full text-xs text-red-500 hover:text-red-700 py-1"
              >
                Remove image (use gradient)
              </button>
            )}
          </div>

          {/* Editable fields */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Cover Fields
            </h3>
            <div className="flex flex-col gap-4">
              {(
                [
                  { key: "projectTitle", label: "Project Title" },
                  { key: "preparedFor", label: "Prepared For" },
                  { key: "preparedBy", label: "Prepared By" },
                  { key: "address", label: "Address" },
                  { key: "reportDate", label: "Date" },
                ] as { key: keyof CoverData; label: string }[]
              ).map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={(coverData[key] as string) || ""}
                    onChange={(e) => onUpdate({ [key]: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Summary fields */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Summary Page
            </h3>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Comments
                </label>
                <textarea
                  value={coverData.comments}
                  onChange={(e) => onUpdate({ comments: e.target.value })}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Recommendations
                </label>
                <textarea
                  value={coverData.recommendations}
                  onChange={(e) =>
                    onUpdate({ recommendations: e.target.value })
                  }
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </div>
          </div>

          {/* Nav */}
          <div className="flex gap-3">
            <button
              onClick={onBack}
              className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={onNext}
              className="flex-1 bg-blue-900 hover:bg-blue-800 text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
