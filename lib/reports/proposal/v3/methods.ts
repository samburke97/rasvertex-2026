// lib/reports/proposal/v3/methods.ts
//
// Remedial work methodologies: the standard "How we fix it" steps for each
// defect code, shown once per code group on the report-style findings pages
// of the painting and waterproofing proposals (not the inspection report).
// A proposal can override a code's steps (findings.methods[code]); clearing
// the override brings the standard back.

import { richItems } from "./rich";
import type { Proposal } from "./types";

export const METHODS: Record<string, string[]> = {
  SH: [
    "Assess and identify the safety hazard.",
    "Make the affected area safe.",
    "Carry out necessary repairs or replacements.",
    "Complete a final safety inspection.",
  ],
  SP: [
    "Remove all loose and deteriorated material.",
    "Clean and treat exposed reinforcement steel.",
    "Reinstate using suitable repair mortar.",
    "Apply protective coatings once cured.",
  ],
  CO: [
    "Remove rust and loose coatings.",
    "Mechanically prepare affected surfaces.",
    "Apply rust-inhibiting primer.",
    "Apply protective finish coats.",
  ],
  SC: [
    "Inspect and assess the affected area.",
    "Prepare and repair cracks using an approved system.",
    "Reinstate damaged surrounding surfaces.",
    "Apply compatible protective coatings.",
  ],
  WI: [
    "Investigate and identify the source of water ingress.",
    "Rectify failed seals, joints or waterproofing.",
    "Repair water-damaged surfaces.",
    "Reinstate protective coatings and finishes.",
  ],
  RC: [
    "Rake out cracks and remove loose material.",
    "Fill using suitable flexible repair compound.",
    "Sand and reinstate the render finish.",
    "Prime and apply exterior finish coats.",
  ],
  DR: [
    "Identify and mark all drummy areas.",
    "Remove loose render back to sound substrate.",
    "Reinstate using compatible render materials.",
    "Prime and repaint repaired areas.",
  ],
  SF: [
    "Remove all failed or deteriorated sealant.",
    "Clean and prepare affected joints.",
    "Install backing rod where required.",
    "Apply new flexible exterior-grade sealant.",
  ],
  LF: [
    "Inspect and identify defective fixings.",
    "Remove loose or deteriorated fixings.",
    "Install suitable replacement fixings.",
    "Seal and protect disturbed surfaces.",
  ],
  WS: [
    "Remove failed perimeter sealant.",
    "Clean and prepare affected surfaces.",
    "Apply new exterior-grade window sealant.",
    "Tool off to provide a neat, watertight finish.",
  ],
  FL: [
    "Inspect affected flashing and junctions.",
    "Repair or replace defective sections.",
    "Reinstate correct overlaps and connections.",
    "Seal joints and reinstate surrounding finishes.",
  ],
  BL: [
    "Inspect posts, fixings and connections.",
    "Remove corrosion and failed coatings.",
    "Repair or replace defective components.",
    "Apply suitable protective coatings.",
  ],
  RM: [
    "Inspect membrane for damage or deterioration.",
    "Remove defective membrane sections.",
    "Reinstate using compatible waterproofing products.",
    "Inspect and test completed repairs.",
  ],
  PW: [
    "Identify areas of standing water.",
    "Clear outlets and check drainage.",
    "Rectify low points and surface falls.",
    "Reinstate waterproofing where required.",
  ],
  BD: [
    "Remove leaves, debris and sediment.",
    "Flush gutters and drainage outlets.",
    "Repair defective joints and connections.",
    "Test water flow to confirm clear drainage.",
  ],
  HC: [
    "Clean and prepare the affected surface.",
    "Fill cracks using suitable repair compound.",
    "Sand smooth and feather surrounding edges.",
    "Prime and apply matching finish coats.",
  ],
  CD: [
    "Scrape back all loose and peeling paint.",
    "Sand and prepare exposed surfaces.",
    "Apply suitable primer or sealer.",
    "Apply specified finish coats.",
  ],
  RS: [
    "Remove surface rust and loose paint.",
    "Sand and clean affected areas.",
    "Apply suitable rust-inhibiting primer.",
    "Apply protective finish coats.",
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
