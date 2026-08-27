// Phase 1.2 — POST /api/auth/login
// Body: { email, password }
// - 401 with neutral "invalid credentials" copy on any failure (plan: never
//   reveal whether the email exists).
// - 200 { ok: true, user: { id, email } } and sets recap_session cookie on success.

import { NextResponse, type NextRequest } from "next/server";
import { verifyPassword, signSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "../../../../lib/auth";
import { query } from "../../../../lib/db";

function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return unauthorized();
  }
  const email = typeof (body as { email?: unknown })?.email === "string"
    ? (body as { email: string }).email.trim().toLowerCase()
    : "";
  const password = typeof (body as { password?: unknown })?.password === "string"
    ? (body as { password: string }).password
    : "";

  if (!email || !password) return unauthorized();

  let row: { id: string; email: string; password_hash: string } | undefined;
  try {
    const result = await query<{ id: string; email: string; password_hash: string }>(
      `SELECT id, email, password_hash FROM users WHERE email = $1`,
      [email],
    );
    row = result.rows[0];
  } catch (err) {
    console.error("login: db error", err);
    return unauthorized();
  }

  if (!row) {
    // Burn a bcrypt cycle anyway to avoid trivial user-enumeration timing.
    await verifyPassword(password, "$2a$10$invalidsaltinvalidsaltinvalidsaltinvalidsaltinva");
    return unauthorized();
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) return unauthorized();

  const token = await signSession({ sub: row.id, email: row.email });
  const res = NextResponse.json({ ok: true, user: { id: row.id, email: row.email } });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
