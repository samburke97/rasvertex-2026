// lib/checkin/simpro.ts
//
// Read-only SimPRO pull for Client Check-in: every customer, job, job cost
// centre, quote, invoice and site. GET requests only. Takes 1–2 minutes, so
// it only runs from the sync route (button + daily cron), never per page view.

import { fetchWithTimeout } from "@/lib/simpro/timeout";

const PAGE_SIZE = 250;
// Pages of 250 jobs with descriptions can be slow; the shared 10s default
// is too tight for a bulk pull.
const PAGE_TIMEOUT_MS = 45_000;

type Tag = string | { Name?: string };
interface Person {
  GivenName?: string;
  FamilyName?: string;
  Email?: string;
}

export interface RawCustomer {
  ID: number;
  CompanyName?: string;
  GivenName?: string;
  FamilyName?: string;
  Email?: string;
  Phone?: string;
  CellPhone?: string;
  AltPhone?: string;
  DoNotCall?: boolean;
  Tags?: Tag[];
  Contacts?: (Person & { ID: number })[];
  Sites?: { ID: number; Name?: string }[];
}

export interface RawJob {
  ID: number;
  Name?: string;
  Description?: string;
  Stage?: string;
  Status?: { ID: number; Name?: string };
  DateIssued?: string;
  CompletedDate?: string | null;
  Customer?: { ID: number };
  Site?: { ID: number; Name?: string };
  Total?: { ExTax?: number };
  CustomerContact?: (Person & { ID?: number }) | null;
}

export interface RawJobCostCentre {
  CostCenter?: { ID: number; Name?: string };
  Job?: { ID: number };
}

export interface RawQuote {
  ID: number;
  Name?: string;
  Status?: { ID: number; Name?: string };
  IsClosed?: boolean;
  DateIssued?: string;
  Customer?: { ID: number };
  Site?: { ID: number; Name?: string };
  Total?: { ExTax?: number };
}

export interface RawInvoice {
  ID: number;
  Customer?: { ID: number };
  IsPaid?: boolean;
  IsCredit?: boolean;
  Total?: { ExTax?: number; IncTax?: number; Paid?: number };
  DateIssued?: string;
  DueDate?: string;
}

export interface RawSite {
  ID: number;
  Name?: string;
  Address?: { City?: string };
}

export interface SimproPull {
  companies: RawCustomer[];
  individuals: RawCustomer[];
  jobs: RawJob[];
  jobCostCentres: RawJobCostCentre[];
  quotes: RawQuote[];
  invoices: RawInvoice[];
  sites: RawSite[];
}

async function get<T>(url: string, attempt = 1): Promise<T> {
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { Authorization: `Bearer ${process.env.SIMPRO_ACCESS_TOKEN}` }, cache: "no-store" },
      PAGE_TIMEOUT_MS,
    );
    if ((res.status === 429 || res.status >= 500) && attempt < 4) throw new Error(`SimPRO ${res.status}`);
    if (!res.ok) throw Object.assign(new Error(`SimPRO ${res.status}: ${res.statusText}`), { fatal: true });
    return (await res.json()) as T;
  } catch (err) {
    if (attempt >= 4 || (err as { fatal?: boolean }).fatal) throw err;
    await new Promise((r) => setTimeout(r, 1000 * attempt * attempt));
    return get<T>(url, attempt + 1);
  }
}

async function all<T>(pathAndQuery: string): Promise<T[]> {
  const base = `${process.env.NEXT_PUBLIC_SIMPRO_BASE_URL}/api/v1.0/companies/0`;
  const out: T[] = [];
  for (let page = 1; ; page++) {
    const batch = await get<T[]>(`${base}${pathAndQuery}&pageSize=${PAGE_SIZE}&page=${page}`);
    out.push(...batch);
    if (batch.length < PAGE_SIZE) return out;
  }
}

export async function pullSimpro(): Promise<SimproPull> {
  const [companies, individuals, jobs, jobCostCentres, quotes, invoices, sites] = await Promise.all([
    all<RawCustomer>("/customers/companies/?columns=ID,CompanyName,Email,Phone,AltPhone,DoNotCall,Contacts,Sites,Tags"),
    all<RawCustomer>("/customers/individuals/?columns=ID,GivenName,FamilyName,Email,Phone,CellPhone,AltPhone,DoNotCall,Contacts,Sites,Tags"),
    all<RawJob>("/jobs/?columns=ID,Name,Description,Stage,Status,DateIssued,CompletedDate,Customer,Site,Total,CustomerContact"),
    all<RawJobCostCentre>("/jobCostCenters/?columns=ID,CostCenter,Job"),
    all<RawQuote>("/quotes/?columns=ID,Name,Status,IsClosed,DateIssued,Customer,Site,Total"),
    all<RawInvoice>("/customerInvoices/?columns=ID,Customer,IsPaid,IsCredit,Total,DateIssued,DueDate"),
    all<RawSite>("/sites/?columns=ID,Name,Address"),
  ]);
  return { companies, individuals, jobs, jobCostCentres, quotes, invoices, sites };
}
