// lib/reports/inspection/types.ts
//
// Inspection Report draft data and photo-label parsing. The draft holds only
// what can't be derived: the job details, the imported photos, any label a
// tech corrected in the app, map pin positions, and the site map / cover
// photo picked in the builder. Of the job details, only
// the scope and the quote contact are editable. Everything else is generated
// from the labels by generate.ts.

import type { EnrichedJob } from "@/lib/simpro/types";
import type { Library, ReportKind } from "./codes";
import { defaultSettings } from "@/lib/reports/settings/defaults";
import { libraryFrom, readTag } from "@/lib/reports/settings/library";
import type { ReportSettings } from "@/lib/reports/settings/types";
import type { PhotoPos } from "@/lib/reports/photos";
import type { MaintenancePlan } from "@/lib/reports/maintenancePlan";

export type { ReportKind };

export interface InspectionPhoto {
  id: string;
  name: string;
  url: string;
  dateAdded?: string | null;
  /** Label typed in the app; overrides the one read from the filename. */
  label?: string;
  /** Title typed in the builder; replaces the defect name(s) on the card. */
  title?: string;
  /** Description typed in the builder; replaces the label's note. */
  desc?: string;
  /** How it sits in its frame, set in Adjust. Unset = centred. */
  pos?: PhotoPos;
  /** Taken off the page in the builder; can be added back. */
  off?: boolean;
  /** Set by dragging in the builder: order within its zone and code. */
  order?: number;
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
  /** Technician comments (rich text), printed after the findings. */
  technicianNotes?: string;
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
  /** The report's type in the settings (roof: "membrane", "tiled"…). */
  type?: string;
  /** Made from a SimPRO quote: jobId is the quote number. Unset: a job. */
  source?: "quote";
  /** The report settings when this report was started. Later edits to the
   *  settings don't change it; drafts from before settings use the defaults. */
  settings?: ReportSettings;
  jobId: string;
  job: InspectionJob;
  /** "all", or a SimPRO attachment folder id to import from. */
  folder: string;
  photos: InspectionPhoto[];
  /** Zone → [x%, y%] on the site plan. */
  pins: Record<string, [number, number]>;
  /** Zone → its section on the site plan: points [x%, y%] of the map, a
   *  free-form shape the tech drew (shapes.ts). Replaces the zone's pin. */
  shapes?: Record<string, [number, number][]>;
  /** Older drafts: rectangles [x%, y%, w%, h%], read as four-point shapes
   *  until the zone is redrawn. */
  boxes?: Record<string, ZoneBox>;
  /** Site map chosen in the builder. Without one, a photo labelled
   *  MAP / Aerial is used. */
  siteMap?: ImageChoice | null;
  /** Cover photo chosen in the builder. Without one, the first overview. */
  cover?: ImageChoice | null;
  /** How the cover photo sits in its frame. */
  coverPos?: CoverPos;
  /** Wording edited in the builder, by key ("sec.about.title",
   *  "defect.SH.what"…). A blank or missing key uses the generated text. */
  text?: Record<string, string>;
  /** Sections left out of the report. */
  hidden?: Partial<Record<SectionKey, boolean>>;
  /** Maintenance plan (optional section): the services picked and the
   *  technician's comments. */
  plan?: MaintenancePlan;
}

export type ZoneBox = [x: number, y: number, w: number, h: number];

/** Pastel tones for zone sections on the site map, in zone order: a darker
 *  border, a light see-through fill and a tag between the two. */
export const ZONE_TONES: { line: string; fill: string; tag: string }[] = [
  { line: "#4f86c6", fill: "rgba(173,206,245,.38)", tag: "#d9e8fa" }, // blue
  { line: "#3f9e7f", fill: "rgba(170,228,203,.40)", tag: "#d4f2e4" }, // mint
  { line: "#d9844a", fill: "rgba(250,203,170,.42)", tag: "#fde3d1" }, // peach
  { line: "#8a6cc8", fill: "rgba(205,190,240,.42)", tag: "#e7defa" }, // lavender
  { line: "#cc5f7f", fill: "rgba(246,190,206,.42)", tag: "#fadbe4" }, // rose
  { line: "#b0921a", fill: "rgba(246,228,150,.45)", tag: "#fbf0c4" }, // butter
  { line: "#2f98a8", fill: "rgba(160,222,230,.42)", tag: "#d2f0f4" }, // aqua
  { line: "#7a9a4a", fill: "rgba(208,228,170,.45)", tag: "#e6f1d4" }, // sage
];
export const zoneTone = (i: number) => ZONE_TONES[((i % ZONE_TONES.length) + ZONE_TONES.length) % ZONE_TONES.length];

