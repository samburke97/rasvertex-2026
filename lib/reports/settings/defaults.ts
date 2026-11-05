// lib/reports/settings/defaults.ts
//
// The settings as the code has them today (codes.ts, anchor.types.ts). Used
// until an admin saves their own, and for reports started before settings
// existed, so those come out exactly as they always have.

import {
  ALL_CODES,
  BANDS,
  BAND_ORDER,
  CODE_ALIASES,
  EXCLUSIONS,
  LIBRARIES,
  ROOF_FIRST,
  type LibraryBase,
} from "@/lib/reports/inspection/codes";
import {
  ANCHOR_TYPE_IS_RATED,
  ANCHOR_TYPE_LABELS,
  ANCHOR_TYPE_SUBTYPES,
  type AnchorType,
} from "@/lib/reports/anchor.types";
import type { AnchorTypeDef, DefectCodeDef, LocationTag, Preset, ReportDef, ReportSettings, Severity } from "./types";

const LETTERS: Record<string, string> = { red: "P", amber: "R", grey: "M" };

const severities = (): Severity[] =>
  BAND_ORDER.map((key, i) => ({
    key,
    name: BANDS[key].name,
    letter: LETTERS[key],
    colour: i,
    desc: BANDS[key].desc,
    tail: BANDS[key].tail,
  }));

const codes = (): DefectCodeDef[] => [
  ...ALL_CODES.map((c) => ({
    ...c,
    aliases: Object.keys(CODE_ALIASES).filter((a) => CODE_ALIASES[a] === c.code),
  })),
  {
    code: "OV",
    name: "Overview photo",
    band: "grey",
    system: true,
    what: "A wide photo that shows the area. Not counted as a defect.",
    action: "",
    work: "",
    why: "",
    aliases: [],
  },
  {
    code: "OT",
    name: "Other item of note",
    band: "grey",
    system: true,
    what: "Anything worth noting that has no code of its own.",
    action: "",
    work: "",
    why: "",
    aliases: [],
  },
];

export const DEFAULT_TAGS: LocationTag[] = [
  { prefix: "D", num: true, prints: "Drop #", kind: "zone" },
  { prefix: "S", num: true, prints: "Section #", kind: "zone" },
  { prefix: "L", num: true, prints: "Level #", kind: "level" },
  { prefix: "LG", num: false, prints: "Ground", kind: "level" },
  { prefix: "LR", num: false, prints: "Roof", kind: "level" },
  { prefix: "U", num: true, prints: "Unit #", kind: "unit" },
];

function presetOf(key: string, name: string, lib: LibraryBase, first?: string[]): Preset {
  return {
    key,
    name,
    codes: null,
    first,
    level: lib.defaultLevel ?? "",
    scope: lib.scope,
    intro: lib.blurb("{street}"),
    ref: lib.reportRef,
    about: lib.about.map((a) => ({ t: a.t, d: a.d, img: a.img })),
    extras: lib.extras.map((x) => ({ t: x.t, d: x.d, img: x.img, when: x.whenAny ?? [] })),
    excl: EXCLUSIONS.join("\n"),
    plan: lib.plan.map((p) => ({ service: p.service, interval: p.interval, req: p.priority === "required", when: p.whenAny ?? [] })),
  };
}

const empty = (key: string, name: string, level = ""): Preset => ({
  key,
  name,
  codes: null,
  level,
  scope: "",
  intro: "",
  about: [],
  extras: [],
  excl: "",
  plan: [],
});

function reports(): ReportDef[] {
  const membrane = presetOf("membrane", "Membrane", LIBRARIES.roof, ROOF_FIRST);
  return [
    { ...presetOf("building", "Building inspection", LIBRARIES.building), types: [] },
    {
      ...empty("roof", "Roof inspection", "LR"),
      types: [membrane, empty("tiled", "Tiled", "LR"), empty("metal", "Metal", "LR")],
    },
  ];
}

function anchors(): AnchorTypeDef[] {
  return (Object.keys(ANCHOR_TYPE_LABELS) as AnchorType[])
    // Anchors first, as on the roof plan's picker.
    .sort((a, b) => Number(ANCHOR_TYPE_IS_RATED[b]) - Number(ANCHOR_TYPE_IS_RATED[a]))
    .map((key, i) => ({
      key,
      name: ANCHOR_TYPE_LABELS[key],
      icon: key,
      colour: i,
      kn: ANCHOR_TYPE_IS_RATED[key] ? "15" : "",
      subs: ANCHOR_TYPE_SUBTYPES[key] ?? null,
    }));
}

export function defaultSettings(): ReportSettings {
  return { version: 1, severities: severities(), codes: codes(), tags: DEFAULT_TAGS, reports: reports(), anchors: anchors() };
}
