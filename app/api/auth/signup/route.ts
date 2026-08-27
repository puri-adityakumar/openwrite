// Phase 1.2 — POST /api/auth/signup
// Body: { email: string, password: string }
// - 400 with neutral "invalid credentials"-style copy on bad input
// - 200 { ok: true, user: { id, email } } and sets recap_session cookie on success
// - Cookie is httpOnly + sameSite=lax (plan requirement, asserted in e2e)

import { NextResponse, type NextRequest } from "next/server";
import { hashPassword, signSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "../../../../lib/auth";
import { query } from "../../../../lib/db";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

function bad(message = "Invalid credentials"): NextResponse {
  // Neutral copy: never reveal which field failed (plan).
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return bad();
  }
  const email = typeof (body as { email?: unknown })?.email === "string"
    ? (body as { email: string }).email.trim().toLowerCase()
    : "";
  const password = typeof (body as { password?: unknown })?.password === "string"
    ? (body as { password: string }).password
    : "";

  if (!EMAIL_RE.test(email) || password.length < MIN_PASSWORD_LEN) {
    return bad();
  }

  const passwordHash = await hashPassword(password);
  let row: { id: string; email: string };
  try {
    const inserted = await query<{ id: string; email: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      [email, passwordHash],
    );
    if (inserted.rowCount === 0) {
      // Email already exists; don't leak that fact, return neutral.
      return bad();
    }
    row = inserted.rows[0];
  } catch (err) {
    console.error("signup: db error", err);
    return bad();
  }

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
