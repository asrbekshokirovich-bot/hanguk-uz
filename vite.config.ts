import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
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
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Split large third-party libraries into their own long-lived chunks so an
    // application code change doesn't invalidate the vendor cache, and so heavy
    // libs (charts, maps) load only on the routes that use them.
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "supabase": ["@supabase/supabase-js"],
          "radix": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-select",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "@radix-ui/react-accordion",
            "@radix-ui/react-scroll-area",
          ],
          "charts": ["recharts"],
          "maps": ["leaflet"],
          "i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
          "forms": ["react-hook-form", "@hookform/resolvers", "zod"],
          "date": ["date-fns"],
        },
      },
    },
  },
}));