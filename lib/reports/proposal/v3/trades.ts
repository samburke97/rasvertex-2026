// lib/reports/proposal/v3/trades.ts
//
// What differs between a painting and a waterproofing proposal. Everything
// else — the pages, layout, pricing, survey and acceptance — is shared.
// Default copy for new proposals lives in createProposal (types.ts), which
// reads the trade's wording from here.

export type Trade = "painting" | "waterproofing";

export type Brand = "dulux" | "haymes" | "sika" | "adheseal";

const A = "/reports/proposal/v3/";

export const BRANDS: Record<Brand, { name: string; logo: string; height: number }> = {
  dulux: { name: "Dulux", logo: A + "dulux.svg", height: 52 },
  haymes: { name: "Haymes", logo: A + "haymes.svg", height: 52 },
  sika: { name: "Sika", logo: A + "wp/sika.png", height: 60 },
  adheseal: { name: "Adheseal", logo: A + "wp/adheseal.png", height: 40 },
};

export interface TradeDef {
  label: string; // "Painting"
  noun: string; // "painting"
  warrantyYears: number;
  brands: Brand[];
  /** Standard photo folders switched on for a new proposal. */
  folders: string[];
  company: {
    h2: string;
    lede: string;
    /** Grid photos: tall left, top middle, right middle, bottom right. */
    photos: { a: [string, string]; g: [string, string]; c: [string, string]; d: [string, string] };
    warrantyLine: string;
  };
  recent: {
    photo: string;
    quote: string;
    who: string;
    role: string;
    logo?: string;
  };
  coverPhoto: string;
  projectPhoto: string;
  /** Maintenance plan row 03. */
  hoursLabel: string;
  /** Spec table: panel heading and the third column's header. */
  specTitle: string;
  coatsLabel: string;
  /** T&C clauses replaced for this trade, by heading. */
  terms: Record<string, { k: string; v: string }>;
}

export const TRADES: Record<Trade, TradeDef> = {
  painting: {
    label: "Painting",
    noun: "painting",
    warrantyYears: 8,
    brands: ["dulux", "haymes"],
    folders: ["building", "team"],
    company: {
      h2: "The Sunshine Coast’s leading commercial and body corporate painting team.",
      lede: "For over 25 years, we’ve completed painting projects with one dedicated team, right here on the Sunshine Coast. No subcontractors, no handovers, just the same experienced faces on site from start to finish.",
      photos: {
        a: [A + "team-abseil.jpg", "center 40%"],
        g: [A + "team-gutter.jpg", "30% center"],
        c: [A + "team-painting.jpg", "35% center"],
        d: [A + "team-tower.jpg", "center 30%"],
      },
      warrantyLine: "Every exterior repaint is backed by an 8-year written warranty covering workmanship and the paint system.",
    },
    recent: {
      photo: A + "trafalgar.jpg",
      quote:
        "“The RAS-VERTEX team are pros. Top quality workmanship and always in a professional manner. We've used RAS-VERTEX on a number of commercial painting projects and they always deliver. Especially if there's something we need when access is difficult, this is the team we always turn to.”",
      who: "Tim Lee",
      role: "Quality First Constructions",
      logo: A + "clients/quality-first-navy.png",
    },
    coverPhoto: A + "web-the-work.jpg",
    projectPhoto: A + "project-2.jpeg",
    hoursLabel: "Painting hours",
    specTitle: "Paint specification",
    coatsLabel: "Coats",
    terms: {},
  },
  waterproofing: {
    label: "Waterproofing",
    noun: "waterproofing",
    warrantyYears: 7,
    brands: ["sika", "adheseal"],
    folders: ["waterproofing", "team"],
    company: {
      h2: "The Sunshine Coast’s leading commercial and body corporate waterproofing team.",
      lede: "From crack repair through to full membrane replacement, we handle waterproofing for schools, body corporates and commercial buildings across the Sunshine Coast, built to handle our coastal conditions.",
      photos: {
        a: [A + "wp/prep-done-right.jpg", "center 30%"],
        g: [A + "wp/leading-systems.jpg", "30% center"],
        c: [A + "wp/documented-waterproofing.jpg", "35% center"],
        d: [A + "wp/membrane-rooftop.jpg", "center 40%"],
      },
      warrantyLine: "Every waterproofing system is backed by a 7-year written warranty covering workmanship and the membrane system.",
    },
    recent: {
      photo: A + "wp/waterproofing-services.jpg",
      quote:
        "“The team of Maxwell, Rob, Shannon and Nick did an amazing job in extremely difficult circumstances, with real professionalism and attention to detail throughout.”",
      who: "Paul McCarthy",
      role: "Medici",
    },
    coverPhoto: A + "wp/membrane-rooftop.jpg",
    projectPhoto: A + "wp/waterproofing-services.jpg",
    hoursLabel: "Repair hours",
    specTitle: "Membrane specification",
    coatsLabel: "Application",
    terms: {
      Warranty: {
        k: "Warranty",
        v: "7-year written workmanship warranty on waterproofing works, as stated in this proposal, to relevant jurisdiction and Australian Standards. Excludes structural movement, damage by others and uncontrollable environmental damage.",
      },
      "Painting Services": {
        k: "Waterproofing Services",
        v: "Price includes repair of every defect flagged in the site survey. Defects hidden at survey are latent conditions, priced and approved in writing before work proceeds.",
      },
      "Painting Specifications": {
        k: "Waterproofing Specifications",
        v: "Work complies with membrane manufacturer specifications, which override our procedures for warranty. Manufacturer representatives conduct quality checks.",
      },
    },
  },
};

export const tradeOf = (t: string | undefined): TradeDef => TRADES[(t as Trade) ?? "painting"] ?? TRADES.painting;
