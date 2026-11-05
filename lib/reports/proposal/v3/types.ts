// lib/reports/proposal/v3/types.ts
//
// Data model for the Painting proposal builder (Quote → Build → Review).
// Shape follows data/default-proposal.json (the handoff spec), plus what the
// SimPRO integration needs: the quote number, the quote's photo folders and
// the photos imported from them.
//
// Photo references (cover.photo, findings[i].photo, …) are plain strings:
//   "/reports/proposal/v3/…"  a standard library photo (public/)
//   "ph:<id>"                 a photo imported from the SimPRO quote
//   "https://…" / "data:…"    an upload
// resolvePhoto() turns any of them into a URL.

import registryJson from "./data/registry.json";
import type { PhotoPos } from "@/lib/reports/photos";
import termsJson from "./data/terms.json";

export const PAGE_IDS = [
  "cover",
  "contents",
  "company",
  "recent",
  "intro",
  "project",
  "scope",
  "findings",
  "flagged",
  "prestart",
  "runs",
  "safety",
  "pricing",
  "maintenance",
  "accept",
  "terms",
] as const;
export type PageId = (typeof PAGE_IDS)[number];

export interface PageDef {
  id: PageId;
  name: string;
  cat?: string;
  sec?: string;
  fixed?: boolean;
  locked?: boolean;
  auto?: boolean;
}

export type Band = "red" | "amber" | "grey";

export interface DefectCodeDef {
  name: string;
  band: Band;
  defaultWork: string;
}

export interface JobField {
  key: keyof Job;
  label: string;
  type: "text" | "date" | "number";
}

interface Registry {
  pages: PageDef[];
  lockedPageNotes: Partial<Record<PageId, string>>;
  jobFields: JobField[];
  bands: Record<Band, { bg: string; fg: string }>;
  flaggedGroups: Record<Band, [string, string]>;
  prestartGroups: Record<Band, [string, string]>;
  paintBrands: Record<string, { name: string; logo: string }>;
}

const registry = registryJson as unknown as Registry;

export const PAGES = registry.pages;
export const PAGE: Record<PageId, PageDef> = Object.fromEntries(PAGES.map((p) => [p.id, p])) as Record<
  PageId,
  PageDef
>;
export const LOCK_NOTES = registry.lockedPageNotes;
export const JOB_FIELDS = registry.jobFields;
/** The defect codes: the inspection reports' table (lib/reports/inspection/
 *  codes.ts), so a photo coded on site maps the same in every report. */
export const CODES: Record<string, DefectCodeDef> = Object.fromEntries(
  ALL_CODES.map((d) => [d.code, { name: d.name, band: d.band, defaultWork: d.work }]),
);
export const BANDS = registry.bands;
export const FLAG_GROUPS = registry.flaggedGroups;
export const PRESTART_GROUPS = registry.prestartGroups;
export const BAND_ORDER: Band[] = ["red", "amber", "grey"];
export const TERMS = termsJson as { k: string; v: string }[];

// ── Assets ───────────────────────────────────────────────────────────────────

export const ASSET_DIR = "/reports/proposal/v3/";
export const asset = (file: string) => ASSET_DIR + file;

export { BRANDS, TRADES, tradeOf, type Brand, type Trade } from "./trades";
import { TRADES, type Brand, type Trade } from "./trades";
import { ALL_CODES } from "@/lib/reports/inspection/codes";

/** Standard photo folders, available on every proposal alongside the
 *  quote's own SimPRO folders. */
export const LIBRARY_FOLDERS: { id: string; name: string; photos: string[] }[] = [
  {
    id: "building",
    name: "Building",
    photos: [
      "web-the-work.jpg",
      "project-2.jpeg",
      "project-1.jpeg",
      "drilldown.jpeg",
      "trafalgar.jpg",
      "web-rope-access-works.jpg",
    ].map(asset),
  },
  {
    id: "team",
    name: "Team",
    photos: ["team-abseil.jpg", "team-gutter.jpg", "team-painting.jpg", "team-tower.jpg"].map(asset),
  },
  {
    id: "waterproofing",
    name: "Waterproofing",
    photos: [
      "membrane-rooftop.jpg",
      "waterproofing-services.jpg",
      "prep-done-right.jpg",
      "leading-systems.jpg",
      "documented-waterproofing.jpg",
    ].map((f) => asset("wp/" + f)),
  },
];

