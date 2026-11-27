// lib/mcp/contacts.ts
// ─────────────────────────────────────────────────────────────────────────────
// Typo-tolerant search for people and names in SimPRO, shared by the
// simpro_find_contact tool and the create tools' duplicate checks.
// ─────────────────────────────────────────────────────────────────────────────

import { like, simproRead } from "./simpro";

/** Runs several reads and merges the rows by ID, keeping the first seen. */
async function merged(asks: Promise<{ data: unknown }>[]) {
  const lists = await Promise.allSettled(asks);
  const seen = new Set<unknown>();
  const rows: Record<string, unknown>[] = [];
  for (const l of lists) {
    if (l.status !== "fulfilled" || !Array.isArray(l.value.data)) continue;
    for (const r of l.value.data as Record<string, unknown>[]) {
      if (seen.has(r.ID)) continue;
      seen.add(r.ID);
      rows.push(r);
    }
  }
  return rows;
}

/** 0–1 likeness of two strings (1 = same), from edit distance. */
export function likeness(a: string, b: string): number {
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
export async function findContacts(query: string, customerId: number, siteId: number, limit: number) {
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

  const pool = (await merged(asks)) as unknown as ContactRow[];
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
