// lib/reports/proposal/v3/methods.ts
//
// Remedial work methodologies: the standard "How we fix it" steps for each
// defect code, shown once per code group on the report-style findings pages
// of the painting and waterproofing proposals (not the inspection report).
// A proposal can override a code's steps (findings.methods[code]); clearing
// the override brings the standard back.

import { richItems } from "./rich";
import type { Proposal } from "./types";

/** Four steps per code, in the order the work is done: prepare, repair,
 *  then prime and paint (or seal and test). Nothing here reads as a concrete
 *  or structural assessment: everything flagged gets fixed. */
export const METHODS: Record<string, string[]> = {
  SH: [
    "Isolate the area and make it safe.",
    "Remove or secure the hazard.",
    "Repair or replace the affected item.",
    "Prime, paint and check it’s safe to use.",
  ],
  WI: [
    "Trace the water back to where it gets in.",
    "Remove failed sealant, flashing or coating.",
    "Reseal and repair the entry point.",
    "Prime and paint the repaired surfaces.",
  ],
  SP: [
    "Remove all loose and drummy material.",
    "Treat exposed metal with a rust inhibitor.",
    "Re-render and reshape the area.",
    "Reinstate the finish to match.",
  ],
  CO: [
    "Remove rust and flaking coatings.",
    "Sand back to clean, sound metal.",
    "Apply a rust-inhibiting primer.",
    "Apply two protective finish coats.",
  ],
  AL: [
    "Trace the leak to its entry point.",
    "Remove failed membrane or sealant.",
    "Make it watertight with a compatible repair.",
    "Water-test, then dry out the area.",
  ],
  MT: [
    "Clean and dry around the tear.",
    "Cut back to sound membrane.",
    "Patch with a compatible membrane.",
    "Recoat and water-test the repair.",
  ],
  SC: [
    "Open up the crack and remove loose material.",
    "Fill with repair system.",
    "Re-render to match the surface texture.",
    "Reinstate the finish to match.",
  ],
  WS: [
    "Remove the failed seals and sealant.",
    "Clean and prepare the frame edges.",
    "Reseal with an exterior-grade sealant.",
    "Tool off for a neat, watertight finish.",
  ],
  LF: [
    "Find every loose or missing fixing.",
    "Remove damaged fixings.",
    "Refix with corrosion-resistant fixings.",
    "Seal and touch up around each fixing.",
  ],
  CR: [
    "Rake out the crack and remove loose material.",
    "Fill with a flexible repair compound.",
    "Re-render to match the surface texture.",
    "Reinstate the finish to match.",
  ],
  PW: [
    "Clear the outlets and drains.",
    "Mark where the water sits.",
    "Correct the falls so water drains away.",
    "Reseal and recoat the area.",
  ],
  LS: [
    "Clean and dry the open laps.",
    "Re-bond the laps.",
    "Seal, adding a cover strip where needed.",
    "Recoat the repaired seams.",
  ],
  BS: [
    "Cut open the blisters.",
    "Dry and clean underneath.",
    "Re-bond and patch.",
    "Recoat to match.",
  ],
  PF: [
    "Remove the failed seal.",
    "Clean and prepare around the penetration.",
    "Fit a compatible flashing collar.",
    "Seal and recoat.",
  ],
  DR: [
    "Tap-test and mark the drummy render.",
    "Cut out loose render back to sound edges.",
    "Re-render and match the texture.",
    "Reinstate the finish once cured.",
  ],
  SF: [
    "Cut out the failed sealant.",
    "Clean and prime the joint.",
    "Fit backing rod and apply new sealant.",
    "Tool smooth and paint where specified.",
  ],
  FL: [
    "Lift or remove the loose flashing.",
    "Clean and prepare the junction.",
    "Refix and reseal the flashing.",
    "Prime and paint to match.",
  ],
  BL: [
    "Check every post, fixing and connection.",
    "Tighten or replace loose components.",
    "Remove rust and sand back old coatings.",
    "Prime and paint with a protective system.",
  ],
  RM: [
    "Clean the membrane and mark the damage.",
    "Cut out the failed sections.",
    "Patch with a compatible membrane.",
    "Recoat and water-test the repairs.",
  ],
  BD: [
    "Remove leaves, debris and sediment.",
    "Flush the gutters and outlets.",
    "Repair leaking joints.",
    "Test that water runs clear.",
  ],
  DLM: [
    "Remove the loose membrane.",
    "Clean and prime the surface.",
    "Re-apply back to sound edges.",
    "Recoat and seal the edges.",
  ],
  UF: [
    "Remove the failed upturn termination.",
    "Clean and prime the junction.",
    "Re-terminate the upturn.",
    "Seal it under a new flashing.",
  ],
  CK: [
    "Clean out the cracks.",
    "Reinforce with membrane fabric.",
    "Apply membrane over the repair.",
    "Recoat to match.",
  ],
  RC: [
    "Rake out the crack and remove loose render.",
    "Fill with a flexible render filler.",
    "Re-render to match the surface texture.",
    "Reinstate the finish to match.",
  ],
  CD: [
    "Scrape back loose and flaking paint.",
    "Sand the edges smooth and clean down.",
    "Spot-prime the bare areas.",
    "Apply two finish coats.",
  ],
  UV: [
    "Wash off chalking and dirt.",
    "Sand and prepare the surface.",
    "Apply a sealer or primer.",
    "Apply two UV-stable finish coats.",
  ],
  DB: [
    "Remove debris and growth.",
    "Treat with a mould and moss wash.",
    "Rinse and let the surface dry.",
    "Prime and paint the affected areas.",
  ],
  RS: [
    "Remove rust and loose paint.",
    "Sand back to clean metal.",
    "Spot-prime with a rust inhibitor.",
    "Touch up with finish coats.",
  ],
  SW: [
    "Clean the worn area.",
    "Sand and prepare the surface.",
    "Prime the bare areas.",
    "Apply a hard-wearing finish coat.",
  ],
  HC: [
    "Clean and prepare the area.",
    "Fill the cracks with a flexible filler.",
    "Shape smooth with the surface.",
    "Prime and paint to match.",
  ],
};

/** The standard steps as editor HTML (one paragraph per step). */
export const methodHtml = (code: string) => (METHODS[code] ?? []).map((s) => `<p>${s}</p>`).join("");

/** A code's steps for this proposal: its override, else the standard. */
export function methodSteps(p: Proposal, code: string): string[] {
  const own = p.d.findings.methods?.[code];
  const items = own ? richItems(own) : [];
  return items.length ? items : (METHODS[code] ?? []);
}
