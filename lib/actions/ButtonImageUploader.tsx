"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  uploadToCloudinary,
  formatCloudinaryUrl,
  CloudinaryFolder,
  CloudinaryPreset,
} from "@/lib/cloudinary/CloudinaryUploader";

export interface ButtonImageUploaderProps {
  onUpload: (url: string) => void;
  onError?: (message: string) => void;
  onProgressChange?: (progress: number) => void;
  // Changed folder to use the CloudinaryFolder type
  folder?: CloudinaryFolder;
  // Added preset prop
  preset?: CloudinaryPreset;
}

export interface ButtonImageUploaderRef {
  openFileDialog: () => void;
}

const ButtonImageUploader = forwardRef<
  ButtonImageUploaderRef,
  ButtonImageUploaderProps
>(
  (
    {
      onUpload,
      onError,
      onProgressChange,
      folder = "uploads",
      preset = "default",
    },
    ref
  ) => {
    const fileInputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      openFileDialog: () => {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      },
    }));

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        // Use the CloudinaryUploader service to handle the upload
        const result = await uploadToCloudinary(
          file,
          folder,
          preset,
          onProgressChange
        );

        // Reset the file input
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }

        // Format the URL with optimizations
        const optimizedUrl = formatCloudinaryUrl(result.url, preset);

        // Call the onUpload callback with the secure URL
        onUpload(optimizedUrl);

        // Reset progress after a delay
        setTimeout(() => {
          if (onProgressChange) onProgressChange(0);
        }, 500);
      } catch (error) {
        console.error("Upload error:", error);
        if (onProgressChange) onProgressChange(0);
        if (onError) {
          onError((error as Error).message || "Failed to upload image");
        }
      }
    };

    return (
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    );
  }
);

ButtonImageUploader.displayName = "ButtonImageUploader";

export default ButtonImageUploader;
