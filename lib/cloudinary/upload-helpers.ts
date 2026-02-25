"use client";

import {
  getEntityImageFolder,
  getEntityPreset,
  CloudinaryFolder,
  CloudinaryPreset,
} from "@/lib/cloudinary/CloudinaryUploader";

// Helper function to get props for Tag image uploads
export function getTagImageProps(tagId: string): {
  folder: CloudinaryFolder;
  preset: CloudinaryPreset;
} {
  return {
    folder: getEntityImageFolder("Tag"),
    preset: getEntityPreset("Tag", "imageUrl"),
  };
}

// Helper function to get props for Sport image uploads
export function getSportImageProps(sportId: string): {
  folder: CloudinaryFolder;
  preset: CloudinaryPreset;
} {
  return {
    folder: getEntityImageFolder("Sport"),
    preset: getEntityPreset("Sport", "imageUrl"),
  };
}

// Helper function to get props for Center logo uploads
export function getCenterLogoProps(centerId: string): {
  folder: CloudinaryFolder;
  preset: CloudinaryPreset;
} {
  return {
    folder: getEntityImageFolder("Center", centerId),
    preset: getEntityPreset("Center", "logoUrl"),
  };
}

// Helper function to get props for Center gallery image uploads
export function getCenterGalleryImageProps(centerId: string): {
  folder: CloudinaryFolder;
  preset: CloudinaryPreset;
} {
  return {
    folder: getEntityImageFolder("CenterImage", centerId),
    preset: getEntityPreset("CenterImage", "imageUrl"),
  };
}

// Helper function to get props for Activity image uploads
export function getActivityImageProps(centerId: string): {
  folder: CloudinaryFolder;
  preset: CloudinaryPreset;
} {
  return {
    folder: getEntityImageFolder("Activity", centerId),
    preset: getEntityPreset("Activity", "imageUrl"),
  };
}
