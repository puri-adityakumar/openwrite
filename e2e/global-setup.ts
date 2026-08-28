import { request, type FullConfig } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEMO_STATE } from "./demo-state";

// Phase 5 — global E2E setup. The seeded demo account (demo@local /
// demo1234) is rate-limited to 10 logins per minute; a growing E2E
// suite that logs in per-spec trips the 429. Log in ONCE per run here
// and share the session via storageState. Specs that TEST the login
// flow itself (auth.spec, stranger.spec) keep their own logins.
export default async function globalSetup(_config: FullConfig) {
  mkdirSync(path.dirname(DEMO_STATE), { recursive: true });
  const ctx = await request.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:13000",
  });
  // Back-to-back suite runs share the 60s login window; retry one
  // 429 once after Retry-After instead of failing the whole run.
  let res;
  for (let attempt = 0; attempt < 2; attempt++) {
    res = await ctx.post("/api/auth/login", {
      data: { email: "demo@local", password: "demo1234" },
    });
    if (res.ok()) break;
    if (res.status() === 429 && attempt === 0) {
      const retryAfter = Number(res.headers()["retry-after"] ?? "61");
      await new Promise((r) => setTimeout(r, Math.min(retryAfter, 61) * 1000));
      continue;
    }
    throw new Error(
      `global-setup: demo login failed (${res.status()}) — is the seed applied? (docker compose up + seed)`,
    );
  }
  const state = await ctx.storageState();
  await ctx.dispose();
  writeFileSync(DEMO_STATE, JSON.stringify(state));
}
