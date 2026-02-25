/**
 * Cloudinary utilities for optimizing and organizing images
 */

/**
 * Generate an optimized image URL for gallery thumbnails
 * @param originalUrl The original Cloudinary URL
 * @param size The size for the thumbnail (default: 140)
 * @returns Optimized Cloudinary URL
 */
export function getGalleryThumbUrl(originalUrl: string): string {
  if (originalUrl && originalUrl.includes("cloudinary.com")) {
    // Use c_thumb instead of c_fill for better focal point detection
    // Add w_300 to request a larger image than needed for better quality
    return originalUrl.replace(
      "/upload/",
      "/upload/c_thumb,g_auto,h_300,w_300,q_auto/"
    );
  }
  return originalUrl;
}
/**
 * Generate a full-size image URL with quality optimization
 * @param originalUrl The original Cloudinary URL
 * @param maxWidth The maximum width (default: 1200)
 * @returns Optimized Cloudinary URL
 */
export function getFullSizeImageUrl(
  originalUrl: string,
  maxWidth: number = 1200
): string {
  if (!originalUrl) return "";

  if (originalUrl.includes("cloudinary.com")) {
    return originalUrl.replace(
      "/upload/",
      `/upload/c_limit,w_${maxWidth},q_auto/`
    );
  }

  return originalUrl;
}

/**
 * Generate a Cloudinary folder path for a specific center and section
 * @param centerId The center ID
 * @param section The section (gallery, logo, etc)
 * @returns The folder path
 */
export function getCloudinaryFolderPath(
  centerId: string,
  section: string = "gallery"
): string {
  return `bord/centers/${centerId}/${section}`;
}

/**
 * Configure Cloudinary upload parameters for a specific center and section
 * @param centerId The center ID
 * @param section The section (gallery, logo, etc)
 * @returns Upload parameters object
 */
export function getCloudinaryUploadParams(
  centerId: string,
  section: string = "gallery"
) {
  return {
    folder: getCloudinaryFolderPath(centerId, section),
    transformation: [{ width: 1200, crop: "limit" }, { quality: "auto" }],
    resourceType: "image",
    maxFileSize: 10485760, // 10MB
  };
}
