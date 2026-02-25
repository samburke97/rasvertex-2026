"use client";
// components/report-builder/Step3PhotoSelect.tsx
// Photo selection: filter by date range, select/deselect, group-by-date toggle.

import React, { useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  CheckSquare,
  Square,
  Calendar,
  Layers,
} from "lucide-react";
import type { WizardPhoto } from "./ReportWizard";

interface Props {
  photos: WizardPhoto[];
  groupByDate: boolean;
  onPhotosChange: (photos: WizardPhoto[]) => void;
  onGroupByDateChange: (v: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step3PhotoSelect({
  photos,
  groupByDate,
  onPhotosChange,
  onGroupByDateChange,
  onNext,
  onBack,
}: Props) {
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  // Derive date-filtered view (doesn't deselect — just hides from view)
  const filteredPhotos = useMemo(() => {
    return photos.filter((p) => {
      if (!filterFrom && !filterTo) return true;
      if (!p.displayDate) return true; // undated always shown
      const d = p.displayDate.getTime();
      const from = filterFrom ? new Date(filterFrom).getTime() : -Infinity;
      const to = filterTo
        ? new Date(filterTo + "T23:59:59").getTime()
        : Infinity;
      return d >= from && d <= to;
    });
  }, [photos, filterFrom, filterTo]);

  // Group filtered photos by date for display
  const groups = useMemo(() => {
    const map = new Map<string, WizardPhoto[]>();
    for (const p of filteredPhotos) {
      const key = p.displayDate
        ? p.displayDate.toISOString().slice(0, 10)
        : "undated";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Sort: dated ascending, undated last
    const sorted = [...map.entries()].sort(([a], [b]) => {
      if (a === "undated") return 1;
      if (b === "undated") return -1;
      return a.localeCompare(b);
    });
    return sorted;
  }, [filteredPhotos]);

  const selectedCount = photos.filter((p) => p.selected).length;
  const filteredSelected = filteredPhotos.filter((p) => p.selected).length;
  const allFilteredSelected =
    filteredPhotos.length > 0 && filteredPhotos.every((p) => p.selected);

  const togglePhoto = (id: string) => {
    onPhotosChange(
      photos.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)),
    );
  };

  const selectAllFiltered = () => {
    const filteredIds = new Set(filteredPhotos.map((p) => p.id));
    onPhotosChange(
      photos.map((p) =>
        filteredIds.has(p.id) ? { ...p, selected: !allFilteredSelected } : p,
      ),
    );
  };

  const formatHeading = (key: string): string => {
    if (key === "undated") return "Undated";
    const date = new Date(key + "T12:00:00");
    return date.toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Select Photos</h2>
        <p className="text-gray-500 text-sm">
          {selectedCount} of {photos.length} photos selected for the report.
        </p>
      </div>

      {/* Controls bar */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5 flex flex-wrap items-center gap-4">
        {/* Select all */}
        <button
          onClick={selectAllFiltered}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-blue-700 transition-colors"
        >
          {allFilteredSelected ? (
            <CheckSquare className="w-4 h-4 text-blue-600" />
          ) : (
            <Square className="w-4 h-4 text-gray-400" />
          )}
          {allFilteredSelected ? "Deselect all" : "Select all"}
          {(filterFrom || filterTo) && " (filtered)"}
        </button>

        <div className="w-px h-5 bg-gray-200" />

        {/* Date range filter */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className="text-sm text-gray-500">From</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-500">to</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {(filterFrom || filterTo) && (
            <button
              onClick={() => {
                setFilterFrom("");
                setFilterTo("");
              }}
              className="text-xs text-red-500 hover:text-red-700 font-medium"
            >
              Clear
            </button>
          )}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Group by date toggle */}
        <button
          onClick={() => onGroupByDateChange(!groupByDate)}
          className={`flex items-center gap-2 text-sm font-medium transition-colors ${
            groupByDate ? "text-blue-700" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Layers className="w-4 h-4" />
          Group by date in report
          <div
            className={`w-8 h-4 rounded-full transition-colors ${groupByDate ? "bg-blue-600" : "bg-gray-300"}`}
          >
            <div
              className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform shadow ${groupByDate ? "translate-x-4 ml-0.5" : "translate-x-0.5"}`}
            />
          </div>
        </button>

        {/* Stats */}
        <div className="ml-auto text-xs text-gray-400">
          {filteredSelected} / {filteredPhotos.length} shown selected
        </div>
      </div>

      {/* Photo grid grouped by date */}
      {groups.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
          No photos match the current filter.
        </div>
      )}

      <div className="flex flex-col gap-6">
        {groups.map(([dateKey, groupPhotos]) => (
          <div key={dateKey}>
            {/* Group header */}
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-gray-700">
                {formatHeading(dateKey)}
              </h3>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">
                {groupPhotos.filter((p) => p.selected).length}/
                {groupPhotos.length} selected
              </span>
              <button
                onClick={() => {
                  const allSelected = groupPhotos.every((p) => p.selected);
                  const groupIds = new Set(groupPhotos.map((p) => p.id));
                  onPhotosChange(
                    photos.map((p) =>
                      groupIds.has(p.id) ? { ...p, selected: !allSelected } : p,
                    ),
                  );
                }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                {groupPhotos.every((p) => p.selected)
                  ? "Deselect group"
                  : "Select group"}
              </button>
            </div>

            {/* Photos */}
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3">
              {groupPhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => togglePhoto(photo.id)}
                  className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all focus:outline-none ${
                    photo.selected
                      ? "border-blue-500 shadow-md shadow-blue-100"
                      : "border-transparent opacity-50 hover:opacity-75"
                  }`}
                >
                  <img
                    src={`data:${photo.mimeType};base64,${photo.base64}`}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />

                  {/* Selection indicator */}
                  <div
                    className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center transition-all ${
                      photo.selected ? "bg-blue-600" : "bg-black/30"
                    }`}
                  >
                    {photo.selected && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
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
                    )}
                  </div>

                  {/* Date source badge */}
                  {photo.dateSource === "exif" && (
                    <div className="absolute bottom-1 left-1 bg-green-600/80 text-white text-[8px] font-medium px-1 rounded">
                      EXIF
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Nav */}
      <div className="flex gap-3 mt-8">
        <button
          onClick={onBack}
          className="flex-1 border border-gray-300 hover:border-gray-400 text-gray-700 px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          disabled={selectedCount === 0}
          className="flex-1 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl flex items-center justify-center gap-2 font-medium text-sm transition-colors"
        >
          Generate Report ({selectedCount} photos){" "}
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
