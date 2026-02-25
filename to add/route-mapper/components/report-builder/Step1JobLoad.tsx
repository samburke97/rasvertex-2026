"use client";
// components/report-builder/Step1JobLoad.tsx
// Enter job number → pull job details + photos from SimPRO → proceed.

import React, { useState } from "react";
import { Search, FileText, ClipboardCheck, CheckSquare } from "lucide-react";
import type { JobData, WizardPhoto, ReportType } from "./ReportWizard";
import { resolvePhotoDate } from "@/lib/report/exif";

interface Props {
  onJobLoaded: (jobData: JobData, photos: WizardPhoto[]) => void;
}

const REPORT_TYPES: {
  type: ReportType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
}[] = [
  {
    type: "variation",
    label: "Variation Report",
    description: "Documents scope changes and repair work",
    icon: <FileText className="w-5 h-5" />,
    color: "blue",
  },
  {
    type: "inspection",
    label: "Inspection Report",
    description: "Records findings from a site inspection",
    icon: <ClipboardCheck className="w-5 h-5" />,
    color: "green",
  },
  {
    type: "completion",
    label: "Completion Report",
    description: "Confirms works completed with sign-off",
    icon: <CheckSquare className="w-5 h-5" />,
    color: "amber",
  },
];

const COLOR_MAP: Record<
  string,
  { ring: string; bg: string; text: string; badge: string }
> = {
  blue: {
    ring: "ring-blue-600",
    bg: "bg-blue-50",
    text: "text-blue-700",
    badge: "bg-blue-600",
  },
  green: {
    ring: "ring-green-600",
    bg: "bg-green-50",
    text: "text-green-700",
    badge: "bg-green-600",
  },
  amber: {
    ring: "ring-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    badge: "bg-amber-500",
  },
};

export default function Step1JobLoad({ onJobLoaded }: Props) {
  const [jobNumber, setJobNumber] = useState("");
  const [reportType, setReportType] = useState<ReportType>("variation");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLoad = async () => {
    if (!jobNumber.trim()) {
      setError("Please enter a job number");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // 1. Fetch job details
      const jobRes = await fetch(`/api/simpro/jobs/${jobNumber}`);
      if (!jobRes.ok) throw new Error(`Job ${jobNumber} not found in SimPRO`);
      const jobDetails = await jobRes.json();

      // 2. Fetch attachments
      const attRes = await fetch(
        `/api/simpro/jobs/${jobNumber}/attachments?companyId=0`,
      );
      if (!attRes.ok) throw new Error("Failed to fetch job photos");
      const { attachments } = await attRes.json();

      // 3. Build photo objects with EXIF date resolution
      const photos: WizardPhoto[] = await Promise.all(
        (attachments || []).map(
          async (att: {
            ID: string;
            Filename: string;
            MimeType: string;
            FileSizeBytes: number;
            Base64Data?: string;
            DateAdded?: string;
          }) => {
            const dateInfo = await resolvePhotoDate(
              att.Base64Data,
              att.DateAdded,
              att.MimeType,
            );

            return {
              id: `simpro_${att.ID}`,
              name: att.Filename,
              base64: att.Base64Data || "",
              mimeType: att.MimeType,
              displayDate: dateInfo.displayDate,
              dateSource: dateInfo.source,
              simproDateAdded: att.DateAdded || null,
              selected: true, // default all selected
            };
          },
        ),
      );

      // 4. Build job data
      const siteAddress = jobDetails.Site?.Address
        ? `${jobDetails.Site.Address}, ${jobDetails.Site.Name || ""}`
        : jobDetails.Site?.Name || "";

      const dateScheduled = jobDetails.DateScheduled
        ? new Date(jobDetails.DateScheduled).toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })
        : new Date().toLocaleDateString("en-AU", {
            day: "numeric",
            month: "long",
            year: "numeric",
          });

      const jobData: JobData = {
        jobId: jobDetails.ID,
        jobNumber: jobNumber.trim(),
        projectTitle:
          jobDetails.Name || jobDetails.Site?.Name || `Job ${jobNumber}`,
        preparedFor: jobDetails.Customer?.Name || "",
        address: siteAddress,
        reportDate: dateScheduled,
        reportType,
      };

      onJobLoaded(jobData, photos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load job");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Load Job</h2>
        <p className="text-gray-500 text-sm">
          Enter a SimPRO job number to pull all details and photos
          automatically.
        </p>
      </div>

      {/* Job number input */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <label className="block text-sm font-semibold text-gray-700 mb-3">
          SimPRO Job Number
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLoad()}
            placeholder="e.g. 12345"
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
          <button
            onClick={handleLoad}
            disabled={loading || !jobNumber.trim()}
            className="bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-5 py-3 rounded-xl flex items-center gap-2 font-medium transition-colors text-sm"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Load Job
              </>
            )}
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Report type selection */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <label className="block text-sm font-semibold text-gray-700 mb-4">
          Report Type
        </label>
        <div className="grid grid-cols-1 gap-3">
          {REPORT_TYPES.map(({ type, label, description, icon, color }) => {
            const c = COLOR_MAP[color];
            const selected = reportType === type;
            return (
              <button
                key={type}
                onClick={() => setReportType(type)}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                  selected
                    ? `${c.ring} ${c.bg} border-current`
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    selected
                      ? `${c.badge} text-white`
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {icon}
                </div>
                <div>
                  <div
                    className={`text-sm font-semibold ${selected ? c.text : "text-gray-900"}`}
                  >
                    {label}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {description}
                  </div>
                </div>
                {selected && (
                  <div
                    className={`ml-auto w-5 h-5 rounded-full ${c.badge} flex items-center justify-center flex-shrink-0`}
                  >
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
