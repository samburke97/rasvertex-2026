// lib/recertifications/types.ts

/**
 * daysUntilDue/status are always derived from nextDueDate relative to
 * *today* — never trust a stored value for these two fields, since "today"
 * keeps moving but a cached row doesn't. Compute fresh every time a row is
 * read, whether it came from a live SimPRO fetch or the Neon cache.
 */
export function computeDueStatus(nextDueDateISO: string): {
  daysUntilDue: number;
  status: RecertificationJob["status"];
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil(
    (new Date(nextDueDateISO).getTime() - today.getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const status: RecertificationJob["status"] =
    daysUntilDue < 0 ? "overdue" : daysUntilDue <= 60 ? "due-soon" : "upcoming";
  return { daysUntilDue, status };
}

export interface RecertificationJob {
  id: number;
  name: string;
  customer: string;
  customerId: number;
  site: string;
  siteId: number;
  completedDate: string;
  nextDueDate: string;
  daysUntilDue: number;
  status: "overdue" | "due-soon" | "upcoming";
  totalExTax: number;
  totalIncTax: number;
  quoteYear: number;
}
