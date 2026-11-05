// components/reports/shared/builder/PhotoTools.tsx
//
// On-page photo editing in the builder previews (inspection, proposal): a ×
// in the photo's top-right corner to take it off the page, and drag a photo
// onto another to move it there. No hooks (the documents also render on the
// server for the PDF, where none of this shows). Include PHOTO_TOOLS_CSS
// once in the preview.

import type { DragEvent, MouseEvent } from "react";

const TYPE = "application/x-report-photo";

export const PHOTO_TOOLS_CSS = `
.pt-card{position:relative}
.pt-card[draggable=true]{cursor:grab}
.pt-card.pt-dragging{opacity:.35}
.pt-card.pt-over{outline:4px dashed #3e7fb0;outline-offset:10px;border-radius:20px}
.pt-x{position:absolute;top:16px;right:16px;z-index:3;width:52px;height:52px;border:0;border-radius:999px;background:rgba(255,255,255,.94);color:#17171a;box-shadow:0 2px 10px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;cursor:pointer;opacity:0;transition:opacity 120ms ease,transform 120ms ease}
.pt-card:hover .pt-x{opacity:1}
.pt-x:hover{transform:scale(1.06);background:#fff;color:#a83a3a}
`;

/** The × on a photo. */
export function RemoveX({ onRemove, title = "Remove from the report" }: { onRemove: () => void; title?: string }) {
  return (
    <button
      type="button"
      className="pt-x"
      title={title}
      aria-label={title}
      onClick={(e: MouseEvent) => {
        e.stopPropagation();
        onRemove();
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

/** Props for a photo card that can be dragged onto another: onMove(from, to). */
export function dragProps(id: string, onMove: (from: string, to: string) => void) {
  const over = (e: DragEvent<HTMLElement>, on: boolean) => e.currentTarget.classList.toggle("pt-over", on);
  return {
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      e.dataTransfer.setData(TYPE, id);
      e.dataTransfer.effectAllowed = "move";
      e.currentTarget.classList.add("pt-dragging");
    },
    onDragEnd: (e: DragEvent<HTMLElement>) => e.currentTarget.classList.remove("pt-dragging"),
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!e.dataTransfer.types.includes(TYPE)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      over(e, true);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) over(e, false);
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      over(e, false);
      const from = e.dataTransfer.getData(TYPE);
      if (from && from !== id) onMove(from, id);
    },
  };
}
