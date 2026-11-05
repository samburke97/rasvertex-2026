// lib/reports/inspection/codes.ts
//
// The defect code libraries and fixed copy for the Inspection Report — one
// library per report kind (building, roof). A
// technician only supplies coded photo labels (see parse.ts); every name,
// explanation, recommended action, work item and severity in the report
// comes from here, never from the technician's note.
//
// `what` and `action` are each written to fill exactly two lines in the
// Defects explained table (about 50–66 characters). Keep new entries to
// that length. `order` sets the sort order everywhere (severity first).
// OV and OT are system codes: not defects, not counted, and not listed in
// Defects explained or Recommended works.

import type { LocationTag } from "@/lib/reports/settings/types";

export type Band = "red" | "amber" | "grey";

export interface BandDef {
  name: string;
  desc: string;
  fg: string;
  bg: string;
  /** Closing sentence of this band's row on the Summary page. */
  tail: string;
}

export const BANDS: Record<Band, BandDef> = {
  red: {
    name: "Priority",
    desc: "Safety risks and active damage. Act now.",
    fg: "#a83a3a",
    bg: "#fbe7e7",
    tail: "These are safety risks or active damage. We recommend acting on them now.",
  },
  amber: {
    name: "Repair",
    desc: "Defects that will get worse. Plan repairs.",
    fg: "#86561a",
    bg: "#fcf0dc",
    tail: "These will get worse if left. We recommend planning repairs in the next maintenance cycle.",
  },
  grey: {
    name: "Monitor",
    desc: "Minor items and reference photos.",
    fg: "rgba(1,25,85,0.72)",
    bg: "#eef1f6",
    tail: "Minor items to watch and include in routine maintenance.",
  },
};

export const BAND_ORDER: Band[] = ["red", "amber", "grey"];

export interface DefectCode {
  code: string;
  name: string;
  band: Band;
  what: string;
  action: string;
  work: string;
  why: string;
  order: number;
  system: boolean;
}

const c = (
  code: string,
  name: string,
  band: Band,
  what: string,
  action: string,
  work: string,
  why: string,
): Omit<DefectCode, "order" | "system"> => ({ code, name, band, what, action, work, why });

type CodeDraft = Omit<DefectCode, "order" | "system">;

const SYSTEM_CODES: CodeDraft[] = [
  c("OV", "Overview photo", "grey", "", "", "", ""),
  c("OT", "Other item of note", "grey", "", "", "", ""),
];

const finish = (list: CodeDraft[]): DefectCode[] =>
  [...list, ...SYSTEM_CODES].map((d, order) => ({
    ...d,
    order,
    system: d.code === "OV" || d.code === "OT",
  }));

// ── The code table ───────────────────────────────────────────────────────────
// One table for every report (the one printed on the SimPRO job sheet), so a
// photo coded on site maps the same in the building and roof inspections and
// the proposal. SC, RC and HC are older codes, kept so earlier photos still
// map. DL was renamed DLM; parse.ts reads both.

