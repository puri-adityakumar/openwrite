import { defineConfig, devices } from "@playwright/test";

// Playwright config — the only required projects at this phase are:
//   - chromium (default desktop baseline for general E2E)
//   - judge-ipad (WebKit @ 1024x768 — iPad stand-in per the Savile Row track)
//
// Each later phase will add tests under e2e/. The judge-ipad project must
// remain so we can run the same E2E suite judges will see on iPad.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "judge-ipad",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1024, height: 768 },
        userAgent:
          "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
  ],
});
