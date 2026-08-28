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
  // Daytona key is absent in dev .env (only GMI_API_KEY is set), so
  // the banner should be visible with the sandbox-preview badge.
  await expect(page.getByTestId("env-banner")).toBeVisible();
  await expect(page.getByTestId("env-banner-sandbox-badge")).toBeVisible();
  // The copyable curl is present.
  await expect(page.getByTestId("env-banner-curl")).toContainText(/curl/);
});