export const ALL_CODES: CodeDraft[] = [
  c("SH", "Safety hazard", "red",
    "Any item or condition that could injure residents or workers.",
    "Isolate the area, then make safe or repair as a priority.",
    "Make safe and repair hazards",
    "A risk to people and a liability for the body corporate."),
  c("WI", "Water ingress", "red",
    "Water entering through the facade, roof, windows or joints.",
    "Locate the entry point, repair it and dry the affected area.",
    "Leak investigation and repair",
    "Causes hidden damage to structure and units, and mould."),
  c("SP", "Spalling", "red",
    "Concrete or render breaking away as the steel inside rusts.",
    "Remove loose material, treat the steel and patch with mortar.",
    "Concrete spalling repairs",
    "Falling debris risk, and the corrosion keeps spreading."),
  c("CO", "Corrosion", "red",
    "Rust on steel fixings, brackets, rails, stairs or pipework.",
    "Treat and recoat light rust. Replace fixings that have weakened.",
    "Corrosion treatment and fixing replacement",
    "Weakens fixings over time and stains surfaces."),
  c("AL", "Active leak", "red",
    "Water getting through the membrane or building fabric into the building below.",
    "Find the entry point, make it watertight and dry out the area.",
    "Leak investigation and repair",
    "Damages ceilings, finishes and units below."),
  c("MT", "Membrane tear or puncture", "red",
    "Splits, cuts or punctures right through the membrane layer.",
    "Cut out the damaged area and patch with a compatible membrane.",
    "Tear and puncture repairs",
    "Water goes straight through to the roof below."),
  c("SC", "Structural crack", "red",
    "Wide, stepped or growing cracks in structural elements.",
    "Refer to a structural engineer (RPEQ) before any repair.",
    "Structural crack assessment and repair",
    "Can indicate movement in the structure."),
  c("WS", "Window seal", "amber",
    "Window or door seals that have perished, shrunk or moved.",
    "Replace the seals or reseal around the frame perimeter.",
    "Window seal replacement",
    "Lets water in around frames and into units."),
  c("LF", "Loose fixing", "amber",
    "Screws, bolts or brackets that are loose, missing or backing out.",
    "Refix into sound backing and replace any damaged components.",
    "Refix loose items",
    "Items can move and fail in high wind."),
  c("CR", "Cracking", "amber",
    "Cracks through render, concrete or masonry, usually caused by movement.",
    "Rake out, fill with a flexible filler and recoat the area.",
    "Crack repairs",
    "Lets water in behind the surface, leading to spalling."),
  c("PW", "Ponding water", "amber",
    "Water sitting on a roof, balcony or ledge instead of draining.",
    "Clear the outlets and correct the falls so water drains away.",
    "Drainage and falls correction",
    "Wears the membrane and finds any weak point."),
  c("LS", "Lap or seam failure", "amber",
    "Joins between membrane sheets or coats that have opened up.",
    "Clean, re-bond and seal the laps, adding a cover strip if needed.",
    "Lap and seam repairs",
    "Open seams are a direct path for water."),
  c("BS", "Blistering", "amber",
    "Bubbles where the membrane or coating has lost its bond to the surface.",
    "Cut out and re-bond the blisters, then patch and recoat.",
    "Blister repairs",
    "Blisters split open and let water underneath."),
  c("PF", "Penetration failure", "amber",
    "Seals around pipes, vents or fixings through the roof or wall failing.",
    "Remove the old seal and re-flash with a compatible collar.",
    "Penetration resealing",
    "Each penetration is a hole through the waterproofing."),
  c("DR", "Drummy render", "amber",
    "Render that sounds hollow when tapped, as it has lost its bond.",
    "Cut out the drummy section, re-render and recoat the area.",
    "Drummy render repairs",
    "Can crack and fall, and holds water behind it."),
  c("SF", "Sealant failure", "amber",
    "Sealant in joints or penetrations that has split or lost grip.",
    "Remove the old sealant and reseal with a compatible product.",
    "Joint and sealant replacement",
    "One of the most common ways water gets in."),
  c("FL", "Flashing", "amber",
    "Metal or membrane flashings that are missing, loose or lifted.",
    "Refix, reseal or replace the flashing to restore the seal.",
    "Flashing repairs",
    "Water gets in at junctions when flashings fail."),
  c("BL", "Balustrade", "amber",
    "Balustrades or handrails that are loose, damaged or corroded.",
    "Make safe and repair, with engineer review where required.",
    "Balustrade repairs",
    "Balustrades must stay secure to prevent falls."),
  c("RM", "Roof membrane", "amber",
    "Damage, lifting or wear to the waterproof roof or deck membrane.",
    "Repair damaged areas, or recoat a membrane at end of life.",
    "Roof membrane repair or recoat",
    "The main barrier against leaks into units below."),
  c("BD", "Blocked drain / outlet or gutter", "amber",
    "Debris blocking a drain, roof outlet, sump, gutter or overflow.",
    "Clear the blockage and add the outlet to routine maintenance.",
    "Drain, outlet and gutter clean",
    "Water backs up and overflows where it should not."),
  c("DLM", "Membrane lifting", "amber",
    "Membrane lifting or peeling away from the surface below.",
    "Remove loose membrane, prime and re-apply back to sound edges.",
    "Membrane re-bonding",
    "Water and wind get underneath and spread the damage."),
  c("UF", "Upturn or flashing failure", "amber",
    "Membrane upturns at walls, kerbs or edges that have failed.",
    "Re-terminate the upturn and seal it under a new flashing.",
    "Upturn and flashing repairs",
    "Junctions are where most roof leaks start."),
  c("CK", "Membrane cracking", "amber",
    "Cracks through the membrane surface from age or movement.",
    "Clean out, reinforce with fabric and recoat the area.",
    "Membrane crack repairs",
    "Cracks open further with heat and let water in."),
  c("RC", "Render crack", "amber",
    "Cracks through the render coat, usually caused by movement.",
    "Rake out, fill with a flexible filler and recoat the area.",
    "Render crack repairs",
    "Lets water in behind the render, leading to spalling."),
  c("CD", "Coating peeling", "grey",
    "Paint or coating lifting, flaking or peeling from the surface.",
    "Prepare the surface and recoat in the next maintenance cycle.",
    "Recoat failed paint and coatings",
    "Leaves the surface exposed to the weather."),
  c("UV", "UV degradation", "grey",
    "Top coat chalking, fading or thinning from sun exposure.",
    "Clean and apply a UV-stable top coat in the next cycle.",
    "UV top coat renewal",
    "The top coat protects the membrane or coating underneath."),
  c("DB", "Debris or growth", "grey",
    "Leaves, dirt, moss or plant growth sitting on the surface.",
    "Clean and remove growth during routine maintenance.",
    "Clean and remove growth",
    "Holds moisture against the surface and blocks drainage."),
  c("RS", "Rust spot", "grey",
    "Small, isolated rust spots on fixings or metal surfaces.",
    "Treat the rust and touch up the coating during maintenance.",
    "Rust treatment and touch up",
    "Minor now, but spreads if left untreated."),
  c("SW", "Surface wear", "grey",
    "Worn areas from foot traffic, plant or equipment.",
    "Add walkway protection and recoat the worn areas.",
    "Walkway protection and recoat",
    "Repeated traffic wears through to the membrane."),
  c("HC", "Hairline crack", "grey",
    "Fine surface cracks in paint or render, typically under 1mm.",
    "Monitor, then fill and recoat in the next maintenance cycle.",
    "Hairline crack filling and recoat",
    "Can open up and let water in over time."),
];

