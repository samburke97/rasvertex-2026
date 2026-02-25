// lib/hooks/use-simpro.ts - Fixed types
import { useState, useCallback } from "react";

interface PhotoGridItem {
  id: string;
  name: string;
  url: string;
  size: number;
  source: "upload" | "simpro";
  simproData?: SimproAttachment;
}

interface SimproAttachment {
  ID: string;
  Filename: string;
  MimeType: string;
  FileSizeBytes: number;
  Base64Data?: string;
}

interface UseSimPROReturn {
  loading: boolean;
  error: string | null;
  fetchAttachments: (
    jobNumber: string,
    companyId?: string
  ) => Promise<PhotoGridItem[]>;
  testConnection: (
    baseUrl: string,
    clientId: string,
    clientSecret: string
  ) => Promise<boolean>;
}

export const useSimPRO = (): UseSimPROReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAttachments = useCallback(
    async (jobNumber: string, companyId = "0"): Promise<PhotoGridItem[]> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/simpro/jobs/${jobNumber}/attachments?companyId=${companyId}`
        );

        if (!response.ok) {
          throw new Error(
            `Failed to fetch attachments: ${response.statusText}`
          );
        }

        const { attachments } = await response.json();

        const imageAttachments = attachments.filter((att: SimproAttachment) =>
          att.MimeType?.startsWith("image/")
        );

        return imageAttachments.map((att: SimproAttachment) => ({
          id: `simpro_${att.ID}`,
          name: att.Filename,
          url: `data:${att.MimeType};base64,${att.Base64Data}`,
          size: att.FileSizeBytes,
          source: "simpro" as const,
          simproData: att,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "Failed to fetch SimPRO attachments";
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const testConnection = useCallback(
    async (
      baseUrl: string,
      clientId: string,
      clientSecret: string
    ): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch("/api/simpro/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseUrl, clientId, clientSecret }),
        });

        if (!response.ok) {
          throw new Error("Authentication failed");
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Connection test failed";
        setError(errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    fetchAttachments,
    testConnection,
  };
};
