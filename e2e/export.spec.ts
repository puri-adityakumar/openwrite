import { test, expect } from "@playwright/test";
import { DEMO_STATE } from "./demo-state";

// Phase 5.4 — export E2E.
//
//   The seeded demo paper's export page renders the mockup (page-count
//   line, Download button, section list) and the download streams a
//   review.md carrying all four sections. The download endpoint serves
//   attachment headers on the unlocked path; the locked path (publish
//   gate pending) is unit-pinned (tests/export-md.test.ts) and 403s.

test.use({ storageState: DEMO_STATE });

test("seeded paper exports review.md with the four mockup sections", async ({ page }) => {
  await page.goto("/paper/attention-is-all-you-need/export");
  await expect(page.getByTestId("export-page-count")).toContainText(
    "Review mode produced 10 pages of markdown.",
  );
  await expect(page.getByTestId("export-sections").locator("li")).toHaveCount(4);
  // The seed paper has no publish gate: the download flows.
  await expect(page.getByTestId("export-download")).toBeVisible();

  // The download streams markdown with all four sections + the claims
  // table from seed_claims.
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("export-download").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("review.md");
  const path = await download.path();
  const { readFile } = await import("node:fs/promises");
  const md = await readFile(path!, "utf8");
  expect(md).toContain("# Attention Is All You Need");
  expect(md).toContain("## TL;DR");
  expect(md).toContain("## Claims ↔ evidence");
  expect(md).toContain("## Reproduction diff");
  expect(md).toContain("## Open questions for the author");
});

test("the download endpoint serves markdown with attachment headers (unlocked path)", async ({ page }) => {
  // The direct-URL form of the same contract (unit-pinned pure logic
  // in tests/export-md.test.ts): without a publish gate the seed
  // download must succeed.
  const r = await page.request.get("/paper/attention-is-all-you-need/export/download");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("text/markdown");
  expect(r.headers()["content-disposition"]).toContain("review.md");
});
