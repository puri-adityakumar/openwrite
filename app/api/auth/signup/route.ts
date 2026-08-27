// Phase 1.2 — POST /api/auth/signup
// Body: { email: string, password: string }
// - 400 with neutral "invalid credentials"-style copy on bad input
// - 200 { ok: true, user: { id, email } } and sets recap_session cookie on success
// - Cookie is httpOnly + sameSite=lax (plan requirement, asserted in e2e)
//
// Bug fixes vs. round 1:
// - 72-byte password limit enforced (Qodo bug 1)
// - IP+email rate limit (Qodo bug 3)
// - Check email existence BEFORE hashing, so dupes cost ~1 SELECT not bcrypt (Qodo bug 3)
// - Always return the same neutral 400 shape so callers cannot distinguish failure modes

import { NextResponse, type NextRequest } from "next/server";
import { hashPassword, signSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "../../../../lib/auth";
import { query } from "../../../../lib/db";
import { isValidPassword } from "../../../../lib/passwordPolicy";
import { checkRateLimit, clientIdentity } from "../../../../lib/rateLimit";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bad(message = "Invalid credentials"): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function tooManyRequests(resetMs: number): NextResponse {
  return NextResponse.json(
    { ok: false, error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(Math.ceil(resetMs / 1000)) } },
  );
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

  if (!EMAIL_RE.test(email) || !isValidPassword(password)) {
    return bad();
  }

  const identity = clientIdentity();
  // Two independent counters (Qodo bug "unique emails bypass signup limit"):
  // one keyed by the client identity and one by the email alone. The route
  // is blocked if EITHER counter exceeds its limit.
  const rl = await checkRateLimit("signup", [identity, email]);
  if (!rl.allowed) return tooManyRequests(rl.resetMs);

  // Check email existence first so duplicate signups don't pay the bcrypt cost.
  let existing: { id: string } | undefined;
  try {
    const result = await query<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
    existing = result.rows[0];
  } catch (err) {
    console.error("signup: db error", err);
    return bad();
  }
  if (existing) return bad();

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
      // Race: another request inserted the same email between SELECT and INSERT.
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
