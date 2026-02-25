"use client";

import { useState, useEffect, useRef } from "react";

// Updated CloudinaryFolder type to include "centers"
export type CloudinaryFolder =
  // Global entity icons/thumbnails
  | "tags"
  | "sports"
  // Centers root folder
  | "centers"
  // Center-specific images
  | `centers/${string}/logo`
  | `centers/${string}/gallery`
  | `centers/${string}/activities`
  // Fallback
  | "uploads";

// Rest of the file remains unchanged...

// Define transformation presets for different use cases
export type CloudinaryPreset =
  | "icon" // Small icon (e.g., tag icons, sport icons)
  | "logo" // Center logos
  | "thumbnail" // Activity thumbnails
  | "gallery" // Center gallery images
  | "default"; // General-purpose

// These should match your Cloudinary upload presets
const UPLOAD_PRESETS: Record<CloudinaryPreset, string> = {
  icon:
    process.env.NEXT_PUBLIC_CLOUDINARY_ICON_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    "",
  logo:
    process.env.NEXT_PUBLIC_CLOUDINARY_LOGO_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    "",
  thumbnail:
    process.env.NEXT_PUBLIC_CLOUDINARY_THUMBNAIL_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    "",
  gallery:
    process.env.NEXT_PUBLIC_CLOUDINARY_GALLERY_PRESET ||
    process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET ||
    "",
  default: process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "",
};

// Settings for each preset
export const PRESET_SETTINGS: Record<
  CloudinaryPreset,
  { maxWidth?: number; maxHeight?: number; quality?: number }
> = {
  icon: { maxWidth: 128, maxHeight: 128, quality: 90 },
  logo: { maxWidth: 256, maxHeight: 256, quality: 90 },
  thumbnail: { maxWidth: 512, maxHeight: 512, quality: 85 },
  gallery: { maxWidth: 1024, maxHeight: 1024, quality: 80 },
  default: { quality: 80 },
};

// Recommended usage map
export const RECOMMENDED_PRESETS: Record<string, CloudinaryPreset> = {
  "Tag.imageUrl": "icon",
  "Sport.imageUrl": "icon",
  "Activity.imageUrl": "thumbnail",
  "Center.logoUrl": "logo",
  "CenterImage.imageUrl": "gallery",
};

// Main upload function
export async function uploadToCloudinary(
  file: File,
  folder: CloudinaryFolder,
  preset: CloudinaryPreset = "default",
  onProgress?: (progress: number) => void
): Promise<{ url: string; publicId: string }> {
  try {
    // Initial progress
    if (onProgress) onProgress(10);

    // Create FormData
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", UPLOAD_PRESETS[preset]);
    formData.append("folder", folder);

    // Track progress in a variable
    let currentProgress = 10;

    // Simulate progress
    const progressInterval = setInterval(() => {
      if (onProgress) {
        if (currentProgress < 90) {
          currentProgress += 10;
          onProgress(currentProgress);
        }
      }
    }, 300);

    // Perform upload
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    clearInterval(progressInterval);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Failed to upload image");
    }

    const data = await response.json();

    // Complete progress
    if (onProgress) onProgress(100);

    return {
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    if (onProgress) onProgress(0);
    throw error;
  }
}

// Format Cloudinary URL with transformations
export function formatCloudinaryUrl(
  url: string,
  preset: CloudinaryPreset = "default"
): string {
  if (!url || !url.includes("cloudinary.com")) {
    return url;
  }

  const settings = PRESET_SETTINGS[preset];
  const transformations: string[] = [];

  if (settings.maxWidth && settings.maxHeight) {
    transformations.push(
      `c_fit,w_${settings.maxWidth},h_${settings.maxHeight}`
    );
  } else if (settings.maxWidth) {
    transformations.push(`w_${settings.maxWidth}`);
  } else if (settings.maxHeight) {
    transformations.push(`h_${settings.maxHeight}`);
  }

  if (settings.quality) {
    transformations.push(`q_${settings.quality}`);
  }

  if (transformations.length === 0) {
    return url;
  }

  // Parse the URL to inject transformations
  const parts = url.split("/upload/");
  if (parts.length !== 2) {
    return url;
  }

  return `${parts[0]}/upload/${transformations.join(",")}/f_auto/${parts[1]}`;
}

// React hook for image uploading
export function useCloudinaryUpload(
  folder: CloudinaryFolder,
  preset: CloudinaryPreset = "default"
) {
  const [progress, setProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const upload = async (file: File) => {
    setIsUploading(true);
    setError(null);

    try {
      const result = await uploadToCloudinary(
        file,
        folder,
        preset,
        setProgress
      );
      setImageUrl(result.url);
      return result;
    } catch (err) {
      setError((err as Error).message || "Upload failed");
      throw err;
    } finally {
      setIsUploading(false);
      // Reset progress after a delay
      setTimeout(() => setProgress(0), 500);
    }
  };

  return {
    upload,
    progress,
    isUploading,
    error,
    imageUrl,
    setImageUrl,
  };
}

// Helper to determine the appropriate folder for an entity and field
export function getEntityImageFolder(
  entityName: string,
  id?: string
): CloudinaryFolder {
  switch (entityName) {
    case "Tag":
      return "tags";
    case "Sport":
      return "sports";
    case "Activity":
      // Activities must have a center ID
      return id ? `centers/${id}/activities` : "uploads";
    case "Center":
      return id ? `centers/${id}/logo` : "centers";
    case "CenterImage":
      return id ? `centers/${id}/gallery` : "centers";
    default:
      return "uploads";
  }
}

// Helper to determine the appropriate preset for an entity and field
export function getEntityPreset(
  entityName: string,
  fieldName: string
): CloudinaryPreset {
  const key = `${entityName}.${fieldName}`;
  return RECOMMENDED_PRESETS[key] || "default";
}

// Get CloudinaryUploader component for specific entity
export function getEntityUploader(entityName: string, id?: string) {
  const folder = getEntityImageFolder(entityName, id);
  const preset = getEntityPreset(entityName, "imageUrl");

  return { folder, preset };
}
