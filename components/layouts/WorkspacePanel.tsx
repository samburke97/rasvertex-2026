"use client";
// components/layouts/WorkspacePanel.tsx
//
// The 244px collapsible tree of Tables/Docs/Folders that sits between the
// icon rail and the main card (leads.css's .panel/.tree). Only "Leads" and
// "Recurring Jobs" are type='table' items — they're seeded shortcuts to
// real pages, not a generic table-building feature, so "+ New" only offers
// Doc and Folder. Doc pages are real Next.js routes (/workspace/[id]), not
// a client-side view swap, so browser back/forward and deep links work
// normally.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./WorkspacePanel.module.css";
import Modal from "@/components/ui/Modal";
import type { WorkspaceItem, WorkspaceItemType } from "@/lib/workspace/store";

const TABLE_ROUTES: Record<string, string> = {
  leads: "/crm",
  "recurring-jobs": "/recurring-jobs",
};

interface WorkspacePanelProps {
  collapsed: boolean;
}

export default function WorkspacePanel({ collapsed }: WorkspacePanelProps) {
  const [items, setItems] = useState<WorkspaceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openFolders, setOpenFolders] = useState<Set<number>>(new Set());
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [ctx, setCtx] = useState<{ id: number; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<WorkspaceItem | null>(null);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [dragOverRoot, setDragOverRoot] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const newMenuRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/items");
      if (!res.ok) throw new Error("Failed to fetch workspace items");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch (err) {
      console.error("[Workspace] fetchItems failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    if (!newMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setNewMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [newMenuOpen]);

  useEffect(() => {
    if (!ctx) return;
    const close = () => setCtx(null);
    document.addEventListener("click", close);
    document.addEventListener("contextmenu", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("contextmenu", close);
    };
  }, [ctx]);

  const childrenOf = useMemo(() => {
    const map = new Map<number | null, WorkspaceItem[]>();
    for (const item of items) {
      const key = item.parentId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    for (const list of map.values()) list.sort((a, b) => a.position - b.position);
    return map;
  }, [items]);

  const matchesSearch = useCallback(
    (item: WorkspaceItem): boolean => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      if (item.name.toLowerCase().includes(q)) return true;
      return (childrenOf.get(item.id) ?? []).some((c) => matchesSearch(c));
    },
    [search, childrenOf],
  );

  // Auto-expand folders that contain a search match.
  useEffect(() => {
    if (!search.trim()) return;
    const toOpen = items
      .filter((i) => i.type === "folder" && matchesSearch(i))
      .map((i) => i.id);
    if (toOpen.length) {
      setOpenFolders((prev) => new Set([...prev, ...toOpen]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const toggleFolder = (id: number) => {
    setOpenFolders((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isActive = (item: WorkspaceItem): boolean => {
    if (item.type === "table") return pathname === TABLE_ROUTES[item.tableRef ?? ""];
    if (item.type === "doc") return pathname === `/workspace/${item.id}`;
    return false;
  };

  const handleOpen = (item: WorkspaceItem) => {
    if (item.type === "folder") {
      toggleFolder(item.id);
      return;
    }
    if (item.type === "table") {
      const href = TABLE_ROUTES[item.tableRef ?? ""];
      if (href) router.push(href);
      return;
    }
    router.push(`/workspace/${item.id}`);
  };

  const collectDescendantIds = useCallback(
    (id: number): Set<number> => {
      const ids = new Set<number>([id]);
      const walk = (parentId: number) => {
        for (const child of childrenOf.get(parentId) ?? []) {
          ids.add(child.id);
          walk(child.id);
        }
      };
      walk(id);
      return ids;
    },
    [childrenOf],
  );

  const handleMove = async (draggedId: number, targetParentId: number | null) => {
    const dragged = items.find((i) => i.id === draggedId);
    if (!dragged || dragged.parentId === targetParentId) return;
    if (draggedId === targetParentId) return;
    // Can't drop a folder into itself or its own descendant.
    if (targetParentId != null && collectDescendantIds(draggedId).has(targetParentId)) return;

    const prevParentId = dragged.parentId;
    setItems((prev) =>
      prev.map((i) => (i.id === draggedId ? { ...i, parentId: targetParentId } : i)),
    );
    if (targetParentId != null) {
      setOpenFolders((prev) => new Set(prev).add(targetParentId));
    }
    try {
      const res = await fetch(`/api/workspace/items/${draggedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: targetParentId }),
      });
      if (!res.ok) throw new Error("Failed to move item");
    } catch (err) {
      console.error("[Workspace] move failed:", err);
      setItems((prev) =>
        prev.map((i) => (i.id === draggedId ? { ...i, parentId: prevParentId } : i)),
      );
    }
  };

  const handleCreate = async (type: WorkspaceItemType, parentId: number | null = null) => {
    setNewMenuOpen(false);
    if (type === "table") return; // no generic table-building feature
    try {
      const res = await fetch("/api/workspace/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          name: type === "folder" ? "New folder" : "Untitled",
          parentId,
        }),
      });
      if (!res.ok) throw new Error("Failed to create item");
      const data = await res.json();
      const created: WorkspaceItem = data.item;
      setItems((prev) => [...prev, created]);
      if (parentId != null) setOpenFolders((prev) => new Set(prev).add(parentId));
      if (created.type === "doc") {
        router.push(`/workspace/${created.id}`);
      } else {
        setRenamingId(created.id);
        setRenameValue(created.name);
      }
    } catch (err) {
      console.error("[Workspace] create failed:", err);
    }
  };

  const commitRename = async (id: number) => {
    const name = renameValue.trim();
    setRenamingId(null);
    const current = items.find((i) => i.id === id);
    if (!name || !current || name === current.name) return;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, name } : i)));
    try {
      const res = await fetch(`/api/workspace/items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to rename");
    } catch (err) {
      console.error("[Workspace] rename failed:", err);
      fetchItems();
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    const idsToRemove = collectDescendantIds(id);
    setConfirmDelete(null);
    setItems((prev) => prev.filter((i) => !idsToRemove.has(i.id)));
    const openDocMatch = pathname?.match(/^\/workspace\/(\d+)$/);
    if (openDocMatch && idsToRemove.has(Number(openDocMatch[1]))) {
      router.push("/crm");
    }
    try {
      const res = await fetch(`/api/workspace/items/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
    } catch (err) {
      console.error("[Workspace] delete failed:", err);
      fetchItems();
    }
  };

  if (collapsed) return null;

  const roots = (childrenOf.get(null) ?? []).filter(matchesSearch);
  const ctxItem = ctx ? items.find((i) => i.id === ctx.id) : null;

  return (
    <aside className={styles.panel}>
      <div className={styles.top}>
        <div className={styles.newBtnWrap} ref={newMenuRef}>
          <button type="button" className={styles.newBtn} onClick={() => setNewMenuOpen((o) => !o)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <span>New</span>
            <svg className={styles.caret} width="9" height="9" viewBox="0 0 24 24" fill="none">
              <path d="M6 9L12 15L18 9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {newMenuOpen && (
            <div className={styles.newMenu}>
              <button type="button" className={styles.newMenuRow} onClick={() => handleCreate("doc")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 3h7l5 5v13H6z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                  <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
                </svg>
                <div className={styles.newMenuText}>
                  <b>Doc</b>
                  <i>Notes, scripts, playbooks</i>
                </div>
              </button>
              <button type="button" className={styles.newMenuRow} onClick={() => handleCreate("folder")}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className={styles.newMenuText}>
                  <b>Folder</b>
                  <i>Group docs together</i>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={styles.search}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M21 21L18.5 18.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          placeholder="Find a page"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div
        className={`${styles.tree} ${dragOverRoot ? styles.treeDragOver : ""}`}
        onDragOver={(e) => {
          if (draggingId == null) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDragOverRoot(true);
        }}
        onDragLeave={() => setDragOverRoot(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverRoot(false);
          const draggedId = Number(e.dataTransfer.getData("text/plain"));
          if (draggedId) handleMove(draggedId, null);
        }}
      >
        {isLoading ? (
          <p className={styles.loading}>Loading…</p>
        ) : (
          roots.map((item) => (
            <TreeRow
              key={item.id}
              item={item}
              depth={0}
              childrenOf={childrenOf}
              openFolders={openFolders}
              activeCheck={isActive}
              matchesSearch={matchesSearch}
              onOpen={handleOpen}
              onContextMenu={(e, it) => {
                e.preventDefault();
                setCtx({ id: it.id, x: e.clientX, y: e.clientY });
              }}
              renamingId={renamingId}
              renameValue={renameValue}
              setRenameValue={setRenameValue}
              onCommitRename={commitRename}
              draggingId={draggingId}
              dragOverId={dragOverId}
              onDragStartItem={setDraggingId}
              onDragEndItem={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragEnterFolder={setDragOverId}
              onDragLeaveFolder={(id) =>
                setDragOverId((prev) => (prev === id ? null : prev))
              }
              onDropOnFolder={(id, draggedId) => handleMove(draggedId, id)}
            />
          ))
        )}
        <button type="button" className={styles.newPage} onClick={() => setNewMenuOpen(true)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span>New page</span>
        </button>
      </div>

      {ctx && ctxItem && (
        <div
          className={styles.ctxMenu}
          style={{ left: Math.min(ctx.x, window.innerWidth - 212), top: ctx.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.ctxLabel}>{ctxItem.name}</div>
          <button
            type="button"
            className={styles.ctxRow}
            onClick={() => {
              setRenamingId(ctxItem.id);
              setRenameValue(ctxItem.name);
              setCtx(null);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 20h4L19 9a2.1 2.1 0 00-3-3L5 17v3z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Rename</span>
          </button>
          <button
            type="button"
            className={`${styles.ctxRow} ${styles.ctxDanger}`}
            onClick={() => {
              setConfirmDelete(ctxItem);
              setCtx(null);
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 7h12M9 7V5h6v2M8 7l1 13h6l1-13"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Remove page</span>
          </button>
        </div>
      )}

      {confirmDelete && (
        <Modal isOpen onClose={() => setConfirmDelete(null)} title="Remove this page?">
          <p className={styles.confirmBody}>
            <strong>{confirmDelete.name}</strong>
            {confirmDelete.type === "folder"
              ? ` — and everything inside it — will be removed. This can't be undone.`
              : ` will be removed. This can't be undone.`}
          </p>
          <div className={styles.confirmActions}>
            <button type="button" className={styles.confirmCancel} onClick={() => setConfirmDelete(null)}>
              Cancel
            </button>
            <button type="button" className={styles.confirmDanger} onClick={handleConfirmDelete}>
              Remove page
            </button>
          </div>
        </Modal>
      )}
    </aside>
  );
}

// ── Tree row (recursive) ─────────────────────────────────────────────────────

function TreeRow({
  item,
  depth,
  childrenOf,
  openFolders,
  activeCheck,
  matchesSearch,
  onOpen,
  onContextMenu,
  renamingId,
  renameValue,
  setRenameValue,
  onCommitRename,
  draggingId,
  dragOverId,
  onDragStartItem,
  onDragEndItem,
  onDragEnterFolder,
  onDragLeaveFolder,
  onDropOnFolder,
}: {
  item: WorkspaceItem;
  depth: number;
  childrenOf: Map<number | null, WorkspaceItem[]>;
  openFolders: Set<number>;
  activeCheck: (item: WorkspaceItem) => boolean;
  matchesSearch: (item: WorkspaceItem) => boolean;
  onOpen: (item: WorkspaceItem) => void;
  onContextMenu: (e: React.MouseEvent, item: WorkspaceItem) => void;
  renamingId: number | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  onCommitRename: (id: number) => void;
  draggingId: number | null;
  dragOverId: number | null;
  onDragStartItem: (id: number) => void;
  onDragEndItem: () => void;
  onDragEnterFolder: (id: number) => void;
  onDragLeaveFolder: (id: number) => void;
  onDropOnFolder: (id: number, draggedId: number) => void;
}) {
  const isFolder = item.type === "folder";
  const isDraggable = item.type !== "table";
  const isOpen = openFolders.has(item.id);
  const children = (childrenOf.get(item.id) ?? []).filter(matchesSearch);
  const isRenaming = renamingId === item.id;
  const isDragOver = isFolder && dragOverId === item.id;

  return (
    <>
      <div
        className={`${styles.row} ${depth > 0 ? styles.rowChild : ""} ${activeCheck(item) ? styles.rowActive : ""} ${draggingId === item.id ? styles.rowDragging : ""} ${isDragOver ? styles.rowDragOver : ""}`}
        style={depth > 0 ? { paddingLeft: 10 + depth * 18 } : undefined}
        onClick={() => !isRenaming && onOpen(item)}
        onContextMenu={(e) => onContextMenu(e, item)}
        role="button"
        tabIndex={0}
        draggable={isDraggable}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", String(item.id));
          e.dataTransfer.effectAllowed = "move";
          onDragStartItem(item.id);
        }}
        onDragEnd={onDragEndItem}
        onDragOver={(e) => {
          if (!isFolder || draggingId == null || draggingId === item.id) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={(e) => {
          if (!isFolder || draggingId == null || draggingId === item.id) return;
          e.preventDefault();
          onDragEnterFolder(item.id);
        }}
        onDragLeave={() => {
          if (!isFolder) return;
          onDragLeaveFolder(item.id);
        }}
        onDrop={(e) => {
          if (!isFolder) return;
          e.preventDefault();
          e.stopPropagation();
          const draggedId = Number(e.dataTransfer.getData("text/plain"));
          if (draggedId) onDropOnFolder(item.id, draggedId);
        }}
      >
        {isFolder ? (
          <svg
            className={`${styles.chev} ${isOpen ? styles.chevOpen : ""}`}
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path d="M9 6L15 12L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <span className={styles.chevSpacer} />
        )}
        <RowIcon type={item.type} />
        {isRenaming ? (
          <input
            className={styles.renameInput}
            value={renameValue}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => onCommitRename(item.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onCommitRename(item.id);
              } else if (e.key === "Escape") {
                e.preventDefault();
                onCommitRename(item.id);
              }
            }}
          />
        ) : (
          <span>{item.name}</span>
        )}
      </div>
      {isFolder &&
        isOpen &&
        children.map((child) => (
          <TreeRow
            key={child.id}
            item={child}
            depth={depth + 1}
            childrenOf={childrenOf}
            openFolders={openFolders}
            activeCheck={activeCheck}
            matchesSearch={matchesSearch}
            onOpen={onOpen}
            onContextMenu={onContextMenu}
            renamingId={renamingId}
            renameValue={renameValue}
            setRenameValue={setRenameValue}
            onCommitRename={onCommitRename}
            draggingId={draggingId}
            dragOverId={dragOverId}
            onDragStartItem={onDragStartItem}
            onDragEndItem={onDragEndItem}
            onDragEnterFolder={onDragEnterFolder}
            onDragLeaveFolder={onDragLeaveFolder}
            onDropOnFolder={onDropOnFolder}
          />
        ))}
    </>
  );
}

function RowIcon({ type }: { type: WorkspaceItemType }) {
  if (type === "table") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 9.5H21M9 9.5V20" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (type === "folder") {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M6 3h7l5 5v13H6z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}
