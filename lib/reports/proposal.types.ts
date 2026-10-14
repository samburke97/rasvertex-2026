// lib/reports/proposal.types.ts
//
// Data model for the Painting proposal builder (Quote → Build → Review).
// Built from a SimPRO Quote: the quote fills in the job details and pricing,
// and the quote's attachment folders supply the photos. Everything else is
// either the rep's own words for this job or standard company wording that
// can be overridden per proposal.
//
// The same ProposalData drives the live preview in the builder and the
// exported PDF (both render components/reports/proposal/builder/
// ProposalDocument.tsx), so section status, numbering and the review checks
// all live here as pure functions rather than inside the UI.

export type ProposalStep = "start" | "build" | "review";

export type SectionId =
  | "cover"
  | "intro"
  | "project"
  | "findings"
  | "scope"
  | "access"
  | "pricing"
  | "warranty"
  | "why"
  | "accept"
  | "services";

export type OptionalSectionId =
  | "project"
  | "findings"
  | "access"
  | "warranty"
  | "why"
  | "services";

export interface SectionDef {
  id: SectionId;
  name: string;
  optional?: boolean;
  // Standard company wording, locked until the rep chooses to edit it.
  std?: boolean;
}

export const SECTIONS: SectionDef[] = [
  { id: "cover", name: "Cover" },
  { id: "intro", name: "Introduction" },
  { id: "project", name: "Your Project", optional: true },
  { id: "findings", name: "Site Survey & Findings", optional: true },
  { id: "scope", name: "Scope: Inclusions & Exclusions" },
  { id: "access", name: "Access & Disruption Plan", optional: true },
  { id: "pricing", name: "Pricing & Terms" },
  { id: "warranty", name: "The 8-Year Warranty", std: true, optional: true },
  { id: "why", name: "Our Clients", optional: true },
  { id: "accept", name: "Acceptance" },
  { id: "services", name: "Trusted by the Coast", optional: true },
];

export const SIGNERS: { name: string; title: string }[] = [
  { name: "Shane Kidby", title: "Project Manager" },
  { name: "Sam Burke", title: "Commercial Manager" },
  { name: "Phil Clark", title: "Director" },
];

export function titleFor(name: string): string {
  return SIGNERS.find((s) => s.name === name)?.title ?? "Project Manager";
}

// Always the company number, never per-salesperson.
export const COMPANY_PHONE = "07 5371 0201";

export const STAGE_COLORS = ["#1f7a4d", "#2563a8", "#c7242e", "#b8860b", "#7c3aed"];

export interface ServiceDef {
  id: string;
  name: string;
  img: string; // public path
  desc: string;
}

export const SERVICES: ServiceDef[] = [
  {
    id: "painting",
    name: "Painting",
    img: "/reports/proposal/assets/project-1.jpeg",
    desc: "Interior and exterior repaints for strata, commercial and residential buildings, with thorough surface prep and premium coatings so the finish lasts.",
  },
  {
    id: "cleaning",
    name: "Cleaning",
    img: "/reports/proposal/assets/nav-cleaning.png",
    desc: "Pressure washing, façade and roof cleaning, and IRATA-certified high-rise window cleaning, scheduled around residents and tenants.",
  },
  {
    id: "waterproofing",
    name: "Waterproofing",
    img: "/reports/proposal/assets/nav-waterproofing.png",
    desc: "Membrane repairs and replacement for balconies, roofs and wet areas, stopping leaks at the source before they damage the structure.",
  },
  {
    id: "maintenance",
    name: "Building Maintenance",
    img: "/reports/proposal/assets/nav-maintenance.png",
    desc: "Scheduled upkeep and reactive repairs, from sealants to minor carpentry, handled by the same team that already knows your building.",
  },
  {
    id: "height",
    name: "Height Safety",
    img: "/reports/proposal/assets/nav-height.png",
    desc: "Installation and annual certification of anchor points, static lines and roof access, keeping your building compliant and safe to work on.",
  },
  {
    id: "inspections",
    name: "Building Inspections",
    img: "/reports/proposal/assets/rope-access.png",
    desc: "Façade and building condition inspections by rope access, drone and thermal imaging, with full condition reports and remediation schedules.",
  },
];

export const SERVICES_INTRO =
  "Painting is one part of what we do. As your complete property maintenance partner, we can bundle painting, cleaning, waterproofing, height safety and inspections into a single maintenance plan: one team, one schedule, one point of contact for the whole building.";

export const STD_WORDING = {
  warranty:
    "Most workmanship warranties in this industry run two to five years, and the longer terms usually come with a catch: an ongoing paid maintenance contract you have to commit to first. Every RAS-VERTEX repaint carries an 8-year written workmanship warranty as standard. No maintenance contract to sign, no conditions attached.",
};

