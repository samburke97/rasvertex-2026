"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import {
  uploadToCloudinary,
  formatCloudinaryUrl,
  CloudinaryFolder,
  CloudinaryPreset,
} from "@/lib/cloudinary/CloudinaryUploader";
import styles from "./ImageUploader.module.css";

interface ImageUploaderProps {
  imageUrl: string | null;
  onImageUpload: (url: string) => void;
  onImageDelete?: () => void;
  onError?: (message: string) => void;
  // Changed folder to use the CloudinaryFolder type
  folder?: CloudinaryFolder;
  // Added preset prop
  preset?: CloudinaryPreset;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  alt?: string;
  label?: string;
  error?: string | null;
  required?: boolean;
  labelClassName?: string;
  id?: string;
  showDeleteButton?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  imageUrl,
  onImageUpload,
  onImageDelete,
  onError,
  folder = "uploads",
  preset = "default",
  size = "lg",
  className = "",
  alt = "Uploaded image",
  label,
  error = null,
  required = false,
  labelClassName = "",
  id = `image-uploader-${Math.random().toString(36).substring(2, 9)}`,
  showDeleteButton = true,
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sizeWidth =
    {
      sm: 32,
      md: 40,
      lg: 48,
      xl: 96,
    }[size] || 96;

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);

      // Use the CloudinaryUploader service to handle the upload
      const result = await uploadToCloudinary(
        file,
        folder,
        preset,
        (newProgress) => {
          // Simply set the progress directly
          setProgress(newProgress);
        }
      );

      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Brief delay to show 100% before clearing the progress bar
      setTimeout(() => {
        setUploading(false);
        setProgress(0);

        // Call the onUpload callback with the secure URL
        onImageUpload(result.url);
      }, 300);
    } catch (error) {
      console.error("Upload error:", error);
      setUploading(false);
      setProgress(0);
      if (onError) {
        onError((error as Error).message || "Failed to upload image");
      }
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onImageDelete) {
      onImageDelete();
    }
  };

  const sizeClass = styles[size] || styles.lg;
  const containerClass = imageUrl
    ? styles.imageContainer
    : styles.emptyContainer;

  // Format the image URL with transformations if it exists
  const optimizedImageUrl = imageUrl
    ? formatCloudinaryUrl(imageUrl, preset)
    : null;

  return (
    <div
      className={`${styles.container} ${className}`}
      style={
        {
          "--uploader-width": `${sizeWidth}px`,
        } as React.CSSProperties
      }
    >
      {label && (
        <label htmlFor={id} className={`${styles.label} ${labelClassName}`}>
          {label}
          {required && error && <span className={styles.required}>*</span>}
        </label>
      )}

      <div className={`${styles.wrapper} ${error ? styles.hasError : ""}`}>
        <div
          className={`${styles.uploaderContainer} ${sizeClass}`}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <button
            type="button"
            onClick={handleClick}
            className={`${
              styles.uploaderButton
            } ${sizeClass} ${containerClass} ${error ? styles.hasError : ""}`}
            aria-label={imageUrl ? "Replace image" : "Upload image"}
            disabled={uploading}
          >
            {optimizedImageUrl ? (
              <div className={styles.imageWrapper}>
                <Image
                  src={optimizedImageUrl}
                  alt={alt}
                  width={
                    size === "xl"
                      ? 96
                      : size === "lg"
                      ? 48
                      : size === "md"
                      ? 40
                      : 32
                  }
                  height={
                    size === "xl"
                      ? 96
                      : size === "lg"
                      ? 48
                      : size === "md"
                      ? 40
                      : 32
                  }
                  className={styles.uploadedImage}
                />
              </div>
            ) : (
              <Image
                src="/icons/utility-outline/add-image.svg"
                width={24}
                height={24}
                alt="Add image"
                className={styles.addIcon}
              />
            )}
          </button>

          {imageUrl && showDeleteButton && (
            <button
              type="button"
              onClick={handleDelete}
              className={`${styles.deleteButton} ${
                isHovering ? styles.visible : ""
              }`}
              aria-label="Delete image"
            >
              <Image
                src="/icons/utility-outline/cross.svg"
                width={12}
                height={12}
                alt="Delete"
                className={styles.whiteIcon}
              />
            </button>
          )}
        </div>

        {uploading && (
          <div className={styles.progressContainer}>
            <div
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        <input
          id={id}
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className={styles.hiddenInput}
          required={required}
        />
      </div>

      {error && <p className={styles.errorText}>{error}</p>}
    </div>
  );
};

export default ImageUploader;
