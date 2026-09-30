// app/api/crm/group-colors/route.ts

import { NextRequest, NextResponse } from "next/server";
import {
  listGroupColors,
  setGroupColor,
  LEAD_STAGES,
  type LeadStage,
} from "@/lib/crm/store";

// Same accepted-format regex as the colour picker popover client-side:
// #RGB | #RRGGBB | rgb(r,g,b) | rgba(r,g,b,a) | bare "r,g,b"
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGB_RE = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)$/i;
const BARE_RGB_RE = /^\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}$/;

function isValidColor(value: string): boolean {
  return HEX_RE.test(value) || RGB_RE.test(value) || BARE_RGB_RE.test(value);
}

export async function GET() {
  try {
    const colors = await listGroupColors();
    return NextResponse.json({ colors });
  } catch (err) {
    console.error("[CRM] listGroupColors failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch group colours." },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  let body: { stage?: string; color?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!body.stage || !(LEAD_STAGES as readonly string[]).includes(body.stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }
  if (!body.color || !isValidColor(body.color.trim())) {
    return NextResponse.json({ error: "Invalid colour" }, { status: 400 });
  }

  try {
    await setGroupColor(body.stage as LeadStage, body.color.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[CRM] setGroupColor failed:", err);
    return NextResponse.json(
      { error: "Failed to save colour." },
      { status: 500 },
    );
  }
}
