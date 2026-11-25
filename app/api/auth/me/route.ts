// app/api/auth/me/route.ts — who is signed in (for the sidebar avatar).
import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!s) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json({ email: s.email, name: s.name });
}
