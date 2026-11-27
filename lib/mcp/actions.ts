// lib/mcp/actions.ts
// ─────────────────────────────────────────────────────────────────────────────
// The Claude connector's "do" tools: they create records in live SimPRO.
//
//   simpro_create_job   — a new job for an existing customer and site
//   simpro_create_quote — a new quote
//
// Both need a salesperson and a project manager (asked for, never assumed;
// they can be the same person) and get a due date 14 days out by default.
//   simpro_add_note     — a note on an existing job or quote
//
// Jobs and quotes can be priced across several cost centres, each with
// one-off "Material" lines and hours on the "Labour" rate — the same shape
// as the ones made by hand.
//
// Each works in two steps. Called without confirm_code, a tool only checks
// the details and answers with a preview plus a code; Claude shows the
// preview to the person, and only a second call with that code (and the
// same details) creates anything. The code is an HMAC of the details, so
// it can't be skipped or reused for different ones.
//
// Nothing here updates or deletes. Every create, and every failed one, is
// written to the mcp_actions table.
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac } from "crypto";
import { neon } from "@neondatabase/serverless";
import { like, simproCreate, simproRead, toText } from "./simpro";
import type { Tool } from "./tools";

type Args = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : v == null ? "" : String(v));
const id = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : 0;
};

const TAG = "Created via Claude";

/** SimPRO cost centres (Setup → Accounts → Cost Centres) that job lines can go under. */
const COST_CENTRES: Record<string, number> = {
  "Painting Commercial": 6,
  "Painting Residential": 12,
  Maintenance: 2,
  Waterproofing: 15,
  "Pressure Cleaning": 13,
  "Window Cleaning": 16,
  "Height Safety": 11,
  Inspections: 9,
  Warranty: 7,
};

/** The standard "Labour" rate — the one on every job. */
const LABOUR_TYPE_ID = 1;

/** Sell price per hour ex GST of the Labour rate: cost × (1 + markup %). */
async function labourRate(): Promise<number> {
  const r = (await simproRead(`/setup/labor/laborRates/${LABOUR_TYPE_ID}`)).data as { CostRate?: number; Markup?: number };
  if (typeof r.CostRate !== "number") throw new Error("No cost rate");
  return Math.round(r.CostRate * (1 + (r.Markup ?? 0) / 100) * 100) / 100;
}

const money = (v: unknown) => {
  const n = Number(typeof v === "string" ? v.replace(/[$,\s]/g, "") : v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};
const aud = (n: number) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Plain text → the HTML SimPRO stores in descriptions and notes. */
function html(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .split(/\r?\n/)
    .join("<br>");
}

/** Code tying a confirm to exactly these details. */
function codeFor(tool: string, details: unknown): string {
  const key = process.env.MCP_SECRET ?? "";
  return createHmac("sha256", key).update(`${tool}:${JSON.stringify(details)}`).digest("base64url").slice(0, 10);
}

async function log(tool: string, details: unknown, outcome: { ok: boolean; record?: number; error?: string }) {
  const url = process.env.DATABASE_URL;
  if (!url) return;
  try {
    const sql = neon(url);
    await sql`
      CREATE TABLE IF NOT EXISTS mcp_actions (
        id         SERIAL PRIMARY KEY,
        at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        tool       TEXT NOT NULL,
        details    JSONB NOT NULL,
        ok         BOOLEAN NOT NULL,
        record_id  INTEGER,
        error      TEXT
      )`;
    await sql`
      INSERT INTO mcp_actions (tool, details, ok, record_id, error)
      VALUES (${tool}, ${JSON.stringify(details)}, ${outcome.ok}, ${outcome.record ?? null}, ${outcome.error ?? null})`;
  } catch (err) {
    // The SimPRO change already happened (or failed) — a log miss mustn't hide that.
    console.error("[MCP log]", err instanceof Error ? err.message : err);
  }
}

/** A timeout means SimPRO may still have made the record: say so, so Claude checks before trying again. */
function explain(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/abort|timed? ?out/i.test(message)) {
    return `${message}. SimPRO didn't answer in time, so the record MAY have been created. Search for it before trying again.`;
  }
  return message;
}

