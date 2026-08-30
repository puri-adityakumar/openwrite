// Phase 1.2 — session guard. Used by /dashboard and /paper/* pages; redirects
// to /auth when the request has no valid recap_session cookie. Also exposes
// getCurrentUser() for pages that just need the current identity.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifySession, SESSION_COOKIE_NAME, type SessionPayload } from "./auth";

export async function getCurrentUser(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  return verifySession(token);
}

export async function requireUser(): Promise<SessionPayload> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth");
  }
  return user;
}
