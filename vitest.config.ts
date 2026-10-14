import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // The real client (src/integrations/supabase/client.ts) is created at import
    // time from these. .env is not in the repo, so without them every test file
    // that imports the client failed to load ("supabaseUrl is required") on any
    // machine but a developer's. A dead local address: a test that forgets to
    // mock a query fails fast instead of reaching the live project.
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:9",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