async function customerName(customerId: number): Promise<string> {
  try {
    const c = (await simproRead(`/customers/companies/${customerId}`)).data as Record<string, unknown>;
    return str(c.CompanyName);
  } catch {
    const p = (await simproRead(`/customers/individuals/${customerId}`)).data as Record<string, unknown>;
    return `${str(p.GivenName)} ${str(p.FamilyName)}`.trim();
  }
}

function previewText(summary: Record<string, unknown>, code: string, warnings: string[]) {
  return toText({
    status: "PREVIEW — nothing has been created yet",
    will_create: summary,
    warnings: warnings.length ? warnings : undefined,
    confirm_code: code,
    next_step:
      "Show the person these details (and any warnings) and ask them to confirm. Only if they say yes, " +
      "call this tool again with exactly the same details plus confirm_code. If they change anything, " +
      "call again without confirm_code to get a new preview.",
  });
}

/** One cost centre's lines on a new job or quote. */
interface Centre {
  cost_centre: string;
  materials: { description: string; amount_ex: number }[];
  labour_hours: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const CENTRES_SCHEMA = {
  type: "array",
  description:
    "The price broken into cost centres. Each has material lines (sell price ex GST) and/or labour hours at the " +
    "standard Labour rate. Use one entry per cost centre.",
  items: {
    type: "object",
    properties: {
      cost_centre: { type: "string", enum: Object.keys(COST_CENTRES) },
      materials: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string", description: "e.g. 'Paint, sealant and consumables'" },
            amount_ex: { type: "number", description: "Sell price ex GST for the line" },
          },
          required: ["description", "amount_ex"],
        },
      },
      labour_hours: { type: "number", description: "Hours at the standard Labour rate (the preview shows the rate)" },
    },
    required: ["cost_centre"],
  },
};

const COMMON_PROPS = {
  customer_id: { type: "number", description: "SimPRO customer ID" },
  site_id: { type: "number", description: "SimPRO site ID" },
  name: { type: "string", description: "Short name, e.g. 'Repaint stairwell — Unit 4'" },
  description: { type: "string", description: "Scope of work, as plain text (line breaks kept)" },
  order_no: { type: "string", description: "The client's works order / PO number, if there is one" },
  type: { type: "string", enum: ["Service", "Project"], description: "Default Service" },
  cost_centres: CENTRES_SCHEMA,
  due_date: { type: "string", description: "Due date, YYYY-MM-DD. Default: 14 days after today" },
  customer_contact_id: {
    type: "number",
    description: "SimPRO contact ID for the customer contact, from simpro_find_contact (confirm close matches first)",
  },
  site_contact_id: { type: "number", description: "SimPRO contact ID for the site contact, from simpro_find_contact" },
  extra_fields: {
    type: "object",
    description:
      "Other SimPRO fields to set on the new record, by their SimPRO name, e.g. {\"CustomerContact\": 123}. Only " +
      "for a field SimPRO asked for (it names it when it turns a create down) or the person asked to set, with the " +
      "value the person gave.",
    additionalProperties: { type: ["string", "number", "boolean"] },
  },
  confirm_code: { type: "string", description: "Only on the second call, from the preview" },
};

const PRICING_HELP =
  "When given a total price, put the materials in and work out the labour hours from the rest at the Labour rate " +
  "(read it from a first preview if needed), and say if it doesn't divide evenly. If anything needed is missing or " +
  "unclear — customer, site, cost centres, the split between materials and labour — ask the person; never guess.";

