// app/api/crm/leads/[id]/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  getLead,
  updateLead,
  listActivity,
  LEAD_STAGES,
  type LeadStage,
} from "@/lib/crm/store";

type Params = { params: Promise<{ id: string }> };

function parseId(idParam: string): number | null {
  const id = parseInt(idParam, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });

  try {
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const activity = await listActivity(id);
    return NextResponse.json({ lead, activity });
  } catch (err) {
    console.error("[CRM] getLead failed:", err);
    return NextResponse.json({ error: "Failed to fetch lead." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id: idParam } = await params;
  const id = parseId(idParam);
  if (!id) return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });

  let body: {
    name?: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    stage?: LeadStage;
    chasing?: boolean;
    customFields?: Record<string, string>;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    body.customFields !== undefined &&
    (typeof body.customFields !== "object" ||
      body.customFields === null ||
      Array.isArray(body.customFields))
  ) {
    return NextResponse.json({ error: "Invalid customFields" }, { status: 400 });
  }

  if (body.stage && !(LEAD_STAGES as readonly string[]).includes(body.stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  try {
    const lead = await updateLead(id, body);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ lead });
  } catch (err) {
    console.error("[CRM] updateLead failed:", err);
    return NextResponse.json(
      { error: "Failed to update lead." },
      { status: 500 },
    );
  }
}
