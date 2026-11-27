// lib/mcp/clients.ts
// ─────────────────────────────────────────────────────────────────────────────
// The connector's client tools: they create records in live SimPRO.
//
//   simpro_create_customer — a new company or individual customer
//   simpro_create_site     — a new site, linked to a customer
//   simpro_create_contact  — a new contact on a customer or a site
//
// Same two steps as lib/mcp/actions.ts: a preview with a confirm code, then a
// confirmed second call. Each preview looks for what already exists (similar
// names, the same address, the same person) and warns, because a duplicate
// customer or contact is the usual way a client's history gets split.
// ─────────────────────────────────────────────────────────────────────────────

import { simproCreate, simproRead, like, toText } from "./simpro";
import { findContacts, likeness } from "./contacts";
import { codeFor, customerName, explain, id, log, previewText, rejected, str } from "./actions";
import type { Tool } from "./tools";

type Args = Record<string, unknown>;

const ADDRESS_PROPS = {
  street: { type: "string", description: "Street address, e.g. '12 Smith Street' or 'Unit 4, 12 Smith Street'" },
  suburb: { type: "string" },
  state: { type: "string", description: "Default QLD" },
  postcode: { type: "string" },
};

function address(a: Args) {
  return {
    street: str(a.street).slice(0, 250),
    suburb: str(a.suburb).slice(0, 100),
    state: (str(a.state) || "QLD").toUpperCase().slice(0, 10),
    postcode: str(a.postcode).slice(0, 10),
  };
}

const addressBody = (d: ReturnType<typeof address>) =>
  d.street || d.suburb || d.postcode
    ? { Address: { Address: d.street, City: d.suburb, State: d.state, PostalCode: d.postcode, Country: "Australia" } }
    : {};

const addressText = (d: ReturnType<typeof address>) =>
  d.street || d.suburb || d.postcode ? [d.street, d.suburb, d.state, d.postcode].filter(Boolean).join(", ") : "(none)";

const rowsOf = (page: { data: unknown } | null) =>
  Array.isArray(page?.data) ? (page!.data as Record<string, unknown>[]) : [];

/** The longest word in a name, for a "contains" search that tolerates the rest being different. */
const keyWord = (name: string) =>
  name
    .split(/[\s,&()/-]+/)
    .filter((w) => !/^(the|and|of|pty|ltd|body|corporate|cts|unit|units)$/i.test(w))
    .sort((x, y) => y.length - x.length)[0] ?? name;

const CONFIRM_HELP =
  "Two steps: call without confirm_code to get a preview (and warnings about anything similar that already " +
  "exists), show it to the person, and only after they confirm call again with exactly the same details plus " +
  "confirm_code. If the preview finds an existing match, ask whether to use that instead.";

