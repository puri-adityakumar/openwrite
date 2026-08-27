// Phase 1.2 — pure auth helpers used by /api/auth/* and lib/session.ts.
// Kept dependency-free of the Next.js request surface so the unit tests
// (tests/auth.test.ts) can exercise them without a live server.

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const BCRYPT_COST = 10;
const COOKIE_NAME = "recap_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload {
  sub: string;
  email?: string;
}

function getSecret(): string {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 16) {
    throw new Error("JWT_SECRET is missing or too short (min 16 chars)");
  }
  return s;
}

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new Promise((resolve, reject) => {
    jwt.sign(
      payload,
      getSecret(),
      { expiresIn: TOKEN_TTL_SECONDS, algorithm: "HS256" },
      (err, token) => (err ? reject(err) : resolve(token as string)),
    );
  });
}

export async function verifySession(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getSecret(), { algorithms: ["HS256"] });
    if (typeof decoded === "string") return null;
    if (typeof decoded.sub !== "string") return null;
    const payload: SessionPayload = { sub: decoded.sub };
    if (typeof decoded.email === "string") payload.email = decoded.email;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_TTL_SECONDS = TOKEN_TTL_SECONDS;
