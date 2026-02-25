"use client";
// components/report-builder/ReportWizard.tsx
// Parent component that owns wizard state and orchestrates the 4 steps.

import React, { useState } from "react";
import Step1JobLoad from "./Step1JobLoad";
import Step2CoverEditor from "./Step2CoverEditor";
import Step3PhotoSelect from "./Step3PhotoSelect";
import Step4Generate from "./Step4Generate";

export type ReportType = "variation" | "inspection" | "completion";

export interface JobData {
  jobId: number;
  jobNumber: string;
  projectTitle: string;
  preparedFor: string; // Customer name
  address: string; // Site address
  reportDate: string; // Formatted date string
  reportType: ReportType;
}

export interface WizardPhoto {
  id: string;
  name: string;
  base64: string;
  mimeType: string;
  displayDate: Date | null;
  dateSource: "exif" | "simproDateAdded" | "unknown";
  simproDateAdded: string | null;
  selected: boolean;
}

export interface CoverData {
  preparedFor: string;
  preparedBy: string;
  projectTitle: string;
  address: string;
  reportDate: string;
  reportType: ReportType;
  heroImageDataUrl: string | null;
  comments: string;
  recommendations: string;
}

export interface WizardState {
  step: 1 | 2 | 3 | 4;
  jobData: JobData | null;
  photos: WizardPhoto[];
  coverData: CoverData;
  groupByDate: boolean;
}

const DEFAULT_COVER: CoverData = {
  preparedFor: "",
  preparedBy: "Phil Clark",
  projectTitle: "",
  address: "",
  reportDate: new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }),
  reportType: "variation",
  heroImageDataUrl: null,
  comments: "General maintenance requirements",
  recommendations: "",
};

const STEP_LABELS = [
  { num: 1, label: "Job Details" },
  { num: 2, label: "Cover Page" },
  { num: 3, label: "Photos" },
  { num: 4, label: "Generate" },
];

export default function ReportWizard() {
  const [state, setState] = useState<WizardState>({
    step: 1,
    jobData: null,
    photos: [],
    coverData: DEFAULT_COVER,
    groupByDate: true,
  });

  const goTo = (step: WizardState["step"]) => setState((s) => ({ ...s, step }));

  const updateCover = (partial: Partial<CoverData>) =>
    setState((s) => ({ ...s, coverData: { ...s.coverData, ...partial } }));

  const updatePhotos = (photos: WizardPhoto[]) =>
    setState((s) => ({ ...s, photos }));

  const handleJobLoaded = (jobData: JobData, photos: WizardPhoto[]) => {
    setState((s) => ({
      ...s,
      jobData,
      photos,
      coverData: {
        ...s.coverData,
        preparedFor: jobData.preparedFor,
        projectTitle: jobData.projectTitle,
        address: jobData.address,
        reportDate: jobData.reportDate,
        reportType: jobData.reportType,
      },
      step: 2,
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-900 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">RV</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">
                RAS-VERTEX
              </div>
              <div className="text-xs text-gray-500">Report Builder</div>
            </div>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-1">
            {STEP_LABELS.map((s, i) => (
              <React.Fragment key={s.num}>
                <button
                  onClick={() => {
                    // Only allow going back to completed steps
                    if (s.num < state.step) goTo(s.num as WizardState["step"]);
                  }}
                  disabled={s.num > state.step}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    state.step === s.num
                      ? "bg-blue-900 text-white"
                      : s.num < state.step
                        ? "bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold ${
                      state.step === s.num
                        ? "bg-white text-blue-900"
                        : s.num < state.step
                          ? "bg-blue-300 text-blue-900"
                          : "bg-gray-300 text-gray-500"
                    }`}
                  >
                    {s.num < state.step ? "✓" : s.num}
                  </span>
                  {s.label}
                </button>
                {i < STEP_LABELS.length - 1 && (
                  <div
                    className={`w-6 h-px ${s.num < state.step ? "bg-blue-300" : "bg-gray-200"}`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </header>

      {/* Step content */}
      <main className="max-w-5xl mx-auto px-6 py-8">
        {state.step === 1 && <Step1JobLoad onJobLoaded={handleJobLoaded} />}
        {state.step === 2 && (
          <Step2CoverEditor
            coverData={state.coverData}
            onUpdate={updateCover}
            onNext={() => goTo(3)}
            onBack={() => goTo(1)}
          />
        )}
        {state.step === 3 && (
          <Step3PhotoSelect
            photos={state.photos}
            groupByDate={state.groupByDate}
            onPhotosChange={updatePhotos}
            onGroupByDateChange={(v) =>
              setState((s) => ({ ...s, groupByDate: v }))
            }
            onNext={() => goTo(4)}
            onBack={() => goTo(2)}
          />
        )}
        {state.step === 4 && state.jobData && (
          <Step4Generate
            coverData={state.coverData}
            photos={state.photos.filter((p) => p.selected)}
            groupByDate={state.groupByDate}
            jobId={state.jobData.jobId}
            onBack={() => goTo(3)}
          />
        )}
      </main>
    </div>
  );
}
