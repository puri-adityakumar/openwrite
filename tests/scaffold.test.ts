import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");

const REQUIRED_FILES = [
  "LICENSE",
  "NOTICE",
  "LICENSES.thirdparty.txt",
  ".env.example",
  "QODO_REVIEW.md",
  "SECURITY.md",
  "TECHNICAL.md",
  "README.md",
  "package.json",
  ".gitignore",
] as const;

const REQUIRED_SCRIPTS = [
  "dev",
  "build",
  "start",
  "test",
  "test:e2e",
  "parity",
  "demo",
] as const;

describe("Phase 0 scaffold", () => {
  it("has every required root file", () => {
    for (const f of REQUIRED_FILES) {
      expect(existsSync(resolve(ROOT, f)), `missing: ${f}`).toBe(true);
    }
  });

  it("package.json parses and contains the 7 required scripts", () => {
    const raw = readFileSync(resolve(ROOT, "package.json"), "utf8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    expect(pkg.scripts, "package.json has no scripts block").toBeDefined();
    for (const s of REQUIRED_SCRIPTS) {
      expect(pkg.scripts?.[s], `missing script: ${s}`).toBeDefined();
    }
  });

  it(".env.example documents every key the app reads", () => {
    const env = readFileSync(resolve(ROOT, ".env.example"), "utf8");
    const required = [
      "DAYTONA_API_KEY",
      "GMI_API_KEY",
      "JWT_SECRET",
      "DATABASE_URL",
      "TF_BASE_URL",
    ];
    for (const k of required) {
      expect(env.includes(k), `.env.example missing key: ${k}`).toBe(true);
      expect(env.includes(`http://localhost:18790`), ".env.example TF_BASE_URL must default to localhost:18790").toBe(true);
    }
  });

  it("README has the Qodo Code Review Evidence heading", () => {
    const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");
    expect(readme).toMatch(/^##\s+Qodo Code Review Evidence/m);
  });

  it("README quickstart has exactly one setup command beyond install: docker compose up", () => {
    const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");
    // Strip fenced code blocks to avoid double-counting example blocks.
    const stripped = readme.replace(/```[\s\S]*?```/g, "");
    const mentions = (stripped.match(/docker compose up/g) ?? []).length;
    expect(mentions, "README should call out `docker compose up` as the only setup step beyond npm install").toBeGreaterThanOrEqual(1);
  });

  it("QODO_REVIEW.md is present at repo root and linked from README", () => {
    const readme = readFileSync(resolve(ROOT, "README.md"), "utf8");
    expect(readme.toLowerCase()).toContain("qodo_review.md");
  });

  it("Vitest and Playwright configs exist (Phase 0.3 test harness)", () => {
    expect(existsSync(resolve(ROOT, "vitest.config.ts"))).toBe(true);
    expect(existsSync(resolve(ROOT, "playwright.config.ts"))).toBe(true);
  });

  it("Playwright config defines the judge-ipad WebKit project at 1024x768", () => {
    const cfg = readFileSync(resolve(ROOT, "playwright.config.ts"), "utf8");
    expect(cfg).toMatch(/name:\s*["']judge-ipad["']/);
    expect(cfg).toMatch(/width:\s*1024/);
    expect(cfg).toMatch(/height:\s*768/);
  });
});
