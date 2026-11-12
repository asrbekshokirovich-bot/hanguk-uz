import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    // Which build an error report came from (src/lib/errorReporter.ts).
    __BUILD_ID__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 8) || "local"),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // Not registered by index.html for every visitor: the CRM registers it
      // for the people who work in it (src/lib/serviceWorker.ts).
      injectRegister: false,
      includeAssets: ["favicon.ico", "icon-1024.png", "brand-mark.png"],
      devOptions: {
        enabled: false,
      },
      manifest: {
        name: "Hanguk Consulting",
        short_name: "Hanguk",
        description: "Janubiy Koreya universitetlariga ariza berish platformasi",
        theme_color: "#1A3A6C",
        background_color: "#1A3A6C",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/icon-1024.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icon-1024.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icon-1024.png",
            sizes: "1024x1024",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,ico,png,svg,jpg,jpeg,webp,woff,woff2}"],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        // No page is answered from the worker. index.html is not in the
        // precache (globPatterns has no html), so the default fallback route
        // threw «non-precached-url» every time the worker started and was
        // never registered. Saying so also keeps the pages that are not this
        // SPA out of the worker's reach if html is ever precached: /app,
        // /tv.html, /account-deletion.html and hanguk.uz/ilova/* (the Flutter
        // web app, another Vercel project proxied by vercel.json).
        navigateFallback: null,
        // No runtime cache for the Supabase API. Until 2026-11-11 a rule here
        // asked the service worker to keep every GET to *.supabase.co for a
        // day (NetworkFirst) under its URL alone — the Authorization header is
        // not part of a cache key. Wherever that rule takes effect, one
        // account's leads, payments and profiles stay on disk after sign-out
        // and are offered to the next account on a shared computer whenever a
        // request fails, and yesterday's data is shown as today's with nothing
        // to say so. The CRM is not an offline app: a request that fails
        // should fail. (AppInitializer removes the old cache where one was made.)
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));