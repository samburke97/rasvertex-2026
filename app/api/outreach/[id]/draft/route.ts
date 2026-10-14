// app/api/outreach/[id]/draft/route.ts
// Fills the next email for an opportunity from its rule's template
// (lib/outreach/templates.ts) and saves it as the pending draft, replacing
// any edits. Nothing is sent.

import { NextResponse } from "next/server";
import { templateEmail } from "@/lib/outreach/templates";
import { getOpportunity, saveDraft } from "@/lib/outreach/store";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  const id = parseInt((await params).id, 10);
  if (!(id > 0)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

  const opportunity = await getOpportunity(id);
  if (!opportunity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (opportunity.status !== "open") {
    return NextResponse.json({ error: "This opportunity is no longer open." }, { status: 409 });
  }

  const draft = templateEmail(opportunity);
  await saveDraft(id, draft.subject, draft.body);
  return NextResponse.json({ opportunity: await getOpportunity(id) });
}
