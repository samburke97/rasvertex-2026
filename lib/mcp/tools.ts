// lib/mcp/tools.ts
// ─────────────────────────────────────────────────────────────────────────────
// The tools the Claude connector offers. These are read-only; the ones that
// create records (simpro_create_job, simpro_create_quote, simpro_add_note)
// are in ./actions.ts and appended to TOOLS at the bottom.
//
//   simpro_search_jobs / _quotes / _customers / _sites — quick text search
//   simpro_find_contact — is this person already a contact? (typo-tolerant,
//                       with the customers and sites each belongs to)
//   simpro_get_record — one job, quote, customer, site, invoice or employee
//   simpro_query      — any SimPRO GET with filters, for questions the
//                       search tools don't cover (Claude builds the query
//                       from simpro_api_guide)
//   simpro_api_guide  — how SimPRO's paths, filters and paging work
// ─────────────────────────────────────────────────────────────────────────────

import { simproRead, toText, like } from "./simpro";
import { ACTIONS } from "./actions";

type Args = Record<string, unknown>;

export interface Tool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** false for tools that create records in SimPRO; default true. */
  readOnly?: boolean;
  run: (args: Args) => Promise<string>;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const int = (v: unknown, def: number, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), max) : def;
};

/** Runs several reads and merges the rows by ID, keeping the first seen. */
async function merged(asks: Promise<{ data: unknown }>[], limit: number) {
  const lists = await Promise.allSettled(asks);
  const seen = new Set<unknown>();
  const rows: Record<string, unknown>[] = [];
  for (const l of lists) {
    if (l.status !== "fulfilled" || !Array.isArray(l.value.data)) continue;
    for (const r of l.value.data as Record<string, unknown>[]) {
      if (seen.has(r.ID) || rows.length >= limit) continue;
      seen.add(r.ID);
      rows.push(r);
    }
  }
  if (!rows.length && lists.length && lists.every((l) => l.status === "rejected")) {
    throw (lists[0] as PromiseRejectedResult).reason;
  }
  return rows;
}

/** 0–1 likeness of two strings (1 = same), from edit distance. */
function likeness(a: string, b: string): number {
  a = a.toLowerCase().replace(/\s+/g, " ").trim();
  b = b.toLowerCase().replace(/\s+/g, " ").trim();
  if (!a || !b) return 0;
  const d: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - d[b.length] / Math.max(a.length, b.length);
}

interface ContactRow {
  ID: number;
  GivenName?: string;
  FamilyName?: string;
  Email?: string;
}

const fullName = (c: ContactRow) => `${c.GivenName ?? ""} ${c.FamilyName ?? ""}`.trim();

