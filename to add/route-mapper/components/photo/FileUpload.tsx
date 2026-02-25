// components/photo/FileUpload.tsx - Fixed import path
"use client";

import React, { useRef } from "react";
import { Upload } from "lucide-react";

interface Photo {
  id: string;
  name: string;
  url: string;
  size: number;
}

interface FileUploadProps {
  onPhotosUploaded: (photos: Photo[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onPhotosUploaded }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newPhotos: Photo[] = [];
    let processedCount = 0;

    files.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const newPhoto: Photo = {
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            url: e.target?.result as string,
            size: file.size,
          };
          newPhotos.push(newPhoto);
          processedCount++;

          if (
            processedCount ===
            files.filter((f) => f.type.startsWith("image/")).length
          ) {
            onPhotosUploaded(newPhotos);
          }
        };
        reader.readAsDataURL(file);
      }
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Upload Photos
      </h3>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-700 mb-4 font-medium">
          Drop images here or click to browse
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-gray-700 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-medium transition-colors shadow-sm"
        >
          Choose Files
        </button>
      </div>
    </div>
  );
};

export default FileUpload;
