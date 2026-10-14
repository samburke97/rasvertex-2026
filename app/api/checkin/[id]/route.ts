// app/api/checkin/[id]/route.ts
// One client's full check-in record: history, quotes, invoices, angles.

import { NextRequest, NextResponse } from "next/server";
import { getCheckinClient } from "@/lib/checkin/store";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const id = parseInt((await params).id, 10);
  if (!(id > 0)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  try {
    const client = await getCheckinClient(id);
    if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 });
    return NextResponse.json({ client });
  } catch (err) {
    console.error("[Checkin] get failed:", err);
    return NextResponse.json({ error: "Could not load client." }, { status: 500 });
  }
}
