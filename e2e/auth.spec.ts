import { test, expect, request } from "@playwright/test";

// Phase 1.2 — auth E2E: sign up, log in, guard redirect, cookie flags.
// These tests talk to the real Next.js app on PLAYWRIGHT_BASE_URL (default
// http://localhost:13000). They assume `npm run dev` is up and the seed has
// applied (demo@local / demo1234 exists). When run in the docker-compose
// stack the app reaches the DB at DATABASE_URL.

// --- Guard: unauthenticated /dashboard redirects to / -----------------------
test("guard redirects unauthenticated /dashboard to /", async ({ page }) => {
  const res = await page.goto("/dashboard");
  // Either we were server-redirected to /, or we landed on / and see the
  // sign-in card. Both satisfy the "redirect to /" rule from the plan.
  const finalUrl = page.url();
  expect(finalUrl).toMatch(/\/(login|signin|)?$/);
  // We must NOT see the dashboard greeting while signed out.
  await expect(page.getByText(/dashboard/i)).not.toBeVisible();
  // 200/302 either way; not a 500.
  expect(res?.status() ?? 200).toBeLessThan(500);
});

// --- Sign up: creates a user, returns httpOnly JWT cookie -------------------
test("POST /api/auth/signup creates a user and sets a secure JWT cookie", async () => {
  const api = await request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000" });
  const unique = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const res = await api.post("/api/auth/signup", {
    data: { email: unique, password: "verysecret-1234" },
  });
  expect(res.status()).toBe(200);

  // Cookie must be httpOnly + sameSite=lax (plan requirement).
  const cookies = await api.storageState();
  const recapCookie = cookies.cookies.find((c) => c.name === "recap_session");
  expect(recapCookie, "recap_session cookie missing").toBeTruthy();
  expect(recapCookie!.httpOnly, "cookie must be httpOnly").toBe(true);
  expect(recapCookie!.sameSite?.toLowerCase()).toBe("lax");

  // Plaintext password must never appear in the response.
  const body = await res.text();
  expect(body).not.toContain("verysecret-1234");
  expect(body).not.toContain("password_hash");
});

// --- Login: existing demo user ---------------------------------------------
test("POST /api/auth/login with demo@local / demo1234 sets a JWT cookie", async () => {
  const api = await request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000" });
  const res = await api.post("/api/auth/login", {
    data: { email: "demo@local", password: "demo1234" },
  });
  expect(res.status()).toBe(200);

  const cookies = await api.storageState();
  const recapCookie = cookies.cookies.find((c) => c.name === "recap_session");
  expect(recapCookie, "recap_session cookie missing after login").toBeTruthy();
  expect(recapCookie!.httpOnly).toBe(true);
  expect(recapCookie!.sameSite?.toLowerCase()).toBe("lax");

  const body = await res.text();
  expect(body).not.toContain("demo1234");
  expect(body).not.toContain("password_hash");
});

// --- Login: wrong password returns neutral 401 -----------------------------
test("POST /api/auth/login with wrong password returns neutral 401", async () => {
  const api = await request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000" });
  const res = await api.post("/api/auth/login", {
    data: { email: "demo@local", password: "definitely-wrong" },
  });
  expect(res.status()).toBe(401);
  const body = await res.text();
  // Plan: "error copy is neutral — invalid credentials"
  expect(body.toLowerCase()).toContain("invalid");
  // Must NOT echo back which field was wrong.
  expect(body.toLowerCase()).not.toContain("password");
  expect(body.toLowerCase()).not.toContain("user not found");
});

// --- Password rules: < 8 chars rejected -----------------------------------
test("POST /api/auth/signup rejects passwords shorter than 8 chars with neutral error", async () => {
  const api = await request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000" });
  const res = await api.post("/api/auth/signup", {
    data: { email: `short-${Date.now()}@example.com`, password: "abc" },
  });
  expect(res.status()).toBe(400);
  const body = await res.text();
  expect(body.toLowerCase()).toContain("invalid");
});
