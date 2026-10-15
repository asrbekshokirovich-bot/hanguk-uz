import { defineConfig } from "vitest/config";

// SQL tests: the database migrations run on an in-memory Postgres (PGlite),
// not against Supabase. See supabase/tests/lead_v2/. Run: npm run test:sql
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["supabase/tests/**/*.test.ts", "supabase/functions/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
