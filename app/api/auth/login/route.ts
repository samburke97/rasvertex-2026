// app/api/auth/login/route.ts
// POST {email, password} → sets the signed session cookie (lib/auth/session.ts).

import { NextRequest, NextResponse } from "next/server";
import { LOCK_MINUTES, isLocked, verifyLogin } from "@/lib/auth/users";
import { SESSION_COOKIE, signSession, loginCookieOptions } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let email = "";
  let password = "";
  let remember = true;
  try {
    const body = await req.json();
    email = String(body.email ?? "");
    password = String(body.password ?? "");
    remember = body.remember !== false;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!email || !password || password.length > 200) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }

  try {
    if (await isLocked(email)) {
      return NextResponse.json(
        { error: `Too many wrong passwords. Try again in ${LOCK_MINUTES} minutes.` },
        { status: 429 },
      );
    }
    const user = await verifyLogin(email, password);
    if (!user) {
      return NextResponse.json({ error: "That email and password don't match." }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true, name: user.name });
    res.cookies.set(SESSION_COOKIE, await signSession(user.email, user.name, remember), loginCookieOptions(remember));
    return res;
  } catch (err) {
    console.error("[Login]", err);
    return NextResponse.json({ error: "Sign-in isn't available right now." }, { status: 500 });
  }
}
