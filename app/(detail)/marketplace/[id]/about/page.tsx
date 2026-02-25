// app/(detail)/marketplace/[id]/about/page.tsx - STANDALONE PAGE VERSION
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TitleDescription from "@/components/ui/TitleDescription";
import TextInput from "@/components/ui/TextInput";
import TextArea from "@/components/ui/TextArea";
import ImageUploader from "@/lib/actions/ImageUploader";
import ActionHeader from "@/components/layouts/headers/ActionHeader";
import Toast from "@/components/ui/Toast";
import styles from "@/components/marketplace/setup/[id]/about/page.module.css";
import { getCenterLogoProps } from "@/lib/cloudinary/upload-helpers";
import {
  CloudinaryFolder,
  CloudinaryPreset,
} from "@/lib/cloudinary/CloudinaryUploader";

interface AboutPageProps {
  params: Promise<{ id: string }>;
}

export default function AboutPage({ params }: AboutPageProps) {
  const router = useRouter();

  // Get the ID from params
  const [id, setId] = useState<string | null>(null);

  // Initialize ID from params
  useEffect(() => {
    const getId = async () => {
      const resolvedParams = await params;
      setId(resolvedParams.id);
    };
    getId();
  }, [params]);

  // Form state - default empty values
  const [localFormData, setLocalFormData] = useState({
    highlights: ["", "", ""],
    description: "",
    logo: null as string | null,
  });

  // Loading state for data fetching
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Track if validation was attempted and description error
  const [showDescriptionError, setShowDescriptionError] = useState(false);

  // Fetch existing data when ID is available
  useEffect(() => {
    const fetchExistingData = async () => {
      if (!id) return;

      try {
        setIsLoadingData(true);

        const response = await fetch(`/api/marketplace/${id}/about`, {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();

          // Always ensure we have exactly 3 highlight slots
          const existingHighlights = data.highlights || [];
          const paddedHighlights = [
            existingHighlights[0] || "",
            existingHighlights[1] || "",
            existingHighlights[2] || "",
          ];

          setLocalFormData({
            highlights: paddedHighlights,
            description: data.description || "",
            logo: data.logoUrl || null,
          });
        }
      } catch (error) {
        console.error("Error fetching about data:", error);
        // Continue with empty form on error
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchExistingData();
  }, [id]);

  // Cloudinary configuration
  const cloudinaryProps = id
    ? getCenterLogoProps(id)
    : {
        folder: "logos" as CloudinaryFolder,
        preset: "business_images" as CloudinaryPreset,
      };
  const { folder, preset } = cloudinaryProps;

  // UI state
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({
    visible: false,
    message: "",
    type: "success" as "success" | "error",
  });

  // Check if description is valid
  const isDescriptionValid = () => {
    return localFormData.description.trim().length >= 10;
  };

  // Save function for standalone edit mode
  const handleSave = async () => {
    if (!id || saving) return;

    // Validate first
    if (!isDescriptionValid()) {
      setShowDescriptionError(true);
      return;
    }

    try {
      setSaving(true);
      setShowDescriptionError(false);

      const payload = {
        highlights: localFormData.highlights.filter((h) => h.trim() !== ""),
        description: localFormData.description.trim(),
        logoUrl: localFormData.logo,
      };

      const response = await fetch(`/api/marketplace/${id}/about`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to save about information");
      }

      setToast({
        visible: true,
        message: "About information saved successfully!",
        type: "success",
      });

      // Redirect after delay
      setTimeout(() => {
        router.push("/marketplace");
      }, 1500);
    } catch (error) {
      setToast({
        visible: true,
        message: "Failed to save about information",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  // Form handlers
  const handleHighlightChange = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newHighlights = [...localFormData.highlights];
    newHighlights[index] = e.target.value;
    setLocalFormData({ ...localFormData, highlights: newHighlights });
  };

  // Description change handler that clears error when valid
  const handleDescriptionChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    const value = e.target.value;
    setLocalFormData({ ...localFormData, description: value });

    // Clear error if description becomes valid
    if (showDescriptionError && value.trim().length >= 10) {
      setShowDescriptionError(false);
    }
  };

  const handleLogoUpload = (url: string) => {
    setLocalFormData({ ...localFormData, logo: url });
  };

  const handleLogoError = (error: string) => {
    setToast({
      visible: true,
      message: `Upload failed: ${error}`,
      type: "error",
    });
  };

  // Show loading while ID or data is loading
  if (!id || isLoadingData) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingContainer}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Get error message for description
  const getDescriptionError = () => {
    if (!showDescriptionError) return null;

    if (localFormData.description.trim().length === 0) {
      return "Description is required";
    }

    if (localFormData.description.trim().length < 10) {
      return "Description must be at least 10 characters";
    }

    return null;
  };

  return (
    <div className={styles.container}>
      <ActionHeader
        primaryAction={handleSave}
        secondaryAction={() => router.push("/marketplace")}
        isProcessing={saving}
      />

      <div className={styles.formContainer}>
        <TitleDescription
          title="About"
          description="Please include your business description, key facility highlights, and your logo."
        />

        {/* Description - Show error when showDescriptionError is true */}
        <div className={styles.section}>
          <label className={styles.label}>Description*</label>
          <TextArea
            id="description"
            placeholder="Enter description (minimum 10 characters)."
            value={localFormData.description}
            onChange={handleDescriptionChange}
            maxLength={500}
            showCharCount={true}
            required
            error={getDescriptionError()}
          />
        </div>

        {/* Highlights */}
        <div className={styles.section}>
          <label className={styles.label}>Highlights</label>
          <div className={styles.highlightsContainer}>
            {localFormData.highlights.map((highlight, index) => (
              <TextInput
                key={index}
                id={`highlight-${index}`}
                label={`Highlight ${index + 1}`}
                value={highlight}
                onChange={(e) => handleHighlightChange(index, e)}
                placeholder={`Enter highlight ${index + 1}`}
                maxLength={100}
              />
            ))}
          </div>
        </div>

        {/* Logo */}
        <div className={styles.section}>
          <label className={styles.label}>Logo</label>
          <ImageUploader
            imageUrl={localFormData.logo}
            onImageUpload={handleLogoUpload}
            onError={handleLogoError}
            folder={folder}
            preset={preset}
            alt="Business logo"
            label="Logo"
          />
        </div>
      </div>

      {/* Only render Toast when visible */}
      {toast.visible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
        />
      )}
    </div>
  );
}
