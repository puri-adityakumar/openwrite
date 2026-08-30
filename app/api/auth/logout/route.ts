// POST /api/auth/logout
// Clears the recap_session cookie. Always 200 — there's nothing the client
// can do with a "not signed in" error here, and we don't want to leak
// whether a token was actually present.

import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../../lib/auth";

export async function POST(): Promise<NextResponse> {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  return res;
}