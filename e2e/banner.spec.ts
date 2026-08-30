import { test, expect } from "@playwright/test";
import { DEMO_STATE } from "./demo-state";

// The seeded demo session is shared per run (see e2e/global-setup.ts).
test.use({ storageState: DEMO_STATE });

// Phase 3.3 — env banner e2e.
//
// The banner is driven by /api/env-status. In dev .env, GMI is set and
// Daytona is not, so the banner should show "Sandbox preview" but not
// the "GMI" key label. The banner is mounted in the root layout, so
// it appears on every page.

test("banner: shows Sandbox preview when Daytona is missing", async ({ page, context }) => {
  await page.goto("/dashboard");
  // Live-only: banner visible only when DAYTONA_API_KEY missing.
  const envRes = await page.request.get("/api/env-status");
  const env = (await envRes.json()) as { status: { daytona: boolean } };
  if (!env.status.daytona) {
    await expect(page.getByTestId("env-banner")).toBeVisible();
    await expect(page.getByTestId("env-banner-sandbox-badge")).toBeVisible();
    await expect(page.getByTestId("env-banner-curl")).toContainText(/curl/);
  } else {
    await expect(page.getByTestId("env-banner")).toBeHidden();
  }
});
