// lib/reports/proposal.print.ts
//
// Print HTML builder for the Proposal report. Unlike condition/anchor/hours
// (each page a fixed 210mm x 297mm div, manually paginated in JS), this
// design is a continuous scrolling document — relies on Chrome's native
// print pagination (page.pdf({format:"A4"}) in pdf-utils.ts) — but it's a
// deliberately FIXED page structure, not free-flowing: every logical
// section starts a fresh page (break-before:page), except a small number
// of pairs that are meant to share one page by design (Your Project +
// Access & Disruption Plan; Your Project Team + 8-Year Warranty; Who We Are
// + Insurance & Compliance). Continuous flow was tried and rejected — a
// heading with no guaranteed room for its content can still get stranded
// alone at the bottom of a page with its content starting flush at the top
// of the next one, which reads as broken no matter how generous the page
// margin is. Forcing a fresh page per section avoids that class of bug
// entirely: a section's heading and its content are always on the same
// page it started on.
//
// IMPORTANT — CSS Grid does not fragment across printed pages in Chromium:
// a `display:grid` container is treated as one atomic block, so if it
// doesn't fit in the remaining space on a page it gets pushed whole to the
// next one (this is what caused the Appendix and Your Project Team to
// strand their heading alone on a page during the flowing-document attempt).
// Even with fixed pages, any block that could plausibly outgrow one page
// (Site Survey & Findings photo cards, Appendix columns) still uses floated
// columns instead of grid, since floats fragment correctly if content ever
// runs long. Fixed, small, non-repeating layouts (e.g. the 4-stat grids
// nested inside an already-atomic card) are fine as CSS Grid.
//
// Fixed company content (team, recent projects, why-our-prep, warranty,
// who-we-are, insurance stats, appendix T&Cs) is baked in here as static
// HTML, not driven by ProposalData — see the approved plan. Only the
// genuinely job-specific sections read from `report`.
//
// Page map:
//   1  Cover
//   2  Table of Contents + "Higher Standards" mark
//   3  Cover Letter
//   4  Your Project + Access & Disruption Plan
//   5  Site Survey & Findings
//   6  Project Scope: Inclusions & Exclusions
//   7  Why Our Prep Is Different + 8-Year Warranty
//   8  Your Project Team
//   9  Pricing
//   10 Acceptance
//   11 Recent Projects
//   12 Client Testimonial
//   13 Who We Are + Insurance & Compliance
//   14 Appendix A — Terms & Conditions
//   15 WorkCover Certificate of Currency
//   16 Public Liability Certificate of Currency

import {
  type ProposalData,
  type ProposalSectionToggles,
  colorForStage,
  pricingSubtotal,
  pricingGst,
  pricingTotal,
} from "./proposal.types";
import {
  DEFAULT_PRINT_ASSETS,
  buildPrintFontFaceCSS,
  type ReportAssets,
} from "./print-shared";

const NAVY = "#011955";
const NAVY_DARK = "#010f3a";
const RED = "#c7242e";
const BURGUNDY = "#6b1f24";
const PALE_BLUE = "#deeeff";
// Always the company number, never per-salesperson — see proposal.types.ts.
const COMPANY_PHONE = "07 5371 0201";
const COMPANY_PHONE_TEL = "0753710201";

function esc(str: string | number | null | undefined): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Bracket-style placeholder fallback — unfilled fields still read as the template. */
function f(value: string | undefined | null, placeholder: string): string {
  return esc(value?.trim() ? value : placeholder);
}

