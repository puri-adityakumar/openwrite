import { test } from "@playwright/test";

// One-off screenshot capture for Phase 1.3 evidence. The plan asks for
// "Screenshot evidence: cockpit first paint shows Trail (6 green pills),
// Coverage grid, Summary tab, 5-line Pulse". Run with `npx playwright test
// e2e/screenshot.spec.ts` after a fresh `npm run dev` to refresh the
// artifacts in /screenshots/.

test("screenshot: cockpit first paint", async ({ page, context }) => {
  // Sign in via the API and copy the cookie into this context.
  const api = await (await import("@playwright/test")).request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
  });
  await api.post("/api/auth/login", { data: { email: "demo@local", password: "demo1234" } });
  const cookies = await api.storageState();
  await context.addCookies(cookies.cookies);
  await api.dispose();

  await page.goto("/paper/attention-is-all-you-need");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/cockpit-first-paint.png", fullPage: true });
});
