// lib/reports/proposal.print.ts
//
// Print HTML builder for the Proposal report. Unlike condition/anchor/hours
// (each page a fixed 210mm x 297mm div, manually paginated in JS), this
// design is a continuous scrolling document — same as the source website
// HTML it's ported from — and relies on Chrome's native print pagination
// (page.pdf({format:"A4"}) in pdf-utils.ts) plus the @media print overrides
// below, exactly as the uploaded source file already does. Don't force this
// into the fixed-page-div pattern the other reports use; it's a genuinely
// different, and simpler, document shape.
//
// Fixed company content (team, recent projects, why-our-prep, warranty,
// support plans, insurance stats, appendix T&Cs) is baked in here as static
// HTML, not driven by ProposalData — see the approved plan. Only the
// genuinely job-specific sections read from `report`.

import {
  type ProposalData,
  type ProposalSectionToggles,
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

function buildStickyBar(a: ReportAssets): string {
  return `
  <div class="rv-sticky-bar" style="position:sticky;top:0;z-index:20;background:#ffffff;display:flex;align-items:center;padding:14px 48px;">
    <img src="${esc(a.proposal.navLogo)}" alt="RAS-VERTEX Maintenance Solutions" style="height:40px;width:auto;">
  </div>`;
}

function buildCover(report: ProposalData, a: ReportAssets): string {
  const j = report.job;
  const coverPhoto = report.photos.find((p) => p.id === j.sitePhotoId)?.url;
  return `
  <section id="sec-01" style="padding:64px 48px 56px;">
    <div style="max-width:1400px;margin:0 auto;">
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

function buildCoverLetter(report: ProposalData): string {
  const j = report.job;
  return `
  <section id="sec-02" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <div style="overflow:hidden;margin:0 0 40px;">
        <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:clamp(3rem,16vw,19.5rem);line-height:0.85;letter-spacing:-0.05em;color:#eef0f5;white-space:nowrap;display:block;margin-left:-0.05em;">HIGHER STANDARDS.</span>
      </div>
      <div style="max-width:680px;">
        <p style="font-size:0.9375rem;color:rgba(1,25,85,0.55);margin:0 0 40px;">${f(j.date, "[DD Month YYYY]")}</p>
        <p style="font-size:1.0625rem;margin:0 0 24px;">Dear ${f(j.contactName, "[Client First Name]")},</p>
        <p style="font-size:1.0625rem;margin:0 0 24px;">Thank you for the opportunity to quote on the external repaint and remedial works at ${f(j.buildingName, "[Building Name]")}. I walked the site personally on ${f(j.inspectionDate, "[inspection date]")}. This proposal reflects exactly what I found there, not a generic scope pulled from a template.</p>
        <p style="font-size:1.0625rem;margin:0 0 24px;">Every trade on this job (painters, waterproofers and our remedial/concrete team) is directly employed under our own licence, run by one project manager from first site visit to warranty sign off. It's the same crew, whatever comes up mid-job.</p>
        <p style="font-size:1.0625rem;margin:0 0 24px;">Every RAS-VERTEX repaint carries our 8-year written workmanship warranty as standard, with no maintenance contract required to unlock it.</p>
        <p style="font-size:1.0625rem;margin:0 0 40px;">Any questions at all, call or text me directly on ${esc(COMPANY_PHONE)}. I'll pick up.</p>
        <p style="font-family:'Caveat','Brush Script MT',cursive;font-size:2.25rem;color:${NAVY};margin:0 0 2px;">${f(j.preparedByName, "[Project Manager Name]")}</p>
        <p style="font-size:1.0625rem;margin:0;font-weight:700;">${f(j.preparedByName, "[Project Manager Name]")}<br><span style="font-weight:400;color:rgba(1,25,85,0.65);">Project Manager, RAS-VERTEX Maintenance Solutions</span></p>
      </div>
    </div>
  </section>`;
}

function buildYourProject(report: ProposalData): string {
  const j = report.job;
  const conditionSummary = j.conditionSummary?.trim()
    ? esc(j.conditionSummary)
    : `Our site walk identified [key condition summary, e.g. coastal chalking, cracking to the north stair core, overgrown vegetation at ground-floor access points].`;
  return `
  <section id="sec-03" style="padding:96px 48px;background:rgba(1,25,85,0.03);break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 20px;break-after:avoid;">Your Project</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:760px;margin:0;">${f(j.buildingName, "[Building Name]")} sits ${f(j.distanceFromCoast, "[distance from coastline]")} from the water at ${f(j.siteAddress, "[address]")}, which means salt air and UV exposure drive how we've specified this job. ${conditionSummary} ${f(j.accessConstraint, "[Access constraint, e.g. limited car parking, no scaffold permits available]")} is exactly why rope access, not scaffolding, suits this site.</p>

      <div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(1,25,85,0.15);margin-top:48px;">
        ${[
          ["Building Type", f(j.buildingType, "[Type, e.g. residential high-rise]")],
          ["Storeys", f(j.storeys, "[N]")],
          ["Access Method", "Rope access"],
          ["Target Start", f(j.targetStart, "[Month YYYY]")],
        ]
          .map(
            ([label, value], i) => `
        <div style="padding:24px ${i < 3 ? "24px" : "0"} 0 ${i > 0 ? "24px" : "0"};${i < 3 ? "border-right:1px solid rgba(1,25,85,0.15);" : ""}">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(1,25,85,0.45);">${label}</div>
          <div style="font-size:1.125rem;font-weight:700;margin-top:6px;">${value}</div>
        </div>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

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
    return `
        <div style="display:flex;flex-direction:column;gap:16px;break-inside:avoid;">
          <div style="width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:rgba(1,25,85,0.08);">
            ${photo ? `<img src="${esc(photo.url)}" alt="${esc(find.title)}" style="width:100%;height:100%;object-fit:cover;">` : ""}
          </div>
          <div>
            <p style="font-weight:700;font-size:1rem;margin:0 0 4px;">${String(i + 1).padStart(2, "0")}. ${esc(find.title) || "[Defect, location]"}</p>
            <p style="font-size:0.875rem;color:rgba(1,25,85,0.6);margin:0;">${esc(find.description) || "[What this means for the scope of works]"}</p>
          </div>
        </div>`;
  }).join("");

  return `
  <section id="sec-04" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 20px;break-after:avoid;">Site Survey &amp; Findings</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:760px;margin:0 0 48px;">We don't quote from a desk. ${f(report.job.preparedByName, "[Project Manager Name]")} inspected ${f(report.job.buildingName, "[Building Name]")} on ${f(report.job.inspectionDate, "[inspection date]")}. Here's exactly what was found, and what it means for the job.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:32px;">${cells}</div>
    </div>
  </section>`;
}

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
      <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:18px;">
        ${items
          .map(
            (item) => `
        <li style="display:flex;gap:12px;align-items:flex-start;break-inside:avoid;">
          ${scopeIconHTML(kind, a)}
          <span style="font-size:1rem;${dim ? `color:rgba(1,25,85,0.65);` : ""}">${esc(item)}</span>
        </li>`,
          )
          .join("")}
      </ul>`;

  return `
  <section id="sec-05" style="padding:96px 48px;background:rgba(1,25,85,0.03);break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 40px;break-after:avoid;">Project Scope: Inclusions &amp; Exclusions</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(1,25,85,0.12);border-radius:24px;overflow:hidden;border:1px solid rgba(1,25,85,0.12);">
        <div style="background:#ffffff;padding:40px;break-inside:avoid;">
          <h3 style="font-size:1.375rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0 0 24px;">Included</h3>
          ${list(included, "plus", false)}
        </div>
        <div style="background:#ffffff;padding:40px;break-inside:avoid;">
          <h3 style="font-size:1.375rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0 0 24px;">Excluded</h3>
          ${list(excluded, "cross", true)}
        </div>
      </div>
    </div>
  </section>`;
}

function buildAccessPlan(report: ProposalData): string {
  const stages = report.accessPlan.stages.length ? report.accessPlan.stages : [];
  const map = report.accessPlan.map;
  const points = map.points;
  const pointsByStage = new Map<string, number[]>();
  points.forEach((p, i) => {
    if (!p.stageId) return;
    if (!pointsByStage.has(p.stageId)) pointsByStage.set(p.stageId, []);
    pointsByStage.get(p.stageId)!.push(i + 1);
  });

  const mapHTML = map.imageUrl
    ? `
      <div style="margin-top:40px;break-inside:avoid;">
        <div style="position:relative;width:100%;aspect-ratio:8/5;border-radius:16px;overflow:hidden;background:${PALE_BLUE};">
          <img src="${esc(map.imageUrl)}" alt="Site aerial with drop points" style="width:100%;height:100%;object-fit:cover;">
          ${points
            .map(
              (p, i) => `
          <div style="position:absolute;left:${p.x}%;top:${p.y}%;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;background:${RED};color:#fff;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;">${i + 1}</div>`,
            )
            .join("")}
        </div>
        ${
          points.length
            ? `
        <ul style="list-style:none;margin:20px 0 0;padding:0;display:flex;flex-direction:column;gap:10px;">
          ${points
            .map(
              (p, i) => `
          <li style="display:flex;gap:12px;align-items:baseline;font-size:0.9375rem;color:rgba(1,25,85,0.75);">
            <span style="flex-shrink:0;width:22px;height:22px;border-radius:50%;background:${RED};color:#fff;font-size:0.6875rem;font-weight:700;display:flex;align-items:center;justify-content:center;">${i + 1}</span>
            <span>${esc(p.note) || `Drop point ${i + 1}`}${
                p.stageId
                  ? ` — <span style="color:rgba(1,25,85,0.5);">${esc(stages.find((s) => s.id === p.stageId)?.label ?? "")}</span>`
                  : ""
              }</span>
          </li>`,
            )
            .join("")}
        </ul>`
            : ""
        }
      </div>`
    : "";

  return `
  <section id="sec-06" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 20px;break-after:avoid;">Access &amp; Disruption Plan</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:760px;margin:0 0 40px;">Rope access is our real structural advantage over most competitors: no scaffolding, no blocked car parks, no scaffold permits. On most buildings, we're on site the same day. The numbered drop points below show exactly where we'll be working, and when.</p>

      ${mapHTML}

      <div style="display:grid;grid-template-columns:repeat(${Math.max(stages.length, 1)},1fr);gap:1px;background:rgba(1,25,85,0.12);border:1px solid rgba(1,25,85,0.12);border-radius:16px;overflow:hidden;margin-top:40px;">
        ${stages
          .map(
            (s) => `
        <div style="background:#ffffff;padding:28px;break-inside:avoid;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(1,25,85,0.45);">${esc(s.label)}</div>
          <div style="font-size:1rem;font-weight:700;margin-top:8px;">${esc(s.description)}</div>
          ${
            pointsByStage.get(s.id)?.length
              ? `<div style="font-size:0.8125rem;color:rgba(1,25,85,0.5);margin-top:10px;">Drop point${pointsByStage.get(s.id)!.length > 1 ? "s" : ""} ${pointsByStage.get(s.id)!.join(", ")}</div>`
              : ""
          }
        </div>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

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

  const itemRow = (item: (typeof rows)[number]) => `
        <div style="display:grid;grid-template-columns:1fr auto;padding:16px 20px;border-top:1px solid rgba(1,25,85,0.12);break-inside:avoid;">
          <span style="font-size:1rem;">${esc(item.label)}</span>
          <span style="font-size:1rem;font-weight:600;">$${money(item.amountExTax)}</span>
        </div>`;

  const groupsHtml = order
    .map((key) => {
      const groupItems = groups.get(key)!;
      const rowsHtml = groupItems.map(itemRow).join("");
      if (!key) {
        return `<div style="margin-bottom:20px;">${rowsHtml}</div>`;
      }
      const groupSubtotal = pricingSubtotal(groupItems);
      return `
      <div style="border:1px solid rgba(1,25,85,0.12);border-radius:10px;overflow:hidden;margin-bottom:20px;break-inside:avoid;">
        <div style="display:grid;grid-template-columns:1fr auto;padding:14px 20px;background:rgba(1,25,85,0.06);">
          <span style="font-size:0.9375rem;font-weight:700;">${esc(key)}</span>
          <span style="font-size:0.9375rem;font-weight:700;">$${money(groupSubtotal)}</span>
        </div>
        ${rowsHtml}
      </div>`;
    })
    .join("");

  return `
  <section id="sec-07" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 40px;break-after:avoid;">Pricing</h2>
      <div style="max-width:760px;">
        ${groupsHtml}
        <div style="display:grid;grid-template-columns:1fr auto;padding:20px 0;border-top:2px solid rgba(1,25,85,0.35);break-inside:avoid;">
          <span style="font-size:1.0625rem;font-weight:700;">Combined Total</span>
          <span style="font-size:1.0625rem;font-weight:700;">$${money(subtotal)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;padding:20px 0;border-top:1px solid rgba(1,25,85,0.15);break-inside:avoid;">
          <span style="font-size:1.0625rem;color:rgba(1,25,85,0.65);">GST (10%)</span>
          <span style="font-size:1.0625rem;">$${money(gst)}</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr auto;padding:24px 28px;background:rgba(1,25,85,0.08);border-radius:16px;margin-top:16px;break-inside:avoid;">
          <span style="font-size:1.375rem;font-weight:700;">Grand Total</span>
          <span style="font-size:1.375rem;font-weight:700;">$${money(total)}</span>
        </div>

        <a href="#sec-16" style="display:block;margin-top:16px;padding:18px 28px;background:#e3f7ea;border-radius:16px;text-decoration:none;break-inside:avoid;">
          <span style="font-size:1.0625rem;font-weight:700;color:#1a7a42;">Ready to proceed? Turn to Acceptance.</span>
        </a>

        <div style="margin-top:48px;break-inside:avoid;">
          <h3 style="font-size:1.125rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0 0 16px;">Notes</h3>
          <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:12px;">
            <li style="font-size:0.9375rem;color:rgba(1,25,85,0.65);">Deposit: ${report.pricing.depositPct}% on acceptance of this proposal.</li>
            <li style="font-size:0.9375rem;color:rgba(1,25,85,0.65);">Progress claims: ${esc(report.pricing.progressTerms)}</li>
            <li style="font-size:0.9375rem;color:rgba(1,25,85,0.65);">Final payment: on completion &amp; sign-off.</li>
            <li style="font-size:0.9375rem;color:rgba(1,25,85,0.65);">Workmanship warranty: 8 years, written, unconditional. See next page.</li>
            <li style="font-size:0.9375rem;color:rgba(1,25,85,0.65);">QBCC Home Warranty Scheme: applies where the building is 3 storeys or under and contract value exceeds $3,300; collected on the owner's behalf.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>`;
}

function buildWarranty(a: ReportAssets): string {
  return `
  <section id="sec-08" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <div style="background:${PALE_BLUE};border-radius:24px;padding:64px;display:flex;align-items:flex-end;gap:64px;flex-wrap:wrap;break-inside:avoid;">
        <div style="flex-shrink:0;display:flex;flex-direction:column;gap:24px;">
          <div style="display:flex;align-items:flex-end;gap:16px;">
            <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:clamp(10rem,16vw,17rem);letter-spacing:-0.04em;color:${NAVY};line-height:0.85;">8</span>
            <span style="font-size:0.875rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(1,25,85,0.65);line-height:1.4;">Year<br>Warranty</span>
          </div>
        </div>
        <div style="flex:1;min-width:280px;display:flex;flex-direction:column;gap:16px;">
          <h2 style="font-size:clamp(1.75rem,3vw,2.5rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0;break-after:avoid;">Standing by our team,<br>and our products.</h2>
          <p style="font-size:1.0625rem;color:rgba(1,25,85,0.65);margin:0;">Most workmanship warranties in this industry run two to five years, and the longer terms usually come with a catch: an ongoing paid maintenance contract you have to commit to first. Every RAS-VERTEX repaint carries an 8-year written workmanship warranty as standard. No maintenance contract to sign, no conditions attached.</p>
        </div>
        <div style="flex-shrink:0;width:260px;display:flex;flex-direction:column;gap:16px;">
          <h3 style="font-size:1.375rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0;">Backed by the best.</h3>
          <div style="display:flex;align-items:center;gap:24px;">
            <img src="${esc(a.associations.haymes)}" alt="Haymes Paint" style="height:32px;width:auto;object-fit:contain;">
            <img src="${esc(a.proposal.dulux)}" alt="Dulux" style="height:28px;width:auto;object-fit:contain;">
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

function buildWhyPrepDifferent(a: ReportAssets): string {
  const cards = [
    {
      n: "01",
      title: "We repair before we coat.",
      body: "We repair cracks and substrate defects properly before any coating goes on top. A patch job over a damaged surface never lasts long, so that's simply not how we do it. In this industry it's common for painters to subcontract repairs out to whoever's available; ours don't. Our painters, waterproofers and remedial/concrete teams are all direct employees under one licence, so when a crack, delaminating render or rusted bracket turns up mid-job, it's fixed by our own qualified team to spec.",
      img: a.proposal.whyPrep1,
    },
    {
      n: "02",
      title: "Coastal systems, not generic ones.",
      body: "Salt air, UV degradation and humidity cycles behave differently within 5km of the water. That's why our coating systems and prep (flexible topcoats, environmentally friendly pressure cleaning) are specified differently for coastal buildings than inland ones. We don't apply the same system regardless of exposure.",
      img: a.proposal.whyPrep2,
    },
  ];
  return `
  <section id="sec-09" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 40px;break-after:avoid;">Why Our Prep Is Different</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;">
        ${cards
          .map(
            (c) => `
        <div style="display:flex;flex-direction:column;gap:24px;break-inside:avoid;">
          <div style="width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:rgba(1,25,85,0.08);">
            <img src="${esc(c.img)}" alt="" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <div style="display:flex;flex-direction:column;gap:12px;">
            <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:1.25rem;letter-spacing:0.05em;color:rgba(1,25,85,0.4);">${c.n}</span>
            <h3 style="font-size:1.5rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0;">${c.title}</h3>
            <p style="font-size:1.0625rem;color:rgba(1,25,85,0.6);margin:0;">${c.body}</p>
          </div>
        </div>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function buildProjectTeam(report: ProposalData, a: ReportAssets): string {
  const j = report.job;
  const avatar = (initials: string, photo?: string) =>
    photo
      ? `
        <div style="width:140px;height:140px;border-radius:50%;overflow:hidden;">
          <img src="${esc(photo)}" alt="" style="width:100%;height:100%;object-fit:cover;">
        </div>`
      : `
        <div style="width:140px;height:140px;border-radius:50%;background:${PALE_BLUE};display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue',Arial,sans-serif;font-size:2.5rem;color:${NAVY};letter-spacing:0.05em;">${esc(initials)}</div>`;
  return `
  <section id="sec-10" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 12px;break-after:avoid;">Your Project Team</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:640px;margin:0 0 48px;">One phone number, one face, accountable from quote to sign-off.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:40px;">
        <div style="display:flex;flex-direction:column;gap:16px;break-inside:avoid;">
          ${avatar(f(j.preparedByName, "PM").slice(0, 2).toUpperCase())}
          <div>
            <p style="font-weight:700;font-size:1.0625rem;margin:0;">${f(j.preparedByName, "[Project Manager Name]")}</p>
            <p style="font-size:0.9375rem;color:rgba(1,25,85,0.55);margin:4px 0 0;">Project Manager, on site from first visit to sign-off</p>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;break-inside:avoid;">
          ${avatar("PC")}
          <div>
            <p style="font-weight:700;font-size:1.0625rem;margin:0;">Phil Clark</p>
            <p style="font-size:0.9375rem;color:rgba(1,25,85,0.55);margin:4px 0 0;">Founder, Height Safety &amp; Rope Access</p>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;break-inside:avoid;">
          ${avatar("C", a.proposal.teamCaroline)}
          <div>
            <p style="font-weight:700;font-size:1.0625rem;margin:0;">Caroline</p>
            <p style="font-size:0.9375rem;color:rgba(1,25,85,0.55);margin:4px 0 0;">Client Support, in the office for job updates &amp; scheduling</p>
          </div>
        </div>
      </div>
      <div style="margin-top:40px;padding-top:24px;border-top:1px solid rgba(1,25,85,0.12);">
        <p style="font-size:1rem;">Direct line: <a href="tel:${COMPANY_PHONE_TEL}" style="font-weight:700;color:${NAVY};">${esc(COMPANY_PHONE)}</a> &nbsp;&middot;&nbsp; <a href="mailto:${esc(j.preparedByEmail)}" style="font-weight:700;color:${NAVY};">${f(j.preparedByEmail, "[email address]")}</a></p>
      </div>
    </div>
  </section>`;
}

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
  ];
  const row = (p: (typeof projects)[number], reverse: boolean) => `
      <div style="display:flex;gap:48px;align-items:flex-start;margin-bottom:48px;break-inside:avoid;">
        <div style="flex:1 1 0;min-width:0;width:100%;aspect-ratio:4/3;border-radius:16px;overflow:hidden;background:rgba(1,25,85,0.08);order:${reverse ? 2 : 1};">
          <img src="${esc(p.img)}" alt="" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:16px;padding-top:8px;order:${reverse ? 1 : 2};">
          <h3 style="font-size:1.5rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0;">${p.title}</h3>
          <p style="font-size:0.9375rem;color:rgba(1,25,85,0.45);margin:0;">${p.meta}</p>
          <ul style="list-style:none;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:10px;">
            ${p.bullets.map((b) => `<li style="font-size:1rem;color:rgba(1,25,85,0.7);">&bull; ${esc(b)}</li>`).join("")}
          </ul>
        </div>
      </div>`;
  return `
  <section id="sec-11" style="padding:96px 48px;background:rgba(1,25,85,0.03);break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 40px;break-after:avoid;">Recent Projects</h2>
      ${row(projects[0], false)}
      ${row(projects[1], true)}
    </div>
  </section>`;
}

function buildTestimonial(): string {
  return `
  <section id="sec-12" style="padding:96px 48px;break-before:page;">
    <div style="max-width:820px;margin:0 auto;display:flex;flex-direction:column;align-items:center;gap:24px;text-align:center;">
      <span style="font-size:3.5rem;font-weight:700;line-height:0.6;color:#6b1f24;">&ldquo;</span>
      <p style="font-size:1.875rem;font-weight:300;line-height:1.4;letter-spacing:-0.015em;margin:0;">RAS-VERTEX carried out a full external repaint, including a thorough building wash and remedial works beforehand. Great communication and planning, with the high standards that Phil, Shane and Jason set, and the flexibility to fix issues as they came up.</p>
      <div>
        <p style="font-weight:600;margin:0;">Kerry O'Donnell</p>
        <p style="font-size:0.9375rem;color:rgba(1,25,85,0.65);margin:2px 0 0;">12 Storey Commercial High-Rise, Sunshine Coast</p>
      </div>
    </div>
  </section>`;
}

function buildSupportPlans(a: ReportAssets): string {
  const plans = [
    { title: "Annual Wash-Down", body: "Removes salt build-up and mould growth before it stains or degrades the coating system.", img: a.proposal.supportWashDown },
    { title: "Annual Inspection", body: "A short report flagging anything worth watching, before it becomes a bigger job.", img: a.proposal.supportInspection },
    { title: "Touch-Up Cover", body: "Minor scuffs and marks addressed as they appear, at a pre-agreed call-out rate.", img: a.proposal.supportTouchUp },
  ];
  return `
  <section id="sec-13" style="padding:96px 48px;background:rgba(1,25,85,0.03);break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 12px;break-after:avoid;">Support &amp; Maintenance Plans</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:700px;margin:0 0 48px;">Entirely optional, and they don't affect your 8-year warranty either way, whether you take one out or not.</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:32px;">
        ${plans
          .map(
            (p) => `
        <div style="display:flex;flex-direction:column;gap:16px;break-inside:avoid;">
          <div style="width:100%;aspect-ratio:3/4;border-radius:16px;overflow:hidden;background:rgba(1,25,85,0.08);">
            <img src="${esc(p.img)}" alt="" style="width:100%;height:100%;object-fit:cover;">
          </div>
          <div>
            <p style="font-family:'Bebas Neue',Arial,sans-serif;font-size:1.375rem;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 8px;">${p.title}</p>
            <p style="font-size:0.875rem;color:rgba(1,25,85,0.6);margin:0;">${p.body}</p>
          </div>
        </div>`,
          )
          .join("")}
      </div>
    </div>
  </section>`;
}

function buildWhoWeAre(): string {
  return `
  <section id="sec-14" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 20px;break-after:avoid;">Who We Are</h2>
      <p style="font-size:1.125rem;color:rgba(1,25,85,0.65);max-width:780px;margin:0;">Founded in 2009 when Phil brought 15 years of UK rope access experience to the Sunshine Coast. In 2023, RAS merged with Vertex Access Solutions to become RAS-VERTEX. Today: 25+ directly employed specialists across painting, waterproofing, height safety and remedial work. No subbies, one team, every trade.</p>
    </div>
  </section>`;
}

function buildInsuranceCompliance(a: ReportAssets): string {
  const stats: [string, string, string][] = [
    ["Licensed contractor", "QBCC", "Painting, waterproofing & building work"],
    ["L1 to L3 certified", "IRATA", "Every technician directly employed"],
    ["Public liability", "$20M", "Plus full workers' compensation cover"],
    ["Years on the Coast", "25+", "Noosa to Caloundra, every suburb"],
  ];
  return `
  <section id="sec-15" style="background:${PALE_BLUE};padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:80px;align-items:end;margin-bottom:40px;">
        <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0;break-after:avoid;">Licensed, certified,<br>and fully insured.</h2>
        <p style="font-size:1.0625rem;color:rgba(1,25,85,0.65);margin:0;">Every certificate is current. Every technician is directly employed. Certificates of currency are issued automatically at quote stage, with no chasing and no surprises for your committee.</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid rgba(1,25,85,0.15);">
        ${stats
          .map(
            ([label, big, sub], i) => `
        <div style="display:flex;flex-direction:column;gap:8px;padding:32px ${i < 3 ? "32px" : "0"} 32px ${i > 0 ? "32px" : "0"};${i < 3 ? "border-right:1px solid rgba(1,25,85,0.15);" : ""}break-inside:avoid;">
          <span style="font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:rgba(1,25,85,0.45);">${label}</span>
          <span style="font-size:2.25rem;font-weight:700;letter-spacing:-0.03em;line-height:1;">${big}</span>
          <span style="font-size:0.875rem;color:rgba(1,25,85,0.55);">${sub}</span>
        </div>`,
          )
          .join("")}
      </div>
      <div style="display:flex;align-items:center;gap:32px;margin-top:40px;">
        <img src="${esc(a.associations.qbcc)}" alt="QBCC" style="height:32px;width:auto;object-fit:contain;">
        <img src="${esc(a.proposal.workCover)}" alt="WorkCover Queensland" style="height:28px;width:auto;object-fit:contain;">
      </div>
    </div>
  </section>`;
}

function signatureBlockHTML(title: string, nameHTML: string, positionHTML: string): string {
  return `
        <div style="background:#ffffff;padding:40px;display:flex;flex-direction:column;gap:24px;break-inside:avoid;">
          <h3 style="font-size:1.125rem;font-weight:700;line-height:1.2;letter-spacing:-0.04em;margin:0;">${esc(title)}</h3>
          ${nameHTML}
          ${positionHTML}
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
              <span style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(1,25,85,0.45);">Signature</span>
            </div>
            <div style="display:flex;align-items:center;gap:10px;border:1px dashed rgba(1,25,85,0.25);border-radius:8px;background:rgba(1,25,85,0.08);height:52px;padding:0 16px;">
              <span style="font-family:'Caveat','Brush Script MT',cursive;font-size:1.5rem;color:rgba(1,25,85,0.35);">Sign here</span>
            </div>
          </div>
          <div style="background:rgba(1,25,85,0.08);border-radius:12px;padding:12px 48px;min-height:52px;display:flex;align-items:center;">
            <span style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(1,25,85,0.45);">Date</span>
          </div>
        </div>`;
}

function buildAcceptance(report: ProposalData): string {
  const j = report.job;
  const clientBlock = signatureBlockHTML(
    "On behalf of the Client",
    `<div style="background:rgba(1,25,85,0.08);border-radius:12px;padding:12px 48px;min-height:52px;display:flex;align-items:center;"><span style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(1,25,85,0.45);">Name</span></div>`,
    `<div style="background:rgba(1,25,85,0.08);border-radius:12px;padding:12px 48px;min-height:52px;display:flex;align-items:center;"><span style="font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:rgba(1,25,85,0.45);">Position</span></div>`,
  );
  const rasBlock = signatureBlockHTML(
    "On behalf of RAS-VERTEX",
    `<div><div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(1,25,85,0.45);margin-bottom:6px;">Name</div><div style="font-size:1rem;font-weight:700;padding-bottom:8px;">${f(j.preparedByName, "[Project Manager Name]")}</div></div>`,
    `<div><div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:rgba(1,25,85,0.45);margin-bottom:6px;">Position</div><div style="font-size:1rem;padding-bottom:8px;">Project Manager</div></div>`,
  );
  return `
  <section id="sec-16" style="padding:96px 48px;background:rgba(1,25,85,0.03);break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 12px;break-after:avoid;">Acceptance</h2>
      <p style="font-size:1.0625rem;color:rgba(1,25,85,0.65);max-width:640px;margin:0 0 48px;">Return a signed copy to accept this proposal (including the Terms &amp; Conditions set out in Appendix A), or contact us with any questions before signing.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:rgba(1,25,85,0.12);border:1px solid rgba(1,25,85,0.12);border-radius:24px;overflow:hidden;">
        ${clientBlock}
        ${rasBlock}
      </div>
      <p style="font-size:0.8125rem;color:rgba(1,25,85,0.45);margin-top:16px;">Accepted electronically or by hand, both carry equal effect under this agreement.</p>
    </div>
  </section>`;
}

// Flat, in column-major reading order (was previously three hardcoded
// 8/7/7 arrays laid out as independent CSS Grid columns in one row — that
// meant a print page break had to cut all three columns at the same pixel
// position, landing at a different item boundary in each one and orphaning
// headings. CSS multi-column below reflows this list the same way (fills
// column 1 top-to-bottom, then column 2, then column 3) but lets each page
// break fall between items instead of through them.
const APPENDIX_ITEMS: { title: string; body: string }[] = [
  { title: "General", body: "All services by RAS-VERTEX (Contractor) to client (Principal) are subject to these Terms and Conditions unless otherwise agreed." },
  { title: "Acceptance", body: "Quote valid 60 days from date. Acceptance subject to credit approval." },
  { title: "Working Hours", body: "Quote based on Monday to Friday, 7am to 5pm. Saturday work may be required. Outside-hours work incurs additional charges." },
  { title: "Warranty", body: "RAS-VERTEX guarantees workmanship per relevant jurisdiction standards and Australian Standards. Workmanship warranty equals manufacturer's material warranty period. No warranty against existing rust reoccurrence or uncontrollable environmental damage." },
  { title: "Access and Equipment", body: "Work performed via rope access from rooftops, with possible unit access. May use EWP, scaffolds, trestles and ladders." },
  { title: "Site Amenities", body: "Client provides storage, electricity, toilet facilities and water throughout the project." },
  { title: "External Cleaning", body: "RAS-VERTEX cannot guarantee removal of all stains from environmental factors, age or poor maintenance. Client is responsible for drainage and waste disposal compliance." },
  { title: "Painting Services", body: "Price excludes rectifying defects, delamination, or major substrate repairs unless pre-identified. Similar colour schemes only, colour changes may incur extra costs." },
  { title: "Painting Specifications", body: "Work complies with manufacturer specifications, which override our procedures for warranty. Manufacturer representatives conduct quality checks." },
  { title: "Height Safety", body: "Anchor services comply with AS1891. Client ensures only qualified personnel use systems after risk assessment and training per WHS legislation." },
  { title: "Building Inspections", body: "Visual inspection only, cannot detect concealed defects. Liability limited to re-inspection of identified defects, excludes consequential damages." },
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

function buildAppendix(): string {
  const items = APPENDIX_ITEMS.map(
    (it) => `
        <div style="break-inside:avoid;margin:0 0 24px;">
          <h4 style="font-size:1rem;font-weight:700;line-height:1.25;letter-spacing:-0.03em;margin:0 0 6px;">${esc(it.title)}</h4>
          <p style="font-size:0.9375rem;color:rgba(1,25,85,0.6);margin:0;">${esc(it.body)}</p>
        </div>`,
  ).join("");
  return `
  <section id="sec-appendix-a" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 40px;break-after:avoid;">Terms &amp; Conditions</h2>
      <div style="column-count:3;column-gap:40px;column-fill:auto;">${items}</div>
    </div>
  </section>`;
}

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
    <img src="${esc(assets.proposal.footerLogos)}" alt="" style="height:28px;width:auto;object-fit:contain;">
    <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;
}

const TOC_ENTRIES: [string, string][] = [
  ["sec-02", "Introduction"],
  ["sec-03", "Your Project"],
  ["sec-04", "Site Survey & Findings"],
  ["sec-05", "Project Scope: Inclusions & Exclusions"],
  ["sec-06", "Access & Disruption Plan"],
  ["sec-07", "Pricing"],
  ["sec-08", "8-Year Warranty"],
  ["sec-09", "Why Our Prep Is Different"],
  ["sec-10", "Your Project Team"],
  ["sec-11", "Recent Projects"],
  ["sec-12", "Client Testimonial"],
  ["sec-13", "Support & Maintenance Plans"],
  ["sec-14", "Who We Are"],
  ["sec-15", "Insurance & Compliance"],
  ["sec-16", "Acceptance"],
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

function buildTableOfContents(report: ProposalData): string {
  const entries = TOC_ENTRIES.filter(([id]) => {
    const toggle = TOC_SECTION_TOGGLE[id];
    return !toggle || report.sections[toggle];
  });

  const row = ([id, label]: [string, string]) => {
    const num = id.startsWith("sec-cert-")
      ? ""
      : id === "sec-appendix-a"
        ? "A"
        : id.replace("sec-", "");
    return `
        <a href="#${id}" style="display:flex;align-items:baseline;gap:20px;padding:18px 0;text-decoration:none;color:${NAVY};break-inside:avoid;">
          <span style="font-family:'Bebas Neue',Arial,sans-serif;font-size:1rem;color:rgba(1,25,85,0.35);width:28px;flex-shrink:0;">${esc(num)}</span>
          <span style="font-size:1.0625rem;">${esc(label)}</span>
        </a>`;
  };
  const half = Math.ceil(entries.length / 2);
  const col1 = entries.slice(0, half).map(row).join("");
  const col2 = entries.slice(half).map(row).join("");

  return `
  <section id="sec-toc" style="padding:96px 48px;break-before:page;">
    <div style="max-width:1400px;margin:0 auto;">
      <h2 style="font-size:clamp(2rem,3.5vw,3rem);font-weight:700;line-height:1.1;letter-spacing:-0.05em;margin:0 0 40px;break-after:avoid;">Contents</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 48px;">
        <div>${col1}</div>
        <div>${col2}</div>
      </div>
    </div>
  </section>`;
}

// ── Main export ───────────────────────────────────────────────────────────────

export function buildProposalPrintHTML(
  report: ProposalData,
  assets?: ReportAssets,
): string {
  const a = assets ?? DEFAULT_PRINT_ASSETS;

  const body = [
    buildStickyBar(a),
    buildCover(report, a),
    buildCoverLetter(report),
    buildTableOfContents(report),
    buildYourProject(report),
    report.sections.findings ? buildFindings(report) : "",
    report.sections.scope ? buildScope(report, a) : "",
    report.sections.accessPlan ? buildAccessPlan(report) : "",
    report.sections.pricing ? buildPricing(report) : "",
    buildWarranty(a),
    buildWhyPrepDifferent(a),
    buildProjectTeam(report, a),
    buildRecentProjects(a),
    buildTestimonial(),
    buildSupportPlans(a),
    buildWhoWeAre(),
    buildInsuranceCompliance(a),
    buildAcceptance(report),
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
    .rv-sticky-bar { position: static !important; }
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
