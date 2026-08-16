import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // ZumSavdo tailwind ishlatmaydi. Inline konfiguratsiya berilmasa, Vite
  // yuqoriga chiqib omborning ildizidagi postcss.config.js ni topib oladi.
  css: { postcss: { plugins: [] } },
  server: {
    host: "0.0.0.0",
    port: 5180,
  },
  preview: {
    host: "0.0.0.0",
    port: 5180,
  },
});
