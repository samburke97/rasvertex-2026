// lib/recertifications/categories.ts
//
// Single source of truth for the recurring-job categories tracked on the
// /recurring-jobs page. Each category maps to one or more SimPRO cost
// centre IDs (a site's most recent job in any of those cost centres counts
// toward that category) plus the copy/text that differs per category —
// quote name, "already quoted" keyword match, page heading, email subject.
//
// Cost centre IDs confirmed against SimPRO's live jobCostCenters data
// (2026-07-23): Height Safety=11, Window Cleaning=16, Bluewater - Window
// Cleaning=4, Surface Cleaning=14, Pressure Cleaning=13.

export type RecurringCategory =
  | "height-safety"
  | "window-cleaning"
  | "building-cleaning";

export interface CategoryConfig {
  id: RecurringCategory;
  label: string;
  pageHeading: string;
  /** SimPRO cost centre IDs that all count toward this category. */
  costCentreIds: number[];
  /** Used when *creating* a new quote — the first ID is the one assigned. */
  primaryCostCentreId: number;
  quoteName: (year: number) => string;
  /** Lowercased substrings — an existing SimPRO quote whose name contains
   *  any of these is treated as "already quoted" for this category. */
  quoteMatchKeywords: string[];
  emailSubjectNoun: string;
  /** ISO date (YYYY-MM-DD) — overrides the default 2-year job-history
   *  lookback. Set on categories with sparse recent history so older
   *  completed jobs still surface instead of being filtered out. */
  historySince?: string;
}

export const RECURRING_CATEGORIES: Record<RecurringCategory, CategoryConfig> =
  {
    "height-safety": {
      id: "height-safety",
      label: "Height Safety",
      pageHeading: "Anchor Recertifications",
      costCentreIds: [11],
      primaryCostCentreId: 11,
      quoteName: (year) => `Annual Anchor Recertification - ${year}`,
      quoteMatchKeywords: [
        "anchor recertification",
        "annual anchor recertification",
        "annual anchor test",
        "anchor test and recertification",
        "anchor rest and recertification",
        "anchor test",
        "recertification",
      ],
      emailSubjectNoun: "anchor recertification",
    },
    "window-cleaning": {
      id: "window-cleaning",
      label: "Window Cleaning",
      pageHeading: "Window Cleaning Recurring Jobs",
      costCentreIds: [16, 4],
      primaryCostCentreId: 16,
      quoteName: (year) => `Annual Window Cleaning - ${year}`,
      quoteMatchKeywords: ["window cleaning"],
      emailSubjectNoun: "window cleaning",
      // TEMPORARY (added 2026-07-23, requested by Sam) — this category was
      // only just started, so the default 2-year lookback misses most of
      // its real history. Widened to capture everything back to 2020.
      // Revert to the 2-year default once there's enough recent data.
      historySince: "2020-01-01",
    },
    "building-cleaning": {
      id: "building-cleaning",
      label: "Building Cleaning",
      pageHeading: "Building Cleaning Recurring Jobs",
      costCentreIds: [14, 13],
      primaryCostCentreId: 14,
      quoteName: (year) => `Annual Building Cleaning - ${year}`,
      quoteMatchKeywords: [
        "building cleaning",
        "surface cleaning",
        "pressure cleaning",
      ],
      emailSubjectNoun: "building cleaning",
      // TEMPORARY — see window-cleaning's historySince comment above.
      historySince: "2020-01-01",
    },
  };

export const RECURRING_CATEGORY_LIST: CategoryConfig[] = Object.values(
  RECURRING_CATEGORIES,
);

export function isRecurringCategory(
  value: string | null,
): value is RecurringCategory {
  return !!value && value in RECURRING_CATEGORIES;
}
