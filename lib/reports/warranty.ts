// lib/reports/warranty.ts
// The warranty pages of the Job overview (project report). Two kinds only:
// waterproofing and painting. Each is RAS-VERTEX's own warranty on the
// workmanship, with what the owner must do to keep it valid and the
// inspections (and, for painting, the washes) that go with it.
//
// The supplier is only named as the manufacturer of the products applied;
// no manufacturer's warranty terms are quoted.

export type WarrantyKind = "waterproofing" | "painting";
export const WARRANTY_KINDS: WarrantyKind[] = ["waterproofing", "painting"];

export type SupplierKey = "adheseal" | "sika" | "dulux" | "haymes" | "other";

export const SUPPLIERS: Record<SupplierKey, { name: string; kinds: WarrantyKind[] }> = {
  adheseal: { name: "Adheseal", kinds: ["waterproofing"] },
  sika: { name: "Sika", kinds: ["waterproofing"] },
  dulux: { name: "Dulux", kinds: ["painting"] },
  haymes: { name: "Haymes", kinds: ["painting"] },
  other: { name: "Other / not listed", kinds: ["waterproofing", "painting"] },
};

export interface WarrantyScheduleRow {
  when: string;
  inspection: string;
  notes: string;
}

export interface WarrantyInfo {
  on: boolean;
  supplier: SupplierKey;
  /** Shown instead of the preset name for "other". */
  supplierName?: string;
  years: number;
  /** "Roof", "Balconies L2–L6" … */
  area: string;
  /** Completion date, "YYYY-MM-DD": the warranty commences then. */
  completed: string;
  products: string;
  /** What the owner must do to keep the warranty valid. */
  requirements: string[];
  schedule: WarrantyScheduleRow[];
  /** Overrides for the generated wording; blank uses it. */
  intro?: string;
  statement?: string;
  /** Date the statement is signed, "YYYY-MM-DD"; defaults to the report date. */
  signed?: string;
}

/** The report's warranty section: on or off, then each kind on or off. */
export interface Warranties {
  on: boolean;
  waterproofing?: WarrantyInfo;
  painting?: WarrantyInfo;
}

export const KIND: Record<
  WarrantyKind,
  { title: string; years: number; area: string; obligations: string; scheduleTitle: string; scheduleIntro: string }
> = {
  waterproofing: {
    title: "Waterproofing warranty",
    years: 7,
    area: "Roof",
    obligations: "Mandatory requirements",
    scheduleTitle: "Recommended inspection schedule",
    scheduleIntro:
      "RAS-VERTEX recommends annual inspections to identify issues such as building movement, surface cracking, mechanical damage or drain blockage before they trigger a warranty exclusion.",
  },
  painting: {
    title: "Painting warranty",
    years: 8,
    area: "External",
    obligations: "Owner obligations",
    scheduleTitle: "Maintenance schedule",
    scheduleIntro:
      "Washing is a condition of this warranty. Inspections are recommended to pick up cracking, sealant failure, water ingress or mechanical damage before they become a warranty exclusion.",
  },
};

