// components/photo/SimproImport.tsx - Fixed types
"use client";

import React, { useState } from "react";
import { Search } from "lucide-react";

interface Photo {
  id: string;
  name: string;
  url: string;
  size: number;
}

interface SimproAttachment {
  ID: string;
  Filename: string;
  MimeType: string;
  FileSizeBytes: number;
  Base64Data?: string;
}

interface SimproImportProps {
  jobNumber: string;
  onJobNumberChange: (value: string) => void;
  onPhotosImported: (photos: Photo[]) => void;
  onError: (error: string) => void;
}

const SimproImport: React.FC<SimproImportProps> = ({
  jobNumber,
  onJobNumberChange,
  onPhotosImported,
  onError,
}) => {
  const [loading, setLoading] = useState(false);

  const fetchSimproPhotos = async () => {
    if (!jobNumber.trim()) {
      onError("Please enter a job number");
      return;
    }

    setLoading(true);
    onError("");

    try {
      // Real SimPRO API call
      const response = await fetch(
        `/api/simpro/jobs/${jobNumber}/attachments?companyId=0`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch photos from SimPRO");
      }

      const { attachments } = await response.json();

      if (!attachments || attachments.length === 0) {
        onError(`No photos found for job ${jobNumber}`);
        return;
      }

      const simproPhotos: Photo[] = attachments.map(
        (att: SimproAttachment) => ({
          id: `simpro_${att.ID}`,
          name: att.Filename,
          url: `data:${att.MimeType};base64,${att.Base64Data}`,
          size: att.FileSizeBytes || 0,
        })
      );

      onPhotosImported(simproPhotos);
      onError(`Loaded ${simproPhotos.length} photos from SimPRO`);
      setTimeout(() => onError(""), 3000);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to fetch photos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Import from SimPRO
      </h3>
      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Enter job number..."
          value={jobNumber}
          onChange={(e) => onJobNumberChange(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-gray-700 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          onKeyPress={(e) => e.key === "Enter" && fetchSimproPhotos()}
        />
        <button
          onClick={fetchSimproPhotos}
          disabled={loading || !jobNumber.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg flex items-center gap-2 font-medium transition-colors shadow-sm"
        >
          <Search className="w-4 h-4" />
          {loading ? "Loading..." : "Fetch Photos"}
        </button>
      </div>
    </div>
  );
};

export default SimproImport;
