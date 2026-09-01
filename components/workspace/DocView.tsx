"use client";
// components/workspace/DocView.tsx
//
// Renders one workspace doc: breadcrumb, an editable title (saved on blur),
// and the Tiptap body (saved on a short debounce after typing stops). No
// single-item GET endpoint exists for workspace items — this fetches the
// same small list WorkspacePanel uses and finds itself in it, matching the
// rest of this app's "small dataset, no per-item round trip" convention.

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./DocView.module.css";
import DocEditor from "./DocEditor";
import type { WorkspaceItem } from "@/lib/workspace/store";

interface DocViewProps {
  itemId: number;
}

type SaveState = "idle" | "saving" | "saved";

export default function DocView({ itemId }: DocViewProps) {
  const [item, setItem] = useState<WorkspaceItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch("/api/workspace/items")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const found: WorkspaceItem | undefined = (data.items ?? []).find(
          (i: WorkspaceItem) => i.id === itemId,
        );
        setItem(found ?? null);
        setTitle(found?.name ?? "");
        setContent(found?.content ?? "");
      })
      .catch((err) => console.error("[Workspace] fetch doc failed:", err))
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [itemId]);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const saveContent = useCallback(
    async (html: string) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/workspace/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        });
        if (!res.ok) throw new Error("Failed to save");
        setSaveState("saved");
      } catch (err) {
        console.error("[Workspace] save doc content failed:", err);
        setSaveState("idle");
      }
    },
    [itemId],
  );

  const handleContentChange = (html: string) => {
    setContent(html);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveContent(html), 900);
  };

  const handleTitleBlur = async () => {
    const trimmed = title.trim();
    if (!item || !trimmed || trimmed === item.name) {
      setTitle(item?.name ?? "");
      return;
    }
    try {
      const res = await fetch(`/api/workspace/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error("Failed to rename");
      setItem((prev) => (prev ? { ...prev, name: trimmed } : prev));
    } catch (err) {
      console.error("[Workspace] rename doc failed:", err);
      setTitle(item.name);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.inner}>
        <p className={styles.loading}>Loading…</p>
      </div>
    );
  }

  if (!item) {
    return (
      <div className={styles.inner}>
        <p className={styles.notFound}>This page was deleted or doesn&apos;t exist.</p>
      </div>
    );
  }

  return (
    <div className={styles.inner}>
      <div className={styles.crumb}>
        <div className={styles.crumbIcon}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M6 3h7l5 5v13H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          </svg>
        </div>
        <span>RAS-VERTEX / Workspace</span>
      </div>
      <input
        className={styles.title}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleTitleBlur}
        placeholder="Untitled"
      />
      <div className={styles.meta}>
        {saveState === "saving"
          ? "Saving…"
          : saveState === "saved"
            ? "Saved"
            : `Edited ${new Date(item.updatedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}`}
      </div>
      <DocEditor value={content} onChange={handleContentChange} />
    </div>
  );
}