function readCentres(a: Args): Centre[] {
  const list = (Array.isArray(a.cost_centres) ? a.cost_centres : []).map((c) => c as Args);
  // Also take a single cost centre given as flat fields.
  if (!list.length && (a.cost_centre || a.materials || a.labour_hours)) {
    list.push({ cost_centre: a.cost_centre, materials: a.materials, labour_hours: a.labour_hours });
  }
  const centres = list
    .map((c) => ({
      cost_centre: str(c.cost_centre),
      materials: (Array.isArray(c.materials) ? c.materials : [])
        .map((m) => m as Args)
        .map((m) => ({ description: str(m.description).slice(0, 250), amount_ex: money(m.amount_ex) }))
        .filter((m) => m.description || m.amount_ex),
      labour_hours: round2(Number(c.labour_hours) || 0),
    }))
    .filter((c) => c.materials.length || c.labour_hours);
  for (const c of centres) {
    if (!COST_CENTRES[c.cost_centre]) {
      throw new Error(`Unknown cost centre "${c.cost_centre}". Use one of: ${Object.keys(COST_CENTRES).join(", ")}`);
    }
    if (c.labour_hours < 0 || c.labour_hours > 5000) throw new Error(`${c.cost_centre}: labour_hours looks wrong`);
    if (c.materials.some((m) => !m.description || !(m.amount_ex > 0))) {
      throw new Error(`${c.cost_centre}: each material line needs a description and an amount_ex above 0`);
    }
  }
  if (new Set(centres.map((c) => c.cost_centre)).size !== centres.length) {
    throw new Error("List each cost centre once, with all of its lines together");
  }
  return centres;
}

/** Lines and totals for the preview, priced at the live Labour rate. */
async function pricePreview(centres: Centre[]) {
  if (!centres.length) return { lines: "(none — no price lines)", totalEx: 0 as number | null, warning: undefined };
  const rate = centres.some((c) => c.labour_hours) ? await labourRate().catch(() => null) : null;
  let total = 0;
  let unknown = false;
  const lines = centres.map((c) => {
    const mat = c.materials.reduce((t, m) => t + m.amount_ex, 0);
    const lab = c.labour_hours ? (rate == null ? null : round2(rate * c.labour_hours)) : 0;
    if (lab == null) unknown = true;
    else total += lab;
    total += mat;
    return {
      cost_centre: c.cost_centre,
      materials: c.materials.length ? c.materials.map((m) => `${m.description}: ${aud(m.amount_ex)} ex`) : "(none)",
      labour: c.labour_hours
        ? `${c.labour_hours} h` + (lab != null ? ` × ${aud(rate!)}/h = ${aud(lab)} ex` : "")
        : "(none)",
      subtotal_ex_gst: lab == null ? "(see labour)" : aud(round2(mat + lab)),
    };
  });
  return {
    lines,
    totalEx: unknown ? null : round2(total),
    warning: unknown ? "Couldn't read the Labour rate, so labour isn't priced here. SimPRO will apply its standard rate." : undefined,
  };
}

/** Adds one section with the cost centres and their lines. Returns what failed, if anything. */
async function addLines(base: string, centres: Centre[]): Promise<string[]> {
  if (!centres.length) return [];
  const problems: string[] = [];
  let sectionId: number;
  try {
    sectionId = (await simproCreate<{ ID: number }>(`${base}/sections/`, {})).ID;
  } catch (e) {
    return [`Couldn't add a section, so no price lines were added: ${explain(e)}`];
  }
  for (const c of centres) {
    let ccId: number;
    try {
      ccId = (await simproCreate<{ ID: number }>(`${base}/sections/${sectionId}/costCenters/`, {
        CostCenter: COST_CENTRES[c.cost_centre],
      })).ID;
    } catch (e) {
      problems.push(`${c.cost_centre}: couldn't add the cost centre, so its lines weren't added: ${explain(e)}`);
      continue;
    }
    const at = `${base}/sections/${sectionId}/costCenters/${ccId}`;
    for (const m of c.materials) {
      await simproCreate(`${at}/oneOffs/`, {
        Type: "Material",
        Description: m.description,
        Total: { Qty: 1 },
        SellPriceExDiscount: m.amount_ex,
      }).catch((e) => problems.push(`${c.cost_centre} material "${m.description}": ${explain(e)}`));
    }
    if (c.labour_hours) {
      await simproCreate(`${at}/labor/`, { LaborType: LABOUR_TYPE_ID, Total: { Qty: c.labour_hours } }).catch((e) =>
        problems.push(`${c.cost_centre} labour ${c.labour_hours} h: ${explain(e)}`),
      );
    }
  }
  return problems;
}