/** Older spellings of a code, read as the code. */
export const CODE_ALIASES: Record<string, string> = { DL: "DLM" };

// Both inspections carry every code; each lists its own trade's first, so
// a code's rank within its band suits the report.
export const ROOF_FIRST = ["AL", "MT", "SH", "LS", "DLM", "BS", "UF", "PF", "CK", "PW", "BD", "RM", "UV", "SW", "DB"];
const BUILDING_CODES = finish(ALL_CODES);
const ROOF_CODES = finish([
  ...ROOF_FIRST.map((k) => ALL_CODES.find((d) => d.code === k)!),
  ...ALL_CODES.filter((d) => !ROOF_FIRST.includes(d.code)),
]);

// ── Fixed copy ───────────────────────────────────────────────────────────────

export const EXCLUSIONS = [
  "This report is based on a visual, non invasive inspection of accessible areas at the time of inspection.",
  "RAS-VERTEX are not structural engineers. No load testing, destructive testing or structural calculations were carried out. Our findings and recommendations are our professional opinion as maintenance contractors. They are not a structural assessment or certification.",
  "Defects that are concealed, inaccessible or not visible at the time of inspection may not be identified in this report.",
  "Where a structural concern is noted, we recommend assessment by a qualified structural engineer (RPEQ) before any decision on repair or replacement.",
];