export const WHY_SUB =
  "For over 25 years, we've completed painting projects with one dedicated team, right here on the Sunshine Coast. No subcontractors, no handovers, just the same experienced faces on site from start to finish.";

export const DEFAULT_CLIENTS = [
  "Accor",
  "Novotel",
  "RACV",
  "Ray White",
  "Mosaic",
  "Archers",
  "Pica Group",
  "Coolum Football Club",
  "Maroochy RSL",
  "SSKB",
].join("\n");

// Logo library for "Our Clients", keyed by lower-case client name. Files live
// in public/reports/partners/. A client whose logo file is missing
// (or who isn't listed here) shows their name in text instead — the preview
// and the PDF route both check the file actually exists before using it.
export const CLIENT_LOGOS: Record<string, { file: string; height: number }> = {
  novotel: { file: "novotel.svg.png", height: 56 },
  accor: { file: "accor.svg", height: 64 },
  racv: { file: "racv.png", height: 60 },
  "ray white": { file: "raywhite.png", height: 40 },
  mosaic: { file: "mosaic.svg", height: 40 },
  archers: { file: "archers.png", height: 56 },
  "pica group": { file: "pica.png", height: 52 },
  "coolum football club": { file: "coolum.png", height: 84 },
  "maroochy rsl": { file: "maroochy.png", height: 64 },
  sskb: { file: "sskb.svg", height: 64 },
};

export const CLIENT_LOGO_DIR = "/reports/partners/";

// ── State ────────────────────────────────────────────────────────────────────

export interface ProposalPhoto {
  id: string;
  name: string;
  url: string; // data: URL until its Blob upload finishes, then the Blob URL
  folderId: string; // SimPRO attachment folder id ("none" = unfiled)
}

export interface PhotoFolderInfo {
  id: string;
  name: string;
  count: number;
}

// Not a SimPRO folder — satellite captures for the access plan live here.
export const AERIAL_FOLDER_ID = "__aerial";

export interface ProposalJob {
  building: string;
  client: string;
  contact: string;
  site: string;
  sales: string;
  email: string;
}

export interface ProposalFinding {
  id: string;
  photo: string | null; // ProposalPhoto id
  title: string;
  desc: string;
}

export interface AccessStage {
  id: string;
  when: string;
  what: string;
}

export interface AccessPoint {
  id: string;
  x: number; // 0-100, % across the aerial
  y: number; // 0-100
  stageId: string | null;
  note: string;
}

export interface PricingLineItem {
  id: string;
  name: string;
  amt: number;
  show: boolean; // hidden from the client by default
}

export interface PricingCentre {
  id: string;
  label: string;
  note: string;
  items: PricingLineItem[];
}

export type CoverValidity = "14 days" | "30 days" | "60 days";

export interface ProposalData {
  version: 2;
  template: "painting";
  quote: string;
  folders: string[]; // selected SimPRO attachment folder ids
  folderList: PhotoFolderInfo[];
  photos: ProposalPhoto[];
  job: ProposalJob;
  on: Record<OptionalSectionId, boolean>;
  cover: { eyebrow: string; title: string; valid: CoverValidity; photo: string | null };
  intro: { greeting: string; body: string; signer: string }; // dated today at render
  project: { summary: string; type: string; access: string; start: string; inspected: string };
  findings: ProposalFinding[]; // unlimited
  scope: { inc: string; exc: string }; // newline-separated
  access: { aerial: string | null; intro: string; stages: AccessStage[]; points: AccessPoint[] };
  std: { warranty: string | null }; // null = standard wording
  pricing: { mode: "totals" | "lines"; deposit: string; terms: string; centres: PricingCentre[] };
  why: { sub: string; rating: string; reviews: string; clients: string };
  accept: { clientName: string; clientRole: string; rvSigner: string };
  services: { hidden: string[]; intro: string };
}