const STAFF_PROPS = {
  salesperson: { type: "string", description: "Staff name. Ask the person who — never assume" },
  project_manager: { type: "string", description: "Staff name. Ask the person who — never assume (can be the salesperson)" },
};

const STAFF_HELP =
  "It needs a salesperson and a project manager: if the person hasn't named both, ask them who (they can be the " +
  "same person) before calling this tool.";

function staffNames(a: Args) {
  const salesperson = str(a.salesperson);
  const project_manager = str(a.project_manager);
  const missing = [!salesperson && "salesperson", !project_manager && "project manager"].filter(Boolean);
  if (missing.length) throw new Error(`Ask the person who the ${missing.join(" and ")} should be, then call again.`);
  return { salesperson, project_manager };
}

/** Both staff, looked up by name. */
async function staff(d: { salesperson: string; project_manager: string }) {
  const [sp, pm] = await Promise.all([employee(d.salesperson), employee(d.project_manager)]);
  return { sp: sp!, pm: pm! };
}

/** A staff member by name, for salesperson / project manager. */
async function employee(name: string): Promise<{ ID: number; Name: string } | null> {
  if (!name) return null;
  const rows = ((await simproRead("/employees/", { Name: like(name), columns: "ID,Name", pageSize: 20 })).data ??
    []) as { ID: number; Name: string }[];
  const exact = rows.filter((r) => r.Name.toLowerCase() === name.toLowerCase());
  if (exact.length === 1) return exact[0];
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw new Error(`No staff member matching "${name}"`);
  throw new Error(`"${name}" matches several staff: ${rows.map((r) => r.Name).join(", ")}. Ask which one.`);
}

/** Checks the customer and site exist; returns their names. */
async function customerAndSite(customerId: number, siteId: number) {
  const [customer, site] = await Promise.all([
    customerName(customerId).catch(() => null),
    simproRead(`/sites/${siteId}`).then((r) => r.data as Record<string, unknown>).catch(() => null),
  ]);
  if (!customer) throw new Error(`No customer with ID ${customerId}`);
  if (!site) throw new Error(`No site with ID ${siteId}`);
  return { customer: `${customer} (ID ${customerId})`, site: `${str(site.Name)} (ID ${siteId})` };
}

const rowsOf = (page: { data: unknown } | null) =>
  Array.isArray(page?.data) ? (page!.data as Record<string, unknown>[]) : [];

/** The job or quote's total as SimPRO now has it. */
const totalOf = (path: string) =>
  simproRead(path, { columns: "ID,Total" })
    .then((r) => (r.data as { Total?: { ExTax?: number; IncTax?: number } }).Total)
    .catch(() => undefined);

const tag = (base: string) =>
  simproCreate(`${base}/notes/`, { Subject: TAG, Note: html(`${TAG} from the RAS-VERTEX connector.`) }).then(
    () => true,
    () => false,
  );

/** Fields the tools set themselves, which extra_fields can't override. */
const OWN_FIELDS = new Set([
  "Customer", "Site", "Type", "Name", "Description", "OrderNo", "DueDate", "Salesperson", "ProjectManager",
  "CustomerContact", "SiteContact", "Stage", "ID",
]);