/** Website photos used by the About and Also worth adding cards. */
export const LOGO_IMAGE = "reports/proposal/assets/logo-full.png";
export const CARD_IMAGES = {
  project: "reports/proposal/assets/project-2.jpeg",
  rope: "reports/proposal/assets/rope-access.png",
  maintenance: "reports/proposal/assets/nav-maintenance.png",
  waterproofing: "reports/proposal/assets/nav-waterproofing.png",
  height: "reports/proposal/assets/nav-height.png",
  painting: "reports/proposal/assets/nav-painting.png",
  cleaning: "reports/proposal/assets/nav-cleaning.png",
  exampleBuilding: "reports/inspection/example-building.jpg",
  exampleRoof: "reports/inspection/example-roof.jpg",
  /** The cover until one is chosen: the team on a tower beside the van. */
  defaultCover: "reports/proposal/assets/rope-access.png",
} as const;
export type ImageKey = keyof typeof CARD_IMAGES;

export interface CardDef {
  t: string;
  d: string;
  img: ImageKey;
}

export interface ExtraDef extends CardDef {
  /** Only shown when one of these codes is in the report. */
  whenAny?: string[];
}

/** A report's key in the settings: "building", "roof", or one an admin added. */
export type ReportKind = string;

/** The built-in copy (LIBRARIES): the defaults the settings start from. */
export interface LibraryBase {
  kind: ReportKind;
  /** "Building inspection" — the builder's choice label. */
  label: string;
  /** Cover fact: "Condition #11355". */
  reportRef: string;
  codes: DefectCode[];
  codeMap: Record<string, DefectCode>;
  about: CardDef[];
  extras: ExtraDef[];
  scope: string;
  blurb: (street: string) => string;
  /** Roof photos may leave out the level; it defaults to LR. */
  defaultLevel: string | null;
  /** Services offered for the maintenance plan, in order; whenAny: ticked
   *  to start with when one of these codes is in the report. */
  plan: { service: string; interval: string; priority: "required" | "recommended"; whenAny?: string[] }[];
  /** The made-up photo on "Reading a photo": one code, a location, a note. */
  example: { img: ImageKey; code: string; zone: string; level: string; note: string };
}

/** What a report reads, built from the settings (settings/library.ts). */
export interface Library extends LibraryBase {
  /** The report's type (roof: "membrane", "tiled"…), when it has types. */
  type?: string;
  bands: Record<Band, BandDef>;
  bandOrder: Band[];
  tags: LocationTag[];
  /** Old or misspelt codes, and OTP / OTR / OTM, → the code. */
  aliases: Record<string, string>;
  exclusions: string[];
}

const byCode = (codes: DefectCode[]) => Object.fromEntries(codes.map((d) => [d.code, d]));

const HELPS: CardDef = {
  t: "Why it helps",
  d: "The committee can see what requires action now and what can be planned. Early repair reduces cost, protects residents and supports maintenance planning.",
  img: "maintenance",
};
const ANNUAL: ExtraDef = {
  t: "Annual inspection",
  d: "Catch new defects early, with a report like this each year.",
  img: "height",
};

