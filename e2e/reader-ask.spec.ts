import { test, expect, request } from "@playwright/test";

// Phase 3.2 — Reader + Ask e2e.
//
// Opens the seed paper, switches to Claims, clicks a row to open the
// Reader, and asserts the Reader drawer renders. Then types a question
// in the Ask composer and submits; we assert an answer appears (or a
// clear error if GMI is unconfigured).

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

test("reader: clicking a claim row opens the drawer", async ({ page, context }) => {
  await signInAsDemo(context);
  await page.goto("/paper/attention-is-all-you-need");
  await page.getByRole("tab", { name: "Claims" }).click();
  const firstRow = page.getByTestId("claim-row").first();
  await firstRow.click();
  await expect(page.getByTestId("reader-drawer")).toBeVisible();
  await expect(page.getByTestId("reader-claim")).toBeVisible();
  // The PDF canvas is in the drawer (may be empty for the seed fixture
  // which is a 1-page blank PDF; we just assert the testid is there).
  await expect(page.getByTestId("reader-canvas")).toBeAttached();
  // Close button hides the drawer.
  await page.getByTestId("reader-close").click();
  await expect(page.getByTestId("reader-drawer")).not.toBeVisible();
});

test("ask: composer accepts a question and renders an answer or a clean error", async ({ page, context }) => {
  await signInAsDemo(context);
  await page.goto("/paper/attention-is-all-you-need");
  await page.getByTestId("ask-input").fill("What is the Transformer?");
  await page.getByTestId("ask-submit").click();
  // Either we get an answer (GMI configured) or a clean error. The
  // first ask in a fresh dev-server build needs Next to compile the
  // route + render the PDF, so we allow a longer window on iPad.
  await expect(async () => {
    const hasAnswer = await page.getByTestId("ask-answer").isVisible().catch(() => false);
    const hasError = await page.getByTestId("ask-error").isVisible().catch(() => false);
    if (!hasAnswer && !hasError) throw new Error("no answer or error after submit");
  }).toPass({ timeout: 25_000 });
});
