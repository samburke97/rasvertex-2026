// app/api/simpro/recertifications/create-quote/route.ts
// Full quote creation flow:
// 1. POST /quotes/ — with Salesperson & ProjectManager = Archer Dutch (ID 20)
// 2. POST /quotes/{id}/sections/ — create blank section
// 3. POST /quotes/{id}/sections/{sectionId}/costCenters/ — Height Safety (ID 11)
// 4. POST /quotes/{id}/sections/{sectionId}/costCenters/{ccId}/oneOffs/ — price line item
// 5. Save to Neon recertification_quotes (quote_type = 'recertification')

import { NextRequest, NextResponse } from "next/server";
import { saveRecertQuote } from "@/lib/recertifications/store";

const SIMPRO_BASE_URL = process.env.NEXT_PUBLIC_SIMPRO_BASE_URL;
const SIMPRO_ACCESS_TOKEN = process.env.SIMPRO_ACCESS_TOKEN;
const ARCHER_DUTCH_ID = 20;
const HEIGHT_SAFETY_COST_CENTRE_ID = 11;

async function simproPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SIMPRO_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SIMPRO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SimPRO POST ${path} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export interface CreateQuotePayload {
  customerId: number;
  siteId: number;
  siteName: string;
  customer: string;
  lastExTax: number;
  nextDueDate: string;
}

export async function POST(request: NextRequest) {
  if (!SIMPRO_BASE_URL || !SIMPRO_ACCESS_TOKEN) {
    return NextResponse.json(
      { error: "SimPRO configuration missing" },
      { status: 500 },
    );
  }

  const body: CreateQuotePayload = await request.json();
  const { customerId, siteId, siteName, customer, lastExTax, nextDueDate } =
    body;

  if (!customerId || !siteId || lastExTax === undefined || !nextDueDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const currentYear = new Date().getFullYear();
  const dueYear = new Date(nextDueDate).getFullYear();
  const quoteYear = Math.max(dueYear, currentYear);

  // Canonical naming convention — all new quotes use this format
  const quoteName = `Annual Anchor Recertification - ${quoteYear}`;

  const description = `Height safety recertification at ${siteName}\nProfessional height safety services, including:\n* Carry out annual compliance inspection of existing roof-mounted anchor points.\n* On completion, inspect, tag and supply compliance documentation as per relevant legislation`;

  const newExTax = Math.round(lastExTax * 1.05 * 100) / 100;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  try {
    console.log(
      `[CreateQuote] Step 1: Creating quote "${quoteName}" for customer ${customerId}`,
    );
    const quote = await simproPost<{ ID: number; JobNo: string }>(
      `/api/v1.0/companies/0/quotes/`,
      {
        Customer: customerId,
        Site: siteId,
        Type: "Service",
        Name: quoteName,
        Description: description,
        DueDate: dueDateStr,
        Salesperson: ARCHER_DUTCH_ID,
        ProjectManager: ARCHER_DUTCH_ID,
      },
    );
    const quoteId = quote.ID;
    const quoteNo = quote.JobNo || null;
    console.log(`[CreateQuote] ✓ Quote created: ID ${quoteId} No ${quoteNo}`);

    console.log(`[CreateQuote] Step 2: Creating section`);
    const section = await simproPost<{ ID: number }>(
      `/api/v1.0/companies/0/quotes/${quoteId}/sections/`,
      {},
    );
    const sectionId = section.ID;

    console.log(`[CreateQuote] Step 3: Adding Height Safety cost centre`);
    const costCentre = await simproPost<{ ID: number }>(
      `/api/v1.0/companies/0/quotes/${quoteId}/sections/${sectionId}/costCenters/`,
      { CostCenter: HEIGHT_SAFETY_COST_CENTRE_ID },
    );
    const costCentreId = costCentre.ID;

    console.log(
      `[CreateQuote] Step 4: Adding one-off item at $${newExTax} ex tax`,
    );
    await simproPost(
      `/api/v1.0/companies/0/quotes/${quoteId}/sections/${sectionId}/costCenters/${costCentreId}/oneOffs/`,
      {
        Type: "Labor",
        Description: "Annual Anchor Recertification",
        SellPriceExDiscount: newExTax,
        Total: { Qty: 1 },
      },
    );

    console.log(`[CreateQuote] Step 5: Saving to Neon`);
    await saveRecertQuote({
      siteId,
      year: quoteYear,
      quoteType: "recertification",
      quoteId,
      quoteName,
      quoteStatus: "created",
      simproQuoteNo: quoteNo,
      customer: customer || siteName,
      siteName,
    });

    console.log(`[CreateQuote] ✅ Complete — Quote ${quoteId} "${quoteName}"`);

    return NextResponse.json({
      quoteId,
      quoteName,
      quoteNo: quoteNo || "",
      newExTax,
      newIncTax: Math.round(newExTax * 1.1 * 100) / 100,
      dueDate: dueDateStr,
      quoteYear,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[CreateQuote] Failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
