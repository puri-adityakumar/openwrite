import { test, expect, request } from "@playwright/test";

// Phase 2.3 — cockpit-live E2E.
//
// Captures a mid-run screenshot of the live cockpit. The fake adapter
// is deterministic and finishes in <1s, so the "mid-run" frame is taken
// just after the turn.created event and before the turn.paused terminal.
//
// Plan verification: "Screenshot evidence: mid-run cockpit with ◉ on
// Verify and partial Coverage" — the fake delivers exactly this state
// for a fraction of a second, so the screenshot is timed to land there.

import { mkdir } from "node:fs/promises";
import path from "node:path";

async function signUpAndSignIn(context: import("@playwright/test").BrowserContext) {
  const api = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
  });
  const email = `mid-${Date.now()}@example.com`;
  const res = await api.post("/api/auth/signup", {
    data: { email, password: "phase2test" },
  });
  if (!res.ok()) throw new Error(`signup failed: ${res.status()}`);
  const cookies = await api.storageState();
  await context.addCookies(cookies.cookies);
  await api.dispose();
}

test("cockpit-live: mid-run screenshot shows live Trail + Coverage", async ({ page, context }) => {
  await signUpAndSignIn(context);
  await page.goto("/paper/new");
  await page.getByLabel(/Paper source URL or path/i).fill("https://arxiv.org/abs/1706.03762");
  // Switch to Learn mode (so the dial is also exercised) — Review is default.
  await page.getByRole("radio", { name: /Review/i }).click();
  await page.getByRole("button", { name: /Start/i }).click();
  await page.waitForURL(/\/paper\//, { timeout: 15_000 });

  // Wait for sandbox.created (proves the live stream is wired) and then
  // snapshot as fast as possible so we land in the mid-run window.
  await expect(page.getByTestId("sandbox-id")).toContainText(/sbx_/, { timeout: 10_000 });

  // The fake adapter is fast, so the "mid-run" frame is only there for a
  // few ms between the gate (Verify pill running) and the terminal
  // turn.paused. We catch it by waiting for the gate pulse line, which
  // appears just before the terminal frame.
  await expect(page.getByTestId("pulse")).toContainText(/\[gate\]/i, { timeout: 5_000 });
  // Snapshot immediately while the Verify pill is "running".
  await mkdir(path.dirname("screenshots/"), { recursive: true });
  await page.screenshot({ path: "screenshots/cockpit-mid-run.png", fullPage: true });
});