export const LIBRARIES: Record<"building" | "roof", LibraryBase> = {
  building: {
    kind: "building",
    plan: [
      { service: "Height safety anchor inspection and recertification", interval: "Annually", priority: "required" },
      { service: "Gutter and roof drainage clean", interval: "Every 6 months", priority: "required", whenAny: ["BD", "WI"] },
      { service: "Balustrade and handrail inspection", interval: "Annually", priority: "required", whenAny: ["BL", "SH"] },
      { service: "Building wash", interval: "Annually", priority: "recommended" },
      { service: "Window clean", interval: "Every 6 months", priority: "recommended" },
      { service: "Sealant and joint inspection, with resealing as needed", interval: "Every 2 years", priority: "recommended", whenAny: ["SF", "WS"] },
      { service: "Render and concrete inspection (cracking, spalling)", interval: "Every 2 years", priority: "recommended", whenAny: ["RC", "SP", "SC", "DR", "HC"] },
      { service: "Corrosion treatment and touch-ups", interval: "Every 2 years", priority: "recommended", whenAny: ["CO", "RS"] },
      { service: "Coating inspection and touch-ups", interval: "Every 2 years", priority: "recommended", whenAny: ["CD"] },
      { service: "Full external repaint", interval: "Every 8–10 years", priority: "recommended" },
      { service: "Building condition inspection and report", interval: "Every 3 years", priority: "recommended" },
    ],
    example: { img: "exampleBuilding", code: "SF", zone: "D3", level: "L2", note: "Expansion joint sealant split and pulling away" },
    label: "Building inspection",
    reportRef: "Condition",
    codes: BUILDING_CODES,
    codeMap: byCode(BUILDING_CODES),
    about: [
      {
        t: "Why this report",
        d: "A photographed record of the building\u2019s exterior condition. Defects at height are difficult to identify from the ground and can escalate if left unaddressed.",
        img: "project",
      },
      {
        t: "What we look for",
        d: "Our technicians inspect the awnings, facade, roof, joints, sealants, fixings and height safety, recording each defect by type and location.",
        img: "rope",
      },
      HELPS,
    ],
    extras: [
      ANNUAL,
      {
        t: "Washdown and repaint",
        d: "Best done straight after repairs, so the new work is protected.",
        img: "painting",
        whenAny: ["HC", "RC", "SC", "CD", "SF", "RS", "DR"],
      },
      { t: "Maintenance plan", d: "Scheduled washdowns and inspections at a fixed annual price.", img: "cleaning" },
    ],
    scope:
      "An external inspection by rope access of the awnings, facade, roof, joints, fixings and height safety.",
    blurb: (street) =>
      `This report outlines the external building inspection at ${street}, including current condition and recommended repairs and maintenance.`,
    defaultLevel: null,
  },
  roof: {
    kind: "roof",
    plan: [
      { service: "Height safety anchor inspection and recertification", interval: "Annually", priority: "required" },
      { service: "Gutter, outlet and drainage clean", interval: "Every 6 months", priority: "required", whenAny: ["BD", "PW"] },
      { service: "Roof clean (debris and growth)", interval: "Annually", priority: "recommended", whenAny: ["DB"] },
      { service: "Membrane inspection, with spot repairs", interval: "Annually", priority: "recommended", whenAny: ["MT", "LS", "DLM", "BS", "CK", "AL"] },
      { service: "Upturn, flashing and penetration check", interval: "Annually", priority: "recommended", whenAny: ["UF", "PF"] },
      { service: "UV-stable top coat", interval: "Every 5 years", priority: "recommended", whenAny: ["UV", "SW"] },
      { service: "Full membrane replacement", interval: "Every 15–20 years", priority: "recommended" },
      { service: "Roof condition inspection and report", interval: "Every 2 years", priority: "recommended" },
    ],
    example: { img: "exampleRoof", code: "MT", zone: "S1", level: "LR", note: "Membrane split along the lap, open to water" },
    label: "Roof inspection",
    reportRef: "Roof",
    codes: ROOF_CODES,
    codeMap: byCode(ROOF_CODES),
    about: [
      {
        t: "Why this report",
        d: "A photographed record of the roof membrane\u2019s condition. Membrane defects are rarely visible from below and lead to leaks if left unaddressed.",
        img: "project",
      },
      {
        t: "What we look for",
        d: "Our technicians inspect the membrane, laps and seams, upturns, flashings, penetrations, outlets and drainage, recording each defect by type and location.",
        img: "waterproofing",
      },
      HELPS,
    ],
    extras: [
      ANNUAL,
      {
        t: "Membrane recoat",
        d: "A new UV-stable top coat extends the life of a sound membrane.",
        img: "painting",
        whenAny: ["UV", "SW", "CK", "BS", "DLM"],
      },
      {
        t: "Maintenance plan",
        d: "Scheduled roof cleans, outlet clears and inspections at a fixed annual price.",
        img: "cleaning",
      },
    ],
    scope:
      "An inspection of the roof membrane, including laps and seams, upturns and flashings, penetrations, outlets and drainage, and surface condition.",
    blurb: (street) =>
      `This report outlines the roof membrane inspection at ${street}, including current condition and recommended repairs and maintenance.`,
    defaultLevel: "LR",
  },
};

export { PLAN_INTERVALS } from "@/lib/reports/maintenancePlan";
