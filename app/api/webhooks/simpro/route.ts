// app/api/webhooks/simpro/route.ts
// SimPRO sends: { name: "Job", action: "updated", reference: { companyID: 0, jobID: 10862 } }
// We then fetch full job + site details from SimPRO API.

import { NextRequest, NextResponse } from "next/server";
import { buildPaymentSchedule } from "@/lib/reports/works-agreement/types";
import {
  saveAgreement,
  getAgreement,
} from "@/lib/reports/works-agreement/store";

const THRESHOLD = 20000;
const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;

async function simproGet<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SimPRO ${res.status}: ${url}`);
  return res.json();
}

// Safely extract a string from a field that might be a string or a nested object
function extractString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val.trim();
  if (typeof val === "number") return String(val);
  // If it's an object, try common nested field names
  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const nested =
      obj.Address ??
      obj.Street ??
      obj.StreetAddress ??
      obj.Name ??
      obj.Value ??
      obj.Text ??
      "";
    return extractString(nested);
  }
  return "";
}

async function fetchSiteAddress(
  companyId: number,
  siteId: number,
): Promise<string> {
  try {
    const site = await simproGet<Record<string, unknown>>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/sites/${siteId}`,
    );
    console.log("[Webhook] Site raw:", JSON.stringify(site));

    // Extract each part safely — handles both flat strings and nested objects
    const addr = extractString(
      site.Address ?? site.Street ?? site.StreetAddress ?? "",
    );
    const city = extractString(site.City ?? site.Suburb ?? "");
    const state = extractString(site.State ?? "");
    const postcode = extractString(
      site.PostCode ?? site.PostalCode ?? site.Postcode ?? "",
    );

    const parts = [addr, city, state, postcode].filter(Boolean);
    const result = parts.join(", ");

    console.log(`[Webhook] Site address resolved: "${result}"`);
    return result;
  } catch (err) {
    console.warn("[Webhook] Site fetch failed:", err);
    return "";
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log("[Webhook] Received:", JSON.stringify(body));

    const action: string = body.action ?? "";
    const name: string = body.name ?? "";
    const reference = body.reference ?? {};
    const jobId: number = reference.jobID;
    const companyId: number = reference.companyID ?? 0;

    const isJobEvent =
      name.toLowerCase() === "job" &&
      (action === "created" || action === "updated");

    if (!isJobEvent || !jobId) {
      console.log(`[Webhook] Skipped — name: ${name}, action: ${action}`);
      return NextResponse.json({ received: true, skipped: "not a job event" });
    }

    console.log(`[Webhook] Fetching job ${jobId}...`);
    const job = await simproGet<Record<string, unknown>>(
      `${SIMPRO_BASE_URL}/api/v1.0/companies/${companyId}/jobs/${jobId}`,
    );
    console.log("[Webhook] Job fetched:", JSON.stringify(job));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const total = job.Total as any;
    const totalIncGst: number = total?.IncTax ?? 0;
    console.log(`[Webhook] Total Inc GST: $${totalIncGst}`);

    if (totalIncGst < THRESHOLD) {
      console.log(`[Webhook] $${totalIncGst} below threshold — skipping`);
      return NextResponse.json({
        received: true,
        skipped: `$${totalIncGst} below $${THRESHOLD} threshold`,
      });
    }

    const jobIdStr = String(jobId);

    if (action === "created") {
      const existing = await getAgreement(jobIdStr);
      if (existing) {
        return NextResponse.json({ received: true, skipped: "already exists" });
      }
    }

    // ── Build client name ─────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const customer = job.Customer as any;
    const clientName =
      customer?.CompanyName?.trim() ||
      [customer?.GivenName, customer?.FamilyName].filter(Boolean).join(" ") ||
      "Client";

    // ── Fetch site address ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const site = job.Site as any;
    const siteAddress = site?.ID
      ? await fetchSiteAddress(companyId, site.ID)
      : "";

    const siteAddressFinal = siteAddress || site?.Name || "";
    console.log(`[Webhook] Final site address: "${siteAddressFinal}"`);

    const date = new Date(
      (job.DateIssued as string) || Date.now(),
    ).toLocaleDateString("en-AU");

    const agreement = {
      jobId: jobIdStr,
      jobNo: job.No ? `#${job.No}` : `#${jobId}`,
      jobName: (job.Name as string)?.trim() || `Job ${jobId}`,
      clientName,
      siteAddress: siteAddressFinal,
      siteName: site?.Name?.trim() || clientName,
      initialWorks: (job.Name as string)?.trim() || "",
      colourScheme: "To be advised",
      totalIncGst,
      paymentSchedule: buildPaymentSchedule(totalIncGst),
      date,
      createdAt: new Date().toISOString(),
      status: "draft" as const,
      triggeredBy: "webhook" as const,
    };

    await saveAgreement(agreement);
    console.log(
      `[Webhook] ✅ Saved — Job ${jobIdStr} $${totalIncGst.toLocaleString()} | Address: "${siteAddressFinal}"`,
    );

    return NextResponse.json({
      received: true,
      created: true,
      jobId: jobIdStr,
      totalIncGst,
      siteAddress: siteAddressFinal,
      schedulePayments: agreement.paymentSchedule.length,
    });
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "SimPRO Works Agreement Webhook",
    threshold: `$${THRESHOLD}`,
  });
}
