// lib/reports/condition.print.ts
//
// This file is the single source of truth for the print/PDF HTML.
// It must be an exact replica of the React components it mirrors:
//   - PhotoSection.tsx    → photo pages with page numbers
//   - ScheduleSection.tsx → schedule pages with topBar, heading, table, footer
//   - SummarySection.tsx  → summary page with topBar, body, footer
//   - CoverSection.tsx    → cover page
//
// The browser Export PDF path uses this file directly (window.open + print()).
// The Save to Job path uses Puppeteer to render this HTML server-side.
// Both must produce identical output — do not diverge these two paths.

import type {
  ConditionReportData,
  PhotoLayout,
  ScheduleRow,
} from "./condition.types";
import { formatScheduleDate } from "./condition.types";

// ── Shared pagination constants (also used by PhotoSection.tsx) ───────────────
// A4 at 96dpi: 794 x 1123px; padding 2.75rem = 44px each side
// Available height: 1123 - (44 * 2) = 1035px
export const PAGE_AVAILABLE_H = 1035;
export const DATE_HEADER_H = 34;
export const GROUP_GAP = 36;

// Photo grid density — must match PHOTO_LAYOUTS in PhotoSection.tsx.
const PHOTO_LAYOUTS: Record<
  PhotoLayout,
  { columns: number; rowH: number; aspectRatio: string }
> = {
  large: { columns: 2, rowH: 390, aspectRatio: "1 / 1" },
  medium: { columns: 2, rowH: 345, aspectRatio: "346 / 301" },
  small: { columns: 3, rowH: 270, aspectRatio: "1 / 1" },
};

// Schedule rows per page — must match ScheduleSection.tsx
const ROWS_PER_FIRST_PAGE = 22;
const ROWS_PER_CONTINUATION = 22;

// Rows are taller when the Notes column is active (room to write on the
// printed page), so fewer of them fit per page — must match ScheduleSection.tsx
const ROWS_PER_FIRST_PAGE_NOTES = 18;
const ROWS_PER_CONTINUATION_NOTES = 20;

// ── Static asset map ──────────────────────────────────────────────────────────
// Browser path: omit — relative /public paths resolve normally.
// Puppeteer path: pass pre-read base64 data URIs so headless Chrome needs
// zero outbound requests and images always appear in the saved PDF.

export interface StaticAssets {
  rasLogo: string;
  linkWhite: string;
  linkBlue: string;
  associations: {
    communitySelect: string;
    dulux: string;
    haymes: string;
    mpa: string;
    qbcc: string;
    smartStrata: string;
  };
}

