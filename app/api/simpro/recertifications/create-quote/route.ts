// app/api/simpro/recertifications/create-quote/route.ts

import { NextRequest, NextResponse } from "next/server";
import { removeSiteFromCache } from "@/lib/recertifications/store";

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
  const { customerId, siteId, lastExTax, nextDueDate } = body;

  if (!customerId || !siteId || lastExTax === undefined || !nextDueDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const currentYear = new Date().getFullYear();
  const dueYear = new Date(nextDueDate).getFullYear();
  const quoteYear = Math.max(dueYear, currentYear);

  const quoteName = `Annual Anchor Recertification - ${quoteYear}`;

  const newExTax = Math.round(lastExTax * 1.05 * 100) / 100;
  const newIncTax = Math.round(newExTax * 1.1 * 100) / 100;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);
  const dueDateStr = dueDate.toISOString().split("T")[0];

  try {
    // 1. Create quote
    const quote = await simproPost<{ ID: number; JobNo: string }>(
      `/api/v1.0/companies/0/quotes/`,
      {
        Name: quoteName,
        Customer: customerId,
        Site: siteId,
        Type: "Service",
        DueDate: dueDateStr,
        Salesperson: ARCHER_DUTCH_ID,
        ProjectManager: ARCHER_DUTCH_ID,
      },
    );

    const quoteId = quote.ID;

    // 2. Create section
    const section = await simproPost<{ ID: number }>(
      `/api/v1.0/companies/0/quotes/${quoteId}/sections/`,
      {},
    );

    const sectionId = section.ID;

    // 3. Create cost center
    const costCenter = await simproPost<{ ID: number }>(
      `/api/v1.0/companies/0/quotes/${quoteId}/sections/${sectionId}/costCenters/`,
      {
        CostCenter: HEIGHT_SAFETY_COST_CENTRE_ID,
      },
    );

    const costCenterId = costCenter.ID;

    // 4. Add ONE OFF ITEM (FIXED)
    await simproPost(
      `/api/v1.0/companies/0/quotes/${quoteId}/sections/${sectionId}/costCenters/${costCenterId}/oneOffs/`,
      {
        Type: "Material", // or "Labor" depending on your setup
        Description: quoteName,
        Total: {
          Qty: 1,
        },
        SellPriceExDiscount: newExTax,
      },
    );

    // 5. Clear cache
    await removeSiteFromCache(siteId);

    return NextResponse.json({
      quoteId,
      quoteName,
      quoteNo: quote.JobNo ?? null,
      totalExTax: newExTax,
      totalIncTax: newIncTax,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[CreateQuote]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
