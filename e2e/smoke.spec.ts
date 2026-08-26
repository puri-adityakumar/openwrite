import { test, expect } from "@playwright/test";

// Smoke test: a real app must render a 200 and a non-empty body at /.
// At Phase 0 the Next.js app is not yet wired, so this is a deliberately
// minimal harness sanity check that simply proves the runner executes and
// the judge-ipad project is wired.
test("harness runs in this project", async ({ page }) => {
  // Avoid a real network call; just assert the runner reached us.
  expect(test.info().project.name).toBeTruthy();
  // Touch the page object so the runner actually instantiates a context.
  await expect(page).toBeDefined();
});