function extraFields(v: unknown): Record<string, string | number | boolean> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, val] of Object.entries(v as Args)) {
    if (!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(k)) throw new Error(`extra_fields: "${k}" isn't a SimPRO field name`);
    if (OWN_FIELDS.has(k)) throw new Error(`extra_fields: set ${k} with this tool's own option, not extra_fields`);
    if (!["string", "number", "boolean"].includes(typeof val)) throw new Error(`extra_fields: ${k} must be text, a number or true/false`);
    out[k] = val as string | number | boolean;
  }
  return out;
}

/** SimPRO turned the create down: nothing was made. Tell Claude to ask, not to give up or work around it. */
function rejected(kind: string, err: unknown): Error {
  const message = explain(err);
  if (/HTTP 4\d\d/.test(message)) {
    return new Error(
      `SimPRO turned the new ${kind} down, so nothing was created. Its answer: ${message}\n` +
        "If it names a missing or invalid field, tell the person in plain words what SimPRO needs and ask them for " +
        "it (don't guess, and don't switch to the browser unless they ask). Then call this tool again WITHOUT " +
        "confirm_code, with the value in the matching option or in extra_fields, to get a fresh preview.",
    );
  }
  return new Error(message);
}

function baseDetails(a: Args) {
  const details = {
    customer_id: id(a.customer_id),
    site_id: id(a.site_id),
    name: str(a.name).slice(0, 250),
    description: str(a.description),
    order_no: str(a.order_no).slice(0, 100),
    type: str(a.type) === "Project" ? "Project" : "Service",
    cost_centres: readCentres(a),
    due_date: str(a.due_date) || in14Days(),
    customer_contact_id: id(a.customer_contact_id),
    site_contact_id: id(a.site_contact_id),
    extra_fields: extraFields(a.extra_fields),
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(details.due_date)) throw new Error("due_date must be YYYY-MM-DD");
  if (!details.customer_id || !details.site_id) throw new Error("Give a numeric customer_id and site_id");
  if (!details.name) throw new Error("Give it a name");
  return details;
}

/** Preview lines for the chosen contacts, with a warning when one isn't linked to this customer / site. */
async function contactsPreview(d: { customer_id: number; site_id: number; customer_contact_id: number; site_contact_id: number }) {
  const warnings: string[] = [];
  const one = async (contactId: number, role: "customer" | "site") => {
    if (!contactId) return "(not set)";
    const c = (await simproRead(`/contacts/${contactId}`).then((r) => r.data).catch(() => null)) as Record<string, unknown> | null;
    if (!c) throw new Error(`No contact with ID ${contactId}`);
    const links = ((role === "customer" ? c.Customers : c.Sites) ?? []) as { ID: number }[];
    const want = role === "customer" ? d.customer_id : d.site_id;
    if (!links.some((x) => x.ID === want)) {
      warnings.push(`${str(c.GivenName)} ${str(c.FamilyName)} isn't linked to this ${role} in SimPRO, so SimPRO may turn it down. Check with the person.`);
    }
    return `${str(c.GivenName)} ${str(c.FamilyName)}`.trim() + (c.Email ? ` <${str(c.Email)}>` : "") + ` (ID ${contactId})`;
  };
  const [customer_contact, site_contact] = await Promise.all([
    one(d.customer_contact_id, "customer"),
    one(d.site_contact_id, "site"),
  ]);
  return { customer_contact, site_contact, warnings };
}

const contactFields = (d: { customer_contact_id: number; site_contact_id: number }) => ({
  ...(d.customer_contact_id ? { CustomerContact: d.customer_contact_id } : {}),
  ...(d.site_contact_id ? { SiteContact: d.site_contact_id } : {}),
});

function priced(preview: Awaited<ReturnType<typeof pricePreview>>) {
  return {
    cost_centres: preview.lines,
    total_ex_gst: preview.totalEx == null ? "(see labour)" : aud(preview.totalEx),
    total_inc_gst: preview.totalEx == null ? undefined : aud(round2(preview.totalEx * 1.1)),
  };
}

