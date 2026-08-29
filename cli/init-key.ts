// Phase 6.3 — `recap init-key`: the power-user path for environment
// keys. NOT a pre-demo step (P3 kill — the in-app .env banner is the
// demo path); this exists for operators who prefer the terminal:
//
//   npx tsx cli/init-key.ts DAYTONA_API_KEY=dt0na GMI_API_KEY=gmi-...
//
// Behavior: upserts KEY=VALUE entries into .env; seeds .env from
// .env.example when it doesn't exist; refuses empty values. The
// content logic is pure (buildEnvContent) and unit-tested.

import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";

export function buildEnvContent(
  existing: string | null,
  entries: Array<[string, string]>,
  exampleContent: string | null = null,
): string {
  let content = existing ?? exampleContent ?? "# Openwrite environment\n";
  for (const [key, value] of entries) {
    if (!value) throw new Error(`refusing to set ${key}: value is empty`);
    const line = `${key}=${value}`;
    // Line-based exact-prefix replacement (Qodo review #3 — never
    // interpolate a user-supplied key into a RegExp: metacharacters
    // would throw or match lookalike variables, e.g. A.B hitting A0B).
    const lines = content.split("\n");
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx >= 0) {
      lines[idx] = line;
      content = lines.join("\n");
    } else {
      content = content.replace(/\n*$/, "\n") + line + "\n";
    }
  }
  return content;
}

function parseEntries(argv: string[]): Array<[string, string]> {
  return argv.map((arg) => {
    const eq = arg.indexOf("=");
    if (eq <= 0) throw new Error(`expected KEY=VALUE, got: ${arg}`);
    return [arg.slice(0, eq), arg.slice(eq + 1)] as [string, string];
  });
}

export function main(argv: string[], cwd: string = process.cwd()): void {
  const entries = parseEntries(argv);
  const envPath = path.join(cwd, ".env");
  const examplePath = path.join(cwd, ".env.example");
  const existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : null;
  const example = existsSync(examplePath) ? readFileSync(examplePath, "utf8") : null;
  const out = buildEnvContent(existing, entries, example);
  // Secret-bearing file: owner-only permissions regardless of umask
  // (Qodo review #4 — default 0644 would expose keys to local users).
  writeFileSync(envPath, out, { mode: 0o600 });
  chmodSync(envPath, 0o600);
  for (const [key] of entries) {
    console.log(`init-key: ${key} written to .env`);
  }
  console.log("init-key: restart the app (npm run dev) to pick up changes.");
}

// Thin wrapper: only auto-run when invoked directly as a script
// (tests import the pure functions instead).
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    console.error(`init-key: ${(e as Error).message}`);
    process.exit(1);
  }
}
