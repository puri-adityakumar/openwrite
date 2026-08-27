// Vitest global setup — load .env into process.env for unit tests.
//
// Tests run with `npm test` (vitest run) and historically expected
// JWT_SECRET etc. to be present in the shell env. To keep unit tests
// portable, we read the .env file (if present) and populate any
// variables that aren't already set. This mirrors the behaviour of
// `next dev` which auto-loads .env.

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(__dirname, "..", ".env");

if (existsSync(ENV_PATH)) {
  const raw = readFileSync(ENV_PATH, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
