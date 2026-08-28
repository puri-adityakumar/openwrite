import { test, expect, request } from "@playwright/test";

// Phase 5.3 — replay E2E.
//
//   Replay the audited run: a new session starts, the audit preserves
//   the original rows (with a "▶ replay started" separator), the
//   cockpit reattaches to the new run (a fresh paused gate card), and
//   the freshness proof lands: the replay session's sandbox.created
//   sandboxId DIFFERS from the original run's.

test("replay creates a fresh session + sandbox and shows both runs in the audit", async ({ page, context }) => {
  const api = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
  });
  const email = `replay-${Date.now()}@example.com`;
  const res = await api.post("/api/auth/signup", {
    data: { email, password: "phase4test" },
  });
  if (!res.ok()) throw new Error(`signup failed: ${res.status()}`);
  const cookies = await api.storageState();
  await context.addCookies(cookies.cookies);

  // Start a first run; the fake streams to its paused terminal.
  await page.goto("/paper/new");
  await page.getByLabel(/Paper source URL or path/i).fill("https://arxiv.org/abs/1706.03762");
  await page.getByRole("button", { name: /Start/i }).click();
  await page.waitForURL(/\/paper\//, { timeout: 15_000 });
  await expect(page.getByTestId("verify-card")).toBeVisible({ timeout: 15_000 });
  const slug = new URL(page.url()).pathname.split("/").pop()!;
  const paperId = ((await (await api.get("/api/papers")).json()) as {
    papers: Array<{ id: string; slug: string }>;
  }).papers.find((p) => p.slug === slug)!.id;

  // Before replay: one sandbox (the original), nothing to compare.
  const before = (await (await api.get(`/api/agent/replay?paperId=${paperId}`)).json()) as {
    fresh: boolean;
    originalSandboxId: string | null;
    replaySandboxId: string | null;
  };
  expect(before.originalSandboxId).toBeTruthy();
  expect(before.replaySandboxId).toBeNull();

  // Replay from the audit page (the header action). The button reloads
  // the page on success; the reloaded render is deterministic when the
  // "▶ replay started" row appears.
  await page.goto(`/paper/${slug}/audit`);
  await expect(page.getByTestId("replay-btn")).toBeVisible();
  await page.getByTestId("replay-btn").click();
  await expect(
    page.getByTestId("audit-row").filter({ hasText: "replay started" }),
  ).toBeVisible({ timeout: 15_000 });

  // The replay flips the paper to running; the cockpit reattaches and
  // the new run pauses on its own fresh gate. domcontentloaded keeps
  // the goto clear of the SSE connection's load-event race on WebKit.
  await page.goto(`/paper/${slug}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("verify-card")).toBeVisible({ timeout: 20_000 });
  await page.waitForLoadState("load");

  // Freshness proof: the replay sandbox differs from the original.
  const after = (await (await api.get(`/api/agent/replay?paperId=${paperId}`)).json()) as {
    fresh: boolean;
    originalSandboxId: string;
    replaySandboxId: string;
  };
  expect(after.fresh).toBe(true);
  expect(after.replaySandboxId).not.toBe(after.originalSandboxId);

  // The audit shows BOTH runs: the original rows, the replay marker,
  // and each run's own Verify request + sandbox row (ids differ —
  // the freshness proof, visible row-for-row).
  await page.goto(`/paper/${slug}/audit`, { waitUntil: "domcontentloaded" });
  const rows = page.getByTestId("audit-row");
  await expect(rows.filter({ hasText: "replay started" })).toHaveCount(1);
  await expect(rows.filter({ hasText: "Verify requested" })).toHaveCount(2);
  await expect(rows.filter({ hasText: `sandbox created: ${after.originalSandboxId}` })).toHaveCount(1);
  await expect(rows.filter({ hasText: `sandbox created: ${after.replaySandboxId}` })).toHaveCount(1);
  await api.dispose();
});
