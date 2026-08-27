// Phase 1.2 — POST /api/auth/login
// Body: { email, password }
// - 401 with neutral "invalid credentials" copy on any failure (plan: never
//   reveal whether the email exists).
// - 200 { ok: true, user: { id, email } } and sets recap_session cookie on success.
//
// Bug fixes vs. round 1:
// - IP+email rate limit (Qodo bug 2)
// - Real bcrypt fake hash (60 chars including the trailing null) so the
//   "no such user" path runs the same cost-10 bcrypt work as the "wrong
//   password" path (Qodo bug 5). The fake hash below was produced once with
//   `bcrypt.hashSync("doesnt-matter", 10)` and is read-only here.

import { NextResponse, type NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { verifyPassword, signSession, SESSION_COOKIE_NAME, SESSION_TTL_SECONDS } from "../../../../lib/auth";
import { query } from "../../../../lib/db";
import { isValidPassword } from "../../../../lib/passwordPolicy";
import { checkRateLimit, clientIp } from "../../../../lib/rateLimit";

// A real bcrypt cost-10 hash computed once at import time. The plaintext is
// irrelevant (we never compare against it via a known match); what matters
// is that bcryptjs does the full cost-10 work on this path so the timing is
// indistinguishable from a wrong-password attempt. Generated at module load
// instead of hardcoded so the format is guaranteed valid (Qodo bug 5).
const FAKE_BCRYPT_HASH: string = bcrypt.hashSync("__not_a_real_password__", 10);

function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: "Invalid credentials" }, { status: 401 });
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
    return unauthorized();
  }
  const email = typeof (body as { email?: unknown })?.email === "string"
    ? (body as { email: string }).email.trim().toLowerCase()
    : "";
  const password = typeof (body as { password?: unknown })?.password === "string"
    ? (body as { password: string }).password
    : "";

  if (!email || !isValidPassword(password)) return unauthorized();

  const identity = `${clientIp(req)}|${email}`;
  const rl = await checkRateLimit("login", identity);
  if (!rl.allowed) return tooManyRequests(rl.resetMs);

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
    // Burn a full cost-10 bcrypt cycle against a real-format fake hash to keep
    // the missing-user path indistinguishable from the wrong-password path.
    await verifyPassword(password, FAKE_BCRYPT_HASH);
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
