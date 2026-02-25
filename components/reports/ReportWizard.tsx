"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import ReportWizardHeader from "./ReportWizardHeader";
import styles from "./ReportWizard.module.css";

interface Photo {
  id: string;
  name: string;
  url: string;
  size: number;
}

function naturalSort(a: string, b: string): number {
  const chunkify = (str: string) => str.split(/(\d+)/).filter((c) => c !== "");
  const chunksA = chunkify(a);
  const chunksB = chunkify(b);
  for (let i = 0; i < Math.max(chunksA.length, chunksB.length); i++) {
    const ca = chunksA[i] || "";
    const cb = chunksB[i] || "";
    if (/^\d+$/.test(ca) && /^\d+$/.test(cb)) {
      const diff = parseInt(ca, 10) - parseInt(cb, 10);
      if (diff !== 0) return diff;
    } else {
      const r = ca.localeCompare(cb);
      if (r !== 0) return r;
    }
  }
  return 0;
}

function isDataOrBlobUrl(url: string) {
  return url.startsWith("data:") || url.startsWith("blob:");
}

const ReportWizard: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [message, setMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const [jobNumber, setJobNumber] = useState("");
  const [loadingImport, setLoadingImport] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    loaded: number;
    total: number;
  } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showMessage = (text: string, type: "success" | "error" = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 4000);
  };

  const sortedPhotos = React.useMemo(
    () => [...photos].sort((a, b) => naturalSort(a.name, b.name)),
    [photos],
  );

  const fetchSimproPhotos = async () => {
    if (!jobNumber.trim()) {
      showMessage("Please enter a job number", "error");
      return;
    }

    setLoadingImport(true);
    setImportProgress(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/simpro/jobs/${jobNumber}/attachments?companyId=0`,
      );

      if (!response.ok || !response.body) {
        throw new Error("Failed to connect to SimPRO");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          if (!frame.trim()) continue;

          const lines = frame.split("\n");
          let eventName = "message";
          let dataLine = "";

          for (const line of lines) {
            if (line.startsWith("event: ")) eventName = line.slice(7).trim();
            if (line.startsWith("data: ")) dataLine = line.slice(6).trim();
          }

          if (!dataLine) continue;

          let payload: Record<string, unknown>;
          try {
            payload = JSON.parse(dataLine);
          } catch {
            continue;
          }

          switch (eventName) {
            case "start":
              setImportProgress({ loaded: 0, total: payload.total as number });
              break;

            case "photo":
              setPhotos((prev) => [
                ...prev,
                {
                  id: payload.id as string,
                  name: payload.name as string,
                  url: payload.url as string,
                  size: payload.size as number,
                },
              ]);
              break;

            case "progress":
              setImportProgress({
                loaded: payload.loaded as number,
                total: payload.total as number,
              });
              break;

            case "done":
              setImportProgress(null);
              if ((payload.loaded as number) === 0) {
                showMessage(`No photos found for job ${jobNumber}`, "error");
              } else {
                showMessage(
                  `Loaded ${payload.loaded} photo${payload.loaded === 1 ? "" : "s"} from SimPRO${
                    (payload.failed as number) > 0
                      ? ` (${payload.failed} failed)`
                      : ""
                  }`,
                );
              }
              break;

            case "error":
              showMessage(
                (payload.message as string) || "Failed to fetch photos",
                "error",
              );
              break;
          }
        }
      }
    } catch (err) {
      showMessage(
        err instanceof Error ? err.message : "Failed to fetch photos",
        "error",
      );
      setImportProgress(null);
    } finally {
      setLoadingImport(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;

    const newPhotos: Photo[] = [];
    let processed = 0;

    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        newPhotos.push({
          id: Math.random().toString(36).substr(2, 9),
          name: file.name,
          url: ev.target?.result as string,
          size: file.size,
        });
        processed++;
        if (processed === imageFiles.length) {
          setPhotos((prev) => [...prev, ...newPhotos]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePhotoRemove = (id: string) =>
    setPhotos((prev) => prev.filter((p) => p.id !== id));

  const startEditing = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name.replace(/\.[^/.]+$/, ""));
  };

  const saveEdit = (id: string) => {
    if (editingName.trim()) {
      setPhotos((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const ext = p.name.includes(".") ? "." + p.name.split(".").pop() : "";
          return { ...p, name: editingName.trim() + ext };
        }),
      );
    }
    setEditingId(null);
    setEditingName("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const generatePrint = async () => {
    if (!photos.length) return;

    const photosWithBase64 = await Promise.all(
      sortedPhotos.map(async (photo) => {
        if (isDataOrBlobUrl(photo.url)) return photo;
        try {
          const res = await fetch(photo.url);
          const blob = await res.blob();
          return await new Promise<Photo>((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) =>
              resolve({ ...photo, url: e.target?.result as string });
            reader.readAsDataURL(blob);
          });
        } catch {
          return photo;
        }
      }),
    );

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Photo Report</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; background: white; }
            .grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.75rem;
              padding: 0.75rem;
            }
            .photo-item { page-break-inside: avoid; break-inside: avoid; }
            .photo-container {
              aspect-ratio: 1 / 1;
              background: #f3f4f6;
              border-radius: 0.5rem;
              overflow: hidden;
            }
            .photo-container img { width: 100%; height: 100%; object-fit: cover; }
            .caption {
              background: #f3f4f6;
              border-radius: 0.5rem;
              padding: 0.5rem 0.75rem;
              margin-top: 0.5rem;
              text-align: center;
              font-size: 0.75rem;
              font-weight: 400;
              color: #374151;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @media print {
              .grid { grid-template-columns: repeat(3, 1fr); gap: 0.75rem; padding: 0.5rem; }
              .caption { font-size: 0.7rem; padding: 0.4rem 0.6rem; }
              .photo-item { page-break-inside: avoid; break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${photosWithBase64
              .map(
                (photo) => `
              <div class="photo-item">
                <div class="photo-container">
                  <img src="${photo.url}" alt="${photo.name}" />
                </div>
                <div class="caption">${photo.name.replace(/\.[^/.]+$/, "")}</div>
              </div>
            `,
              )
              .join("")}
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 1000);
  };

  const handlePDFEditor = () => {
    console.log("PDF Editor clicked - implement when ready");
  };

  const clearAll = () => {
    setPhotos([]);
    setJobNumber("");
    setMessage(null);
    setImportProgress(null);
  };

  const headerActions = (
    <ReportWizardHeader
      hasPhotos={photos.length > 0}
      hasJobNumber={jobNumber.trim().length > 0}
      onQuickPrint={generatePrint}
      onPDFEditor={handlePDFEditor}
      onClearAll={clearAll}
    />
  );

  const fetchButtonLabel = () => {
    if (loadingImport && importProgress) {
      return `${importProgress.loaded} / ${importProgress.total}`;
    }
    if (loadingImport) return "Connecting...";
    return "Fetch Photos";
  };

  return (
    <div className={styles.page}>
      {message && (
        <div
          className={`${styles.banner} ${
            message.type === "error" ? styles.bannerError : styles.bannerSuccess
          }`}
        >
          {message.text}
        </div>
      )}

      {loadingImport && importProgress && (
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{
              width: `${Math.round((importProgress.loaded / importProgress.total) * 100)}%`,
            }}
          />
        </div>
      )}

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Import from SimPRO</h3>
        <div className={styles.importRow}>
          <input
            type="text"
            placeholder="Enter job number..."
            value={jobNumber}
            onChange={(e) => setJobNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchSimproPhotos()}
            className={styles.importInput}
          />
          <Button
            onClick={fetchSimproPhotos}
            disabled={loadingImport || !jobNumber.trim()}
            variant="primary"
            icon={
              <Image
                src="/icons/utility-outline/search.svg"
                alt=""
                width={18}
                height={18}
              />
            }
          >
            {fetchButtonLabel()}
          </Button>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Upload Photos</h3>
        <div
          className={styles.dropZone}
          onClick={() => fileInputRef.current?.click()}
        >
          <Image
            src="/icons/utility-outline/add-image.svg"
            alt=""
            width={40}
            height={40}
            className={styles.dropZoneIcon}
          />
          <p className={styles.dropZoneText}>
            Drop images here or click to browse
          </p>
          <Button
            variant="secondary"
            onClick={(e) => {
              e?.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Choose Files
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: "none" }}
        />
      </div>

      {sortedPhotos.length === 0 ? (
        <div className={styles.emptyCard}>
          <Image
            src="/icons/utility-outline/map.svg"
            alt=""
            width={48}
            height={48}
          />
          <h3 className={styles.emptyTitle}>No Photos Yet</h3>
          <p className={styles.emptyText}>
            Import photos from a SimPRO job or upload files to get started
          </p>
        </div>
      ) : (
        <div className={styles.card}>
          <div className={styles.gridHeader}>
            <h3 className={styles.gridTitle}>Photos ({sortedPhotos.length})</h3>
            <span className={styles.gridHint}>Click photo names to edit</span>
          </div>
          <div className={styles.grid}>
            {sortedPhotos.map((photo) => (
              <div key={photo.id} className={styles.photoItem}>
                <div className={styles.photoThumb}>
                  {isDataOrBlobUrl(photo.url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo.url} alt={photo.name} />
                  ) : (
                    <Image
                      src={photo.url}
                      alt={photo.name}
                      fill
                      style={{ objectFit: "cover" }}
                    />
                  )}
                  <button
                    className={styles.removeBtn}
                    onClick={() => handlePhotoRemove(photo.id)}
                    aria-label="Remove photo"
                  >
                    <Image
                      src="/icons/utility-outline/cross.svg"
                      alt="Remove"
                      width={12}
                      height={12}
                      style={{ filter: "brightness(0) invert(1)" }}
                    />
                  </button>
                </div>

                {editingId === photo.id ? (
                  <input
                    className={styles.photoCaptionInput}
                    value={editingName}
                    autoFocus
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => saveEdit(photo.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(photo.id);
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                ) : (
                  <p
                    className={styles.photoCaption}
                    onClick={() => startEditing(photo.id, photo.name)}
                    title={photo.name.replace(/\.[^/.]+$/, "")}
                  >
                    {photo.name.replace(/\.[^/.]+$/, "")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportWizard;
