import { defineConfig } from "vitest/config";

// Two test environments, picked by file name:
//   - *.test.ts   -> node  (auth, reducer, route, schema, seed, etc.)
//   - *.test.tsx  -> jsdom (component tests using @testing-library/react)
//     (set via the `// @vitest-environment jsdom` directive at the top
//      of each component test file, since `environmentMatchGlobs` is
//      removed in vitest 4.)
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