const DEFAULT_ASSETS: StaticAssets = {
  rasLogo: "/reports/ras-logo.png",
  linkWhite: "/reports/link_white.png",
  linkBlue: "/reports/link_blue.png",
  associations: {
    communitySelect: "/reports/associations/communityselect.png",
    dulux: "/reports/associations/dulux.png",
    haymes: "/reports/associations/haymes.svg",
    mpa: "/reports/associations/mpa.png",
    qbcc: "/reports/associations/qbcc.png",
    smartStrata: "/reports/associations/smartstrata.png",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function esc(str: string | number): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripExt(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

function formatGroupDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-AU", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getDayKey(iso: string | null | undefined): string {
  if (!iso) return "undated";
  try {
    return new Date(iso).toISOString().slice(0, 10);
  } catch {
    return "undated";
  }
}

// Natural sort — mirrors PhotoSection.tsx, handles "01 Anchor.jpg", "2 Roof.jpg" etc.
function naturalSort(a: string, b: string): number {
  const chunkify = (s: string) => s.split(/(\d+)/).filter(Boolean);
  const ca = chunkify(a);
  const cb = chunkify(b);
  for (let i = 0; i < Math.max(ca.length, cb.length); i++) {
    const x = ca[i] ?? "";
    const y = cb[i] ?? "";
    if (/^\d+$/.test(x) && /^\d+$/.test(y)) {
      const diff = parseInt(x, 10) - parseInt(y, 10);
      if (diff !== 0) return diff;
    } else {
      const r = x.localeCompare(y);
      if (r !== 0) return r;
    }
  }
  return 0;
}

type Photo = ConditionReportData["photos"][0];
interface PhotoGroup {
  key: string;
  label: string | null;
  photos: Photo[];
}

function groupPhotosByDate(photos: Photo[]): PhotoGroup[] {
  const map = new Map<string, Photo[]>();
  for (const p of photos) {
    const key = getDayKey(p.dateAdded);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return Array.from(map.entries()).map(([key, group]) => {
    const sorted = [...group].sort((a, b) => naturalSort(a.name, b.name));
    return {
      key,
      label: key === "undated" ? null : formatGroupDate(sorted[0].dateAdded!),
      photos: sorted,
    };
  });
}

// ── Photo paginator ───────────────────────────────────────────────────────────

type PrintItem =
  | { type: "dateHeader"; label: string }
  | { type: "photoRow"; photos: Photo[] };

function paginatePhotos(
  groups: PhotoGroup[],
  showDates: boolean,
  layout: PhotoLayout,
): PrintItem[][] {
  const { columns, rowH } = PHOTO_LAYOUTS[layout] ?? PHOTO_LAYOUTS.small;
  const pages: PrintItem[][] = [];
  let current: PrintItem[] = [];
  let usedH = 0;

  function flush() {
    if (current.length > 0) {
      pages.push(current);
      current = [];
      usedH = 0;
    }
  }

  for (let g = 0; g < groups.length; g++) {
    const group = groups[g];
    if (showDates && group.label) {
      const neededH = DATE_HEADER_H + rowH;
      if (usedH > 0 && usedH + neededH > PAGE_AVAILABLE_H) flush();
      current.push({ type: "dateHeader", label: group.label });
      usedH += DATE_HEADER_H;
    }
    const rows: Photo[][] = [];
    for (let i = 0; i < group.photos.length; i += columns)
      rows.push(group.photos.slice(i, i + columns));
    for (const row of rows) {
      if (usedH > 0 && usedH + rowH > PAGE_AVAILABLE_H) flush();
      current.push({ type: "photoRow", photos: row });
      usedH += rowH;
    }
    const isLastGroup = g === groups.length - 1;
    if (!isLastGroup && usedH > 0 && usedH + GROUP_GAP < PAGE_AVAILABLE_H)
      usedH += GROUP_GAP;
  }
  flush();
  return pages;
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const D = "#e5e7eb";

// ── Print styles ──────────────────────────────────────────────────────────────
// Every rule here must exactly match the corresponding .module.css files.

const PRINT_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #fff; font-family: 'Inter', Arial, sans-serif; }

  @media print {
    @page { size: A4; margin: 0; }
    body { margin: 0; }
  }

  /* ─────────────────────────────────────────────────────────────────────────
     COVER PAGE — mirrors CoverSection.tsx / CoverSection.module.css
  ───────────────────────────────────────────────────────────────────────── */
  .cover { width:210mm; height:297mm; display:flex; flex-direction:column; overflow:hidden; break-before:auto; page-break-before:auto; }
  .cover-hero { position:relative; width:100%; height:55%; flex-shrink:0; overflow:hidden; }
  .cover-hero-navy { position:absolute; inset:0; background:#0d1c45; z-index:0; }
  .cover-hero-photo { position:absolute; inset:0; background-size:cover; background-position:center; z-index:1; }
  .cover-hero-overlay { position:absolute; inset:0; background:rgba(13,28,69,0.45); z-index:2; }
  .cover-logo { position:absolute; top:2.5rem; left:2.75rem; z-index:3; }
  .cover-logo img { height:48px; width:auto; display:block; }
  .cover-web { position:absolute; bottom:2rem; right:2.75rem; z-index:3; }
  .cover-web img { height:18px; width:auto; display:block; opacity:0.85; }
  .cover-body { flex:1; display:flex; flex-direction:column; padding:2.5rem 2.75rem 0; overflow:hidden; }
  .cover-title-group { flex-shrink:0; margin-bottom:1.5rem; }
  .cover-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:3.4rem; letter-spacing:0.04em; line-height:0.95; color:#0d1c45; text-transform:uppercase; margin-bottom:0.75rem; }
  .cover-intro { font-family:'Inter',Arial,sans-serif; font-size:0.82rem; font-weight:300; color:#555; line-height:1.65; max-width:480px; }
  .cover-intro p { margin:0; }
  .cover-intro p+p { margin-top:0.35em; }
  .lbl { font-family:'Bebas Neue',Arial,sans-serif; font-size:1.05rem; letter-spacing:0.08em; line-height:1; color:#0d1c45; padding:0.4rem 1.25rem 0.4rem 0; white-space:nowrap; vertical-align:middle; }
  .val { font-family:'Inter',Arial,sans-serif; font-size:0.82rem; font-weight:300; color:#333; padding:0.4rem 0; vertical-align:middle; white-space:nowrap; }
  .cover-meta-wrap { padding-bottom:2rem; }
  .cover-meta { border-collapse:collapse; width:1px; }
  .cover-footer { margin-top:auto; padding:1.5rem 0 2rem; border-top:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:nowrap; }
  .cover-footer img { height:36px; width:auto; max-width:80px; object-fit:contain; display:block; opacity:0.85; }

  /* ─────────────────────────────────────────────────────────────────────────
     PHOTO PAGES — mirrors PhotoSection.tsx / PhotoSection.module.css
  ───────────────────────────────────────────────────────────────────────── */
  .photo-page { width:210mm; min-height:297mm; break-before:page; page-break-before:always; display:flex; flex-direction:column; justify-content:space-between; padding:2.75rem; }
  .photo-page:first-of-type { break-before:auto; page-break-before:auto; }
  .photo-page-inner { display:flex; flex-direction:column; gap:0.875rem; flex:1; }
  .photo-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:0.875rem; align-items:start; }
  .photo-item { display:flex; flex-direction:column; gap:0; min-width:0; width:100%; }
  .photo-thumb { width:100%; aspect-ratio:1/1; border-radius:6px; overflow:hidden; }
  .photo-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
  .photo-caption { padding:0.35rem 0.25rem 0; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:400; color:#374151; text-align:center; }
  .date-header { display:flex; align-items:center; gap:0.75rem; margin-bottom:1rem; }
  .date-line { flex:1; height:1px; background:#e5e7eb; }
  .date-text { font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:#6b7280; white-space:nowrap; padding:0 0.25rem; }
  .page-num { text-align:right; font-family:'Inter',Arial,sans-serif; font-size:0.68rem; font-weight:400; letter-spacing:0.1em; text-transform:uppercase; color:#9ca3af; padding-top:1rem; }

  /* ─────────────────────────────────────────────────────────────────────────
     SCHEDULE PAGES — mirrors ScheduleSection.tsx / ScheduleSection.module.css
  ───────────────────────────────────────────────────────────────────────── */
  .sch-page { width:210mm; min-height:297mm; break-before:page; page-break-before:always; display:flex; flex-direction:column; }
  .sch-topbar { display:flex; align-items:flex-start; justify-content:space-between; padding:2.75rem 2.75rem 0; flex-shrink:0; }
  .sch-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:3rem; font-weight:400; letter-spacing:0.04em; color:#0d1c45; line-height:1; text-transform:uppercase; }
  .sch-topbar-link { height:22px; width:auto; display:block; margin-top:0.5rem; }
  .sch-body { padding:2rem 2.75rem 2rem; flex:1; display:flex; flex-direction:column; }
  .sch-heading { display:flex; align-items:center; gap:1rem; margin-bottom:1.25rem; }
  .sch-heading-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:1.15rem; letter-spacing:0.08em; color:#0d1c45; white-space:nowrap; }
  .sch-heading-rule { flex:1; height:2px; background:#0d1c45; }
  .sch-table-wrap { flex:1; }
  .sch-table { width:100%; border-collapse:collapse; }
  .sch-th { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#374151; background:#f9f9f9; border-bottom:1px solid ${D}; text-align:left; width:20%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-th-num { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#374151; background:#f9f9f9; border-bottom:1px solid ${D}; text-align:right; white-space:nowrap; width:10%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-th-note { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#374151; background:#f9f9f9; border-bottom:1px solid ${D}; text-align:left; width:46%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-th-wide { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#374151; background:#f9f9f9; border-bottom:1px solid ${D}; text-align:left; width:35%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-th-num-wide { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:#374151; background:#f9f9f9; border-bottom:1px solid ${D}; text-align:right; white-space:nowrap; width:25%; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-row { border-bottom:1px solid #f0f0f0; }
  .sch-row:last-child { border-bottom:none; }
  .sch-row:nth-child(even) { background:#f9f9f9; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-td, .sch-td-num, .sch-td-note { padding:0.48rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.78rem; font-weight:300; color:#374151; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sch-td-num { text-align:right; }
  .sch-table.tall .sch-td, .sch-table.tall .sch-td-num, .sch-table.tall .sch-td-note { padding-top:0.95rem; padding-bottom:0.95rem; }
  .sch-section-row { background:#eef1f6; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-section-cell { padding:0.5rem 0.875rem; font-family:'Bebas Neue',Arial,sans-serif; font-size:1.15rem; font-weight:400; letter-spacing:0.08em; color:#0d1c45; text-transform:uppercase; line-height:1; border-bottom:1px solid #e0e4ee; }
  .sch-totals { background:#f9f9f9; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .sch-totals-label { padding:0.55rem 0.875rem; font-family:'Bebas Neue',Arial,sans-serif; font-size:0.85rem; letter-spacing:0.08em; color:#0d1c45; }
  .sch-totals-cell { padding:0.55rem 0.875rem; font-family:'Inter',Arial,sans-serif; font-size:0.78rem; font-weight:600; color:#0d1c45; text-align:right; }
  .sch-footer { padding:1.5rem 2.75rem 2rem; border-top:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:nowrap; }
  .sch-footer img { height:36px; width:auto; max-width:80px; object-fit:contain; display:block; opacity:0.85; }

  /* ─────────────────────────────────────────────────────────────────────────
     SUMMARY PAGE — mirrors SummarySection.tsx / SummarySection.module.css
  ───────────────────────────────────────────────────────────────────────── */
  .summary-page { width:210mm; min-height:297mm; break-before:page; page-break-before:always; display:flex; flex-direction:column; }
  .summary-topbar { display:flex; align-items:flex-start; justify-content:space-between; padding:2.75rem 2.75rem 0; flex-shrink:0; }
  .summary-title { font-family:'Bebas Neue',Arial,sans-serif; font-size:3rem; font-weight:400; letter-spacing:0.04em; color:#0d1c45; line-height:1; text-transform:uppercase; }
  .summary-link { height:22px; width:auto; display:block; margin-top:0.5rem; }
  .summary-body { padding:2rem 2.75rem; flex:1; display:flex; flex-direction:column; gap:2rem; }
  .summary-section { display:flex; flex-direction:column; gap:0.5rem; }
  .summary-label { font-family:'Bebas Neue',Arial,sans-serif; font-size:1.15rem; letter-spacing:0.08em; color:#0d1c45; line-height:1; margin-bottom:0.15em; }
  /* FIX 1: white-space:pre-wrap preserves line breaks from Tiptap HTML        */
  /* FIX 2: overflow-wrap + word-break prevents caption overflow               */
  /* FIX 3: min-height on <p> preserves blank lines (empty <p> from Tiptap)   */
  .summary-text { font-family:'Inter',Arial,sans-serif; font-size:0.85rem; font-weight:300; color:#444; line-height:1.85; overflow-wrap:break-word; word-break:break-word; }
  .summary-text p { margin:0 0 0.35em; min-height:1.572em; }
  .summary-text p:last-child { margin-bottom:0; }
  .summary-text strong { font-weight:600; color:#333; }
  .summary-text em { font-style:italic; }
  .summary-text ul,.summary-text ol { padding-left:1.4em; margin:0.2em 0 0.35em; }
  .summary-text ul { list-style-type:disc; }
  .summary-text ol { list-style-type:decimal; }
  .summary-text li { margin-bottom:0.15em; }
  .summary-footer { margin-top:auto; padding:1.5rem 2.75rem 2rem; border-top:1px solid #ebebeb; display:flex; align-items:center; justify-content:center; gap:20px; flex-wrap:nowrap; }
  .summary-footer img { height:36px; width:auto; max-width:80px; object-fit:contain; display:block; opacity:0.85; }
`;

// ── Schedule pages HTML builder ───────────────────────────────────────────────
// Mirrors ScheduleSection.tsx exactly:
//   - Paginates at ROWS_PER_FIRST_PAGE (22) then ROWS_PER_CONTINUATION (22),
//     or the *_NOTES variants when the Notes column is active (taller rows)
//   - topBar + sub-heading only on first page
//   - Association footer on every page
//   - Total row on last page only
//   - Columns: Date, Employee, Hours, (Notes — optional, left blank for pen
//     notes; matches React component)

// Mirrors the item model in ScheduleSection.tsx: when sectioned, rows are
// expanded into header/row/subtotal items so a per-section tally can be
// inserted right after the last row of each section.
type ScheduleItem =
  | { kind: "header"; sectionId: string; title: string }
  | { kind: "row"; row: ScheduleRow }
  | { kind: "subtotal"; sectionId: string; title: string; hours: number };

const DEFAULT_LEADING_SECTION_TITLE = "Section 1";

// Once any row has a named break, every row must belong to a named section —
// including the rows before the first break, which get an auto-named header.
function buildScheduleItems(
  rows: ScheduleRow[],
  sectioned: boolean,
): ScheduleItem[] {
  if (!sectioned) return rows.map((row) => ({ kind: "row", row }));

  const hasAnyBreak = rows.some((r) => r.sectionTitle);

  const items: ScheduleItem[] = [];
  let sectionId: string | null = null;
  let title = "";
  let hours = 0;
  let inSection = false;

  const flush = () => {
    if (inSection) {
      items.push({ kind: "subtotal", sectionId: sectionId!, title, hours });
    }
  };

  rows.forEach((row, idx) => {
    const isImplicitLeadingHeader =
      idx === 0 && hasAnyBreak && !row.sectionTitle;

    if (row.sectionTitle || isImplicitLeadingHeader) {
      flush();
      sectionId = row.id;
      title = row.sectionTitle || DEFAULT_LEADING_SECTION_TITLE;
      hours = 0;
      inSection = true;
      items.push({ kind: "header", sectionId: row.id, title });
    }
    items.push({ kind: "row", row });
    if (inSection) hours += row.actualHours;
  });
  flush();
  return items;
}

// Identical slotting rule to ScheduleSection.tsx's paginateScheduleItems:
// header/row/subtotal each take one slot, and every new section starts on a
// fresh page (unless it's already the first item on one).
function paginateScheduleItems(
  items: ScheduleItem[],
  perFirst: number,
  perCont: number,
): ScheduleItem[][] {
  const pages: ScheduleItem[][] = [];
  let current: ScheduleItem[] = [];
  let limit = perFirst;

  for (const item of items) {
    const startsNewSection = item.kind === "header" && current.length > 0;
    if (current.length >= limit || startsNewSection) {
      pages.push(current);
      current = [];
      limit = perCont;
    }
    current.push(item);
  }
  pages.push(current);
  return pages;
}

function buildSchedulePagesHTML(
  rows: ScheduleRow[],
  assocHTML: string,
  linkBlue: string,
  showNotes: boolean,
  sectioned: boolean,
): string {
  if (rows.length === 0) return "";

  const totalHours = rows.reduce((s, r) => s + r.actualHours, 0);

  const rowsPerFirstPage = showNotes
    ? ROWS_PER_FIRST_PAGE_NOTES
    : ROWS_PER_FIRST_PAGE;
  const rowsPerContinuation = showNotes
    ? ROWS_PER_CONTINUATION_NOTES
    : ROWS_PER_CONTINUATION;

  const items = buildScheduleItems(rows, sectioned);
  const pages = paginateScheduleItems(
    items,
    rowsPerFirstPage,
    rowsPerContinuation,
  );

  const noteCell = (row: ScheduleRow) =>
    showNotes ? `<td class="sch-td-note">${esc(row.note)}</td>` : "";

  // No Notes column — give Date/Employee/Hours a wider, evenly-distributed
  // share so Hours doesn't strand itself far from Employee. Must match
  // .thEvenWide/.thNumWide (and td equivalents) in ScheduleSection.tsx.
  const thEvenClass = showNotes ? "sch-th" : "sch-th-wide";
  const thNumClass = showNotes ? "sch-th-num" : "sch-th-num-wide";

  return pages
    .map((pageItems, pageIdx) => {
      const isFirst = pageIdx === 0;
      const isLast = pageIdx === pages.length - 1;

      const topBar = isFirst
        ? `<div class="sch-topbar">
            <h1 class="sch-title">Schedule</h1>
            <img src="${esc(linkBlue)}" alt="rasvertex.com.au" class="sch-topbar-link" />
          </div>`
        : "";

      const subHeading = isFirst
        ? `<div class="sch-heading">
            <div class="sch-heading-title">Hours Schedule</div>
            <div class="sch-heading-rule"></div>
          </div>`
        : "";

      const bodyRows = pageItems
        .map((item) => {
          if (item.kind === "header") {
            const colCount = showNotes ? 4 : 3;
            return `
        <tr class="sch-section-row">
          <td class="sch-section-cell" colspan="${colCount}">${esc(item.title || "Untitled section")}</td>
        </tr>`;
          }

          if (item.kind === "subtotal") {
            return `
        <tr class="sch-totals">
          <td class="sch-totals-label">${esc((item.title || "Section") + " subtotal")}</td>
          <td class="sch-td"></td>
          <td class="sch-totals-cell">${item.hours > 0 ? item.hours.toFixed(2) : "—"}</td>
          ${showNotes ? '<td class="sch-td"></td>' : ""}
        </tr>`;
          }

          const row = item.row;
          return `
        <tr class="sch-row">
          <td class="sch-td">${esc(formatScheduleDate(row.date))}</td>
          <td class="sch-td">${esc(row.employeeName)}</td>
          <td class="sch-td-num">${row.actualHours > 0 ? row.actualHours.toFixed(2) : "—"}</td>
          ${noteCell(row)}
        </tr>`;
        })
        .join("\n");

      const totalsRow =
        isLast && rows.length > 0
          ? `<tfoot>
              <tr class="sch-totals">
                <td class="sch-totals-label">Total</td>
                <td class="sch-td"></td>
                <td class="sch-totals-cell">${totalHours > 0 ? totalHours.toFixed(2) : "—"}</td>
                ${showNotes ? '<td class="sch-td"></td>' : ""}
              </tr>
            </tfoot>`
          : "";

      return `
<div class="sch-page">
  ${topBar}
  <div class="sch-body">
    ${subHeading}
    <div class="sch-table-wrap">
      <table class="sch-table${showNotes ? " tall" : ""}">
        <thead>
          <tr>
            <th class="${thEvenClass}">Date</th>
            <th class="${thEvenClass}">Employee</th>
            <th class="${thNumClass}">Hours</th>
            ${showNotes ? '<th class="sch-th-note">Notes</th>' : ""}
          </tr>
        </thead>
        <tbody>${bodyRows}</tbody>
        ${totalsRow}
      </table>
    </div>
  </div>
  <div class="sch-footer">${assocHTML}</div>
</div>`;
    })
    .join("\n");
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Builds the full print-ready HTML for a condition report.
 *
 * @param report  Report data. Photos must already have base64 `url` values
 *                when called server-side (Puppeteer path).
 * @param assets  Optional pre-loaded base64 data URIs for /public static assets.
 *                Omit when calling from the browser — relative paths work fine.
 *                Pass when calling from Puppeteer so headless Chrome has no
 *                outbound image requests and all assets are embedded inline.
 */
export function buildPrintHTML(
  report: ConditionReportData,
  assets?: StaticAssets,
): string {
  const { showDates, photoLayout, showSchedule, showScheduleNotes, scheduleSections } =
    report.settings;
  const a = assets ?? DEFAULT_ASSETS;
  const { columns: photoColumns, aspectRatio: photoAspectRatio } =
    PHOTO_LAYOUTS[photoLayout] ?? PHOTO_LAYOUTS.small;

  // ── Association logos fragment (reused in cover, schedule, summary footers) ─
  const ASSOC_LOGOS = [
    { src: a.associations.communitySelect, alt: "Community Select" },
    { src: a.associations.dulux, alt: "Dulux" },
    { src: a.associations.haymes, alt: "Haymes Paint" },
    { src: a.associations.mpa, alt: "MPA" },
    { src: a.associations.qbcc, alt: "QBCC" },
    { src: a.associations.smartStrata, alt: "Smart Strata" },
  ];
  const assocHTML = ASSOC_LOGOS.map(
    (l) => `<img src="${esc(l.src)}" alt="${esc(l.alt)}" />`,
  ).join("");

  // ── Photo pages ───────────────────────────────────────────────────────────
  // When not grouping by date, still sort the flat list by filename
  const flatSorted = [...report.photos].sort((a, b) =>
    naturalSort(a.name, b.name),
  );
  const groups = showDates
    ? groupPhotosByDate(report.photos)
    : [{ key: "all", label: null, photos: flatSorted }];

  const photoPages = paginatePhotos(groups, showDates, photoLayout);
  const totalPhotoPages = photoPages.length;

  const photoPageHTML = photoPages
    .map((items, pageIdx) => {
      const inner = items
        .map((item) => {
          if (item.type === "dateHeader") {
            return `<div class="date-header"><span class="date-line"></span><span class="date-text">${esc(item.label)}</span><span class="date-line"></span></div>`;
          }
          const cells = item.photos
            .map((photo) => {
              return `<div class="photo-item">
  <div class="photo-thumb" style="aspect-ratio:${photoAspectRatio}"><img src="${esc(photo.url)}" alt="${esc(photo.name)}" /></div>
  <div class="photo-caption">${esc(stripExt(photo.name))}</div>
</div>`;
            })
            .join("\n");
          return `<div class="photo-grid" style="grid-template-columns:repeat(${photoColumns}, 1fr)">${cells}</div>`;
        })
        .join("\n");

      const pageLabel =
        totalPhotoPages > 1
          ? `PAGE ${pageIdx + 1} / ${totalPhotoPages}`
          : `PAGE ${pageIdx + 1}`;

      return `<div class="photo-page">
  <div class="photo-page-inner">${inner}</div>
  <div class="page-num">${pageLabel}</div>
</div>`;
    })
    .join("\n");

  // ── Schedule pages ────────────────────────────────────────────────────────
  const scheduleHTML =
    showSchedule && report.schedule.length > 0
      ? buildSchedulePagesHTML(
          report.schedule,
          assocHTML,
          a.linkBlue,
          showScheduleNotes,
          scheduleSections,
        )
      : "";

  // ── Cover page ────────────────────────────────────────────────────────────
  const coverPhotoLayer = report.job.coverPhoto
    ? `<div class="cover-hero-photo" style="background-image:url('${report.job.coverPhoto}')"></div>`
    : "";

  const metaRows = [
    { label: "Prepared For:", value: report.job.preparedFor },
    { label: "Prepared By:", value: report.job.preparedBy },
    { label: "Address:", value: report.job.address },
    { label: "Project:", value: report.job.project },
    { label: "Date:", value: report.job.date },
  ]
    .map(
      (r) =>
        `<tr><td class="lbl">${esc(r.label)}</td><td class="val">${esc(r.value || "")}</td></tr>`,
    )
    .join("");

  const introText =
    report.job.intro ||
    "This report outlines the repairs and maintenance works completed, including any updates, adjustments, and variations from the original scope.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${esc(report.job.reportType || "Building Condition Report")} — ${esc(report.job.project)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@300;400;600&display=swap" rel="stylesheet" />
  <style>${PRINT_STYLES}</style>
</head>
<body>

<!-- ── COVER ── -->
<div class="cover">
  <div class="cover-hero">
    <div class="cover-hero-navy"></div>
    ${coverPhotoLayer}
    <div class="cover-hero-overlay"></div>
    <div class="cover-logo"><img src="${esc(a.rasLogo)}" alt="RAS Vertex" /></div>
    <div class="cover-web"><img src="${esc(a.linkWhite)}" alt="rasvertex.com.au" /></div>
  </div>
  <div class="cover-body">
    <div class="cover-title-group">
      <div class="cover-title">${esc(report.job.reportType || "Building Condition Report")}</div>
      <div class="cover-intro">${introText}</div>
    </div>
    <div class="cover-meta-wrap">
      <table class="cover-meta">${metaRows}</table>
    </div>
    <div class="cover-footer">${assocHTML}</div>
  </div>
</div>

<!-- ── PHOTO PAGES ── -->
${photoPageHTML}

<!-- ── SCHEDULE PAGES ── -->
${scheduleHTML}

<!-- ── SUMMARY ── -->
<div class="summary-page">
  <div class="summary-topbar">
    <div class="summary-title">Summary</div>
    <img src="${esc(a.linkBlue)}" alt="rasvertex.com.au" class="summary-link" />
  </div>
  <div class="summary-body">
    <div class="summary-section">
      <div class="summary-label">Comments:</div>
      <div class="summary-text">${report.comments || ""}</div>
    </div>
    <div class="summary-section">
      <div class="summary-label">Recommendations:</div>
      <div class="summary-text">${report.recommendations || ""}</div>
    </div>
  </div>
  <div class="summary-footer">${assocHTML}</div>
</div>

</body>
</html>`;
}
