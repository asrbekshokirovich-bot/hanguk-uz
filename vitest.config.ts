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
    // The Supabase client is created on import and refuses an empty URL. With
    // no .env (a fresh clone, CI) seven suites failed before running a single
    // test. Nothing answers at this address: a test that reaches the network
    // gets a refused connection instead of touching production.
    env: { VITE_SUPABASE_URL: "http://127.0.0.1:54321" },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
