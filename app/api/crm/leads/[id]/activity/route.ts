// app/api/crm/leads/[id]/activity/route.ts
// Manual notes only — email activity is created by the /email route.

import { NextRequest, NextResponse } from "next/server";
import { addNote, getLead } from "@/lib/crm/store";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id: idParam } = await params;
  const id = parseInt(idParam, 10);
  if (isNaN(id) || id <= 0)
    return NextResponse.json({ error: "Invalid lead ID" }, { status: 400 });

  let body: { body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.body?.trim())
    return NextResponse.json({ error: "body is required" }, { status: 400 });

  try {
    const lead = await getLead(id);
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const activity = await addNote(id, body.body.trim());
    return NextResponse.json({ activity }, { status: 201 });
  } catch (err) {
    console.error("[CRM] addNote failed:", err);
    return NextResponse.json({ error: "Failed to add note." }, { status: 500 });
  }
}
