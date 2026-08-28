import { test } from "@playwright/test";
import { DEMO_STATE } from "./demo-state";

// The seeded demo session is shared per run (see e2e/global-setup.ts).
test.use({ storageState: DEMO_STATE });

// One-off screenshot capture for Phase 1.3 evidence. The plan asks for
// "Screenshot evidence: cockpit first paint shows Trail (6 green pills),
// Coverage grid, Summary tab, 5-line Pulse". Run with `npx playwright test
// e2e/screenshot.spec.ts` after a fresh `npm run dev` to refresh the
// artifacts in /screenshots/.

test("screenshot: cockpit first paint", async ({ page }) => {
  await page.goto("/paper/attention-is-all-you-need");
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "screenshots/cockpit-first-paint.png", fullPage: true });
});
