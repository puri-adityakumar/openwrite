import { test, expect, request } from "@playwright/test";

// Phase 5.1 — halt 2-state + cap E2E.
//
//   Halt cycle: the live fake pauses at the Verify gate; the button
//   shows "⏹ Stop" (the Pause→Stop cycle's second state), clicking it
//   stops and LOCKS the run: the button flips to the locked "⏹
//   Stopped" label, the paused gate card does NOT resurrect, and the
//   gate API refuses approvals (409).
//
//   Cap: a paper created with capTokens=1 hard-stops when the fake's
//   turn.done metrics (18,402 tokens) arrive — the chip turns red and
//   the paper row lands halted with halt_reason 'cap'.

async function signUp(context: import("@playwright/test").BrowserContext) {
  const api = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
  });
  const email = `halt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`;
  const res = await api.post("/api/auth/signup", {
    data: { email, password: "phase4test" },
  });
  if (!res.ok()) throw new Error(`signup failed: ${res.status()}`);
  const cookies = await api.storageState();
  await context.addCookies(cookies.cookies);
  await api.dispose();
  return email;
}

test.describe("Phase 5.1 — halt 2-state + cap", () => {
  test("Pause → Stop cycle locks the run and the paused gate card does not resurrect", async ({ page, context }) => {
    await signUp(context);

    await page.goto("/paper/new");
    await expect(page.getByRole("heading", { name: /New Paper/i })).toBeVisible();
    await page.getByLabel(/Paper source URL or path/i).fill("https://arxiv.org/abs/1706.03762");
    await page.getByRole("button", { name: /Start/i }).click();
    await page.waitForURL(/\/paper\//, { timeout: 15_000 });

    // The fake streams to its paused terminal quickly; the halt button
    // then offers the second state of the cycle: Stop.
    const halt = page.getByTestId("halt-btn");
    await expect(halt).toBeVisible({ timeout: 10_000 });
    await expect(halt).toHaveAttribute("data-state", /pause|stop/);
    await expect(page.getByTestId("verify-card")).toBeVisible({ timeout: 10_000 });
    await expect(halt).toHaveAttribute("data-state", "stop");

    // Stop terminates and locks.
    await halt.click();
    await page.waitForLoadState("load");
    await expect(page.getByTestId("halt-btn")).toHaveAttribute("data-state", "locked", { timeout: 10_000 });
    await expect(page.getByTestId("halt-btn")).toContainText("Stopped");
    // The run is locked: the paused gate card does not come back.
    await expect(page.getByTestId("verify-card")).toBeHidden({ timeout: 10_000 });

    // API truth: the paper row is halted; approvals are refused (409).
    const api = await request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
      storageState: { cookies: await context.cookies(), origins: [] },
    });
    // The list is newest-first; the paper this test just started is [0].
    const papersRes = await api.get("/api/papers");
    const papersBody = (await papersRes.json()) as {
      papers: Array<{ id: string; status: string; halted: boolean; halt_reason: string | null }>;
    };
    const mine = papersBody.papers[0]!;
    expect(mine.halted).toBe(true);
    expect(mine.halt_reason).toBe("user");

    const gatesRes = await api.get(`/api/papers/${mine.id}/gates`);
    if (gatesRes.ok()) {
      const gate = ((await gatesRes.json()) as { gate: { id: string } | null }).gate;
      if (gate) {
        const approveRes = await api.post("/api/agent/approve", {
          data: { gateId: gate.id, decision: "allow" },
        });
        expect(approveRes.status()).toBe(409);
      }
    }
    await api.dispose();
  });

  test("cap exceed hard-stops the run and turns the chip red", async ({ page, context }) => {
    await signUp(context);

    // Create the paper with a 1-token cap; the fake's turn reports
    // 18,402 tokens, so the cap crosses the moment metrics arrive.
    const api = await request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
      storageState: { cookies: await context.cookies(), origins: [] },
    });
    const createRes = await api.post("/api/papers", {
      data: { source: "https://arxiv.org/abs/1706.03762", mode: "review", capTokens: 1 },
    });
    if (!createRes.ok()) throw new Error(`paper create failed: ${createRes.status()} ${await createRes.text()}`);
    const { paperId, slug } = (await createRes.json()) as { paperId: string; slug: string };
    const startRes = await api.post("/api/agent/start", {
      data: {
        paperId,
        mode: "review",
        source: "https://arxiv.org/abs/1706.03762",
      },
    });
    if (!startRes.ok()) throw new Error(`start failed: ${startRes.status()} ${await startRes.text()}`);

    await page.goto(`/paper/${slug}`);
    const chip = page.getByTestId("cap-chip");
    await expect(chip).toBeVisible({ timeout: 10_000 });
    // The chip turns red (data-exceeded) when the usage lands.
    await expect(chip).toHaveAttribute("data-exceeded", "true", { timeout: 15_000 });
    await expect(chip).toContainText("18,402");

    // The hard stop landed DB-side: halted, halt_reason 'cap'.
    const papersRes = await api.get("/api/papers");
    const papersBody = (await papersRes.json()) as {
      papers: Array<{ id: string; halted: boolean; halt_reason: string | null }>;
    };
    const mine = papersBody.papers.find((p) => p.id === paperId)!;
    expect(mine.halted).toBe(true);
    expect(mine.halt_reason).toBe("cap");
    await api.dispose();
  });
});
