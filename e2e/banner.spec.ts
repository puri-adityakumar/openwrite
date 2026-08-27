import { test, expect, request } from "@playwright/test";

// Phase 3.3 — env banner e2e.
//
// The banner is driven by /api/env-status. In dev .env, GMI is set and
// Daytona is not, so the banner should show "Sandbox preview" but not
// the "GMI" key label. The banner is mounted in the root layout, so
// it appears on every page.

async function signInAsDemo(context: import("@playwright/test").BrowserContext) {
  const api = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
  });
  const res = await api.post("/api/auth/login", {
    data: { email: "demo@local", password: "demo1234" },
  });
  if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
  const cookies = await api.storageState();
  await context.addCookies(cookies.cookies);
  await api.dispose();
}

test("banner: shows Sandbox preview when Daytona is missing", async ({ page, context }) => {
  await signInAsDemo(context);
  await page.goto("/dashboard");
  // Daytona key is absent in dev .env (only GMI_API_KEY is set), so
  // the banner should be visible with the sandbox-preview badge.
  await expect(page.getByTestId("env-banner")).toBeVisible();
  await expect(page.getByTestId("env-banner-sandbox-badge")).toBeVisible();
  // The copyable curl is present.
  await expect(page.getByTestId("env-banner-curl")).toContainText(/curl/);
});