/** dd/mm/yyyy, as on the warranty page. */
export const shortDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-AU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export function addYears(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

export function defaultRequirements(kind: WarrantyKind, years: number): string[] {
  return kind === "waterproofing"
    ? [
        `At the request of building maintenance personnel, the membrane is to be inspected every ${years} years. Any required maintenance works identified must be carried out at the building owner's expense.`,
        "The membrane must be adequately protected, and water must drain freely from the membrane surface.",
        "Any alleged non-performance must be notified in writing within one month of becoming aware of it. Notify RAS-VERTEX first, and we will lodge the claim with the manufacturer on your behalf.",
      ]
    : [
        "Wash painted surfaces at least every 12 months.",
        "Maintain roofs, gutters, flashings, sealants and membranes, and repair damage promptly.",
        "Do not apply other coatings or alter painted areas without our written consent.",
        "Keep maintenance records.",
      ];
}

export function defaultSchedule(kind: WarrantyKind, years: number): WarrantyScheduleRow[] {
  return kind === "waterproofing"
    ? [
        {
          when: "Annually",
          inspection: "Roof level inspection",
          notes:
            "Roof membrane integrity, façade render and cracks, joints and sealing, corrosion and other potential water ingress points. Photographic report provided. RAS-VERTEX can provide this service.",
        },
        {
          when: `Year ${years}`,
          inspection: "Full warranty inspection",
          notes:
            "Full assessment prior to warranty expiry. Identifies any maintenance required at the building owner's cost. Consider recoating at this stage.",
        },
      ]
    : [
        {
          when: "Annual",
          inspection: "Building washdown",
          notes:
            "Full external clean of façades, balcony walls and ceilings, ground-level and boundary walls, with chlorine pre and post-treatment as required. Removes salt, dirt and mould that break down the coating.",
        },
        {
          when: "Annual",
          inspection: "Building inspection",
          notes:
            "Check for peeling, blistering, cracking, failed sealants, rust staining and water ingress. Photographic report provided.",
        },
      ];
}

export function newWarranty(kind: WarrantyKind, completed: string): WarrantyInfo {
  const k = KIND[kind];
  return {
    on: true,
    supplier: "other",
    years: k.years,
    area: k.area,
    completed,
    products: "",
    requirements: defaultRequirements(kind, k.years),
    schedule: defaultSchedule(kind, k.years),
  };
}

/** Which kind the job looks like, from its description. */
export function guessKind(description: string | null | undefined): WarrantyKind {
  const t = (description ?? "").toLowerCase();
  const paint = /paint|coating|repaint/.test(t);
  const wp = /waterproof|membrane/.test(t);
  return paint && !wp ? "painting" : "waterproofing";
}

/** Drafts saved before the two kinds had a single warranty; read them as
 *  one kind. */
export function normWarranties(raw: unknown, completed: string): Warranties | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const w = raw as Record<string, unknown>;
  if (!("supplier" in w)) return w as unknown as Warranties;
  const supplier = (w.supplier as SupplierKey) in SUPPLIERS ? (w.supplier as SupplierKey) : "other";
  const kind: WarrantyKind = supplier === "dulux" || supplier === "haymes" ? "painting" : "waterproofing";
  const base = newWarranty(kind, (w.completed as string) || completed);
  return {
    on: !!w.on,
    [kind]: {
      ...base,
      supplier,
      supplierName: w.supplierName as string | undefined,
      years: Number(w.years) || base.years,
      area: (w.area as string) || base.area,
      products: (w.products as string) || "",
    },
  };
}

/** The manufacturer, as printed. */
export const supplierName = (w: WarrantyInfo) => (w.supplier === "other" ? w.supplierName?.trim() || "" : SUPPLIERS[w.supplier].name);

/** What a switched-on warranty must have before the report is saved or
 *  downloaded. */
export const WARRANTY_REQUIRED = [
  { key: "area", label: "area of works" },
  { key: "products", label: "products applied" },
  { key: "completed", label: "completion date" },
] as const;

export const isMissing = (w: WarrantyInfo, key: (typeof WARRANTY_REQUIRED)[number]["key"]) => !String(w[key] ?? "").trim();

/** "Waterproofing warranty: products applied, completion date", one per
 *  incomplete warranty; empty when there's nothing to fix. */
export function warrantyGaps(raw: unknown, completed: string): string[] {
  const ws = normWarranties(raw, completed);
  if (!ws?.on) return [];
  return WARRANTY_KINDS.flatMap((k) => {
    const w = ws[k];
    if (!w?.on) return [];
    const missing = WARRANTY_REQUIRED.filter((r) => isMissing(w, r.key)).map((r) => r.label);
    return missing.length ? [`${KIND[k].title}: ${missing.join(", ")}`] : [];
  });
}
