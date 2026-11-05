// app/api/reports/settings/route.ts
//
// GET    the report settings (the defaults until some are saved)
// PUT    save them, after checking them
// DELETE back to the defaults
//
// These settings change every client report, so writes need the admin
// passcode (REPORT_SETTINGS_PASSCODE) when one is set, sent as
// X-Settings-Passcode. Without one set, anyone signed in can edit.

import { NextRequest, NextResponse } from "next/server";
import { getSettings, resetSettings, saveSettings } from "@/lib/reports/settings/store";
import { settingsProblems } from "@/lib/reports/settings/validate";
import type { ReportSettings } from "@/lib/reports/settings/types";

function allowed(req: NextRequest) {
  const code = process.env.REPORT_SETTINGS_PASSCODE;
  return !code || req.headers.get("x-settings-passcode") === code;
}

export async function GET() {
  try {
    const { settings, updatedAt } = await getSettings();
    return NextResponse.json({ settings, updatedAt, locked: !!process.env.REPORT_SETTINGS_PASSCODE });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't load the settings" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!allowed(req)) return NextResponse.json({ error: "Wrong passcode" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { settings?: ReportSettings } | null;
  const s = body?.settings;
  if (!s) return NextResponse.json({ error: "No settings sent" }, { status: 400 });
  const problems = settingsProblems(s);
  if (problems.length) return NextResponse.json({ error: problems[0], problems }, { status: 422 });
  try {
    await saveSettings(s);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't save" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!allowed(req)) return NextResponse.json({ error: "Wrong passcode" }, { status: 403 });
  await resetSettings();
  return NextResponse.json({ ok: true });
}
