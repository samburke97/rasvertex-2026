// lib/reports/inspection/types.ts
//
// Inspection Report draft data and photo-label parsing. The draft holds only
// what can't be derived: the job details, the imported photos, any label a
// tech corrected in the app, map pin positions, and the site map / cover
// photo picked in the builder. Of the job details, only
// the scope and the quote contact are editable. Everything else is generated
// from the labels by generate.ts.

import type { EnrichedJob } from "@/lib/simpro/types";
import { libraryFor, type Library, type ReportKind } from "./codes";

export type { ReportKind };

export interface InspectionPhoto {
  id: string;
  name: string;
  url: string;
  dateAdded?: string | null;
  /** Label typed in the app; overrides the one read from the filename. */
  label?: string;
  /** Uploaded in the builder rather than imported from SimPRO — kept when
   *  the SimPRO photos are re-imported. */
  uploaded?: boolean;
}

export interface InspectionJob {
  ref: string;
  site: string;
  address: string;
  blurb: string;
  date: string;
  forName: string;
  by: string;
  byTitle: string;
  /** Name of one of CONTACTS — who quote requests go to. */
  contact: string;
  scope: string;
  /** SimPRO Site ID, kept for saving the PDF — not rendered. */
  siteId: string;
}

// Quote contact shown on the Recommended works page.
export interface Contact {
  name: string;
  title: string;
  phone: string;
  email: string;
}

const COMPANY_PHONE = "07 5371 0201";

export const CONTACTS: Contact[] = [
  { name: "Phil Clark", title: "Director", phone: COMPANY_PHONE, email: "phil@rasvertex.com.au" },
  { name: "Archer Dutch", title: "", phone: COMPANY_PHONE, email: "safety@rasvertex.com.au" },
  { name: "Hylton Denton", title: "", phone: COMPANY_PHONE, email: "hylton@rasvertex.com.au" },
];

export function contactFor(name: string): Contact {
  return CONTACTS.find((c) => c.name === name) ?? CONTACTS[0];
}

export interface InspectionReportData {
  version: 1;
  /** Building or roof inspection — picks the code library and copy.
   *  Older drafts have none and are building inspections. */
  kind?: ReportKind;
  jobId: string;
  job: InspectionJob;
  /** "all", or a SimPRO attachment folder id to import from. */
  folder: string;
  photos: InspectionPhoto[];
  /** Zone → [x%, y%] on the site plan. */
  pins: Record<string, [number, number]>;
  /** Site map chosen in the builder. Without one, a photo labelled
   *  MAP / Aerial is used. */
  siteMap?: ImageChoice | null;
  /** Cover photo chosen in the builder. Without one, the first overview. */
  cover?: ImageChoice | null;
  /** How the cover photo sits in its frame. */
  coverPos?: CoverPos;
}

/** An image picked in the builder: uploaded / captured, or a job photo. */
export type ImageChoice =
  | {
      source: "upload" | "satellite";
      url: string;
      /** Satellite captures: where the map was framed, to reopen there. */
      lat?: number;
      lng?: number;
      zoom?: number;
    }
  | { source: "photo"; photoId: string };