export const CLIENT_ACTIONS: Tool[] = [
  {
    name: "simpro_create_customer",
    readOnly: false,
    description:
      "Create a new customer in RAS-VERTEX's live SimPRO: a company (body corporate, business, agency) or an " +
      "individual (a homeowner). Search with simpro_search_customers first; only create when they're genuinely new. " +
      CONFIRM_HELP,
    inputSchema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["company", "individual"] },
        company_name: { type: "string", description: "For a company" },
        given_name: { type: "string", description: "For an individual" },
        family_name: { type: "string", description: "For an individual" },
        email: { type: "string" },
        phone: { type: "string" },
        mobile: { type: "string", description: "For an individual" },
        ...ADDRESS_PROPS,
        confirm_code: { type: "string", description: "Only on the second call, from the preview" },
      },
      required: ["kind"],
    },
    run: async (a: Args) => {
      const details = {
        kind: str(a.kind) === "individual" ? "individual" : "company",
        company_name: str(a.company_name).slice(0, 250),
        given_name: str(a.given_name).slice(0, 100),
        family_name: str(a.family_name).slice(0, 100),
        email: str(a.email).slice(0, 250),
        phone: str(a.phone).slice(0, 50),
        mobile: str(a.mobile).slice(0, 50),
        ...address(a),
      };
      const company = details.kind === "company";
      if (company && !details.company_name) throw new Error("Give the company_name");
      if (!company && (!details.given_name || !details.family_name)) throw new Error("Give the given_name and family_name");
      const name = company ? details.company_name : `${details.given_name} ${details.family_name}`;

      const code = codeFor("simpro_create_customer", details);
      const given = str(a.confirm_code);
      if (given !== code) {
        const warnings: string[] = [];
        if (given) warnings.push("The confirm_code didn't match these details, so this is a fresh preview.");
        const asks = company
          ? [simproRead("/customers/companies/", { CompanyName: like(keyWord(name)), columns: "ID,CompanyName", pageSize: 100 })]
          : [simproRead("/customers/individuals/", { FamilyName: like(details.family_name), columns: "ID,GivenName,FamilyName", pageSize: 100 })];
        if (details.email) {
          asks.push(simproRead(company ? "/customers/companies/" : "/customers/individuals/", {
            Email: details.email,
            columns: company ? "ID,CompanyName" : "ID,GivenName,FamilyName",
            pageSize: 10,
          }));
        }
        const found = (await Promise.allSettled(asks)).flatMap((r) => (r.status === "fulfilled" ? rowsOf(r.value) : []));
        const label = (r: Record<string, unknown>) => (company ? str(r.CompanyName) : `${str(r.GivenName)} ${str(r.FamilyName)}`);
        const similar = [...new Map(found.map((r) => [r.ID, r])).values()]
          .map((r) => ({ r, score: likeness(name, label(r)) }))
          .filter((x) => x.score >= 0.75 || label(x.r).toLowerCase().includes(name.toLowerCase()))
          .sort((x, y) => y.score - x.score)
          .slice(0, 6);
        if (similar.length) {
          warnings.push(
            `Similar customers already in SimPRO: ${similar.map((x) => `${label(x.r)} (ID ${x.r.ID})`).join("; ")}. ` +
              "Ask whether it's one of these before creating a new one.",
          );
        }
        return previewText(
          {
            record: company ? "COMPANY CUSTOMER" : "INDIVIDUAL CUSTOMER",
            name,
            email: details.email || "(none)",
            phone: details.phone || "(none)",
            ...(company ? {} : { mobile: details.mobile || "(none)" }),
            address: addressText(details),
          },
          code,
          warnings,
        );
      }

      try {
        const made = await simproCreate<{ ID: number }>(company ? "/customers/companies/" : "/customers/individuals/", {
          ...(company
            ? { CompanyName: details.company_name }
            : { GivenName: details.given_name, FamilyName: details.family_name, ...(details.mobile ? { CellPhone: details.mobile } : {}) }),
          ...(details.email ? { Email: details.email } : {}),
          ...(details.phone ? { Phone: details.phone } : {}),
          ...addressBody(details),
        });
        if (!made?.ID) throw new Error("SimPRO didn't return the new customer's ID");
        await log("simpro_create_customer", details, { ok: true, record: made.ID });
        return toText({ status: "CREATED", customer_id: made.ID, name });
      } catch (err) {
        const e = rejected("customer", err);
        await log("simpro_create_customer", details, { ok: false, error: e.message });
        throw e;
      }
    },
  },
  {
    name: "simpro_create_site",
    readOnly: false,
    description:
      "Create a new site (property) in RAS-VERTEX's live SimPRO, linked to an existing customer. Search with " +
      "simpro_search_sites first; only create when it's genuinely new. The name defaults to the street and suburb, " +
      "the way existing sites are named. " + CONFIRM_HELP,
    inputSchema: {
      type: "object",
      properties: {
        customer_id: { type: "number", description: "The customer the site belongs to" },
        name: { type: "string", description: "Site name, e.g. 'Aspect' or '12 Smith Street Noosaville'" },
        ...ADDRESS_PROPS,
        confirm_code: { type: "string", description: "Only on the second call, from the preview" },
      },
      required: ["customer_id", "street", "suburb"],
    },
    run: async (a: Args) => {
      const addr = address(a);
      const details = {
        customer_id: id(a.customer_id),
        name: (str(a.name) || `${addr.street} ${addr.suburb}`).trim().slice(0, 250),
        ...addr,
      };
      if (!details.customer_id) throw new Error("Give the customer_id the site belongs to");
      if (!details.street || !details.suburb) throw new Error("Give the street and suburb");

      const code = codeFor("simpro_create_site", details);
      const given = str(a.confirm_code);
      if (given !== code) {
        const customer = await customerName(details.customer_id).catch(() => null);
        if (!customer) throw new Error(`No customer with ID ${details.customer_id}`);
        const warnings: string[] = [];
        if (given) warnings.push("The confirm_code didn't match these details, so this is a fresh preview.");
        const [byAddress, byName] = await Promise.all([
          simproRead("/sites/", { "Address.Address": like(keyWord(details.street)), columns: "ID,Name,Address", pageSize: 50 }).catch(() => null),
          simproRead("/sites/", { Name: like(keyWord(details.name)), columns: "ID,Name,Address", pageSize: 50 }).catch(() => null),
        ]);
        const text = (r: Record<string, unknown>) => {
          const ad = (r.Address ?? {}) as Record<string, unknown>;
          return `${str(r.Name)} — ${[str(ad.Address), str(ad.City)].filter(Boolean).join(", ")}`;
        };
        const same = [...new Map([...rowsOf(byAddress), ...rowsOf(byName)].map((r) => [r.ID, r])).values()]
          .map((r) => {
            const ad = (r.Address ?? {}) as Record<string, unknown>;
            const score = Math.max(
              likeness(`${details.street} ${details.suburb}`, `${str(ad.Address)} ${str(ad.City)}`),
              likeness(details.name, str(r.Name)),
            );
            return { r, score };
          })
          .filter((x) => x.score >= 0.75)
          .sort((x, y) => y.score - x.score)
          .slice(0, 6);
        if (same.length) {
          warnings.push(
            `Similar sites already in SimPRO: ${same.map((x) => `${text(x.r)} (ID ${x.r.ID})`).join("; ")}. ` +
              "Ask whether it's one of these before creating a new one.",
          );
        }
        return previewText(
          { record: "SITE", name: details.name, address: addressText(details), customer: `${customer} (ID ${details.customer_id})` },
          code,
          warnings,
        );
      }

      let siteId = 0;
      try {
        const made = await simproCreate<{ ID: number }>("/sites/", {
          Name: details.name,
          ...addressBody(details),
          Customers: [details.customer_id],
        });
        if (!made?.ID) throw new Error("SimPRO didn't return the new site's ID");
        siteId = made.ID;
      } catch (err) {
        const e = rejected("site", err);
        await log("simpro_create_site", details, { ok: false, error: e.message });
        throw e;
      }
      // Check the link to the customer took; say so plainly if it didn't.
      const linked = await simproRead(`/sites/${siteId}`)
        .then((r) => ((r.data as { Customers?: { ID: number }[] }).Customers ?? []).some((c) => c.ID === details.customer_id))
        .catch(() => null);
      const problem =
        linked === false
          ? `The site was created but isn't linked to customer ${details.customer_id}. Link it in SimPRO (site → Customers); don't create the site again.`
          : undefined;
      await log("simpro_create_site", details, { ok: !problem, record: siteId, error: problem });
      return toText({ status: problem ? "CREATED, BUT NOT LINKED — do not create the site again" : "CREATED", site_id: siteId, problem });
    },
  },
  {
    name: "simpro_create_contact",
    readOnly: false,
    description:
      "Create a new contact person in RAS-VERTEX's live SimPRO, on a customer (e.g. a strata manager) or on a site " +
      "(e.g. an on-site building manager). Check simpro_find_contact first: if they already exist, use that contact " +
      "instead. " + CONFIRM_HELP,
    inputSchema: {
      type: "object",
      properties: {
        on: { type: "string", enum: ["customer", "site"], description: "Where the contact belongs" },
        customer_id: { type: "number", description: "When on = customer" },
        site_id: { type: "number", description: "When on = site" },
        given_name: { type: "string" },
        family_name: { type: "string" },
        email: { type: "string" },
        mobile: { type: "string" },
        phone: { type: "string", description: "Work phone" },
        position: { type: "string", description: "e.g. 'Strata manager', 'Building manager'" },
        confirm_code: { type: "string", description: "Only on the second call, from the preview" },
      },
      required: ["on", "given_name"],
    },
    run: async (a: Args) => {
      const details = {
        on: str(a.on) === "site" ? "site" : "customer",
        customer_id: id(a.customer_id),
        site_id: id(a.site_id),
        given_name: str(a.given_name).slice(0, 100),
        family_name: str(a.family_name).slice(0, 100),
        email: str(a.email).slice(0, 250),
        mobile: str(a.mobile).slice(0, 50),
        phone: str(a.phone).slice(0, 50),
        position: str(a.position).slice(0, 100),
      };
      const onSite = details.on === "site";
      const targetId = onSite ? details.site_id : details.customer_id;
      if (!targetId) throw new Error(onSite ? "Give the site_id" : "Give the customer_id");
      if (!details.given_name) throw new Error("Give at least the given_name");
      const name = `${details.given_name} ${details.family_name}`.trim();

      const code = codeFor("simpro_create_contact", details);
      const given = str(a.confirm_code);
      if (given !== code) {
        const target = onSite
          ? await simproRead(`/sites/${targetId}`, { columns: "ID,Name" }).then((r) => str((r.data as Args).Name)).catch(() => null)
          : await customerName(targetId).catch(() => null);
        if (!target) throw new Error(`No ${details.on} with ID ${targetId}`);
        const warnings: string[] = [];
        if (given) warnings.push("The confirm_code didn't match these details, so this is a fresh preview.");
        const [byName, byEmail] = await Promise.all([
          findContacts(name, onSite ? 0 : targetId, onSite ? targetId : 0, 6).catch(() => []),
          details.email ? findContacts(details.email, 0, 0, 3).catch(() => []) : Promise.resolve([]),
        ]);
        const all = [...new Map([...byEmail, ...byName].map((c) => [c.contact_id, c])).values()];
        const here = all.filter((c) => (onSite ? c.on_this_site : c.on_this_customer));
        if (here.length) {
          warnings.push(
            `Already a contact on this ${details.on}: ${here.map((c) => `${c.name}${c.email ? ` <${c.email}>` : ""} (ID ${c.contact_id})`).join("; ")}. ` +
              "Use that contact instead of creating another, unless the person says it's someone different.",
          );
        } else if (all.length) {
          warnings.push(
            `Similar contacts elsewhere in SimPRO: ${all
              .map((c) => `${c.name}${c.email ? ` <${c.email}>` : ""} (ID ${c.contact_id}; ${[...c.customers, ...c.sites].join(", ") || "not linked"})`)
              .join("; ")}. Ask whether it's one of these.`,
          );
        }
        return previewText(
          {
            record: "CONTACT",
            name,
            on: `${details.on}: ${target} (ID ${targetId})`,
            email: details.email || "(none)",
            mobile: details.mobile || "(none)",
            phone: details.phone || "(none)",
            position: details.position || "(none)",
          },
          code,
          warnings,
        );
      }

      try {
        const made = await simproCreate<{ ID: number }>(onSite ? `/sites/${targetId}/contacts/` : `/customers/${targetId}/contacts/`, {
          GivenName: details.given_name,
          FamilyName: details.family_name,
          ...(details.email ? { Email: details.email } : {}),
          ...(details.mobile ? { CellPhone: details.mobile } : {}),
          ...(details.phone ? { WorkPhone: details.phone } : {}),
          ...(details.position ? { Position: details.position } : {}),
        });
        if (!made?.ID) throw new Error("SimPRO didn't return the new contact's ID");
        await log("simpro_create_contact", details, { ok: true, record: made.ID });
        return toText({ status: "CREATED", contact_id: made.ID, name, on: details.on, [`${details.on}_id`]: targetId });
      } catch (err) {
        const e = rejected("contact", err);
        await log("simpro_create_contact", details, { ok: false, error: explain(e) });
        throw e;
      }
    },
  },
];