/** Finds contacts by name or email, allowing for typos, with the customers and sites each belongs to. */
async function findContacts(query: string, customerId: number, siteId: number, limit: number) {
  const q = query.trim();
  const words = q.split(/\s+/).filter(Boolean);
  const first = words[0] ?? "";
  const last = words.length > 1 ? words[words.length - 1] : "";
  const cols = { columns: "ID,GivenName,FamilyName,Email", pageSize: 100 };
  const asks: Promise<{ data: unknown }>[] = [];
  if (q.includes("@")) asks.push(simproRead("/contacts/", { Email: like(q), ...cols }));
  if (first) asks.push(simproRead("/contacts/", { GivenName: like(first), ...cols }));
  if (last) {
    asks.push(simproRead("/contacts/", { FamilyName: like(last), ...cols }));
    // Typos: also the surnames that start the same way.
    if (last.length >= 4) asks.push(simproRead("/contacts/", { FamilyName: `${last.slice(0, 3)}%`, ...cols }));
  } else if (first) {
    asks.push(simproRead("/contacts/", { FamilyName: like(first), ...cols }));
  }
  // The contacts already on this customer / site, whatever their spelling.
  if (customerId) asks.push(simproRead(`/customers/${customerId}/contacts/`, { display: "all", pageSize: 100 }));
  if (siteId) asks.push(simproRead(`/sites/${siteId}/contacts/`, { display: "all", pageSize: 100 }));

  const pool = (await merged(asks, 2000)) as unknown as ContactRow[];
  const scored = pool
    .map((c) => {
      const name = fullName(c);
      const score = q.includes("@")
        ? likeness(q, c.Email ?? "")
        : Math.max(likeness(q, name), last ? 0.4 * likeness(first, c.GivenName ?? "") + 0.6 * likeness(last, c.FamilyName ?? "") : 0);
      return { c, score };
    })
    .filter((x) => x.score >= 0.7)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit * 2);

  const detailed = await Promise.all(
    scored.map(async ({ c, score }) => {
      const d = (await simproRead(`/contacts/${c.ID}`).then((r) => r.data).catch(() => c)) as Record<string, unknown>;
      const customers = (Array.isArray(d.Customers) ? d.Customers : []) as Record<string, unknown>[];
      const sites = (Array.isArray(d.Sites) ? d.Sites : []) as Record<string, unknown>[];
      return {
        contact_id: c.ID,
        name: fullName(d as unknown as ContactRow),
        email: d.Email || undefined,
        mobile: d.CellPhone || undefined,
        phone: d.WorkPhone || undefined,
        position: d.Position || undefined,
        match: score >= 0.99 ? "exact" : "close — ask 'did you mean…?'",
        customers: customers.map((x) => `${x.CompanyName || `${x.GivenName ?? ""} ${x.FamilyName ?? ""}`.trim()} (ID ${x.ID})`),
        sites: sites.map((x) => `${x.Name} (ID ${x.ID})`),
        on_this_customer: customerId ? customers.some((x) => x.ID === customerId) : undefined,
        on_this_site: siteId ? sites.some((x) => x.ID === siteId) : undefined,
      };
    }),
  );
  // The ones already on this customer / site first, then the closest names.
  const linked = (x: (typeof detailed)[number]) => (x.on_this_customer ? 2 : 0) + (x.on_this_site ? 1 : 0);
  return detailed
    .map((x, i) => ({ x, i }))
    .sort((p, q2) => linked(q2.x) - linked(p.x) || p.i - q2.i)
    .slice(0, limit)
    .map(({ x }) => x);
}

const GUIDE = `SimPRO REST API v1.0 — how to query it with simpro_query
(paths are relative to /api/v1.0/companies/0; simpro_query only reads — creating
 jobs, quotes and notes goes through the simpro_create_* and simpro_add_note tools)

LIST ENDPOINTS (end with a slash)
  /jobs/                      jobs (Stage: Pending, Progress, Complete, Invoiced, Archived)
  /quotes/                    quotes
  /leads/                     leads
  /invoices/                  invoices
  /customers/companies/       company customers
  /customers/individuals/     individual customers
  /sites/                     sites
  /employees/                 staff
  /schedules/                 schedule blocks (who is booked where, by date)
  /jobCostCenters/            job cost centres across all jobs
  /contractors/               contractors
  /catalogs/                  catalogue items
  /prebuilds/                 prebuilds (standard price lists)

SINGLE RECORDS AND CHILDREN
  /jobs/{id}                  one job (also /quotes/{id}, /sites/{id}, /invoices/{id},
                              /customers/companies/{id}, /employees/{id}, /leads/{id})
  /jobs/{id}/sections/                          sections of a job
  /jobs/{id}/sections/{sid}/costCenters/        cost centres in a section
  /jobs/{id}/sections/{sid}/costCenters/{cid}/schedules/   schedules on a cost centre
  /jobs/{id}/notes/            notes          (same shape for /quotes/{id}/notes/)
  /jobs/{id}/attachments/files/?columns=ID,Filename,Folder   attachment list
  /jobs/{id}/timelines/        history of a job (also quotes)
  /quotes/{id}/sections/{sid}/costCenters/{cid}/oneOffs/     quote line items

QUERY PARAMETERS
  columns=ID,Name,Stage,Site,Customer,Total,DateIssued   choose fields (smaller, faster)
  display=all                 return every field on a list row
  pageSize=50&page=2          paging (max pageSize 250). The tool result's "total"
                              is the full match count, "pages" the page count.
  orderby=-DateIssued         sort, "-" for descending; several: orderby=Stage,-ID

FILTERS (put the field name as the parameter; nested fields use dots)
  Stage=Progress                       equals
  Site.Name=%Banksia%                  contains (% is a wildcard)
  Customer.CompanyName=%Body Corp%
  ID=in(1234,1240,1301)                one of
  Stage=in(Pending,Progress)
  DateIssued=ge(2026-07-01)            on or after (also gt, le, lt)
  DateIssued=between(2026-07-01,2026-09-30)
  Total.ExTax=gt(20000)
  Several filters combine with AND.

TIPS
  - Start with a small pageSize and columns, then fetch single records for detail.
  - For "how many", ask with pageSize=1 and read "total".
  - Money fields are objects, e.g. Total {ExTax, Tax, IncTax}.
  - If a filter field is rejected, fetch one record with display=all to see the real
    field names, then try again.
  - Dates are YYYY-MM-DD. The business is in Queensland (AEST, UTC+10).`;

