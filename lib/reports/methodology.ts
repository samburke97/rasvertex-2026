// lib/reports/methodology.ts
// The Job overview's optional Methodology section: how the works were
// carried out, as numbered steps in named stages, with an optional photo.
// Templates are a starting point; every step is editable.

export interface MethodGroup {
  title: string;
  /** One step per item: list HTML from the "/" editor. */
  steps: string;
}

export interface Methodology {
  intro: string;
  groups: MethodGroup[];
  /** A job photo shown after the steps, with its caption. */
  photoId?: string | null;
  caption?: string;
}

const list = (items: string[]) => `<ul>${items.map((t) => `<li><p>${t}</p></li>`).join("")}</ul>`;

const PRE_CONSTRUCTION: MethodGroup = {
  title: "Pre-construction",
  steps: list([
    "Prepare a site-specific Risk Assessment and Safe Work Method Statement (SWMS) in accordance with the Work Health and Safety Regulations 2011.",
    "Complete site induction and hazard identification.",
    "Establish exclusion zones at ground level with appropriate signage and barriers.",
    "Install a perimeter screening system to mitigate debris migration.",
    "Install protective sheeting to interior floor surfaces as required.",
  ]),
};

export const METHOD_TEMPLATES: Record<"waterproofing" | "painting", { label: string; method: Methodology }> = {
  waterproofing: {
    label: "Roof waterproofing",
    method: {
      intro: "How the roof waterproofing was carried out, from site setup to the final membrane coats.",
      groups: [
        PRE_CONSTRUCTION,
        {
          title: "Substrate preparation",
          steps: list([
            "Mechanically remove the existing coating system by grinding to expose the concrete substrate.",
            "Inspect and remediate the drainage system as required to ensure compliance with AS/NZS 3500.3 (Stormwater Drainage).",
            "Replace deck-tight seals at all slab penetrations.",
            "Apply levelling compound or screed to isolated low-lying areas to promote positive drainage and eliminate ponding. A full re-screed is excluded from this scope.",
            "Cut drainage channels where required to improve water flow pathways.",
            "Repair substrate cracks in accordance with the manufacturer's specifications.",
            "Remove all waste materials from site in accordance with environmental management requirements.",
          ]),
        },
        {
          title: "Waterproofing application",
          steps: list([
            "Apply one (1) coat of epoxy primer to the substrate, extending 150mm up all vertical surfaces or to the top of the parapet or hob.",
            "Install flexible polyurethane sealant at all wall-to-floor junctions and movement joints.",
            "Apply two (2) coats of weather-resistant polyurethane waterproofing membrane, extending 150mm up all vertical surfaces or to the top of the parapet or hob, achieving the minimum dry film thickness to the manufacturer's specifications.",
            "Apply two (2) coats of weather-resistant polyurethane trafficable waterproofing membrane, extending 150mm up all vertical surfaces or to the top of the parapet or hob, achieving the minimum dry film thickness to the manufacturer's specifications.",
          ]),
        },
      ],
    },
  },
  painting: {
    label: "External repaint",
    method: {
      intro: "How the external repaint was carried out, from site setup to the final coats.",
      groups: [
        PRE_CONSTRUCTION,
        {
          title: "Surface preparation",
          steps: list([
            "Pressure clean all painted and rendered surfaces to remove dirt, mould, salt and chalking.",
            "Repair cracks and defects in the substrate in accordance with the manufacturer's specifications.",
            "Scrape and sand loose or flaking paint back to a sound edge.",
            "Spot prime bare and repaired areas.",
            "Seal joints and junctions with flexible sealant where required.",
          ]),
        },
        {
          title: "Coating application",
          steps: list([
            "Apply one (1) coat of sealer or primer suited to the substrate.",
            "Apply two (2) full coats of the specified exterior topcoat, achieving the minimum film build to the manufacturer's specifications.",
            "Inspect each elevation on completion and rectify any defects before access equipment is removed.",
          ]),
        },
      ],
    },
  },
};

// ── From the job's description ───────────────────────────────────────────────
// SimPRO descriptions are written as bold headings ("Substrate Preparation",
// "Floor slabs:") each followed by a bulleted list. Each heading becomes a
// stage and its bullets the steps; text under a scope heading (or before any
// heading) becomes the intro. The method is the run of bulleted stages: it
// ends at the first heading written as paragraphs (a quote's conditions and
// assumptions), and quote-only headings (notes, exclusions…) are left out.

const SKIP = /^(notes?|exclusions?|inclusions?|pricing|price|payment|terms|validity|warranty|assumptions?|clarifications?|standards)\b/i;
const SCOPE = /^(project )?scope( of works)?\b/i;
const MARKER = /^methodology$/i;

const decode = (s: string) =>
  s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const textOf = (html: string) => decode(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();

/** "PRE-CONSTRUCTION PHASE:" → "Pre-construction phase". */
function cleanTitle(t: string): string {
  const s = t.replace(/[:\s]+$/, "").trim();
  if (s !== s.toUpperCase()) return s;
  const lower = s.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** A step as a sentence: bullet marks gone, capitalised, full stop. */
function cleanStep(t: string): string {
  let s = t.replace(/^([-–•*·]|\d+[.)])\s*/, "").trim();
  if (!s) return "";
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return /[.!?:;]$/.test(s) ? s : s + ".";
}

export function methodFromDescription(html: string | null | undefined): Methodology | null {
  if (!html?.trim()) return null;
  const intro: string[] = [];
  const groups: { title: string; steps: string[]; paras: number; skip: boolean; scope: boolean }[] = [];
  for (const seg of html.split(/<\/(?:div|p|li|h[1-6])>|<br\s*\/?>/i)) {
    const text = textOf(seg);
    if (!text) continue;
    const isLi = /<li\b/i.test(seg);
    const strong = [...seg.matchAll(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => textOf(m[2])).join(" ").trim();
    const heading = !isLi && (/<h[1-6]\b/i.test(seg) || (strong && strong === text));
    if (heading) {
      const title = cleanTitle(text);
      if (MARKER.test(title)) continue;
      groups.push({ title, steps: [], paras: 0, skip: SKIP.test(title), scope: SCOPE.test(title) });
      continue;
    }
    const g = groups[groups.length - 1];
    if (!isLi && (!g || g.scope)) intro.push(text);
    else if (!g) groups.push({ title: "", steps: [text], paras: 0, skip: false, scope: false });
    else {
      g.steps.push(text);
      if (!isLi) g.paras++;
    }
  }
  const kept: MethodGroup[] = [];
  for (const g of groups) {
    if (g.scope || !g.steps.length) continue;
    if (g.skip || g.paras) {
      if (kept.length) break;
      continue;
    }
    kept.push({ title: g.title, steps: list(g.steps.map(cleanStep).filter(Boolean).map(escape)) });
  }
  if (!kept.length) return null;
  return {
    intro: intro.length ? intro.map(cleanStep).join(" ") : "How the works were carried out, from site setup to completion.",
    groups: kept,
  };
}