// ── State ────────────────────────────────────────────────────────────────────

export interface Job {
  building: string;
  client: string;
  contact: string;
  site: string;
  quote: string;
  date: string; // YYYY-MM-DD
  valid: string; // days
  pm: string;
  pmTitle: string;
  phone: string;
  email: string;
  signer: string;
  signerTitle: string;
}

export interface SpecRow {
  surface: string;
  system: string;
  coats: string;
}

export interface Finding {
  photo: string;
  /** Report style: the most severe of `codes` ("" = none). Kept for older
   *  drafts and simple reads; codesOf() is the full list. */
  code: string;
  /** Every code on the photo, e.g. a "D10 L2 SH LF" tag gives [SH, LF]. */
  codes?: string[];
  /** Report style: where it is — zone, level, unit ("D10 L2"). From the tag,
   *  editable. Its zone is pinned on the site map. */
  where?: string;
  /** How the photo sits in its frame: focal point (0–100 %) and zoom
   *  (1 = just fills the frame). Unset = centred, no zoom. */
  pos?: PhotoPos;
  title: string;
  desc: string; // standard style: one point per line
}

/** Standard: photo, title and points. Report: inspection style, with defect
 *  codes, plus the Flagged issues and Pre-start pages. */
export type FindingsStyle = "standard" | "report";

export interface SimproFolder {
  id: string; // "sp:<SimPRO folder id>"
  name: string;
  count: number;
}

export interface SimproPhoto {
  id: string;
  name: string;
  url: string; // data: URL until its Blob upload finishes, then the Blob URL
  folderId: string;
}

export interface ProposalSections {
  cover: { blurb: string; photo: string; pos?: PhotoPos };
  intro: { open: string; bullets: { t: string; d: string }[]; close: string };
  project: {
    pos?: PhotoPos;
    p1: string;
    p2: string;
    type: string;
    access: string;
    program: string;
    photo: string;
    brand: Brand;
    specIntro: string;
    /** No spec received yet: the table, logo and note come off the page, and
     *  noSpecIntro replaces specIntro under "Higher standards". */
    hideSpec?: boolean;
    noSpecIntro: string;
    note: string;
    /** Each product keeps its own rows. */
    rows: Partial<Record<Brand, SpecRow[]>>;
  };
  scope: { intro: string; inc: string; exc: string };
  findings: {
    intro: string;
    style: FindingsStyle;
    items: Finding[];
    /** Per-proposal "How we fix it" steps by code (list HTML); unset =
     *  the standard steps in methods.ts. */
    methods?: Partial<Record<string, string>>;
    /** Report style: the site map (photo ref) and each zone's pin, as
     *  [x%, y%]. */
    map?: string;
    mapView?: { lat?: number; lng?: number; zoom: number };
    pins?: Record<string, [number, number]>;
    /** false hides the site map (it's optional); unset = shown. */
    showMap?: boolean;
  };
  // auto: built from the findings' codes and kept in step with them
  // (survey.ts syncSurvey); editing a row makes it the rep's own.
  flagged: { intro: string; rows: { code: string; count: string; where?: string; auto?: boolean }[] };
  prestart: { intro: string; rows: { code: string; work: string; where: string; auto?: boolean }[]; note: string };
  /** How your project runs: the stages in order, each with when and where. */
  runs: { intro: string; stages: RunStage[]; note: string };
  pricing: { intro: string; stages: { label: string; note: string; amt: string }[]; terms: string };
  maintenance: { intro: string; price: string };
  accept: { intro: string };
}

export type StageKind = "prep" | "repairs" | "clean" | "works" | "handover";

export interface RunStage {
  kind: StageKind;
  name: string;
  /** "Week 1", "Weeks 2–4"; the highest week number is the time on site. */
  when: string;
  where: string;
  desc: string;
}