export type SectionKey = "about" | "map" | "defects" | "findings" | "index" | "summary" | "plan" | "works";

export type { PlanItem, PlanPriority } from "@/lib/reports/maintenancePlan";

/** Sections that are off until switched on (the maintenance plan); the rest
 *  show until hidden. */
const OPT_IN: SectionKey[] = ["plan"];
export const sectionHidden = (d: Pick<InspectionReportData, "hidden">, k: SectionKey) =>
  OPT_IN.includes(k) ? d.hidden?.[k] !== false : !!d.hidden?.[k];

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

export const settingsOf = (d: Pick<InspectionReportData, "settings">): ReportSettings => d.settings ?? defaultSettings();

/** The codes and copy this report uses: its settings snapshot, its type. */
export const libraryOf = (d: Pick<InspectionReportData, "settings" | "kind" | "type">): Library =>
  libraryFrom(settingsOf(d), d.kind, d.type);

export function createInspectionReport(
  jobId: string,
  job: EnrichedJob,
  settings: ReportSettings,
  kind: ReportKind,
  type?: string,
): InspectionReportData {
  const lib = libraryFrom(settings, kind, type);
  const site = job.siteName || job.name;
  const street = job.siteAddress.split(",")[0]?.trim() || site;
  return {
    version: 1,
    kind,
    type,
    settings,
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

/** The label for a photo's tags and name, as the builder edits them. */
export function composeLabel(t: { zone: string; level: string; unit: string | null; codes: string[]; note: string }): string {
  const head = [t.zone, t.level, t.unit, ...t.codes].filter(Boolean).join(" ");
  return t.note ? (head ? `${head} - ${t.note}` : t.note) : head;
}

export type ParsedLabel =
  | { kind: "map" }
  | {
      kind: "photo";
      zone: string; // D10 / S2, or "" (optional)
      level: string; // LG / L2 / LR, or "" (optional)
      unit: string | null; // U401
      codes: string[];
      note: string;
      head: string;
      /** Tokens that weren't a zone, level, unit or code. */
      ignored: string[];
    };

const SITE_PLAN = /^(map|site\s*plan|aer?i[ae]l|arei?l|ari[ae]l)\b/i;

export function parseLabel(raw: string, lib: Library): ParsedLabel {
  const label = raw.trim();
  if (SITE_PLAN.test(label)) return { kind: "map" };

  // Tags first, then the name: after " - ", or (without one) from the first
  // word that isn't a tag, as in the proposal: "S1 RC Hairline at window".
  const split = label.indexOf(" - ");
  const head = (split >= 0 ? label.slice(0, split) : label).trim();
  let note = split >= 0 ? label.slice(split + 3).trim() : "";

  let zone: string | null = null;
  let level: string | null = null;
  let unit: string | null = null;
  const codes: string[] = [];
  const ignored: string[] = [];
  const toks = head.split(/\s+/).filter(Boolean);
  for (let k = 0; k < toks.length; k++) {
    const tok = toks[k];
    const up = tok.toUpperCase().replace(/[,;.]$/, "");
    const x = lib.aliases[up] ?? up;
    const where = readTag(up, lib.tags);
    if (where?.kind === "zone") {
      if (!zone) zone = up;
    } else if (where?.kind === "level") {
      if (!level) level = up;
    } else if (where?.kind === "unit") {
      if (!unit) unit = up;
    } else if (lib.codeMap[x]) {
      if (!codes.includes(x)) codes.push(x);
    } else if (split < 0) {
      note = toks.slice(k).join(" ");
      break;
    } else {
      ignored.push(tok);
    }
  }

  // Nothing is required. Zone, level and unit structure the report (a single
  // apartment needs none); a photo with no code goes under Other items.
  return { kind: "photo", zone: zone ?? "", level: level ?? lib.defaultLevel ?? "", unit, codes, note, head: head.toUpperCase(), ignored };
}