export const TOOLS: Tool[] = [
  {
    name: "simpro_search_jobs",
    description:
      "Find RAS-VERTEX jobs in SimPRO by job number, site name, customer name or job name. Open jobs (Pending, Progress) by default.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Job number, or part of a site, customer or job name" },
        stages: {
          type: "string",
          description: "Comma list of stages to include, or 'all'. Default: Pending,Progress",
        },
        limit: { type: "number", description: "Max results (default 20, max 100)" },
      },
      required: ["query"],
    },
    run: async (a) => {
      const q = str(a.query);
      const limit = int(a.limit, 20, 100);
      const stages = str(a.stages) || "Pending,Progress";
      const stage = stages.toLowerCase() === "all" ? {} : { Stage: `in(${stages.replace(/\s/g, "")})` };
      const cols = { columns: "ID,Name,Stage,Site,Customer,Total,DateIssued,CompletedDate", pageSize: limit };
      const asks = [
        simproRead("/jobs/", { ...stage, "Site.Name": like(q), ...cols }),
        simproRead("/jobs/", { ...stage, "Customer.CompanyName": like(q), ...cols }),
        simproRead("/jobs/", { ...stage, Name: like(q), ...cols }),
      ];
      if (/^\d{3,7}$/.test(q)) asks.unshift(simproRead("/jobs/", { ID: q, ...cols }));
      return toText(await merged(asks, limit));
    },
  },
  {
    name: "simpro_search_quotes",
    description: "Find quotes in SimPRO by quote number, site name, customer name or quote name. Newest first.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Quote number, or part of a site, customer or quote name" },
        since: { type: "string", description: "Only quotes issued on or after this date (YYYY-MM-DD)" },
        limit: { type: "number", description: "Max results (default 20, max 100)" },
      },
      required: ["query"],
    },
    run: async (a) => {
      const q = str(a.query);
      const limit = int(a.limit, 20, 100);
      const since = str(a.since);
      const base = {
        ...(since ? { DateIssued: `ge(${since})` } : {}),
        columns: "ID,Name,Stage,Status,Site,Customer,Total,DateIssued,Salesperson",
        orderby: "-DateIssued",
        pageSize: limit,
      };
      const asks = [
        simproRead("/quotes/", { ...base, "Site.Name": like(q) }),
        simproRead("/quotes/", { ...base, "Customer.CompanyName": like(q) }),
        simproRead("/quotes/", { ...base, Name: like(q) }),
      ];
      if (/^\d{3,7}$/.test(q)) asks.unshift(simproRead("/quotes/", { ID: q, columns: base.columns }));
      return toText(await merged(asks, limit));
    },
  },
  {
    name: "simpro_search_customers",
    description: "Find customers (companies and individuals) in SimPRO by name.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of the company name, or a person's given or family name" },
        limit: { type: "number", description: "Max results per kind (default 20, max 100)" },
      },
      required: ["query"],
    },
    run: async (a) => {
      const q = str(a.query);
      const limit = int(a.limit, 20, 100);
      const [companies, people] = await Promise.allSettled([
        simproRead("/customers/companies/", { CompanyName: like(q), display: "all", pageSize: limit }),
        merged(
          [
            simproRead("/customers/individuals/", { FamilyName: like(q), display: "all", pageSize: limit }),
            simproRead("/customers/individuals/", { GivenName: like(q), display: "all", pageSize: limit }),
          ],
          limit,
        ),
      ]);
      return toText({
        companies: companies.status === "fulfilled" ? companies.value.data : `Error: ${companies.reason}`,
        individuals: people.status === "fulfilled" ? people.value : `Error: ${people.reason}`,
      });
    },
  },
  {
    name: "simpro_search_sites",
    description: "Find sites (property addresses) in SimPRO by site name or street address.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Part of the site name or street address" },
        limit: { type: "number", description: "Max results (default 20, max 100)" },
      },
      required: ["query"],
    },
    run: async (a) => {
      const q = str(a.query);
      const limit = int(a.limit, 20, 100);
      const rows = await merged(
        [
          simproRead("/sites/", { Name: like(q), display: "all", pageSize: limit }),
          simproRead("/sites/", { "Address.Address": like(q), display: "all", pageSize: limit }),
        ],
        limit,
      );
      return toText(rows);
    },
  },
  {
    name: "simpro_find_contact",
    description:
      "Check whether a person is already a contact in SimPRO, by name or email, allowing for misspellings. Returns " +
      "exact and close matches with the customers and sites each belongs to. Use it whenever someone names a contact " +
      "(e.g. for a job or quote). If a match is only close, ask 'Did you mean <name> (<customer>)?' before using it; " +
      "if several match, ask which. Give customer_id / site_id when known, to also check the contacts already on them.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "The person's name as given (typos fine), or their email" },
        customer_id: { type: "number", description: "The customer it's for, if known" },
        site_id: { type: "number", description: "The site it's for, if known" },
        limit: { type: "number", description: "Max matches (default 8, max 20)" },
      },
      required: ["query"],
    },
    run: async (a) => {
      const q = str(a.query);
      if (q.length < 2) throw new Error("Give a name or email");
      const found = await findContacts(q, int(a.customer_id, 0, 1e9), int(a.site_id, 0, 1e9), int(a.limit, 8, 20));
      if (!found.length) {
        return `No contact in SimPRO matches "${q}", even allowing for typos. Tell the person, and ask how to spell it or whether to just note the name in the description (this connector can't create contacts yet).`;
      }
      return toText(found);
    },
  },
  {
    name: "simpro_get_record",
    description:
      "Get the full detail of one SimPRO record: a job, quote, site, invoice, lead, employee or company customer. Optionally include its notes.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["job", "quote", "site", "invoice", "lead", "employee", "customer"],
        },
        id: { type: "number" },
        include_notes: { type: "boolean", description: "Also return the record's notes (jobs, quotes)" },
      },
      required: ["type", "id"],
    },
    run: async (a) => {
      const paths: Record<string, string> = {
        job: "/jobs/",
        quote: "/quotes/",
        site: "/sites/",
        invoice: "/invoices/",
        lead: "/leads/",
        employee: "/employees/",
        customer: "/customers/companies/",
      };
      const base = paths[str(a.type)];
      const id = int(a.id, 0, 1e9);
      if (!base || !id) throw new Error("Give a type and a numeric id");
      const record = await simproRead(`${base}${id}`);
      if (!a.include_notes || !["job", "quote"].includes(str(a.type))) return toText(record.data);
      const notes = await simproRead(`${base}${id}/notes/`, { display: "all", pageSize: 50 }).catch(
        (e) => ({ data: `Notes unavailable: ${e instanceof Error ? e.message : e}` }),
      );
      return toText({ record: record.data, notes: notes.data });
    },
  },
  {
    name: "simpro_query",
    description:
      "Run any read-only GET against the SimPRO API, with filters, columns, sorting and paging. Use this for reports, counts, date ranges, totals and anything the search tools don't cover. Read simpro_api_guide first for paths and filter syntax.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path under the company, e.g. /quotes/ or /jobs/1234/sections/" },
        params: {
          type: "object",
          description:
            'Query parameters, e.g. {"Stage":"in(Pending,Progress)","DateIssued":"ge(2026-10-01)","columns":"ID,Name,Total","orderby":"-DateIssued","pageSize":50}',
          additionalProperties: { type: ["string", "number"] },
        },
      },
      required: ["path"],
    },
    run: async (a) => {
      const params = (a.params && typeof a.params === "object" ? a.params : {}) as Record<string, string | number>;
      if (params.pageSize !== undefined) params.pageSize = int(params.pageSize, 50, 250);
      const page = await simproRead(str(a.path), params);
      return toText(page);
    },
  },
  {
    name: "simpro_api_guide",
    description:
      "How to query RAS-VERTEX's SimPRO with simpro_query: endpoints, filter syntax (contains, in, ge/le, between), columns, sorting and paging.",
    inputSchema: { type: "object", properties: {} },
    run: async () => GUIDE,
  },
  ...ACTIONS,
];