/** Stage kinds: the colour of the number and the weeks chip. */
export const STAGE_KINDS: Record<StageKind, { label: string; bg: string; fg: string }> = {
  prep: { label: "Setup / prep", bg: "#eef1f6", fg: "rgba(1,25,85,0.72)" },
  repairs: { label: "Repairs", bg: "#f1ebf8", fg: "#5f4391" },
  clean: { label: "Wash / clean", bg: "#deeeff", fg: "#2563a8" },
  works: { label: "Main works", bg: "#dff2e6", fg: "#2f7a55" },
  handover: { label: "Handover", bg: "#fcf0dc", fg: "#86561a" },
};

/** Weeks on site: the highest week number in the stages' "when". */
export const weeksOnSite = (stages: RunStage[]) =>
  Math.max(0, ...stages.flatMap((s) => (s.when.match(/\d+/g) ?? []).map(Number)));

export interface Proposal {
  version: 3;
  /** SimPRO Site ID of the quote's site ("" if none), for saving the PDF. */
  siteId?: string;
  /** Painting or waterproofing — wording, photos, warranty (trades.ts). */
  trade: Trade;
  quote: string;
  job: Job;
  order: PageId[];
  hidden: Partial<Record<PageId, boolean>>;
  folders: string[]; // enabled photo folders: library ids + SimPRO "sp:" ids
  uploads: string[]; // newest first, max 20
  simpro: { folders: SimproFolder[]; photos: SimproPhoto[] };
  d: ProposalSections;
}

// Lists on pages that flow onto continuation sheets (findings, flagged,
// pre-start, drops, price stages) are capped only to keep a PDF sane; the rest are capped
// so their single page never overflows.
export const LIMITS = {
  bullets: 6,
  specRows: 6,
  findings: 120,
  flagged: 40,
  prestart: 40,
  runStages: 16,
  priceStages: 40,
  uploads: 20,
};

