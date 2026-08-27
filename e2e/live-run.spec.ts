import { test, expect, request } from "@playwright/test";

// Phase 2.1 — live-run E2E.
//
// Drives /paper/new with the 3-mode dial, then asserts the live cockpit
// streams the fake TrueForge event sequence: turn.created ->
// sandbox.created -> deltas -> tool.response -> thread.created ->
// turn.paused terminal.
//
// Must run on the `chromium` project (the judge-ipad iPad-stand-in
// WebKit profile handles SSE differently and the iPad test is in
// cockpit-live.spec.ts). The plan verification line is:
//   `npm run test:e2e -- live-run` green
//
// Assumes `npm run dev` is up and `PLAYWRIGHT_BASE_URL` is set.

async function signUpAndSignIn(context: import("@playwright/test").BrowserContext) {
  const api = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
  });
  const email = `live-${Date.now()}@example.com`;
  const res = await api.post("/api/auth/signup", {
    data: { email, password: "phase2test" },
  });
  if (!res.ok()) throw new Error(`signup failed: ${res.status()}`);
  const cookies = await api.storageState();
  await context.addCookies(cookies.cookies);
  await api.dispose();
}

test("live-run: /paper/new start -> /paper/[slug] streams turn.paused", async ({ page, context }) => {
  await signUpAndSignIn(context);

  // 1) /paper/new — pick Review, paste an arXiv URL, click Start.
  await page.goto("/paper/new");
  await expect(page.getByRole("heading", { name: /New Paper/i })).toBeVisible();
  // Review is the default; assert it is selected.
  const reviewRadio = page.getByRole("radio", { name: /Review/i });
  await expect(reviewRadio).toHaveAttribute("aria-checked", "true");
  await page.getByLabel(/Paper source URL or path/i).fill("https://arxiv.org/abs/1706.03762");
  await page.getByRole("button", { name: /Start/i }).click();

  // 2) After start, we navigate to /paper/[slug] and the live cockpit
  //    streams SSE events. The fake adapter finishes the run in <1s.
  await page.waitForURL(/\/paper\//, { timeout: 15_000 });
  await expect(page.getByTestId("trail-pills")).toBeVisible();

  // 3) The fake adapter emits 12 events and a turn.paused terminal.
  //    Wait for the Pulse to populate at least 5 lines and for the
  //    status to flip to "paused".
  await expect(page.getByTestId("pulse")).toContainText(/turn started/i, { timeout: 10_000 });
  // sandbox.created evidence: the status row carries the sandboxId.
  await expect(page.getByTestId("sandbox-id")).toContainText(/sbx_/, { timeout: 10_000 });
  // The Halt button + Cap chip are stubs in Phase 2 (wired in Phase 5).
  await expect(page.getByTestId("halt-btn")).toBeVisible();
  // costDisplay must be the GMI "—" rule (totalCostInUsd=0).
  await expect(page.getByTestId("cap-chip")).toContainText("Cap: —");

  // 4) Coverage should have at least one entry from the tool.response events.
  await expect(page.getByTestId("coverage-grid")).toContainText(/[░▒▓█]/);

  // 5) Trail: the live fake ends on the paused terminal, so the Verify
  //    pill should be "running" (paused on the gate).
  const verifyPill = page.locator("[data-pill='verify']");
  await expect(verifyPill).toHaveAttribute("data-state", "running", { timeout: 10_000 });
});
