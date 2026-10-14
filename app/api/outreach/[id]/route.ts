// app/api/outreach/[id]/route.ts
// PATCH { subject, body } saves an edited draft;
// PATCH { action: "dismiss", reason } / { action: "restore" } changes status.

import { NextRequest, NextResponse } from "next/server";
import {
  dismissOpportunity,
  getOpportunity,
  restoreOpportunity,
  saveDraft,
} from "@/lib/outreach/store";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const id = parseInt((await params).id, 10);
  if (!(id > 0)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  let body: { action?: string; reason?: string; subject?: string; body?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body.action === "dismiss") {
    await dismissOpportunity(id, body.reason?.trim() || "Dismissed");
  } else if (body.action === "restore") {
    await restoreOpportunity(id);
  } else if (typeof body.subject === "string" && typeof body.body === "string") {
    await saveDraft(id, body.subject, body.body);
  } else {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const opportunity = await getOpportunity(id);
  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ opportunity });
}
