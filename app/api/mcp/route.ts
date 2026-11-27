// app/api/mcp/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// Claude connector (remote MCP server) for RAS-VERTEX's SimPRO.
//
// Add it in Claude as a custom connector with the URL
//   https://<your-domain>/api/mcp?key=<MCP_SECRET>
// or the URL https://<your-domain>/api/mcp plus the request header
//   Authorization: Bearer <MCP_SECRET>
//
// Stateless Streamable HTTP: each POST carries one JSON-RPC message (or a
// batch) and gets a plain JSON answer. Tools live in lib/mcp/tools.ts; all
// read except the create tools (lib/mcp/actions.ts: jobs, quotes, notes;
// lib/mcp/clients.ts: customers, sites, contacts),
// which preview first and create only on a confirmed second call.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { TOOLS } from "@/lib/mcp/tools";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SERVER = { name: "ras-vertex-simpro", version: "1.2.0" };
const LATEST = "2025-06-18";

const INSTRUCTIONS =
  "Access to RAS-VERTEX's live SimPRO (jobs, quotes, customers, sites, schedules, invoices). " +
  "Use the search tools for quick lookups and simpro_get_record for detail. For counts, date ranges, " +
  "totals and reports, read simpro_api_guide and then use simpro_query. Amounts are AUD. " +
  "The simpro_create_* tools and simpro_add_note change the live system: look up the real customer, " +
  "site or job first, ask the person about anything missing or unclear (never guess customers, sites, prices or " +
  "staff), call once for a preview, show it to the person, and only call with confirm_code after they say yes. " +
  "Never confirm on the person's behalf, and never create several records without asking about each. " +
  "If SimPRO turns a create down, tell the person what it needs, ask them for it, and preview again with it; " +
  "don't switch to the browser instead unless they ask. New jobs and quotes are due 14 days after entry unless " +
  "the person says otherwise. Ask who the salesperson and project manager are unless the person said. When a " +
  "contact person is mentioned, check simpro_find_contact first: use an exact match on that customer, ask " +
  "'Did you mean …?' for a close one, and ask which when several match. Before creating a customer, site or contact, search for it; if it " +
  "already exists use it, and if it's new, offer to create it rather than leaving it out.";

interface RpcMessage {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function authorised(req: NextRequest): boolean {
  const secret = process.env.MCP_SECRET;
  if (!secret || secret.length < 24) return false;
  const header = req.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : req.nextUrl.searchParams.get("key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const result = (id: RpcMessage["id"], value: unknown) => ({ jsonrpc: "2.0", id, result: value });
const failure = (id: RpcMessage["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

async function handle(msg: RpcMessage) {
  const { id, method, params = {} } = msg;
  const isNotification = id === undefined || id === null;

  switch (method) {
    case "initialize": {
      const asked = typeof params.protocolVersion === "string" ? params.protocolVersion : LATEST;
      return result(id, {
        protocolVersion: asked,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, {
        tools: TOOLS.map(({ name, description, inputSchema, readOnly = true }) => ({
          name,
          description,
          inputSchema,
          annotations: readOnly
            ? { readOnlyHint: true, openWorldHint: false }
            : { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
        })),
      });
    case "tools/call": {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) return failure(id, -32602, `Unknown tool: ${String(params.name)}`);
      try {
        const text = await tool.run((params.arguments as Record<string, unknown>) ?? {});
        return result(id, { content: [{ type: "text", text }] });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[MCP ${tool.name}]`, message);
        // Tool errors go back to Claude as results, so it can correct the query.
        return result(id, { content: [{ type: "text", text: `Error: ${message}` }], isError: true });
      }
    }
    default:
      if (isNotification) return null; // notifications/initialized etc.
      return failure(id, -32601, `Method not found: ${String(method)}`);
  }
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  let body: RpcMessage | RpcMessage[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(failure(null, -32700, "Parse error"), { status: 400 });
  }

  if (Array.isArray(body)) {
    const answers = (await Promise.all(body.map(handle))).filter(Boolean);
    return answers.length ? NextResponse.json(answers) : new NextResponse(null, { status: 202 });
  }
  const answer = await handle(body);
  return answer ? NextResponse.json(answer) : new NextResponse(null, { status: 202 });
}

// No server-sent event stream and no sessions: this server only answers POSTs.
export async function GET() {
  return new NextResponse("Method not allowed", { status: 405, headers: { Allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
