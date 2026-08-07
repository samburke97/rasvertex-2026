// app/api/crm/leads/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  listLeads,
  createLead,
  LEAD_STAGES,
  type LeadStage,
} from "@/lib/crm/store";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stageParam = searchParams.get("stage");
  const stage =
    stageParam && (LEAD_STAGES as readonly string[]).includes(stageParam)
      ? (stageParam as LeadStage)
      : undefined;

  try {
    const leads = await listLeads(stage);
    return NextResponse.json({ leads });
  } catch (err) {
    console.error("[CRM] listLeads failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch leads." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    company?: string | null;
    email?: string | null;
    phone?: string | null;
    stage?: LeadStage;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (body.stage && !(LEAD_STAGES as readonly string[]).includes(body.stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  try {
    const lead = await createLead({
      name: body.name.trim(),
      company: body.company ?? null,
      email: body.email ?? null,
      phone: body.phone ?? null,
      stage: body.stage,
    });
    return NextResponse.json({ lead }, { status: 201 });
  } catch (err) {
    console.error("[CRM] createLead failed:", err);
    return NextResponse.json(
      { error: "Failed to create lead." },
      { status: 500 },
    );
  }
}
