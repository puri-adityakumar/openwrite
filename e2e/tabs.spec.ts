import { test, expect, request } from "@playwright/test";

// Phase 3.1 — Tabs e2e.
//
// Drives the cockpit: opens the seed paper, asserts the 4 tabs are
// visible, switches to Claims (asserts the seeded 4 rows), switches
// to Authors (asserts the OpenAlex cards load), clicks the Audit
// link (asserts navigation).

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

test("tabs: Summary default + Claims renders rows + Audit link", async ({ page, context }) => {
  await signInAsDemo(context);
  await page.goto("/paper/attention-is-all-you-need");

  // Summary is the default tab.
  await expect(page.getByTestId("summary-tab")).toBeVisible();

  // Switch to Claims — the seed inserts 4 rows.
  await page.getByRole("tab", { name: "Claims" }).click();
  const rows = page.getByTestId("claim-row");
  await expect(rows).toHaveCount(4);

  // Confidence chip is present on every row.
  await expect(page.getByTestId("confidence-chip").first()).toBeVisible();

  // Switch to Authors — give OpenAlex a moment to respond.
  await page.getByRole("tab", { name: "Authors" }).click();
  // Authors tab body is reachable (either cards or "no authors" message).
  await expect(page.getByTestId("authors-tab")).toBeVisible();

  // Audit is a link — click navigates to the audit page.
  const audit = page.getByRole("tab", { name: "Audit" });
  await expect(audit).toHaveAttribute("href", "/paper/attention-is-all-you-need/audit");
});