export function isProposal(x: unknown): x is Proposal {
  const p = x as Proposal | null;
  return !!p && p.version === 3 && typeof p.quote === "string" && !!p.job && !!p.d && Array.isArray(p.order);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const lines = (t: string) =>
  String(t || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export const bandOf = (code: string): Band => CODES[code]?.band ?? "grey";

/** Severity order: red before amber before grey, then registry order. */
export const codeRank = (code: string) => BAND_ORDER.indexOf(bandOf(code)) * 100 + Object.keys(CODES).indexOf(code);

/** A finding's codes, most severe first (older drafts carry just `code`). */
export function codesOf(f: Finding): string[] {
  const list = (f.codes?.length ? f.codes : f.code ? [f.code] : []).filter((c) => CODES[c]);
  return [...new Set(list)].sort((a, b) => codeRank(a) - codeRank(b));
}

/** Sets a finding's codes, keeping `code` as the most severe. */
export function withCodes(f: Finding, codes: string[]): Finding {
  const sorted = [...new Set(codes.filter((c) => CODES[c]))].sort((a, b) => codeRank(a) - codeRank(b));
  return { ...f, codes: sorted, code: sorted[0] ?? "" };
}

export function todayISO(d = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// Company email convention: firstname@rasvertex.com.au.
export function deriveEmail(name: string): string {
  const first = (name.trim().split(/\s+/)[0] ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return first ? `${first}@rasvertex.com.au` : "";
}

export const COMPANY_PHONE = "07 5371 0201";

export function resolvePhoto(p: Proposal, ref: string): string {
  if (!ref) return "";
  if (ref.startsWith("ph:")) return p.simpro.photos.find((x) => x.id === ref.slice(3))?.url ?? "";
  return ref;
}

/** Every photo the visible document shows — the PDF export inlines these. */
export function referencedPhotos(p: Proposal): string[] {
  const d = p.d;
  return [d.cover.photo, d.project.photo, ...d.findings.items.map((f) => f.photo)].filter(Boolean);
}

/** Merges a saved draft over fresh defaults, and puts any page the draft
 *  doesn't know about back at its registry position. */
export function mergeDraft(saved: Proposal, fresh: Proposal): Proposal {
  const d = { ...fresh.d } as ProposalSections;
  for (const k of Object.keys(d) as (keyof ProposalSections)[]) {
    if (saved.d?.[k]) (d as unknown as Record<string, unknown>)[k] = { ...fresh.d[k], ...saved.d[k] };
  }
  // Drafts from before the style switch were all report style.
  if (saved.d?.findings && !saved.d.findings.style)
    d.findings = { ...d.findings, style: saved.d.findings.items?.length ? "report" : "standard" };
  const order = (saved.order ?? []).filter((id) => PAGE[id]);
  PAGES.forEach((pg, i) => {
    if (!order.includes(pg.id)) order.splice(Math.min(i, order.length), 0, pg.id);
  });
  return {
    ...fresh,
    ...saved,
    job: { ...fresh.job, ...saved.job },
    order,
    hidden: saved.hidden ?? {},
    trade: saved.trade ?? "painting",
    simpro: saved.simpro ?? fresh.simpro,
    d,
  };
}

// ── Construction from a SimPRO quote ─────────────────────────────────────────

export interface QuoteHeader {
  siteId?: string;
  siteName: string;
  siteAddress: string;
  clientName: string;
  contactName: string;
  salespersonName: string;
}

export interface QuotePricingRow {
  id: string;
  groupLabel: string;
  label: string;
  amountExTax: number;
}

/** One price stage per SimPRO cost centre. */
export function stagesFromPricing(rows: QuotePricingRow[]): ProposalSections["pricing"]["stages"] {
  const order: string[] = [];
  const sums = new Map<string, number>();
  for (const r of rows) {
    const key = r.groupLabel || "Works";
    if (!sums.has(key)) order.push(key);
    sums.set(key, (sums.get(key) ?? 0) + (r.amountExTax || 0));
  }
  return order.map((label) => ({ label, note: "", amt: String(Math.round((sums.get(label) ?? 0) * 100) / 100) }));
}

/** Job fields that come from the SimPRO quote (the rest are the rep's). */
export function jobFromQuote(quote: string, h: QuoteHeader): Partial<Job> {
  const pm = h.salespersonName.trim();
  return {
    building: h.siteName || h.clientName || "",
    client: h.clientName,
    contact: h.contactName.trim().split(/\s+/)[0] ?? "",
    site: h.siteAddress,
    quote,
    ...(pm ? { pm, email: deriveEmail(pm) } : {}),
  };
}

export function createProposal(quote: string, h: QuoteHeader, pricing: QuotePricingRow[], trade: Trade = "painting"): Proposal {
  const job: Job = {
    building: "",
    client: "",
    contact: "",
    site: "",
    quote,
    date: todayISO(),
    valid: "30",
    pm: "Hylton Denton",
    pmTitle: "Project Manager",
    phone: COMPANY_PHONE,
    email: "hylton@rasvertex.com.au",
    signer: "Phil Clark",
    signerTitle: "Director",
    ...jobFromQuote(quote, h),
  };
  return {
    version: 3,
    siteId: h.siteId ?? "",
    trade,
    quote,
    job,
    order: PAGES.map((p) => p.id),
    // Findings start in standard style. Flagged issues and Pre-start come on
    // with report style (tagged inspection photos, see survey.ts).
    hidden: { flagged: true, prestart: true },
    folders: [...TRADES[trade].folders],
    uploads: [],
    simpro: { folders: [], photos: [] },
    d: defaultSections(trade, job, stagesFromPricing(pricing)),
  };
}

/** The standard wording for a trade. Also used to switch a proposal's
 *  trade: sections still on the old trade's wording take the new one's. */
export function defaultSections(trade: Trade, job: Job, stages: ProposalSections["pricing"]["stages"]): ProposalSections {
  const T = TRADES[trade];
  const W = trade === "waterproofing";
  const b = job.building || "your building";
  const street = job.site.split(",")[0]?.trim() || b;
  const y = T.warrantyYears;
  return {
    cover: {
      blurb: W
        ? `Proposal for the waterproofing and remedial works at ${street}. Every defect repaired, a manufacturer-approved membrane system applied by our own team, and a ${y}-year written warranty, with residents in the building throughout.`
        : `Proposal for the full external repaint and remedial works at ${street}. Every defect repaired, two full coats applied by rope access, and an ${y}-year written warranty, with residents in the building throughout.`,
      photo: T.coverPhoto,
    },
    intro: {
      open: `Thank you for the opportunity to quote on ${b}. We inspected the building face by face before pricing, so this proposal is built on what we found, not a generic scope. Here’s what the committee gets:`,
      bullets: [
        {
          t: "Every defect repaired, already priced",
          d: W ? "Every defect from our survey is fixed before any membrane goes down." : "Every defect from our survey is fixed before any paint goes on.",
        },
        W
          ? { t: "Manufacturer-approved membrane, photographed", d: "A coastal-grade Sika system applied to spec, with photo evidence at every stage." }
          : { t: "Two full coats, photographed", d: "A coastal-grade Dulux system applied to spec, with photo evidence at every stage." },
        { t: "Rope access, building stays open", d: "No scaffold blocking the site. Residents keep full use of the building throughout." },
        { t: "One project manager, start to finish", d: "I run your job personally, from first site visit to warranty handover." },
        { t: `${y}-year written warranty`, d: "As standard, and never tied to a maintenance plan." },
      ],
      close: `Your price is fixed for this scope. If anything new turns up, we stop, show you the evidence and price it in writing before any work goes ahead. Any questions, call or text me directly on ${COMPANY_PHONE}.`,
    },
    project: {
      p1: "",
      p2: "Rope access does most of the work from the roof down. Only the lower levels need a knuckle boom or mobile scaffold, and residents keep full use of the building throughout.",
      type: "Residential high-rise",
      access: "Rope access",
      program: "",
      photo: T.projectPhoto,
      brand: T.brands[0],
      noSpecIntro: `After 25+ years ${W ? "waterproofing" : "painting"} coastal buildings, we know which systems last here. Your specification will be confirmed with the manufacturer’s representative, who also inspects our work on site, so your warranty is backed by both of us.`,
      specIntro: `After 25+ years ${W ? "waterproofing" : "painting"} coastal buildings, we know which systems last here. Each one below was specified with the manufacturer’s representative, who also inspects our work on site, so your warranty is backed by both of us.`,
      note: W
        ? "Coastal grade membrane system, checked on site by the manufacturer’s representative."
        : "Coastal grade system, checked on site by the manufacturer’s representative.",
      rows: W
        ? {
            sika: [
              { surface: "Roof decks", system: "Sika primer + Sika liquid-applied polyurethane membrane", coats: "Primer + 2 coats" },
              { surface: "Balconies", system: "Sika liquid-applied membrane under tile", coats: "Primer + 2 coats" },
              { surface: "Joints and penetrations", system: "Sikaflex polyurethane sealant", coats: "Cut out and reseal" },
            ],
            adheseal: [
              { surface: "Roof decks", system: "Liquid-applied membrane system", coats: "Primer + 2 coats" },
              { surface: "Balconies", system: "Liquid-applied membrane under tile", coats: "Primer + 2 coats" },
              { surface: "Joints and penetrations", system: "Adheseal hybrid sealant", coats: "Cut out and reseal" },
            ],
          }
        : {
            dulux: [
              { surface: "Rendered walls", system: "Dulux AcraTex sealer + Dulux Weathershield Low Sheen", coats: "Sealer + 2 full coats" },
              { surface: "Trims and fascias", system: "Dulux Weathershield Gloss", coats: "2 full coats" },
              { surface: "Metal balustrades", system: "Dulux Metalshield", coats: "Primer + 2 full coats" },
            ],
            haymes: [
              { surface: "Rendered walls", system: "Haymes masonry sealer + Haymes Solarscreen Low Sheen", coats: "Sealer + 2 full coats" },
              { surface: "Trims and fascias", system: "Haymes Ultratrim Gloss", coats: "2 full coats" },
              { surface: "Metal balustrades", system: "Haymes metal primer + Haymes Ultratrim", coats: "Primer + 2 full coats" },
            ],
          },
    },
    scope: {
      intro:
        "Exactly what your price covers. If we find something during the job that isn’t listed here, we stop, show you the evidence and price it in writing before any work goes ahead.",
      inc: (W
        ? [
            "Full clean and preparation of all membrane areas",
            "Crack repair and substrate preparation",
            "Repair of every defect flagged in the site survey, by our own remedial team",
            "Manufacturer-approved membrane system, coastal grade",
            "Joint, penetration and upstand sealing",
            "All access equipment for every stage of the programme",
            "Full site clean-up and waste removal on completion",
          ]
        : [
            "Full pressure clean of all painted and rendered surfaces",
            "Crack injection and substrate repair",
            "Repair of every defect flagged in the site survey, by our own remedial team",
            "Two-coat premium coating system, coastal grade",
            "All access equipment for every stage of the programme",
            "Full site clean-up and waste removal on completion",
          ]
      ).join("\n"),
      exc: (W
        ? [
            "Internal works of any kind",
            "Structural or engineering-certified remedial work",
            "Tiling, screeds or finishes over the membrane, unless listed",
            "Permit and council fees, if required for this site",
            "Defects hidden at survey, priced and approved in writing before work proceeds",
          ]
        : [
            "Internal painting or works of any kind",
            "Structural or engineering-certified remedial work",
            "Permit and council fees, if required for this site",
            "Defects hidden at survey, priced and approved in writing before work proceeds",
          ]
      ).join("\n"),
    },
    findings: {
      intro: `We inspected ${b} before writing a single line of this quote. What we found decides which defects need repair, which products will last, and which specialist teams go on site. Every defect shown is already priced, so there are no surprises.`,
      style: "standard",
      items: [],
    },
    flagged: {
      intro:
        "Every defect from the survey, sorted by urgency. Priority items are made safe first, before rope access begins, so the building is safe for residents and our crew.",
      rows: [],
    },
    prestart: {
      intro: W
        ? "Repairs come before the membrane, never after. This is the order we work in, so every repair is sound before the membrane goes over it and nothing comes back through the new system."
        : "Repairs come before paint, never after. This is the order we work in, so every repair is sound before the coating goes over it and nothing comes back through the new finish.",
      rows: [],
      note: W
        ? "Before the membrane goes down, our dedicated maintenance team works through every item above and reports back to the committee with photos. It’s how we hold ourselves to a higher standard, and why we’ve been the Sunshine Coast’s trusted waterproofing partner for over 25 years."
        : "Before painting starts, our dedicated maintenance team works through every item above and reports back to the committee with photos. Only then does the coating go on. It’s how we hold ourselves to a higher standard, and why we’ve been the Sunshine Coast’s trusted painting partner for over 25 years.",
    },
    runs: W
      ? {
          intro:
            "We run your project differently from most. It starts with a proper site setup, and your project manager guides every stage from the first resident notice to the final handover, reporting back to you as each stage is completed.",
          stages: [
            { kind: "prep", name: "Site setup & access plan", when: "Week 1", where: "Whole site", desc: "Your project manager prepares the site documentation, sends resident notices and confirms the access plan, including exclusion zones, with the committee. Every stakeholder knows what is happening, and when, before work begins." },
            { kind: "clean", name: "Clean & preparation", when: "Weeks 1–2", where: "All membrane areas", desc: "Every surface is cleaned, old coatings and loose material removed, and cracks repaired so the membrane bonds to a sound substrate." },
            { kind: "works", name: "Membrane · section A", when: "Weeks 2–4", where: "", desc: "Primer, reinforcement at joints and penetrations, then the full membrane system. We report back with photos as each section is completed." },
            { kind: "works", name: "Membrane · section B", when: "Weeks 4–6", where: "", desc: "The same system on the next area, with upstands, outlets and penetrations detailed and flood tested where it applies." },
            { kind: "handover", name: "Site walkthrough", when: "Week 7", where: "Whole site, with the committee", desc: "We walk the site with the committee, list anything that needs attention and fix it before we leave." },
            { kind: "handover", name: "Document handover", when: "Week 7", where: "", desc: "You receive the project reports, product records and your written warranty, so the work is documented in one place for the life of the membrane." },
          ],
          note: "On larger sites we carry out the works in separate sections. Once you accept, we confirm a formal access plan for each one as timelines are locked in, and if plans change, we work around your schedule. Timeframes exclude wet weather; if rain stops work, we let the committee know the same day.",
        }
      : {
          intro:
            "We run your project differently from most. It starts with a proper site setup, not a pressure washer, and your project manager guides every stage from the first resident notice to the final handover, reporting back to you as each stage is completed.",
          stages: [
            { kind: "prep", name: "Site setup & access plan", when: "Week 1", where: "Whole site", desc: "Your project manager prepares the site documentation, sends resident notices and confirms the access plan, including exclusion zones, with the committee. Every stakeholder knows what is happening, and when, before work begins." },
            { kind: "repairs", name: "Repairs", when: "Weeks 1–3", where: "Every defect flagged in the site survey", desc: "Our remedial team completes every repair before the building is washed. Repair work is dirty work, so doing it first means one wash leaves every surface clean and ready for paint." },
            { kind: "clean", name: "Building wash", when: "Weeks 3–4", where: "All painted and rendered surfaces, roof down", desc: "A single, thorough pressure clean from the roof down removes salt, mould, chalking and repair dust. Surfaces are left to dry fully before priming." },
            { kind: "works", name: "Prime & paint · section A", when: "Weeks 4–6", where: "", desc: "Primer or sealer, then two full coats, drop by drop from the roof down. We report back with photos as each section is completed." },
            { kind: "works", name: "Prime & paint · section B", when: "Weeks 6–8", where: "", desc: "The same system on the next faces, worked from rope access or a knuckle boom so there’s no scaffold in the way." },
            { kind: "handover", name: "Site walkthrough", when: "Week 9", where: "Whole building, with the committee", desc: "We walk the whole building with the committee, list anything that needs attention and fix it before we leave." },
            { kind: "handover", name: "Document handover", when: "Week 9", where: "", desc: "You receive the project reports, product and colour records and your written warranty, so your building’s history is documented in one place." },
          ],
          note: "On larger buildings we carry out the works in separate sections. Once you accept, we confirm a formal access plan for each one as timelines are locked in, and if plans change, we work around your schedule. Timeframes exclude wet weather; if rain stops work, we let the committee know the same day.",
        },
    pricing: {
      intro:
        "One fixed price, broken down by stage. Repair allowances are included, and anything beyond them is priced in writing first.",
      stages: stages.length ? stages : [{ label: "Works", note: "", amt: "0" }],
      terms: [
        "Deposit: 10% on acceptance of this proposal.",
        "Progress claims: tied to the percentage of the job completed.",
        "Final payment: on completion and sign-off.",
        `Workmanship warranty: ${y} years, written, as standard.${W ? "" : " The industry norm is 5."}`,
      ].join("\n"),
    },
    maintenance: {
      intro: `After handover, the plan keeps your building looking as it did on day one, catching wear early so it never becomes a full ${W ? "membrane replacement" : "repaint"}. It’s optional, with nothing to sign until you’re happy with the finished job.`,
      price: "",
    },
    accept: {
      intro: `Sign below or confirm in writing to secure your start date. ${job.pm.split(" ")[0] || "We"} will then confirm the programme with the committee and notify residents before works begin.`,
    },
  };
}

/** Switches a proposal's trade. Wording still on the old trade's standard
 *  takes the new trade's; anything the rep has edited is kept. */
export function switchTrade(p: Proposal, trade: Trade): Proposal {
  if (p.trade === trade) return p;
  const from = defaultSections(p.trade ?? "painting", p.job, p.d.pricing.stages);
  const to = defaultSections(trade, p.job, p.d.pricing.stages);
  const d = { ...p.d } as unknown as Record<string, Record<string, unknown>>;
  const F = from as unknown as Record<string, Record<string, unknown>>;
  const N = to as unknown as Record<string, Record<string, unknown>>;
  for (const sec of Object.keys(d)) {
    const next = { ...d[sec] };
    for (const k of Object.keys(next)) {
      if (k === "rows" && sec === "project") continue;
      if (JSON.stringify(next[k]) === JSON.stringify(F[sec]?.[k])) next[k] = N[sec]?.[k];
    }
    d[sec] = next;
  }
  const proj = d.project as unknown as ProposalSections["project"];
  const T = TRADES[trade];
  d.project = {
    ...proj,
    brand: T.brands.includes(proj.brand) ? proj.brand : T.brands[0],
    rows: { ...to.project.rows, ...proj.rows },
  } as unknown as Record<string, unknown>;
  const lib = (id: string) => LIBRARY_FOLDERS.some((f) => f.id === id);
  return {
    ...p,
    trade,
    folders: [...p.folders.filter((id) => !lib(id)), ...T.folders],
    d: d as unknown as ProposalSections,
  };
}

/** The zone of a location ("D10 L2" → "D10"), or "". */
export const zoneOf = (where: string | undefined) => (where ?? "").toUpperCase().match(/\b[DS]\d+\b/)?.[0] ?? "";
