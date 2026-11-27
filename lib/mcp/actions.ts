// lib/mcp/actions.ts
// ─────────────────────────────────────────────────────────────────────────────
// The Claude connector's "do" tools: they create records in live SimPRO.
//
//   simpro_create_job — a new job for an existing customer and site, with
//                       optional material lines and labour hours under one
//                       cost centre (the same shape as jobs made by hand:
//                       one-off "Material" lines plus hours on "Labour")
//   simpro_add_note   — a note on an existing job or quote
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
import { simproCreate, simproRead, toText } from "./simpro";
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

export const ACTIONS: Tool[] = [
  {
    name: "simpro_create_job",
    readOnly: false,
    description:
      "Create a new job in RAS-VERTEX's live SimPRO for an existing customer and site, optionally priced with materials " +
      "and labour, e.g. 'create a job for X at Y, $4,000 ex: $600 materials, the rest labour'. Two steps: call without " +
      "confirm_code to get a preview (with totals) and a code, show the preview to the person, and only after they " +
      "confirm call again with exactly the same details plus confirm_code. Find customer_id and site_id first with " +
      "simpro_search_customers and simpro_search_sites; never guess them. Labour is charged in hours at the standard " +
      "Labour rate (the preview shows it); when given a total price, put the materials in and work out the hours from " +
      "the rest, and say if it doesn't divide evenly.",
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "number", description: "SimPRO customer ID" },
        site_id: { type: "number", description: "SimPRO site ID" },
        name: { type: "string", description: "Short job name, e.g. 'Repaint stairwell — Unit 4'" },
        description: { type: "string", description: "The work to be done, as plain text (line breaks kept)" },
        order_no: { type: "string", description: "The client's works order / PO number, if there is one" },
        type: { type: "string", enum: ["Service", "Project"], description: "Default Service" },
        cost_centre: {
          type: "string",
          enum: Object.keys(COST_CENTRES),
          description: "Which cost centre the lines go under. Needed when there are materials or labour.",
        },
        materials: {
          type: "array",
          description: "Material lines, each a sell price ex GST",
          items: {
            type: "object",
            properties: {
              description: { type: "string", description: "e.g. 'Paint, sealant and consumables'" },
              amount_ex: { type: "number", description: "Sell price ex GST for the line" },
            },
            required: ["description", "amount_ex"],
          },
        },
        labour_hours: { type: "number", description: "Hours of labour at the standard Labour rate" },
        confirm_code: { type: "string", description: "Only on the second call, from the preview" },
      },
      required: ["customer_id", "site_id", "name"],
    },
    run: async (a: Args) => {
      const materials = (Array.isArray(a.materials) ? a.materials : [])
        .map((m) => m as Args)
        .map((m) => ({ description: str(m.description).slice(0, 250), amount_ex: money(m.amount_ex) }))
        .filter((m) => m.description || m.amount_ex);
      const details = {
        customer_id: id(a.customer_id),
        site_id: id(a.site_id),
        name: str(a.name).slice(0, 250),
        description: str(a.description),
        order_no: str(a.order_no).slice(0, 100),
        type: str(a.type) === "Project" ? "Project" : "Service",
        cost_centre: str(a.cost_centre),
        materials,
        labour_hours: Math.round((Number(a.labour_hours) || 0) * 100) / 100,
      };
      if (!details.customer_id || !details.site_id) throw new Error("Give a numeric customer_id and site_id");
      if (!details.name) throw new Error("Give the job a name");
      if (details.labour_hours < 0 || details.labour_hours > 5000) throw new Error("labour_hours looks wrong");
      if (materials.some((m) => !m.description || !(m.amount_ex > 0))) {
        throw new Error("Each material line needs a description and an amount_ex above 0");
      }
      const priced = materials.length > 0 || details.labour_hours > 0;
      const centreId = COST_CENTRES[details.cost_centre];
      if (priced && !centreId) {
        throw new Error(`Pick a cost_centre for the lines: ${Object.keys(COST_CENTRES).join(", ")}`);
      }

      const code = codeFor("simpro_create_job", details);
      const given = str(a.confirm_code);

      if (given !== code) {
        const [customer, site, rate] = await Promise.all([
          customerName(details.customer_id).catch(() => null),
          simproRead(`/sites/${details.site_id}`).then((r) => r.data as Record<string, unknown>).catch(() => null),
          details.labour_hours ? labourRate().catch(() => null) : Promise.resolve(null),
        ]);
        if (!customer) throw new Error(`No customer with ID ${details.customer_id}`);
        if (!site) throw new Error(`No site with ID ${details.site_id}`);

        const warnings: string[] = [];
        if (given) warnings.push("The confirm_code didn't match these details, so this is a fresh preview.");
        if (details.order_no) {
          const same = await simproRead("/jobs/", {
            OrderNo: details.order_no,
            columns: "ID,Name,Stage,Customer,Site",
            pageSize: 10,
          }).catch(() => null);
          const rows = Array.isArray(same?.data) ? (same!.data as Record<string, unknown>[]) : [];
          if (rows.length) {
            warnings.push(
              `Order number ${details.order_no} is already on job(s) ${rows.map((r) => r.ID).join(", ")}. ` +
                "Check this isn't a duplicate.",
            );
          }
        }
        const open = await simproRead("/jobs/", {
          "Site.ID": details.site_id,
          Stage: "in(Pending,Progress)",
          columns: "ID,Name,Stage",
          pageSize: 10,
        }).catch(() => null);
        const openRows = Array.isArray(open?.data) ? (open!.data as Record<string, unknown>[]) : [];
        if (openRows.length) {
          warnings.push(
            `This site already has open job(s): ${openRows.map((r) => `${r.ID} ${str(r.Name)}`).join("; ")}.`,
          );
        }
        if (details.labour_hours && rate == null) {
          warnings.push("Couldn't read the Labour rate, so the labour total isn't shown. SimPRO will apply its standard rate.");
        }

        const materialsEx = materials.reduce((t, m) => t + m.amount_ex, 0);
        const labourEx = rate == null ? null : Math.round(rate * details.labour_hours * 100) / 100;
        const totalEx = labourEx == null ? null : Math.round((materialsEx + labourEx) * 100) / 100;

        return previewText(
          {
            customer: `${customer} (ID ${details.customer_id})`,
            site: `${str(site.Name)} (ID ${details.site_id})`,
            job_name: details.name,
            description: details.description || "(none)",
            order_no: details.order_no || "(none)",
            type: details.type,
            stage: "Pending",
            ...(priced
              ? {
                  cost_centre: details.cost_centre,
                  materials: materials.map((m) => `${m.description}: ${aud(m.amount_ex)} ex`),
                  labour: details.labour_hours
                    ? `${details.labour_hours} h` + (rate != null ? ` × ${aud(rate)}/h = ${aud(labourEx!)} ex` : "")
                    : "(none)",
                  total_ex_gst: totalEx == null ? "(see labour)" : aud(totalEx),
                  total_inc_gst: totalEx == null ? undefined : aud(Math.round(totalEx * 110) / 100),
                }
              : { lines: "(none — job only)" }),
            note_added: TAG,
          },
          code,
          warnings,
        );
      }

      let jobId = 0;
      try {
        const job = await simproCreate<{ ID: number }>("/jobs/", {
          Customer: details.customer_id,
          Site: details.site_id,
          Type: details.type,
          Name: details.name,
          ...(details.description ? { Description: html(details.description) } : {}),
          ...(details.order_no ? { OrderNo: details.order_no } : {}),
        });
        if (!job?.ID) throw new Error("SimPRO didn't return the new job's ID");
        jobId = job.ID;
      } catch (err) {
        const message = explain(err);
        await log("simpro_create_job", details, { ok: false, error: message });
        throw new Error(message);
      }

      // The job exists from here on. A failed line is reported, not thrown,
      // so Claude doesn't try again and make a second job.
      const problems: string[] = [];
      if (priced) {
        try {
          const section = await simproCreate<{ ID: number }>(`/jobs/${jobId}/sections/`, {});
          const cc = await simproCreate<{ ID: number }>(`/jobs/${jobId}/sections/${section.ID}/costCenters/`, {
            CostCenter: centreId,
          });
          const at = `/jobs/${jobId}/sections/${section.ID}/costCenters/${cc.ID}`;
          for (const m of materials) {
            await simproCreate(`${at}/oneOffs/`, {
              Type: "Material",
              Description: m.description,
              Total: { Qty: 1 },
              SellPriceExDiscount: m.amount_ex,
            }).catch((e) => problems.push(`Material "${m.description}": ${explain(e)}`));
          }
          if (details.labour_hours) {
            await simproCreate(`${at}/labor/`, {
              LaborType: LABOUR_TYPE_ID,
              Total: { Qty: details.labour_hours },
            }).catch((e) => problems.push(`Labour ${details.labour_hours} h: ${explain(e)}`));
          }
        } catch (e) {
          problems.push(`Couldn't set up the ${details.cost_centre} cost centre, so no lines were added: ${explain(e)}`);
        }
      }
      const tagged = await simproCreate(`/jobs/${jobId}/notes/`, {
        Subject: TAG,
        Note: html(`${TAG} from the RAS-VERTEX connector.`),
      }).then(() => true, () => false);

      const total = await simproRead(`/jobs/${jobId}`, { columns: "ID,Total" })
        .then((r) => (r.data as { Total?: { ExTax?: number; IncTax?: number } }).Total)
        .catch(() => undefined);
      await log("simpro_create_job", details, {
        ok: problems.length === 0,
        record: jobId,
        error: problems.length ? problems.join(" | ") : undefined,
      });
      return toText({
        status: problems.length ? "CREATED, BUT SOME LINES FAILED — do not create the job again" : "CREATED",
        job_id: jobId,
        total_ex_gst: total?.ExTax != null ? aud(total.ExTax) : undefined,
        total_inc_gst: total?.IncTax != null ? aud(total.IncTax) : undefined,
        problems: problems.length ? problems : undefined,
        tagged_with_note: tagged,
      });
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
        const message = explain(err);
        await log("simpro_add_note", details, { ok: false, error: message });
        throw new Error(message);
      }
    },
  },
];