function money(n: number): string {
  return n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Section builders ─────────────────────────────────────────────────────────

// `position:sticky` only repeats an element across a scrolling browser
// viewport — Chromium's print pagination doesn't replicate it per physical
// page, so a sticky bar rendered once in the document body only ever shows
// up on whichever single page it happens to land on. The old nav-logo
// sticky bar was dropped for this reason; the rasvertex.com.au mark now
// lives inline on the Cover Letter page only — see buildCoverLetter below.

// ── Page 1: Cover ──────────────────────────────────────────────────────────

function buildCover(report: ProposalData, a: ReportAssets): string {
  const j = report.job;
  const coverPhoto = report.photos.find((p) => p.id === j.sitePhotoId)?.url;
  return `
  <section id="sec-01" style="padding:64px 48px 56px;">
    <div style="max-width:1400px;margin:0 auto;">
      <img src="${esc(a.proposal.navLogo)}" alt="RAS-VERTEX" style="height:40px;width:auto;margin-bottom:40px;">
      <div>
        <h1 style="font-size:clamp(2.75rem,6vw,5.25rem);font-weight:700;line-height:1.05;letter-spacing:-0.06em;margin:0;color:${NAVY};">${f(j.buildingName, "[Building Name]")}.</h1>
        <p style="font-size:1.375rem;color:rgba(1,25,85,0.65);max-width:640px;margin:20px 0 0;font-weight:400;">${f(j.siteAddress, "[Full site address]")}, prepared for ${f(j.clientName, "[Client / Body Corporate Name]")}, attention ${f(j.contactName, "[Contact Name]")}.</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:32px;">
        ${[
          ["Date", f(j.date, "[DD Month YYYY]")],
          ["Proposal Ref.", f(j.quoteId, "[RV-0000]")],
          ["QBCC Licence", "1307234"],
          ["ABN", "53 167 652 637"],
        ]
          .map(
            ([label, value]) => `
        <div style="background:rgba(1,25,85,0.045);border-radius:12px;padding:14px 18px;">
          <div style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(1,25,85,0.45);white-space:nowrap;">${label}</div>
          <div style="font-size:1rem;font-weight:700;letter-spacing:-0.01em;margin-top:6px;white-space:nowrap;">${value}</div>
        </div>`,
          )
          .join("")}
      </div>

      <div style="position:relative;width:100%;aspect-ratio:16/9;border-radius:24px;overflow:hidden;margin-top:32px;background:${PALE_BLUE};break-inside:avoid;">
        ${coverPhoto ? `<img src="${esc(coverPhoto)}" alt="Site photo" style="width:100%;height:100%;object-fit:cover;">` : ""}
      </div>

      <p style="font-size:0.875rem;color:rgba(1,25,85,0.45);margin-top:20px;">Prepared by ${f(j.preparedByName, "[Project Manager Name]")}, RAS-VERTEX Maintenance Solutions, Sunshine Coast.</p>

      <div style="display:flex;align-items:flex-start;gap:9px;margin-top:24px;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="${NAVY}" style="flex-shrink:0;margin-top:1px;"><path d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.97h3.86c2.26-2.09 3.56-5.17 3.56-8.79zM12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.97c-1.07.71-2.44 1.14-4.07 1.14-3.13 0-5.78-2.11-6.73-4.96H1.27v3.06C3.24 21.3 7.26 24 12 24zM5.27 14.3c-.24-.71-.38-1.46-.38-2.3s.14-1.59.38-2.3V6.64H1.27A11.95 11.95 0 0 0 0 12c0 1.93.46 3.76 1.27 5.36l4-3.06zM12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.26 0 3.24 2.7 1.27 6.64l4 3.06C6.22 6.86 8.87 4.75 12 4.75z"></path></svg>
        <div style="display:flex;flex-direction:column;gap:2px;">
          <span style="font-size:0.875rem;font-weight:600;color:${NAVY};">Google Rating</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="font-size:1.0625rem;font-weight:700;color:${NAVY};line-height:1;">4.9</span>
            <div style="display:flex;align-items:center;">
              ${Array.from({ length: 5 }).map(() => `<svg width="15" height="15" viewBox="0 0 24 24" fill="${NAVY}" style="margin-left:-2px;"><path d="M12 2.5l2.97 6.02 6.64.97-4.8 4.68 1.13 6.6L12 17.6l-5.94 3.17 1.13-6.6-4.8-4.68 6.64-.97L12 2.5z"></path></svg>`).join("")}
            </div>
          </div>
          <span style="font-size:0.6875rem;letter-spacing:0.12em;text-transform:uppercase;color:rgba(1,25,85,0.45);">Based on 50+ reviews</span>
        </div>
      </div>
    </div>
  </section>`;
}

// ── Page 2: Table of Contents + Higher Standards mark ───────────────────────

const TOC_ENTRIES: [string, string][] = [
  ["sec-02", "Introduction"],
  ["sec-03", "Your Project"],
  ["sec-06", "Access & Disruption Plan"],
  ["sec-04", "Site Survey & Findings"],
  ["sec-05", "Project Scope: Inclusions & Exclusions"],
  ["sec-09", "Why Our Prep Is Different"],
  ["sec-08", "8-Year Warranty"],
  ["sec-10", "Your Project Team"],
  ["sec-07", "Pricing"],
  ["sec-16", "Acceptance"],
  ["sec-11", "Recent Projects"],
  ["sec-12", "Client Testimonial"],
  ["sec-services-support", "Other Services & Support Plans"],
  ["sec-14", "Who We Are"],
  ["sec-15", "Insurance & Compliance"],
  ["sec-appendix-a", "Appendix A — Terms & Conditions"],
  ["sec-cert-workcover", "WorkCover Certificate of Currency"],
  ["sec-cert-liability", "Public Liability Certificate of Currency"],
];


const TOC_SECTION_TOGGLE: Record<string, keyof ProposalSectionToggles> = {
  "sec-04": "findings",
  "sec-05": "scope",
  "sec-06": "accessPlan",
  "sec-07": "pricing",
};

// The printed PDF is two separate documents stitched together (see the
// "Main export" section below) — front matter (Cover, Contents, Cover
// Letter) carries no footer page number at all, and the numbered document
// starts its own count fresh at 1 from "Your Project". This mirrors that
// exactly rather than falling back to each section's own "sec-NN" id, which
// no longer lines up with any real printed page number now that front
// matter is unnumbered and the rest restarts from 1. Nominal — assumes no
// section's content grows past one page (e.g. a very long Scope list still
// fragments onto extra pages of its own; the numbers below don't shift to
// account for that, same accepted approximation as before).
const NUMBERED_PAGE: Record<string, number> = {
  "sec-03": 1,
  "sec-10": 1,
  "sec-06": 2,
  "sec-04": 3,
  "sec-05": 4,
  "sec-09": 5,
  "sec-08": 5,
  "sec-07": 6,
  "sec-16": 7,
  "sec-11": 8,
  "sec-12": 9,
  "sec-services-support": 10,
  "sec-14": 11,
  "sec-15": 11,
};

function buildTableOfContents(report: ProposalData): string {
  const entries = TOC_ENTRIES.filter(([id]) => {
    const toggle = TOC_SECTION_TOGGLE[id];
    return !toggle || report.sections[toggle];
  });

  const row = ([id, label]: [string, string]) => {
    // sec-02 (Cover Letter) is front matter — no page number, same as
    // Cover/Contents themselves and the two certificate pages.
    const num = id.startsWith("sec-cert-") || id === "sec-02"
      ? ""
      : id === "sec-appendix-a"
        ? "A"
        : String(NUMBERED_PAGE[id] ?? "");
    return `
        <a href="#${id}" style="display:flex;align-items:baseline;gap:20px;padding:14px 0;text-decoration:none;color:${NAVY};break-inside:avoid;">
          <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:1rem;color:rgba(1,25,85,0.35);width:28px;flex-shrink:0;">${esc(num)}</span>
          <span style="font-size:1.0625rem;">${esc(label)}</span>
        </a>`;
  };
  const half = Math.ceil(entries.length / 2);
  const col1 = entries.slice(0, half).map(row).join("");
  const col2 = entries.slice(half).map(row).join("");

  return `
  <section id="sec-toc" style="padding:96px 48px 48px;break-before:page;min-height:100vh;box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="max-width:1400px;margin:0 auto;width:100%;flex:1;display:flex;flex-direction:column;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 40px;break-after:avoid;">Contents</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 10px;">
        <div>${col1}</div>
        <div>${col2}</div>
      </div>
      <div style="overflow:hidden;margin-top:auto;">
        <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:clamp(3.5rem,16vw,19rem);line-height:0.85;letter-spacing:-0.05em;color:#eef0f5;white-space:nowrap;display:block;margin-left:-0.05em;">HIGHER STANDARDS.</span>
      </div>
    </div>
  </section>`;
}

// ── Page 3: Cover Letter ─────────────────────────────────────────────────────

function buildCoverLetter(report: ProposalData, a: ReportAssets): string {
  const j = report.job;
  return `
  <section id="sec-02" style="padding:96px 48px;break-before:page;position:relative;">
    <img src="${esc(a.linkBlue)}" alt="rasvertex.com.au" style="position:absolute;top:48px;right:48px;height:19px;width:auto;">
    <div style="max-width:680px;margin:0 auto;">
      <p style="font-size:0.9375rem;color:rgba(1,25,85,0.55);margin:0 0 40px;">${f(j.date, "[DD Month YYYY]")}</p>
      <p style="font-size:1.0625rem;margin:0 0 24px;">Dear ${f(j.contactName, "[Client First Name]")},</p>
      <p style="font-size:1.0625rem;margin:0 0 24px;">Thank you for the opportunity to quote on the external repaint and remedial works at ${f(j.buildingName, "[Building Name]")}. I walked the site personally on ${f(j.inspectionDate, "[inspection date]")}. This proposal reflects exactly what I found there, not a generic scope pulled from a template.</p>
      <p style="font-size:1.0625rem;margin:0 0 24px;">Every trade on this job (painters, waterproofers and our remedial/concrete team) is directly employed under our own licence, run by one project manager from first site visit to warranty sign off. It's the same crew, whatever comes up mid-job.</p>
      <p style="font-size:1.0625rem;margin:0 0 24px;">Every RAS-VERTEX repaint carries our 8-year written workmanship warranty as standard, with no maintenance contract required to unlock it.</p>
      <p style="font-size:1.0625rem;margin:0 0 40px;">Any questions at all, call or text me directly on ${esc(COMPANY_PHONE)}. I'll pick up.</p>
      <p style="font-family:'Caveat','Brush Script MT',cursive;font-size:2.25rem;color:${NAVY};margin:0 0 2px;">${f(j.preparedByName, "[Project Manager Name]")}</p>
      <p style="font-size:1.0625rem;margin:0;font-weight:700;">${f(j.preparedByName, "[Project Manager Name]")}<br><span style="font-weight:400;color:rgba(1,25,85,0.65);">Project Manager, RAS-VERTEX</span></p>
    </div>
  </section>`;
}

// ── Page 4: Your Project + Access & Disruption Plan ─────────────────────────

function buildYourProject(report: ProposalData): string {
  const j = report.job;
  const conditionSummary = j.conditionSummary?.trim()
    ? esc(j.conditionSummary)
    : `Our site walk identified [key condition summary, e.g. coastal chalking, cracking to the north stair core, overgrown vegetation at ground-floor access points].`;
  return `
  <section id="sec-03" style="padding:72px 48px 32px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 20px;break-after:avoid;">Your Project</h2>
      <div style="background:rgba(1,25,85,0.035);border-radius:32px;padding:36px;break-inside:avoid;">
        <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:760px;margin:0;">${f(j.buildingName, "[Building Name]")} sits ${f(j.distanceFromCoast, "[distance from coastline]")} from the water at ${f(j.siteAddress, "[address]")}, which means salt air and UV exposure drive how we've specified this job. ${conditionSummary} ${f(j.accessConstraint, "[Access constraint, e.g. limited car parking, no scaffold permits available]")} is exactly why rope access, not scaffolding, suits this site.</p>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(1,25,85,0.15);margin-top:40px;">
          ${[
            ["Building Type", f(j.buildingType, "[Type, e.g. residential high-rise]")],
            ["Storeys", f(j.storeys, "[N]")],
            ["Access Method", "Rope access"],
            ["Target Start", f(j.targetStart, "[Month YYYY]")],
          ]
            .map(
              ([label, value], i) => `
          <div style="padding:20px ${i < 3 ? "20px" : "0"} 0 ${i > 0 ? "20px" : "0"};${i < 3 ? "border-right:1px solid rgba(1,25,85,0.15);" : ""}break-inside:avoid;">
            <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(1,25,85,0.45);">${label}</div>
            <div style="font-size:1.125rem;font-weight:700;margin-top:6px;">${value}</div>
          </div>`,
            )
            .join("")}
        </div>
      </div>
    </div>
  </section>`;
}

function buildAccessPlan(report: ProposalData): string {
  const stages = report.accessPlan.stages.length ? report.accessPlan.stages : [];
  const zones = report.accessPlan.zones.filter((z) => z.map.imageUrl);
  const multiZone = zones.length > 1;

  // Every point across every zone, keyed by stage — each entry keeps its
  // own zone-relative pin number (and colour) so the stage cards below can
  // show a real numbered badge, not just a count.
  type StagedPoint = { zoneName: string; number: number; note: string; color: string };
  const pointsByStage = new Map<string, StagedPoint[]>();
  const unassigned: StagedPoint[] = [];
  for (const zone of report.accessPlan.zones) {
    zone.map.points.forEach((p, i) => {
      const entry: StagedPoint = {
        zoneName: zone.name,
        number: i + 1,
        note: p.note,
        color: colorForStage(p.stageId, stages),
      };
      if (!p.stageId) {
        unassigned.push(entry);
        return;
      }
      if (!pointsByStage.has(p.stageId)) pointsByStage.set(p.stageId, []);
      pointsByStage.get(p.stageId)!.push(entry);
    });
  }

  const pointBadge = (p: StagedPoint) => `
          <div style="display:flex;align-items:flex-start;gap:8px;break-inside:avoid;">
            <span style="flex-shrink:0;width:18px;height:18px;border-radius:50%;background:${p.color};color:#fff;font-size:0.625rem;font-weight:700;display:flex;align-items:center;justify-content:center;margin-top:1px;">${p.number}</span>
            <span style="font-size:0.8125rem;color:rgba(1,25,85,0.65);">${multiZone ? `<strong style="color:rgba(1,25,85,0.85);">${esc(p.zoneName)}:</strong> ` : ""}${esc(p.note) || "&nbsp;"}</span>
          </div>`;

  const zoneHTML = zones
    .map(
      (zone) => `
      <div style="margin-top:32px;break-inside:avoid;">
        ${multiZone ? `<div style="font-size:1rem;font-weight:700;margin-bottom:12px;">${esc(zone.name)}</div>` : ""}
        <div style="position:relative;width:100%;aspect-ratio:${zone.map.imageRatio ?? 8 / 5};border-radius:16px;overflow:hidden;background:${PALE_BLUE};">
          <img src="${esc(zone.map.imageUrl!)}" alt="Site aerial with drop points" style="width:100%;height:100%;object-fit:contain;">
          ${zone.map.points
            .map(
              // Centred via negative margin, not `transform:translate(-50%,-50%)` —
              // Chromium's print/PDF rasteriser has a known bug where box-shadow on a
              // border-radius:50% element stops being clipped to the circle once a
              // transform is also present, rendering as a grey square behind the pin
              // instead of a soft round shadow. Only shows up in the printed PDF, not
              // on-screen — the live editor's own pin CSS already avoids transform for
              // the same reason (AccessMapEditor.module.css's .pin uses margin-left/-top).
              (p, i) => `
          <div style="position:absolute;left:calc(${p.x}% - 13px);top:calc(${p.y}% - 13px);width:26px;height:26px;border-radius:50%;background:${colorForStage(p.stageId, stages)};color:#fff;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">${i + 1}</div>`,
            )
            .join("")}
        </div>
      </div>`,
    )
    .join("");

  return `
  <section id="sec-06" style="padding:96px 48px 72px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 20px;break-after:avoid;">Access &amp; Disruption Plan</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:760px;margin:0 0 32px;">Rope access is our real structural advantage over most competitors: no scaffolding, no blocked car parks, no scaffold permits. On most buildings, we're on site the same day.</p>

      ${zoneHTML}

      <div style="margin-top:32px;">
        ${(() => {
          const n = Math.max(stages.length, 1);
          const gap = 16;
          return stages
            .map(
              (s, i) => `
        <div style="float:left;width:calc((100% - ${gap * (n - 1)}px) / ${n});margin-right:${i === stages.length - 1 ? "0" : `${gap}px`};box-sizing:border-box;background:#ffffff;border:1px solid rgba(1,25,85,0.12);border-radius:16px;padding:24px;break-inside:avoid;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(1,25,85,0.45);">${esc(s.label)}</div>
          <div style="font-size:1rem;font-weight:700;margin-top:8px;">${esc(s.description)}</div>
          ${
            pointsByStage.get(s.id)?.length
              ? `<div style="display:flex;flex-direction:column;gap:6px;margin-top:12px;">${pointsByStage
                  .get(s.id)!
                  .map(pointBadge)
                  .join("")}</div>`
              : ""
          }
        </div>`,
            )
            .join("");
        })()}
        <div style="clear:both;"></div>
      </div>

      ${
        unassigned.length
          ? `
      <div style="margin-top:24px;break-inside:avoid;">
        <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(1,25,85,0.45);margin-bottom:10px;">Unassigned drop points</div>
        <div style="display:flex;flex-direction:column;gap:6px;">${unassigned.map(pointBadge).join("")}</div>
      </div>`
          : ""
      }
    </div>
  </section>`;
}

// ── Page 5: Site Survey & Findings ───────────────────────────────────────────

function buildFindings(report: ProposalData): string {
  const findings = report.findings.slice(0, 6);
  const photoById = new Map(report.photos.map((p) => [p.id, p]));
  const cells = (findings.length ? findings : Array.from({ length: 3 }).map((_, i) => ({
    id: `placeholder-${i}`,
    photoId: null,
    title: "[Defect, location]",
    description: "[What this means for the scope of works]",
  }))).map((find, i) => {
    const photo = find.photoId ? photoById.get(find.photoId) : null;
    // Floated (not grid) so Chromium's print engine can fragment the card
    // grid across pages — CSS Grid renders as one atomic block and won't
    // break, which matters once this list grows to dozens of photos.
    const marginRight = i % 3 !== 2 ? "32px" : "0";
    return `
        <div style="float:left;width:calc((100% - 64px) / 3);margin:0 ${marginRight} 32px 0;break-inside:avoid;">
          <div style="width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:rgba(1,25,85,0.08);">
            ${photo ? `<img src="${esc(photo.url)}" alt="${esc(find.title)}" style="width:100%;height:100%;object-fit:cover;">` : ""}
          </div>
          <div style="margin-top:16px;">
            <p style="font-weight:700;font-size:1rem;margin:0 0 4px;">${String(i + 1).padStart(2, "0")}. ${esc(find.title) || "[Defect, location]"}</p>
            <p style="font-size:0.875rem;color:rgba(1,25,85,0.6);margin:0;">${esc(find.description) || "[What this means for the scope of works]"}</p>
          </div>
        </div>`;
  }).join("");

  return `
  <section id="sec-04" style="padding:72px 48px 40px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 20px;break-after:avoid;">Site Survey &amp; Findings</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:760px;margin:0 0 40px;">We don't quote from a desk. ${f(report.job.preparedByName, "[Project Manager Name]")} inspected ${f(report.job.buildingName, "[Building Name]")} on ${f(report.job.inspectionDate, "[inspection date]")}. Here's exactly what was found, and what it means for the job.</p>
      <div>${cells}<div style="clear:both;"></div></div>
    </div>
  </section>`;
}

// ── Page 6: Project Scope ────────────────────────────────────────────────────

function scopeIconHTML(kind: "plus" | "cross", a: ReportAssets): string {
  const src = kind === "plus" ? a.proposal.iconPlus : a.proposal.iconCross;
  return `<img src="${esc(src)}" width="18" height="18" alt="" style="flex-shrink:0;margin-top:2px;" />`;
}

function buildScope(report: ProposalData, a: ReportAssets): string {
  const included = report.scope.included.length
    ? report.scope.included
    : ["Full pressure clean of all painted & rendered surfaces", "Crack injection & substrate repair, up to [X] linear metres", "2-coat premium coating system: Haymes / Dulux coastal grade", "Rope access: no scaffold, no blocked car parks", "Full site clean-up & waste removal on completion"];
  const excluded = report.scope.excluded.length
    ? report.scope.excluded
    : ["Internal painting or works of any kind", "[Optional item, e.g. roof recoat], priced separately, see Item 2", "Structural or engineering-certified remedial work", "Permit & council fees, if required for this site"];

  const list = (items: string[], kind: "plus" | "cross", dim: boolean) => `
      <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:16px;">
        ${items
          .map(
            (item) => `
        <li style="display:flex;gap:12px;align-items:flex-start;break-inside:avoid;">
          ${scopeIconHTML(kind, a)}
          <span style="font-size:1rem;line-height:1.5;${dim ? `color:rgba(1,25,85,0.65);` : ""}">${esc(item)}</span>
        </li>`,
          )
          .join("")}
      </ul>`;

  // Floated (not grid) — CSS Grid renders as one atomic, non-fragmenting
  // block in Chromium's print engine: a grid box taller than the page
  // doesn't paginate, it overlaps the footer and continues past the page
  // boundary uncontrolled (see the top-of-file note on Appendix/Findings
  // for the same class of bug). Two independently floated cards paginate
  // as ordinary block flow if either one ever runs long.
  // No break-inside:avoid here (deliberately) — that forces the *whole*
  // card to jump to the next page the moment it's taller than whatever
  // space is left, which is what stranded page 1 with nothing but the
  // title under it: a 16-item card doesn't fit in the leftover space below
  // a heading, so the entire thing got pushed to page 2. Individual <li>s
  // still carry their own break-inside:avoid (in `list()` above), so a
  // single item's icon+text never splits — only the card as a whole is
  // free to fragment, exactly like Appendix's floated columns.
  const card = (title: string, items: string[], kind: "plus" | "cross", dim: boolean, last: boolean) => `
      <div style="float:left;width:calc(50% - 5px);${last ? "" : "margin-right:10px;"}background:#ffffff;border:1px solid rgba(1,25,85,0.12);border-radius:20px;padding:36px 40px;">
        <h3 style="font-size:1.375rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0 0 20px;">${title}</h3>
        ${list(items, kind, dim)}
      </div>`;

  // No hard split — the full Included list renders in one card and, if
  // it's taller than one page, fragments naturally onto as many further
  // pages as it needs (real Chromium print layout deciding, not a guess).
  // There's no "(cont.)" heading on those overflow pages: Chromium's print
  // engine doesn't implement CSS Paged Media's running-header machinery
  // (string-set etc.), so there's no reliable way to inject one at
  // wherever content happens to break — same trade-off Appendix already
  // makes elsewhere in this file. A tool built on the full Paged Media
  // spec (e.g. Paged.js) could add that back; not worth pulling in for
  // one page today.
  return `
  <section id="sec-05" style="padding:72px 48px 40px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 32px;break-after:avoid;">Project Scope: Inclusions &amp; Exclusions</h2>
      <div>
        ${card("Included", included, "plus", false, false)}
        ${card("Excluded", excluded, "cross", true, true)}
        <div style="clear:both;"></div>
      </div>
    </div>
  </section>`;
}

// ── Page 7: Why Our Prep Is Different ────────────────────────────────────────

function buildWhyPrepDifferent(a: ReportAssets): string {
  const cards = [
    {
      n: "01",
      title: "We repair before we coat.",
      body: "Cracks and substrate defects get repaired properly before any coating goes on — never a patch job. Our painters, waterproofers and remedial teams are all direct employees under one licence, so whatever turns up mid-job is fixed to spec by our own crew, not a subbie.",
      img: a.proposal.whyPrep1,
    },
    {
      n: "02",
      title: "Coastal systems, not generic ones.",
      body: "Salt air, UV and humidity behave differently within 5km of the water, so our coating systems and prep are specified for that exposure — not the same system regardless of where the building sits.",
      img: a.proposal.whyPrep2,
    },
  ];
  return `
  <section id="sec-09" style="padding:64px 48px 32px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 28px;break-after:avoid;">Why Our Prep Is Different</h2>
      <div>
        ${cards
          .map(
            (c, i) => `
        <div style="float:left;width:calc(50% - 5px);margin-right:${i === 0 ? "10px" : "0"};break-inside:avoid;">
          <div style="width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:rgba(1,25,85,0.08);">
            <img src="${esc(c.img)}" alt="" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;margin-top:24px;">
            <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:1.25rem;letter-spacing:0.05em;color:rgba(1,25,85,0.4);">${c.n}</span>
            <h3 style="font-size:1.5rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0;">${c.title}</h3>
            <p style="font-size:1.0625rem;color:rgba(1,25,85,0.6);margin:0;">${c.body}</p>
          </div>
        </div>`,
          )
          .join("")}
        <div style="clear:both;"></div>
      </div>
    </div>
  </section>`;
}

// ── Page 8: Your Project Team + 8-Year Warranty ─────────────────────────────

function buildProjectTeam(report: ProposalData, a: ReportAssets): string {
  const j = report.job;
  const avatar = (initials: string, photo?: string) =>
    photo
      ? `
        <div style="width:96px;height:96px;border-radius:18px;overflow:hidden;">
          <img src="${esc(photo)}" alt="" style="width:100%;height:100%;object-fit:cover;">
        </div>`
      : `
        <div style="width:96px;height:96px;border-radius:18px;background:${PALE_BLUE};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',Arial,sans-serif;font-size:2.25rem;color:${NAVY};letter-spacing:0.05em;">${esc(initials)}</div>`;
  return `
  <section id="sec-10" style="padding:32px 48px 48px;break-inside:avoid;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 12px;break-after:avoid;">Your Team</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:640px;margin:0 0 24px;">One phone number, one face, accountable from quote to sign-off.</p>
      <div>
        <div style="float:left;width:calc((100% - 80px) / 3);margin-right:40px;break-inside:avoid;">
          ${avatar(f(j.preparedByName, "PM").slice(0, 2).toUpperCase())}
          <div style="margin-top:14px;">
            <p style="font-weight:700;font-size:1.0625rem;margin:0;">${f(j.preparedByName, "[Project Manager Name]")}</p>
            <p style="font-size:0.9375rem;color:rgba(1,25,85,0.55);margin:4px 0 0;">Project Manager, on site from first visit to sign-off</p>
          </div>
        </div>
        <div style="float:left;width:calc((100% - 80px) / 3);margin-right:40px;break-inside:avoid;">
          ${avatar("PC")}
          <div style="margin-top:14px;">
            <p style="font-weight:700;font-size:1.0625rem;margin:0;">Phil Clark</p>
            <p style="font-size:0.9375rem;color:rgba(1,25,85,0.55);margin:4px 0 0;">Founder, Height Safety &amp; Rope Access</p>
          </div>
        </div>
        <div style="float:left;width:calc((100% - 80px) / 3);break-inside:avoid;">
          ${avatar("CP")}
          <div style="margin-top:14px;">
            <p style="font-weight:700;font-size:1.0625rem;margin:0;">Caroline Park</p>
            <p style="font-size:0.9375rem;color:rgba(1,25,85,0.55);margin:4px 0 0;">Client Support, in the office for job updates &amp; scheduling</p>
          </div>
        </div>
        <div style="clear:both;"></div>
      </div>
      <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(1,25,85,0.12);">
        <p style="font-size:1rem;margin:0;">Direct line: <a href="tel:${COMPANY_PHONE_TEL}" style="font-weight:700;color:${NAVY};">${esc(COMPANY_PHONE)}</a> &nbsp;&middot;&nbsp; <a href="mailto:${esc(j.preparedByEmail)}" style="font-weight:700;color:${NAVY};">${f(j.preparedByEmail, "[email address]")}</a></p>
      </div>
    </div>
  </section>`;
}

function buildWarranty(a: ReportAssets): string {
  return `
  <section id="sec-08" style="padding:0 48px 64px;">
    <div style="max-width:1400px;margin:0 auto;">
      <div style="background:${PALE_BLUE};border-radius:24px;padding:40px;display:flex;flex-direction:column;gap:24px;break-inside:avoid;">
        <div style="display:flex;align-items:flex-end;gap:10px;">
          <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:clamp(4rem,6vw,5rem);letter-spacing:-0.04em;color:${NAVY};line-height:0.85;">8</span>
          <span style="font-size:0.75rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(1,25,85,0.65);line-height:1.4;">Year<br>Warranty</span>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <h2 style="font-size:clamp(1.25rem,2vw,1.625rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0;break-after:avoid;">Standing by our team, and our products.</h2>
          <p style="font-size:0.875rem;color:rgba(1,25,85,0.65);margin:0;">Most workmanship warranties in this industry run two to five years, often with a catch: an ongoing paid maintenance contract. Every RAS-VERTEX repaint carries an 8-year written workmanship warranty as standard — no contract to sign, no conditions attached.</p>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <h3 style="font-size:1rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0;">Backed by the best.</h3>
          <div style="display:flex;align-items:center;gap:18px;">
            <img src="${esc(a.associations.haymes)}" alt="Haymes Paint" style="height:22px;width:auto;object-fit:contain;">
            <img src="${esc(a.proposal.dulux)}" alt="Dulux" style="height:18px;width:auto;object-fit:contain;">
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

// ── Page 9: Pricing ──────────────────────────────────────────────────────────

function buildPricing(report: ProposalData): string {
  const items = report.pricing.items;
  const subtotal = pricingSubtotal(items);
  const gst = pricingGst(items);
  const total = pricingTotal(items);
  const rows = items.length
    ? items
    : [{ id: "1", groupLabel: "", label: "Item 1: External Repaint", amountExTax: 0, source: "manual" as const }];

  // Group by cost centre (groupLabel) in first-seen order — SimPRO imports
  // carry one groupLabel per cost centre so its line items render together
  // as a labeled table with their own subtotal; manually-added rows have no
  // groupLabel and render as a flat, ungrouped list (the common single-item
  // case, and the pre-grouping default look).
  const order: string[] = [];
  const groups = new Map<string, typeof rows>();
  for (const item of rows) {
    const key = item.groupLabel || "";
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(item);
  }

  // Flat rows throughout — no boxed/background cards around cost-centre
  // groups. A group's name renders as a plain bold row with its own
  // subtotal, styled exactly like every other row, just bold; its line
  // items follow directly underneath with the same border-top divider as
  // everything else. Matches the source design's plain repeating-row list.
  // The very first row of the whole table skips its border-top — right
  // under the heading it just reads as a redundant extra rule.
  const itemRow = (item: (typeof rows)[number], borderTop: boolean) => `
        <div style="display:grid;grid-template-columns:1fr auto;padding:20px 0;${borderTop ? "border-top:1px solid rgba(1,25,85,0.15);" : ""}break-inside:avoid;">
          <span style="font-size:1.0625rem;">${esc(item.label)}</span>
          <span style="font-size:1.0625rem;font-weight:600;">$${money(item.amountExTax)}</span>
        </div>`;

  const showLineItems = report.pricing.showLineItems;
  let isFirstRow = true;
  const takeFirst = () => {
    const wasFirst = isFirstRow;
    isFirstRow = false;
    return wasFirst;
  };

  const groupsHtml = order
    .map((key) => {
      const groupItems = groups.get(key)!;
      if (!key) {
        return groupItems.map((item) => itemRow(item, !takeFirst())).join("");
      }
      const groupSubtotal = pricingSubtotal(groupItems);
      // Collapsed (default): one row for the whole cost centre, its total
      // only. Expanded: the cost centre name as a plain heading, its line
      // items underneath, then a plain "Subtotal" row (never prefixed with
      // the cost centre name again — the heading right above it already
      // says which one it is).
      if (!showLineItems) {
        const borderTop = !takeFirst();
        return `
      <div style="display:grid;grid-template-columns:1fr auto;padding:20px 0;${borderTop ? "border-top:1px solid rgba(1,25,85,0.15);" : ""}break-inside:avoid;">
        <span style="font-size:1.0625rem;font-weight:700;">${esc(key)}</span>
        <span style="font-size:1.0625rem;font-weight:700;">$${money(groupSubtotal)}</span>
      </div>`;
      }
      isFirstRow = false;
      const rowsHtml = groupItems.map((item) => itemRow(item, true)).join("");
      return `
      <div style="padding:20px 0 0;break-inside:avoid;">
        <span style="font-size:1.0625rem;font-weight:700;">${esc(key)}</span>
      </div>
      ${rowsHtml}
      <div style="display:grid;grid-template-columns:1fr auto;padding:20px 0;border-top:1px solid rgba(1,25,85,0.15);break-inside:avoid;">
        <span style="font-size:1.0625rem;font-weight:700;">Subtotal</span>
        <span style="font-size:1.0625rem;font-weight:700;">$${money(groupSubtotal)}</span>
      </div>`;
    })
    .join("");

  return `
  <section id="sec-07" style="padding:72px 48px 40px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 32px;break-after:avoid;">Pricing</h2>
      <div style="max-width:80%;">
        ${groupsHtml}
        <div style="display:grid;grid-template-columns:1fr auto;padding:20px 0;border-top:2px solid rgba(1,25,85,0.35);break-inside:avoid;">
          <span style="font-size:1.0625rem;font-weight:700;">Subtotal</span>
          <span style="font-size:1.0625rem;font-weight:700;">$${money(subtotal)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;padding:20px 0;border-top:1px solid rgba(1,25,85,0.15);break-inside:avoid;">
          <span style="font-size:1.0625rem;color:rgba(1,25,85,0.65);">GST</span>
          <span style="font-size:1.0625rem;">$${money(gst)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;padding:24px 28px;background:rgba(1,25,85,0.08);border-radius:16px;margin-top:16px;break-inside:avoid;">
          <span style="font-size:1.375rem;font-weight:700;">Total</span>
          <span style="font-size:1.375rem;font-weight:700;">$${money(total)}</span>
        </div>

        <a href="#sec-16" style="display:inline-flex;align-items:center;margin-top:20px;padding:10px 18px;background:#dcf2e3;border-radius:12px;text-decoration:none;break-inside:avoid;">
          <span style="font-size:0.9375rem;font-weight:600;color:#1f7a4d;">Ready to proceed? Turn to Acceptance.</span>
        </a>

        <div style="margin-top:28px;padding-top:20px;border-top:1px solid rgba(1,25,85,0.12);break-inside:avoid;">
          <p style="font-size:1.125rem;font-weight:700;margin:0 0 6px;">Any questions? We're here to help</p>
          <p style="font-size:1rem;margin:0;"><a href="tel:${COMPANY_PHONE_TEL}" style="color:${NAVY};">${esc(COMPANY_PHONE)}</a> &nbsp;&middot;&nbsp; <a href="mailto:${esc(report.job.preparedByEmail)}" style="color:${NAVY};">${f(report.job.preparedByEmail, "[email address]")}</a></p>
        </div>
      </div>
    </div>
  </section>`;
}

// ── Page 10: Acceptance ──────────────────────────────────────────────────────

// Filled-in fields (RAS-VERTEX's own name/position, already known) render
// as plain confirmed text — a fillable-looking grey box only makes sense
// for the blank fields the other party still has to write in.
function acceptanceFieldHTML(label: string, value: string | null): string {
  return `
          <div>
            <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(1,25,85,0.45);margin-bottom:6px;">${esc(label)}</div>
            ${
              value
                ? `<div style="font-size:1rem;font-weight:700;">${esc(value)}</div>`
                : `<div style="background:rgba(1,25,85,0.08);border-radius:12px;padding:12px 16px;min-height:44px;"></div>`
            }
          </div>`;
}

// "Shane Kidby" -> "skidby" — first initial + last name, lowercase.
function signatureAbbrev(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0]?.toLowerCase() ?? "";
  return (parts[0][0] + parts[parts.length - 1]).toLowerCase();
}

function signatureBlockHTML(
  title: string,
  nameHTML: string,
  positionHTML: string,
  signatureName: string | null,
  dateValue: string | null,
): string {
  return `
        <div style="background:#ffffff;padding:40px;display:flex;flex-direction:column;gap:20px;">
          <h3 style="font-size:1.125rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0;">${esc(title)}</h3>
          ${nameHTML}
          ${positionHTML}
          <div>
            <div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(1,25,85,0.45);margin-bottom:6px;">Signature</div>
            <div style="border:1px dashed rgba(1,25,85,0.25);border-radius:8px;background:${signatureName ? "transparent" : "rgba(1,25,85,0.08)"};height:52px;display:flex;align-items:center;padding:0 16px;">
              ${
                signatureName
                  ? `<span style="font-family:'Caveat','Brush Script MT',cursive;font-size:1.75rem;color:${NAVY};">${esc(signatureName)}</span>`
                  : ""
              }
            </div>
          </div>
          ${acceptanceFieldHTML("Date", dateValue)}
        </div>`;
}

function buildAcceptance(report: ProposalData): string {
  const j = report.job;
  const today = new Date().toLocaleDateString("en-AU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const clientBlock = signatureBlockHTML(
    "On behalf of the Client",
    acceptanceFieldHTML("Name", null),
    acceptanceFieldHTML("Position", null),
    null,
    null,
  );
  const rasBlock = signatureBlockHTML(
    "On behalf of RAS-VERTEX",
    acceptanceFieldHTML("Name", f(j.preparedByName, "[Project Manager Name]")),
    acceptanceFieldHTML("Position", "Project Manager"),
    j.preparedByName?.trim() ? signatureAbbrev(j.preparedByName) : null,
    today,
  );
  return `
  <section id="sec-16" style="padding:72px 48px 100px;break-before:page;min-height:100vh;box-sizing:border-box;display:flex;flex-direction:column;">
    <div style="max-width:1400px;margin:0 auto;width:100%;flex:1;display:flex;flex-direction:column;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 12px;break-after:avoid;">Acceptance</h2>
      <p style="font-size:1.0625rem;color:rgba(1,25,85,0.65);max-width:640px;margin:0 0 48px;">Return a signed copy to accept this proposal (including the Terms &amp; Conditions set out in Appendix A), or contact us with any questions before signing.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(1,25,85,0.12);border:1px solid rgba(1,25,85,0.12);border-radius:24px;overflow:hidden;break-inside:avoid;">
        ${clientBlock}
        ${rasBlock}
      </div>

      <div style="margin-top:auto;padding-top:40px;break-inside:avoid;">
        <h3 style="font-size:0.9375rem;font-weight:700;line-height:1.2;letter-spacing:-0.02em;margin:0 0 10px;">Notes</h3>
        <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:5px;">
          <li style="font-size:0.8125rem;line-height:1.45;color:rgba(1,25,85,0.6);">Deposit: ${report.pricing.depositPct}% on acceptance of this proposal.</li>
          <li style="font-size:0.8125rem;line-height:1.45;color:rgba(1,25,85,0.6);">Progress claims: ${esc(report.pricing.progressTerms)}</li>
          <li style="font-size:0.8125rem;line-height:1.45;color:rgba(1,25,85,0.6);">Final payment: on completion &amp; sign-off.</li>
          <li style="font-size:0.8125rem;line-height:1.45;color:rgba(1,25,85,0.6);">Workmanship warranty: 8 years, written, unconditional.</li>
          <li style="font-size:0.8125rem;line-height:1.45;color:rgba(1,25,85,0.6);">QBCC Home Warranty Scheme: applies where the building is 3 storeys or under and contract value exceeds $3,300; collected on the owner's behalf.</li>
        </ul>
      </div>
    </div>
  </section>`;
}

// ── Page 11: Recent Projects ─────────────────────────────────────────────────

function buildRecentProjects(a: ReportAssets): string {
  const projects = [
    {
      title: "Coastal High-Rise: Full Exterior Repaint & Remedial",
      meta: "12 storeys &middot; Mooloolaba &middot; 9-week programme",
      img: a.proposal.projectMooloolaba,
      bullets: [
        "Full pressure clean & substrate preparation",
        "Crack injection & render repair throughout",
        "2-coat Dulux Weathershield coastal system",
        "Rope access: zero scaffold, zero blocked parking",
        "Completed on time",
      ],
    },
    {
      title: "Beachfront Building: Exterior Repaint & Waterproofing",
      meta: "8 storeys &middot; Alexandra Headland &middot; 7-week programme",
      img: a.proposal.projectAlexandraHeadland,
      bullets: [
        "Full building wash & substrate preparation",
        "Box gutter re-skin and window works",
        "2-coat Haymes coastal grade system",
        "Rope access: zero scaffold, zero blocked parking",
        "Completed on time",
      ],
    },
    {
      title: "Rooftop Membrane Recoat: Beachfront Complex",
      meta: "6 storeys &middot; Sunshine Coast &middot; 3-week programme",
      img: a.proposal.projectRoofMembrane,
      bullets: [
        "Full roof membrane inspection & substrate preparation",
        "Waterproof membrane recoat across the full roof deck",
        "Work coordinated around pool & amenity access",
        "Rope access equipment lift: zero crane hire",
        "Completed on time",
      ],
    },
  ];
  const row = (p: (typeof projects)[number], reverse: boolean, last: boolean) => `
      <div style="display:flex;gap:40px;align-items:flex-start;margin-bottom:${last ? 0 : 56}px;break-inside:avoid;">
        <div style="flex:0.9 1 0;min-width:0;width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:rgba(1,25,85,0.08);order:${reverse ? 2 : 1};">
          <img src="${esc(p.img)}" alt="" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="flex:1.1 1 0;min-width:0;display:flex;flex-direction:column;gap:12px;order:${reverse ? 1 : 2};">
          <h3 style="font-size:1.25rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0;">${p.title}</h3>
          <p style="font-size:0.875rem;color:rgba(1,25,85,0.45);margin:0;">${p.meta}</p>
          <ul style="list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column;gap:8px;">
            ${p.bullets.map((b) => `<li style="font-size:0.875rem;line-height:1.4;color:rgba(1,25,85,0.7);">&bull; ${esc(b)}</li>`).join("")}
          </ul>
        </div>
      </div>`;
  return `
  <section id="sec-11" style="padding:64px 48px 40px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 48px;break-after:avoid;">Recent Projects</h2>
      ${row(projects[0], false, false)}
      ${row(projects[1], true, false)}
      ${row(projects[2], false, true)}
    </div>
  </section>`;
}

// ── Page 12: Client Testimonial ──────────────────────────────────────────────

function buildTestimonial(): string {
  return `
  <section id="sec-12" style="padding:96px 48px;break-before:page;min-height:100vh;box-sizing:border-box;display:flex;align-items:center;">
    <div style="max-width:820px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center;">
      <span style="font-size:3.5rem;font-weight:700;line-height:0.6;color:${BURGUNDY};">&ldquo;</span>
      <p style="font-size:1.875rem;font-weight:300;line-height:1.4;letter-spacing:-0.015em;margin:0;">RAS-VERTEX carried out a full external repaint, including a thorough building wash and remedial works beforehand. Great communication and planning, with the high standards that Phil, Shane and Jason set, and the flexibility to fix issues as they came up.</p>
      <div>
        <p style="font-weight:600;margin:0;">Kerry O'Donnell</p>
        <p style="font-size:0.9375rem;color:rgba(1,25,85,0.65);margin:2px 0 0;">12 Storey Commercial High-Rise, Sunshine Coast</p>
      </div>
    </div>
  </section>`;
}

// ── Page 13: Other Services & Support Plans ──────────────────────────────────
// Merged from two separate pages (Support & Maintenance Plans, Other
// Services) into one two-column page — same content, half the paper.

function buildOtherServicesAndSupport(report: ProposalData, a: ReportAssets): string {
  const j = report.job;
  const otherServices = [
    {
      img: a.proposal.serviceCleaning,
      title: "External Cleaning",
      body: "Full building washdowns that clear salt, mould and grime.",
    },
    {
      img: a.proposal.serviceWindowCleaning,
      title: "Window Cleaning",
      body: "Streak-free glass at height, on the same rope access rig.",
    },
    {
      img: a.proposal.serviceHeightSafety,
      title: "Height Safety",
      body: "Anchor point install, inspection and certification to AS/NZS 1891.",
    },
    {
      img: a.proposal.serviceWaterproofing,
      title: "Waterproofing",
      body: "Roof, box gutter and balcony membrane works.",
    },
    {
      img: a.proposal.serviceMaintenance,
      title: "Maintenance",
      body: "Scheduled inspections and touch-ups that catch small issues early.",
    },
  ];
  const supportPlans = [
    {
      img: a.proposal.supportWashDown,
      title: "Annual Wash-Down",
      body: "Removes salt build-up and mould before it degrades the coating.",
    },
    {
      img: a.proposal.serviceWaterproofing,
      title: "Annual Inspection",
      body: "A short report flagging anything worth watching.",
    },
    {
      img: a.proposal.projectMooloolaba,
      title: "Touch-Up Cover",
      body: "Minor scuffs addressed as they appear, at a pre-agreed call-out rate.",
    },
  ];
  const row = (c: { img: string; title: string; body: string }, last: boolean) => `
        <div style="display:flex;gap:18px;align-items:flex-start;padding:16px 0;${last ? "" : "border-bottom:1px solid rgba(1,25,85,0.08);"}break-inside:avoid;">
          <img src="${esc(c.img)}" alt="" style="width:72px;height:72px;border-radius:12px;object-fit:cover;flex-shrink:0;">
          <div>
            <p style="font-weight:700;font-size:0.9375rem;margin:0 0 4px;">${c.title}</p>
            <p style="font-size:0.8125rem;line-height:1.45;color:rgba(1,25,85,0.6);margin:0;">${c.body}</p>
          </div>
        </div>`;
  const card = (label: string, items: { img: string; title: string; body: string }[]) => `
      <div style="background:#ffffff;border:1px solid rgba(1,25,85,0.12);border-radius:18px;padding:28px 32px;break-inside:avoid;">
        <p style="font-family:'Bebas Neue',Arial,sans-serif;font-size:1.0625rem;letter-spacing:0.06em;text-transform:uppercase;color:rgba(1,25,85,0.4);margin:0 0 10px;">${label}</p>
        ${items.map((it, i) => row(it, i === items.length - 1)).join("")}
      </div>`;
  return `
  <section id="sec-services-support" style="padding:80px 48px 56px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 14px;break-after:avoid;">Other Services &amp; Support Plans</h2>
      <p style="font-size:1.0625rem;color:rgba(1,25,85,0.65);max-width:700px;margin:0 0 32px;">Beyond this scope, we cover the rest of your building's exterior maintenance under the one licence and the one project manager.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:start;">
        ${card("Other Services", otherServices)}
        ${card("Support &amp; Maintenance Plans", supportPlans)}
      </div>
      <p style="font-size:1rem;color:rgba(1,25,85,0.65);max-width:820px;margin:32px 0 0;">Combined, these form a tailored plan for ${f(j.buildingName, "[Building Name]")}, covering cleaning, safety, waterproofing and touch-ups on a single schedule with the one project manager.</p>
      <p style="font-size:0.875rem;color:rgba(1,25,85,0.5);margin:10px 0 0;">Talk to us about setting up a maintenance plan, ask ${f(j.preparedByName, "[Project Manager Name]")} at your walkthrough or call <a href="tel:${COMPANY_PHONE_TEL}" style="font-weight:700;color:${NAVY};">${esc(COMPANY_PHONE)}</a>.</p>
    </div>
  </section>`;
}

// ── Page 15: Who We Are + Insurance & Compliance ─────────────────────────────

function buildWhoWeAre(): string {
  return `
  <section id="sec-14" style="padding:72px 48px 40px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 20px;break-after:avoid;">Who We Are</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:780px;margin:0;">Founded in 2009 when Phil brought 15 years of UK rope access experience to the Sunshine Coast. In 2023, RAS merged with Vertex Access Solutions to become RAS-VERTEX. Today: 25+ directly employed specialists across painting, waterproofing, height safety and remedial work. No subbies, one team, every trade.</p>
    </div>
  </section>`;
}

function buildInsuranceCompliance(a: ReportAssets): string {
  const stats: [string, string, string][] = [
    ["Licensed<br>Contractor", "QBCC", "Painting, waterproofing & building work"],
    ["L1 to L3<br>Certified", "IRATA", "Every technician directly employed"],
    ["Public<br>Liability", "$20M", "Plus full workers' compensation cover"],
    ["Years on the<br>Coast", "25+", "Noosa to Caloundra, every suburb"],
  ];
  return `
  <section id="sec-15" style="padding:32px 48px 72px;">
    <div style="max-width:1400px;margin:0 auto;">
      <div style="background:${PALE_BLUE};border-radius:24px;padding:40px;break-inside:avoid;">
        <div style="margin-bottom:32px;">
          <h2 style="font-size:clamp(1.75rem,3vw,2.5rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 16px;break-after:avoid;">Licensed, certified, and fully insured.</h2>
          <p style="font-size:1rem;color:rgba(1,25,85,0.65);max-width:640px;margin:0;">Every certificate is current. Every technician is directly employed. Certificates of currency are issued automatically at quote stage, with no chasing and no surprises for your committee.</p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(1,25,85,0.15);">
          ${stats
            .map(
              ([label, big, sub], i) => `
          <div style="display:flex;flex-direction:column;gap:6px;padding:24px ${i < 3 ? "24px" : "0"} 0 ${i > 0 ? "24px" : "0"};${i < 3 ? "border-right:1px solid rgba(1,25,85,0.15);" : ""}break-inside:avoid;">
            <span style="font-size:10px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;line-height:1.4;color:rgba(1,25,85,0.45);">${label}</span>
            <span style="font-size:1.875rem;font-weight:700;letter-spacing:-0.03em;line-height:1;">${big}</span>
            <span style="font-size:0.8125rem;color:rgba(1,25,85,0.55);">${sub}</span>
          </div>`,
            )
            .join("")}
        </div>
        <div style="display:flex;align-items:center;gap:32px;margin-top:32px;">
          <img src="${esc(a.associations.qbcc)}" alt="QBCC" style="height:40px;width:auto;object-fit:contain;">
          <img src="${esc(a.proposal.workCover)}" alt="WorkCover Queensland" style="height:34px;width:auto;object-fit:contain;">
        </div>
      </div>
    </div>
  </section>`;
}

// ── Page 14: Appendix A — Terms & Conditions (compact, one page) ───────────

// Flat, in column-major reading order — split into 3 fixed columns below
// (explicit CSS grid, not CSS multi-column) so it renders predictably as a
// single page alongside the heading.
const APPENDIX_ITEMS: { title: string; body: string }[] = [
  { title: "General", body: "All services by RAS-VERTEX (Contractor) to client (Principal) are subject to these Terms and Conditions unless otherwise agreed." },
  { title: "Acceptance", body: "Quote valid 60 days from date. Acceptance subject to credit approval." },
  { title: "Working Hours", body: "Quote based on Monday to Friday, 7am to 5pm. Saturday work may be required. Outside-hours work incurs additional charges." },
  { title: "Warranty", body: "RAS-VERTEX guarantees workmanship per relevant jurisdiction standards and Australian Standards. Workmanship warranty equals manufacturer's material warranty period. No warranty against existing rust reoccurrence or uncontrollable environmental damage." },
  { title: "Access and Equipment", body: "Work performed via rope access from rooftops, with possible unit access. May use EWP, scaffolds, trestles and ladders." },
  { title: "Site Amenities", body: "Client provides storage, electricity, toilet facilities and water throughout the project." },
  { title: "External Cleaning", body: "RAS-VERTEX cannot guarantee removal of all stains from environmental factors, age or poor maintenance. Client is responsible for drainage and waste disposal compliance." },
  { title: "Painting Specifications", body: "Work complies with manufacturer specifications, which override our procedures for warranty. Manufacturer representatives conduct quality checks." },
  { title: "Waterproofing", body: "Work per Australian Standards. Client ensures proper drainage and maintenance. Warranty excludes structural movement or poor maintenance damage." },
  { title: "Payment Terms", body: "Payment due within 7 days of invoice. Progress claims at agreed intervals. Late payment: 5% penalty plus 12% per annum interest at RAS-VERTEX discretion." },
  { title: "Variations", body: "Client-requested variations entitle price variation and time extension. All variations require written agreement." },
  { title: "Delays and Force Majeure", body: "Client delays, force majeure, latent conditions or access issues may result in time extensions (with costs) or termination for prolonged delays." },
  { title: "Liquidated Damages", body: "RAS-VERTEX does not accept liability for liquidated damages." },
  { title: "Toxic Materials", body: "Pre-existing toxic materials (lead, chromate paints, asbestos) subject to additional preparation, removal or isolation costs." },
  { title: "Program and Sequencing", body: "Work programs mutually agreed. RAS-VERTEX determines sequence and may charge for coordination with other trades." },
  { title: "Latent Conditions", body: "Quote based on information available at quoting time. Site conditions beyond reasonable foreseeability are deemed latent conditions qualifying as claimable variations." },
  { title: "Credit & Privacy", body: "As credit provider, RAS-VERTEX collects personal information per legislative requirements. Proposal subject to credit approval. Complies with Privacy Amendment (Private Sector) Act 2001." },
  { title: "Environment & Safety", body: "Client represents site drainage and contamination risks. RAS-VERTEX not liable for environmental contamination unless pre-advised of site conditions." },
  { title: "Insurance", body: "$20 million public liability and workers' compensation maintained. QBCC Home Warranty added if applicable for dwellings under 3 storeys." },
  { title: "Marketing", body: "RAS-VERTEX may send promotional offers (unsubscribe available) and use project images for marketing (no identifiable individuals)." },
];

// Splits a sequence into `k` CONTIGUOUS groups (preserving reading order —
// column 1 top-to-bottom, then column 2, etc.) while minimizing the tallest
// group's estimated height. A plain count-based split (e.g. 8/7/7 items)
// looks balanced but isn't: item body lengths vary a lot, so one column can
// end up visibly taller than the others and overflow past the page margin
// while its neighbours have room to spare. Classic "book allocation" binary
// search over the max-group-weight, O(n log(total weight)).
function balanceIntoColumns<T extends { title: string; body: string }>(
  items: T[],
  k: number,
): T[][] {
  const COLUMN_CHARS_PER_LINE = 32;
  const weight = (it: T) => 40 + Math.ceil(it.body.length / COLUMN_CHARS_PER_LINE) * 18;
  const weights = items.map(weight);
  const n = items.length;
  const fitsWithin = (limit: number): boolean => {
    let groups = 1;
    let sum = 0;
    for (const w of weights) {
      if (sum + w > limit) {
        groups++;
        sum = w;
        if (w > limit) return false;
      } else {
        sum += w;
      }
    }
    return groups <= k;
  };
  let lo = Math.max(...weights);
  let hi = weights.reduce((a, b) => a + b, 0);
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (fitsWithin(mid)) hi = mid;
    else lo = mid + 1;
  }
  const groups: T[][] = [];
  let current: T[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    if (sum + weights[i] > lo && current.length) {
      groups.push(current);
      current = [];
      sum = 0;
    }
    current.push(items[i]);
    sum += weights[i];
  }
  if (current.length) groups.push(current);
  while (groups.length < k) groups.push([]);
  return groups;
}

function buildAppendix(): string {
  const [col1, col2, col3] = balanceIntoColumns(APPENDIX_ITEMS, 3);
  // Floated (not grid) — CSS Grid renders as one atomic, non-fragmenting
  // block in Chromium's print engine, which is what stranded the heading
  // alone on a page while the whole grid jumped to the next one. Floated
  // columns are ordinary block flow and paginate normally.
  const renderCol = (col: { title: string; body: string }[], last: boolean) =>
    `<div style="float:left;width:calc((100% - 56px) / 3);margin-right:${last ? "0" : "28px"};">${col
      .map(
        (it) => `
        <div style="margin:0 0 17px;break-inside:avoid;">
          <h4 style="font-size:0.8125rem;font-weight:700;line-height:1.3;letter-spacing:-0.01em;margin:0 0 3px;">${esc(it.title)}</h4>
          <p style="font-size:0.75rem;line-height:1.5;color:rgba(1,25,85,0.6);margin:0;">${esc(it.body)}</p>
        </div>`,
      )
      .join("")}</div>`;
  return `
  <section id="sec-appendix-a" style="padding:64px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 24px;break-after:avoid;">Terms &amp; Conditions</h2>
      <div>
        ${renderCol(col1, false)}${renderCol(col2, false)}${renderCol(col3, true)}
        <div style="clear:both;"></div>
      </div>
    </div>
  </section>`;
}

// ── Pages 15–16: Certificates ─────────────────────────────────────────────

function buildCertificatePage(id: string, src: string, alt: string): string {
  return `
  <section id="${id}" style="break-before:page;height:100vh;box-sizing:border-box;padding:32px;display:flex;align-items:center;justify-content:center;">
    <img src="${esc(src)}" alt="${esc(alt)}" style="max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;break-inside:avoid;">
  </section>`;
}

// Puppeteer's footerTemplate renders in an isolated frame — no access to
// this document's <style>/@font-face, so a plain system font stack only —
// and repeats on every physical page with pageNumber/totalPages
// substituted live, which is the only reliable way to get real page
// numbers into a printed PDF (Chromium doesn't support CSS Paged Media's
// counter(page) for this). See renderPDF()'s RenderPDFOptions.
export function buildProposalFooterTemplate(assets: ReportAssets): string {
  return `
  <div style="width:100%;box-sizing:border-box;padding:8px 48px 0;margin:0 auto;font-family:Arial,Helvetica,sans-serif;font-size:9px;color:rgba(1,25,85,0.35);display:flex;align-items:center;justify-content:space-between;">
    <img src="${esc(assets.proposal.footerLogos)}" alt="" style="height:38px;width:auto;object-fit:contain;">
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

// ── Main export ───────────────────────────────────────────────────────────────
//
// Split into two independent HTML documents — front matter (Cover, Contents,
// Cover Letter) and everything else — rendered as two separate PDFs and
// stitched together (see export-proposal-pdf/route.ts). This is the only way
// to get "no page numbers on the first three pages, numbering starts fresh
// at 1 after Contents": Chromium's footerTemplate applies identically to
// every physical page of a single page.pdf() call — there's no per-page
// conditional and no way to offset its pageNumber/totalPages counters from
// within the template (it doesn't run script). Rendering the numbered
// sections as their own document makes Chromium's own counter naturally
// start at 1 there, and the front-matter document simply never gets a
// footerTemplate at all.

function wrapProposalHTML(
  report: ProposalData,
  a: ReportAssets,
  body: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Proposal — ${esc(report.job.buildingName || "RAS-VERTEX")}</title>
<style>${buildPrintFontFaceCSS(a)}</style>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  img, svg { display: block; max-width: 100%; }
  a { color: ${NAVY}; text-decoration: none; }
  body { font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif; color: ${NAVY}; background: #ffffff; line-height: 1.7; }

  @media print {
    @page { size: A4; margin: 0; }
  }
</style>
</head>
<body>
<div>
${body}
</div>
</body>
</html>`;
}

// Cover, Contents, Cover Letter — no footerTemplate is ever passed for this
// document, so these three pages carry no page number at all.
export function buildProposalFrontMatterHTML(
  report: ProposalData,
  assets?: ReportAssets,
): string {
  const a = assets ?? DEFAULT_PRINT_ASSETS;
  const body = [
    buildCover(report, a),
    buildTableOfContents(report),
    buildCoverLetter(report, a),
  ].join("\n");
  return wrapProposalHTML(report, a, body);
}

// Everything from "Your Project" onward — rendered as its own document so
// Chromium's pageNumber/totalPages counters start fresh at 1 here instead
// of continuing from the front matter.
export function buildProposalNumberedHTML(
  report: ProposalData,
  assets?: ReportAssets,
): string {
  const a = assets ?? DEFAULT_PRINT_ASSETS;
  const body = [
    buildYourProject(report), // 1a
    buildProjectTeam(report, a), // 1b
    report.sections.accessPlan ? buildAccessPlan(report) : "",
    report.sections.findings ? buildFindings(report) : "",
    report.sections.scope ? buildScope(report, a) : "",
    buildWhyPrepDifferent(a),
    buildWarranty(a),
    report.sections.pricing ? buildPricing(report) : "",
    buildAcceptance(report),
    buildRecentProjects(a),
    buildTestimonial(),
    buildOtherServicesAndSupport(report, a),
    buildWhoWeAre(),
    buildInsuranceCompliance(a),
    buildAppendix(),
    buildCertificatePage(
      "sec-cert-workcover",
      a.proposal.workCoverCert,
      "WorkCover Queensland Certificate of Currency",
    ),
    buildCertificatePage(
      "sec-cert-liability",
      a.proposal.publicLiabilityCert,
      "Public & Products Liability Certificate of Currency",
    ),
  ].join("\n");
  return wrapProposalHTML(report, a, body);
}
