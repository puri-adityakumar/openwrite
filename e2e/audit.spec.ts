import { test, expect, request } from "@playwright/test";
import { DEMO_STATE } from "./demo-state";

// Phase 5.2 — audit page E2E.
//
//   Seed path: the seeded demo paper renders the first-paint timeline
//   (trail pills + pulse lines) with the header actions.
//   Live path: a fresh user's run renders the mockup vocabulary —
//   "▶ session started", "⏸ Verify requested", a deny decision row —
//   and the footer totals with the Cost "—" rule.

test.describe("Phase 5.2 — audit page: seeded paper", () => {
  test.use({ storageState: DEMO_STATE });

  test("seeded paper renders the seed timeline and header actions", async ({ page }) => {
    await page.goto("/paper/attention-is-all-you-need/audit");
    const timeline = page.getByTestId("audit-timeline");
    await expect(timeline).toBeVisible();
    await expect(page.getByRole("heading", { name: /Attention Is All You Need/i })).toBeVisible();
    // Audit eyebrow is separate span (exact match avoids replay button)
    await expect(page.getByText("Audit", { exact: true }).first()).toBeVisible();
    // Seed rows: the trail pills as ▶ rows, pulse lines as ✓ rows.
    await expect(timeline.getByTestId("audit-row")).toHaveCount(10); // 6 pills + 4 pulse lines
    await expect(timeline.getByTestId("audit-row").first()).toContainText("Source");
    await expect(timeline.getByTestId("audit-row").nth(6)).toContainText("8 authors");
    // Header actions.
    await expect(page.getByTestId("replay-btn")).toBeVisible();
    await expect(page.getByTestId("audit-export-link")).toBeVisible();
    // Seed has no metrics: the footer placeholders render.
    await expect(page.getByTestId("audit-footer")).toContainText("Total tokens —");
    // The Export action navigates to the export page (5.2 checklist).
    await page.getByTestId("audit-export-link").click();
    await expect(page).toHaveURL(/\/paper\/attention-is-all-you-need\/export$/);
    await expect(page.getByTestId("export-page")).toBeVisible();
  });
});

test.describe("Phase 5.2 — audit page: live run", () => {
  test("live run renders the mockup vocabulary including the decision row", async ({ page, context }) => {
    const api = await request.newContext({
      baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
    });
    const email = `audit-${Date.now()}@example.com`;
    const res = await api.post("/api/auth/signup", {
      data: { email, password: "phase4test" },
    });
    if (!res.ok()) throw new Error(`signup failed: ${res.status()}`);
    const cookies = await api.storageState();
    await context.addCookies(cookies.cookies);

    await page.goto("/paper/new");
    await page.getByLabel(/Paper source URL or path/i).fill("https://arxiv.org/abs/1706.03762");
    await page.getByRole("button", { name: /Start/i }).click();
    await page.waitForURL(/\/paper\//, { timeout: 15_000 });
    await expect(page.getByTestId("verify-card")).toBeVisible({ timeout: 15_000 });

    // Deny with a reason → the audit gains the decision row. The deny
    // handler reloads the page; wait for the post-reload cockpit (the
    // resume sequence ends the turn, so the gate card disappears)
    // before navigating on — a goto raced against that reload aborts.
    page.once("dialog", (d) => void d.accept("audit e2e deny"));
    await page.getByTestId("verify-deny").click();
    await expect(page.getByTestId("verify-card")).toBeHidden({ timeout: 15_000 });
    await page.waitForLoadState("load");

    const slug = new URL(page.url()).pathname.split("/").pop()!;
    const paperId = ((await (await api.get("/api/papers")).json()) as {
      papers: Array<{ id: string; slug: string }>;
    }).papers[0]!.id;

    await page.goto(`/paper/${slug}/audit`);
    const timeline = page.getByTestId("audit-timeline");
    await expect(timeline.getByTestId("audit-row").first()).toContainText("session started");
    const rows = timeline.getByTestId("audit-row");
    await expect(rows.filter({ hasText: "Verify requested" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "user denied" })).toHaveCount(1);
    await expect(rows.filter({ hasText: "audit e2e deny" })).toHaveCount(1);
    // Footer shape: tokens from the last metrics turn, the Cost "—"
    // rule, a duration. (Exact values are unit-pinned in
    // tests/audit-page.test.tsx; live numbers vary.)
    await expect(page.getByTestId("audit-footer")).toContainText(/Total tokens [\d,]+/);
    await expect(page.getByTestId("audit-footer")).toContainText("Cost —");
    await expect(page.getByTestId("audit-footer")).toContainText(/Duration \d+/);

    // The JSON route mirrors the page.
    const auditRes = await api.get(`/api/audit/${paperId}`);
    expect(auditRes.ok()).toBeTruthy();
    const auditBody = (await auditRes.json()) as {
      source: string;
      rows: Array<{ icon: string; message: string }>;
    };
    expect(auditBody.source).toBe("live");
    expect(auditBody.rows.some((r) => r.message === "session started")).toBe(true);
    expect(auditBody.rows.some((r) => r.message.startsWith("user denied"))).toBe(true);
    await api.dispose();
  });
});