/** Focal point (0–100 %) and zoom (1 = fills the frame). */
export interface CoverPos {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_COVER_POS: CoverPos = { x: 50, y: 50, zoom: 1 };

/** Ids builder-added images are referenced by in the document. */
export const SITE_MAP_ID = "site-map";
export const COVER_ID = "cover-photo";

/** Every image the report can show, including builder-added ones. */
export function reportImages(d: InspectionReportData): { id: string; url: string }[] {
  const out: { id: string; url: string }[] = [...d.photos];
  if (d.siteMap && d.siteMap.source !== "photo") out.push({ id: SITE_MAP_ID, url: d.siteMap.url });
  if (d.cover && d.cover.source !== "photo") out.push({ id: COVER_ID, url: d.cover.url });
  return out;
}

/** Resolves a builder choice to a photo id, if it still exists. */
export function choiceId(d: InspectionReportData, c: ImageChoice | null | undefined, ownId: string): string | null {
  if (!c) return null;
  if (c.source !== "photo") return ownId;
  return d.photos.some((p) => p.id === c.photoId) ? c.photoId : null;
}

export function todayLong(d = new Date()): string {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
}

/** Drafts are saved per job and kind, so a job can have both reports. */
export function draftKey(jobId: string, kind: ReportKind): string {
  return kind === "roof" ? `${jobId}-roof` : jobId;
}

export function createInspectionReport(jobId: string, job: EnrichedJob, kind: ReportKind): InspectionReportData {
  const lib = libraryFor(kind);
  const site = job.siteName || job.name;
  const street = job.siteAddress.split(",")[0]?.trim() || site;
  return {
    version: 1,
    kind,
    jobId,
    job: {
      ref: jobId,
      site,
      address: job.siteAddress,
      blurb: lib.blurb(street),
      date: todayLong(),
      forName: job.clientName || job.preparedFor,
      by: "Phil Clark",
      byTitle: "Director",
      contact: CONTACTS[0].name,
      scope: lib.scope,
      siteId: job.siteId,
    },
    folder: "all",
    photos: [],
    pins: {},
  };
}

export function isInspectionData(x: unknown): x is InspectionReportData {
  const d = x as InspectionReportData | null;
  return !!d && d.version === 1 && typeof d.jobId === "string" && !!d.job && Array.isArray(d.photos);
}

// ── Labels ───────────────────────────────────────────────────────────────────
// <ZONE> <LEVEL> [UNIT] <CODE> [CODE…] [ - note]
// (In a roof inspection the level is optional and defaults to LR.)
//   D10 L2 SH LF - awning fixed through VJ cladding, flexes under load
//   S3 L4 U402 CD - breezeway coating breaking down
//   MAP / Aerial  (the site plan — common misspellings like "areil" count)

/** The label a photo carries: the tech's in-app edit, else its filename. */
export function photoLabel(p: InspectionPhoto): string {
  if (p.label != null) return p.label;
  return p.name
    .replace(/\.[^/.]+$/, "") // extension
    .replace(/_/g, " ")
    .replace(/\s*\(\d+\)$/, "") // "(1)" duplicate-upload suffix
    .trim();
}

export type ParsedLabel =
  | { kind: "map" }
  | {
      kind: "photo";
      zone: string; // D10 / S2
      level: string; // LG / L2 / LR
      unit: string | null; // U401
      codes: string[];
      note: string;
      head: string;
      /** Tokens that weren't a zone, level, unit or code. */
      ignored: string[];
    }
  | { kind: "rejected"; reason: string };

const SITE_PLAN = /^(map|site\s*plan|aer?i[ae]l|arei?l|ari[ae]l)\b/i;

export function parseLabel(raw: string, lib: Library): ParsedLabel {
  const label = raw.trim();
  if (SITE_PLAN.test(label)) return { kind: "map" };

  const split = label.indexOf(" - ");
  const head = (split >= 0 ? label.slice(0, split) : label).trim();
  const note = split >= 0 ? label.slice(split + 3).trim() : "";

  let zone: string | null = null;
  let level: string | null = null;
  let unit: string | null = null;
  const codes: string[] = [];
  const ignored: string[] = [];
  for (const tok of head.split(/\s+/).filter(Boolean)) {
    const x = tok.toUpperCase();
    if (/^[DS]\d+$/.test(x)) {
      if (!zone) zone = x;
    } else if (/^L(\d+|G|R)$/.test(x)) {
      if (!level) level = x;
    } else if (/^U\d+$/.test(x)) {
      if (!unit) unit = x;
    } else if (lib.codeMap[x]) {
      if (!codes.includes(x)) codes.push(x);
    } else {
      ignored.push(tok);
    }
  }

  if (!zone) return { kind: "rejected", reason: "No zone (D# or S#)" };
  level ??= lib.defaultLevel;
  if (!level) return { kind: "rejected", reason: "No level (LG, L#, LR)" };
  if (!codes.length) return { kind: "rejected", reason: "No valid code" };
  return { kind: "photo", zone, level, unit, codes, note, head: head.toUpperCase(), ignored };
}
