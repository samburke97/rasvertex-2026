// app/api/reports/settings/site-aliases/route.ts
// GET / PUT the Weekly schedule's site aliases ({ "Cosmopolitan": "Cosmo" }),
// stored beside the report settings (lib/reports/settings/store.ts).

import { NextRequest, NextResponse } from "next/server";
import { getSiteAliases, saveSiteAliases } from "@/lib/reports/settings/store";

export async function GET() {
  try {
    return NextResponse.json({ aliases: await getSiteAliases() });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { aliases?: unknown } | null;
  const a = body?.aliases;
  const ok =
    !!a && typeof a === "object" && !Array.isArray(a) && Object.entries(a).every(([k, v]) => typeof v === "string" && k.length <= 200 && v.length <= 200);
  if (!ok) return NextResponse.json({ error: "aliases must map names to names" }, { status: 400 });
  try {
    // Renamed back to itself, or cleared: no alias.
    const clean = Object.fromEntries(Object.entries(a as Record<string, string>).filter(([k, v]) => v.trim() && v.trim() !== k).map(([k, v]) => [k, v.trim()]));
    await saveSiteAliases(clean);
    return NextResponse.json({ aliases: clean });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save" }, { status: 500 });
  }
}