function finished(kind: "job" | "quote", recordId: number, problems: string[], total: { ExTax?: number; IncTax?: number } | undefined, tagged: boolean) {
  return toText({
    status: problems.length ? `CREATED, BUT SOME LINES FAILED — do not create the ${kind} again` : "CREATED",
    [`${kind}_id`]: recordId,
    total_ex_gst: total?.ExTax != null ? aud(total.ExTax) : undefined,
    total_inc_gst: total?.IncTax != null ? aud(total.IncTax) : undefined,
    problems: problems.length ? problems : undefined,
    tagged_with_note: tagged,
  });
}

function in14Days(): string {
  const d = new Date(Date.now() + 10 * 3600_000); // Queensland date
  d.setUTCDate(d.getUTCDate() + 14);
  return d.toISOString().slice(0, 10);
}

export const ACTIONS: Tool[] = [
  {
    name: "simpro_create_job",
    readOnly: false,
    description:
      "Create a new job in RAS-VERTEX's live SimPRO for an existing customer and site, optionally priced and broken " +
      "into cost centres, e.g. from a client's works order. Two steps: call without confirm_code to get a preview " +
      "(with totals) and a code, show the preview to the person, and only after they confirm call again with exactly " +
      "the same details plus confirm_code. Find customer_id and site_id first with simpro_search_customers and " +
      "simpro_search_sites; never guess them. " + STAFF_HELP + " " + PRICING_HELP,
    inputSchema: {
      type: "object",
      properties: {
        ...COMMON_PROPS,
        ...STAFF_PROPS,
      },
      required: ["customer_id", "site_id", "name", "salesperson", "project_manager"],
    },
    run: async (a: Args) => {
      const details = { ...baseDetails(a), ...staffNames(a) };
      const code = codeFor("simpro_create_job", details);
      const given = str(a.confirm_code);

      if (given !== code) {
        const [who, { sp, pm }, price, contacts] = await Promise.all([
          customerAndSite(details.customer_id, details.site_id),
          staff(details),
          pricePreview(details.cost_centres),
          contactsPreview(details),
        ]);
        const warnings: string[] = [...contacts.warnings];
        if (given) warnings.push("The confirm_code didn't match these details, so this is a fresh preview.");
        if (price.warning) warnings.push(price.warning);
        if (details.order_no) {
          const same = rowsOf(
            await simproRead("/jobs/", { OrderNo: details.order_no, columns: "ID,Name", pageSize: 10 }).catch(() => null),
          );
          if (same.length) {
            warnings.push(
              `Order number ${details.order_no} is already on job(s) ${same.map((r) => r.ID).join(", ")}. Check this isn't a duplicate.`,
            );
          }
        }
        const open = rowsOf(
          await simproRead("/jobs/", {
            "Site.ID": details.site_id,
            Stage: "in(Pending,Progress)",
            columns: "ID,Name",
            pageSize: 10,
          }).catch(() => null),
        );
        if (open.length) {
          warnings.push(`This site already has open job(s): ${open.map((r) => `${r.ID} ${str(r.Name)}`).join("; ")}.`);
        }
        return previewText(
          {
            record: "JOB",
            ...who,
            name: details.name,
            description: details.description || "(none)",
            order_no: details.order_no || "(none)",
            type: details.type,
            stage: "Pending",
            due_date: details.due_date,
            salesperson: sp.Name,
            project_manager: pm.Name,
            customer_contact: contacts.customer_contact,
            site_contact: contacts.site_contact,
            ...(Object.keys(details.extra_fields).length ? { other_fields: details.extra_fields } : {}),
            ...priced(price),
            note_added: TAG,
          },
          code,
          warnings,
        );
      }

      const { sp, pm } = await staff(details);
      let jobId = 0;
      try {
        const job = await simproCreate<{ ID: number }>("/jobs/", {
          Customer: details.customer_id,
          Site: details.site_id,
          Type: details.type,
          Name: details.name,
          DueDate: details.due_date,
          ...(details.description ? { Description: html(details.description) } : {}),
          ...(details.order_no ? { OrderNo: details.order_no } : {}),
          Salesperson: sp.ID,
          ProjectManager: pm.ID,
          ...contactFields(details),
          ...details.extra_fields,
        });
        if (!job?.ID) throw new Error("SimPRO didn't return the new job's ID");
        jobId = job.ID;
      } catch (err) {
        const e = rejected("job", err);
        await log("simpro_create_job", details, { ok: false, error: e.message });
        throw e;
      }
      // The job exists from here on. A failed line is reported, not thrown,
      // so Claude doesn't try again and make a second job.
      const problems = await addLines(`/jobs/${jobId}`, details.cost_centres);
      const tagged = await tag(`/jobs/${jobId}`);
      const total = await totalOf(`/jobs/${jobId}`);
      await log("simpro_create_job", details, {
        ok: !problems.length,
        record: jobId,
        error: problems.length ? problems.join(" | ") : undefined,
      });
      return finished("job", jobId, problems, total, tagged);
    },
  },
  {
    name: "simpro_create_quote",
    readOnly: false,
    description:
      "Create a new quote in RAS-VERTEX's live SimPRO for an existing customer and site, priced and broken into cost " +
      "centres. Two steps: call without confirm_code to get a preview (with totals) and a code, show the preview to " +
      "the person, and only after they confirm call again with exactly the same details plus confirm_code. Find " +
      "customer_id and site_id first with simpro_search_customers and simpro_search_sites; never guess them. Every " +
      "quote " + STAFF_HELP.charAt(0).toLowerCase() + STAFF_HELP.slice(1) + " " + PRICING_HELP,
    inputSchema: {
      type: "object",
      properties: {
        ...COMMON_PROPS,
        ...STAFF_PROPS,
      },
      required: ["customer_id", "site_id", "name", "salesperson", "project_manager"],
    },
    run: async (a: Args) => {
      const details = { ...baseDetails(a), ...staffNames(a) };
      const code = codeFor("simpro_create_quote", details);
      const given = str(a.confirm_code);

      if (given !== code) {
        const [who, { sp, pm }, price, contacts] = await Promise.all([
          customerAndSite(details.customer_id, details.site_id),
          staff(details),
          pricePreview(details.cost_centres),
          contactsPreview(details),
        ]);
        const warnings: string[] = [...contacts.warnings];
        if (given) warnings.push("The confirm_code didn't match these details, so this is a fresh preview.");
        if (price.warning) warnings.push(price.warning);
        if (!details.cost_centres.length) warnings.push("No price lines: the quote will be created at $0.");
        const since = new Date(Date.now() - 60 * 86400_000).toISOString().slice(0, 10);
        const recent = rowsOf(
          await simproRead("/quotes/", {
            "Site.ID": details.site_id,
            DateIssued: `ge(${since})`,
            columns: "ID,Name,DateIssued",
            pageSize: 10,
          }).catch(() => null),
        );
        if (recent.length) {
          warnings.push(
            `Quotes already made for this site in the last 60 days: ${recent.map((r) => `${r.ID} ${str(r.Name)}`).join("; ")}.`,
          );
        }
        return previewText(
          {
            record: "QUOTE",
            ...who,
            name: details.name,
            description: details.description || "(none)",
            order_no: details.order_no || "(none)",
            type: details.type,
            salesperson: sp.Name,
            project_manager: pm.Name,
            customer_contact: contacts.customer_contact,
            site_contact: contacts.site_contact,
            due_date: details.due_date,
            ...(Object.keys(details.extra_fields).length ? { other_fields: details.extra_fields } : {}),
            ...priced(price),
            note_added: TAG,
          },
          code,
          warnings,
        );
      }

      const { sp, pm } = await staff(details);
      let quoteId = 0;
      try {
        const quote = await simproCreate<{ ID: number }>("/quotes/", {
          Customer: details.customer_id,
          Site: details.site_id,
          Type: details.type,
          Name: details.name,
          DueDate: details.due_date,
          Salesperson: sp.ID,
          ProjectManager: pm.ID,
          ...(details.description ? { Description: html(details.description) } : {}),
          ...(details.order_no ? { OrderNo: details.order_no } : {}),
          ...contactFields(details),
          ...details.extra_fields,
        });
        if (!quote?.ID) throw new Error("SimPRO didn't return the new quote's ID");
        quoteId = quote.ID;
      } catch (err) {
        const e = rejected("quote", err);
        await log("simpro_create_quote", details, { ok: false, error: e.message });
        throw e;
      }
      const problems = await addLines(`/quotes/${quoteId}`, details.cost_centres);
      const tagged = await tag(`/quotes/${quoteId}`);
      const total = await totalOf(`/quotes/${quoteId}`);
      await log("simpro_create_quote", details, {
        ok: !problems.length,
        record: quoteId,
        error: problems.length ? problems.join(" | ") : undefined,
      });
      return finished("quote", quoteId, problems, total, tagged);
    },
  },
  {
    name: "simpro_add_note",
    readOnly: false,
    description:
      "Add a note to an existing job or quote in RAS-VERTEX's live SimPRO. Two steps: call without confirm_code to get a " +
      "preview and a code, show it to the person, and only after they confirm call again with the same details plus confirm_code.",
    inputSchema: {
      type: "object",
      properties: {
        record_type: { type: "string", enum: ["job", "quote"] },
        record_id: { type: "number", description: "Job or quote number" },
        subject: { type: "string", description: "Short subject line" },
        note: { type: "string", description: "The note, as plain text (line breaks kept)" },
        confirm_code: { type: "string", description: "Only on the second call, from the preview" },
      },
      required: ["record_type", "record_id", "subject", "note"],
    },
    run: async (a: Args) => {
      const details = {
        record_type: str(a.record_type) === "quote" ? "quote" : "job",
        record_id: id(a.record_id),
        subject: str(a.subject).slice(0, 200),
        note: str(a.note),
      };
      if (!details.record_id) throw new Error("Give a numeric record_id");
      if (!details.subject || !details.note) throw new Error("Give a subject and the note");
      const base = details.record_type === "quote" ? "/quotes/" : "/jobs/";

      const code = codeFor("simpro_add_note", details);
      const given = str(a.confirm_code);

      if (given !== code) {
        const rec = await simproRead(`${base}${details.record_id}`, { columns: "ID,Name,Stage,Customer,Site" })
          .then((r) => r.data as Record<string, unknown>)
          .catch(() => null);
        if (!rec) throw new Error(`No ${details.record_type} ${details.record_id}`);
        const name = (v: unknown) => str((v as Record<string, unknown> | undefined)?.Name ?? (v as Record<string, unknown> | undefined)?.CompanyName);
        return previewText(
          {
            on: `${details.record_type} ${details.record_id}: ${str(rec.Name)}`,
            site: name(rec.Site) || undefined,
            customer: name(rec.Customer) || undefined,
            subject: `${details.subject} (via Claude)`,
            note: details.note,
          },
          code,
          given ? ["The confirm_code didn't match these details, so this is a fresh preview."] : [],
        );
      }

      try {
        const made = await simproCreate<{ ID?: number }>(`${base}${details.record_id}/notes/`, {
          Subject: `${details.subject} (via Claude)`,
          Note: html(details.note),
        });
        await log("simpro_add_note", details, { ok: true, record: details.record_id });
        return toText({ status: "ADDED", record_type: details.record_type, record_id: details.record_id, note_id: made?.ID });
      } catch (err) {
        const e = rejected("note", err);
        await log("simpro_add_note", details, { ok: false, error: e.message });
        throw e;
      }
    },
  },
];
