// lib/reports/works-agreement/types.ts

export interface PaymentScheduleItem {
  label: string; // "Payment 1", "Payment 2", etc.
  percentage: number; // 10, 25, etc.
  value: number; // calculated dollar amount inc GST
  description: string;
}

export interface WorksAgreementData {
  // Job identifiers
  jobId: string;
  jobNo: string;
  jobName: string;

  // Parties
  clientName: string; // e.g. "The Mirage Alexandra Headland"
  siteAddress: string; // e.g. "6 Mari Street, Alexandra Headland, QLD"
  siteName: string; // e.g. "The Mirage"

  // Works details
  initialWorks: string; // Free text – what work is being done
  colourScheme: string; // "To be advised" or specific

  // Financials
  totalIncGst: number; // e.g. 34804.00
  paymentSchedule: PaymentScheduleItem[];

  // Metadata
  date: string; // AU formatted: DD/MM/YYYY
  createdAt: string; // ISO timestamp
  status: "draft" | "sent" | "accepted";
  triggeredBy: "webhook" | "manual";
}

export type AgreementStatus = WorksAgreementData["status"];

// ── Payment schedule templates ─────────────────────────────────────────────

/** Jobs up to $100,000 inc GST — 5 payment schedule */
export const SCHEDULE_5: Omit<PaymentScheduleItem, "value">[] = [
  {
    label: "Payment 1",
    percentage: 10,
    description: "Deposit, payable on execution date.",
  },
  {
    label: "Payment 2",
    percentage: 25,
    description: "Progress payment due upon 35% of completion.",
  },
  {
    label: "Payment 3",
    percentage: 25,
    description: "Progress payment due upon 60% of completion.",
  },
  {
    label: "Payment 4",
    percentage: 25,
    description: "Progress payment due upon 85% of completion.",
  },
  {
    label: "Payment 5",
    percentage: 15,
    description: "Final payment due upon completion.",
  },
];

/** Jobs above $100,000 inc GST — 6 payment schedule */
export const SCHEDULE_6: Omit<PaymentScheduleItem, "value">[] = [
  {
    label: "Payment 1",
    percentage: 10,
    description: "Deposit, payable on execution date.",
  },
  {
    label: "Payment 2",
    percentage: 15,
    description: "Progress payment due upon 25% of completion.",
  },
  {
    label: "Payment 3",
    percentage: 25,
    description: "Progress payment due upon 50% of completion.",
  },
  {
    label: "Payment 4",
    percentage: 25,
    description: "Progress payment due upon 75% of completion.",
  },
  {
    label: "Payment 5",
    percentage: 15,
    description: "Progress payment due upon 90% of completion.",
  },
  {
    label: "Payment 6",
    percentage: 10,
    description: "Final payment due upon completion.",
  },
];

export function buildPaymentSchedule(
  totalIncGst: number,
): PaymentScheduleItem[] {
  const template = totalIncGst > 100000 ? SCHEDULE_6 : SCHEDULE_5;
  return template.map((item) => ({
    ...item,
    value: Math.round((item.percentage / 100) * totalIncGst * 100) / 100,
  }));
}

// ── SimPRO webhook payload shape ──────────────────────────────────────────

export interface SimproWebhookPayload {
  event: string; // "job.created" | "job.updated"
  companyId?: number;
  data: {
    ID: number;
    No?: string;
    Name?: string;
    Total?: {
      IncTax?: number;
      ExTax?: number;
      Tax?: number;
    };
    Customer?: {
      ID: number;
      CompanyName?: string;
      GivenName?: string;
      FamilyName?: string;
    };
    Site?: {
      ID: number;
      Name?: string;
      Address?: string;
      City?: string;
      State?: string;
      PostCode?: string;
    };
    DateIssued?: string;
    Stage?: string;
  };
}