export function isProposalData(x: unknown): x is ProposalData {
  return !!x && typeof x === "object" && (x as { version?: unknown }).version === 2;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export const uid = () => Math.random().toString(36).slice(2, 10);

export const lines = (t: string) =>
  t
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

export const paras = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((x) => x.trim())
    .filter(Boolean);

export const fmtMoney = (n: number) =>
  "$" +
  Number(n).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

export function todayLong(d = new Date()): string {
  return d.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Company email convention: firstname@rasvertex.com.au.
export function deriveEmail(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  const clean = first.toLowerCase().replace(/[^a-z]/g, "");
  return clean ? `${clean}@rasvertex.com.au` : "";
}

export function centreTotal(c: PricingCentre): number {
  return c.items.reduce((a, i) => a + i.amt, 0);
}

export function pricingSubtotal(p: ProposalData): number {
  return p.pricing.centres.reduce((a, c) => a + centreTotal(c), 0);
}

export function pricingGst(p: ProposalData): number {
  return Math.round(pricingSubtotal(p) * 10) / 100;
}

export function stageColor(stages: AccessStage[], stageId: string | null): string {
  const i = stages.findIndex((s) => s.id === stageId);
  return STAGE_COLORS[(i < 0 ? 0 : i) % STAGE_COLORS.length];
}

export function isSectionOn(p: ProposalData, id: SectionId): boolean {
  const def = SECTIONS.find((s) => s.id === id);
  return !def?.optional || p.on[id as OptionalSectionId] !== false;
}

export function visibleSections(p: ProposalData): SectionDef[] {
  return SECTIONS.filter((s) => isSectionOn(p, s.id));
}

/** "01".."0N" for a visible section, "" for the cover or a hidden one. */
export function sectionNumber(p: ProposalData, id: SectionId): string {
  const i = visibleSections(p).findIndex((s) => s.id === id);
  return i <= 0 ? "" : String(i).padStart(2, "0");
}

export function sectionTotal(p: ProposalData): string {
  return String(visibleSections(p).length - 1).padStart(2, "0");
}

export interface SectionStatus {
  text: string;
  color: string;
  bg: string;
  need?: boolean;
}

const G = (text: string): SectionStatus => ({ text, color: "#3f8f68", bg: "#e9f5ef" });
const A = (text: string): SectionStatus => ({ text, color: "#96731f", bg: "#fbf4e5", need: true });
const N = (text: string): SectionStatus => ({
  text,
  color: "rgba(23,23,26,0.5)",
  bg: "rgba(0,0,0,0.045)",
});

export function sectionStatus(p: ProposalData, id: SectionId): SectionStatus {
  if (!isSectionOn(p, id))
    return { text: "Not included", color: "rgba(23,23,26,0.34)", bg: "rgba(0,0,0,0.045)" };
  switch (id) {
    case "cover":
      return p.cover.photo ? G("Ready") : A("Choose a cover photo");
    case "project":
      return p.project.summary.trim() ? G("Ready") : A("Overview missing");
    case "findings":
      if (!p.project.inspected.trim()) return A("Inspection date missing");
      return p.findings.length ? G(`${p.findings.length} findings`) : A("Add findings");
    case "scope":
      return G(`${lines(p.scope.inc).length} in · ${lines(p.scope.exc).length} out`);
    case "access":
      return p.access.points.length
        ? G(`${p.access.points.length} drop points`)
        : A("Mark drop points");
    case "pricing":
      return G(fmtMoney(pricingSubtotal(p)));
    case "why": {
      const c = lines(p.why.clients);
      const ph = c.filter((n) => /^\[.*\]$/.test(n)).length;
      return ph ? A(`${ph} client to name`) : G(`${c.length} clients`);
    }
    case "warranty":
      return p.std.warranty != null
        ? { text: "Edited for this job", color: "#2f6a94", bg: "#e9f2f9" }
        : N("Standard wording");
    case "services": {
      const n = SERVICES.length - p.services.hidden.length;
      return n ? N(`${n} services`) : A("No services shown");
    }
    case "accept":
      return p.accept.clientName.trim() && p.accept.clientRole.trim()
        ? G("Ready")
        : A("Client signatory missing");
    default:
      return G("Ready");
  }
}

export interface ReviewCheck {
  kind: "ok" | "issue" | "info";
  title: string;
  detail: string;
  fix?: SectionId;
  fixLabel?: string;
}

export function reviewChecks(p: ProposalData): ReviewCheck[] {
  const checks: ReviewCheck[] = [];
  const add = (sec: SectionId, okTitle: string, badTitle: string | null, detail: string) => {
    if (!isSectionOn(p, sec)) return;
    const st = sectionStatus(p, sec);
    checks.push(
      st.need
        ? { kind: "issue", title: badTitle ?? st.text, detail, fix: sec }
        : { kind: "ok", title: okTitle, detail: st.text },
    );
  };
  const sub = pricingSubtotal(p);
  const gst = pricingGst(p);
  const itemCount = p.pricing.centres.reduce((a, c) => a + c.items.length, 0);
  const hiddenCount = p.pricing.centres.reduce(
    (a, c) => a + c.items.filter((i) => !i.show).length,
    0,
  );

  checks.push({
    kind: "ok",
    title: "Job details",
    detail: [p.job.client, p.job.contact].filter(Boolean).join(" · "),
  });
  add("cover", "Cover photo chosen", "No cover photo", "Pick one from the job photos");
  add("project", "Project details complete", null, "Shown in Your Project");
  add("findings", "Findings", null, "Used in the findings intro");
  add("accept", "Client signatory set", "Client signatory missing", "Name and position for the acceptance block");
  checks.push({
    kind: "ok",
    title: "Price",
    detail: `${fmtMoney(sub)} ex GST · ${fmtMoney(sub + gst)} incl. GST`,
  });
  checks.push({
    kind: "info",
    title: `${hiddenCount} of ${itemCount} line items hidden from client`,
    detail: p.pricing.mode === "totals" ? "PDF shows totals only" : "PDF shows totals plus chosen items",
    fix: "pricing",
    fixLabel: "Review",
  });
  return checks;
}

// ── Construction from a SimPRO quote ─────────────────────────────────────────

export interface QuoteHeader {
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

/** Groups SimPRO pricing rows into cost centres, keeping any edits (labels,
 *  notes, which items are shown) from an existing set of centres. */
export function centresFromPricing(
  rows: QuotePricingRow[],
  previous: PricingCentre[] = [],
): PricingCentre[] {
  const order: string[] = [];
  const groups = new Map<string, QuotePricingRow[]>();
  for (const r of rows) {
    const key = r.groupLabel || "Line items";
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(r);
  }
  const prevShown = new Set(
    previous.flatMap((c) => c.items.filter((i) => i.show).map((i) => i.id)),
  );
  return order.map((key) => {
    const id = "cc-" + key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const prev = previous.find((c) => c.id === id);
    return {
      id,
      label: prev?.label ?? key,
      note: prev?.note ?? "",
      items: groups.get(key)!.map((r) => ({
        id: r.id,
        name: r.label,
        amt: r.amountExTax,
        show: prevShown.has(r.id),
      })),
    };
  });
}

export function createProposal(
  quote: string,
  header: QuoteHeader,
  pricing: QuotePricingRow[],
): ProposalData {
  const building = header.siteName || header.clientName || "";
  const contactFirst = header.contactName.trim().split(/\s+/)[0] ?? "";
  const sales = header.salespersonName;
  return {
    version: 2,
    template: "painting",
    quote,
    folders: [],
    folderList: [],
    photos: [],
    job: {
      building,
      client: header.clientName,
      contact: header.contactName,
      site: header.siteAddress,
      sales,
      email: deriveEmail(sales),
    },
    on: { project: true, findings: true, access: true, warranty: true, why: true, services: true },
    cover: {
      eyebrow: "Proposal, external repaint & remedial works",
      title: building ? `${building}.` : "",
      valid: "30 days",
      photo: null,
    },
    intro: {
      greeting: contactFirst,
      signer: SIGNERS.some((s) => s.name === sales) ? sales : sales || "Shane Kidby",
      body: [
        `Thank you for the opportunity to quote on the external repaint and remedial works at ${building || "your building"}. This proposal reflects what we found on site, not a generic scope.`,
        "Every trade on this job, painters, waterproofers and our remedial team, is directly employed under our own licence and run by one project manager from first site visit to warranty sign-off.",
        "Every RAS-VERTEX repaint carries our 8-year written workmanship warranty as standard, with no maintenance contract required.",
        `Any questions, call or text me directly on ${COMPANY_PHONE}.`,
      ].join("\n\n"),
    },
    project: { summary: "", type: "", access: "", start: "", inspected: "" },
    findings: [],
    scope: {
      inc: [
        "Full pressure clean of all painted & rendered surfaces",
        "Crack injection & substrate repair",
        "Defects found mid-job repaired by our own remedial team, no extra trades",
        "2-coat premium coating system: Haymes / Dulux coastal grade",
        "Rope access: no scaffold, no blocked car parks",
        "Full site clean-up & waste removal on completion",
      ].join("\n"),
      exc: [
        "Internal painting or works of any kind",
        "Structural or engineering-certified remedial work",
        "Permit & council fees, if required for this site",
      ].join("\n"),
    },
    access: {
      aerial: null,
      intro:
        "Rope access means no scaffolding, no blocked car parks and no scaffold permits. Residents keep full use of the building while we work.",
      stages: [
        { id: "s1", when: "Weeks 1 to 2", what: "Wash & prep" },
        { id: "s2", when: "Weeks 3 to 5", what: "Remedial repairs" },
        { id: "s3", when: "Weeks 6 to 9", what: "Coating & sign-off" },
      ],
      points: [],
    },
    std: { warranty: null },
    pricing: {
      mode: "totals",
      deposit: "10",
      terms: "Fortnightly against works completed",
      centres: centresFromPricing(pricing),
    },
    why: { sub: WHY_SUB, rating: "4.9", reviews: "50+", clients: DEFAULT_CLIENTS },
    accept: { clientName: "", clientRole: "", rvSigner: "Phil Clark" },
    services: { hidden: [], intro: SERVICES_INTRO },
  };
}

/** Photo ids the document actually renders (cover, findings, aerial). */
export function referencedPhotoIds(p: ProposalData): Set<string> {
  const ids = [p.cover.photo, p.access.aerial];
  if (isSectionOn(p, "findings")) ids.push(...p.findings.map((f) => f.photo));
  return new Set(ids.filter((x): x is string => !!x));
}
