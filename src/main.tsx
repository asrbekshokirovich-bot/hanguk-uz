import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppInitializer } from "./components/native/AppInitializer";
import "./index.css";

// After a deploy, a page opened before it still asks for the old build's
// chunks (a CRM tab, a lazily loaded page), and those files are gone — the
// error boundary then showed "Failed to fetch dynamically imported module".
// Vite reports that as vite:preloadError; loading the page again brings the
// new build. Once per minute at most, so a chunk that is really missing shows
// the error instead of reloading forever.
const RELOADED_AT = "chunk-reload-at";
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0);
    if (Date.now() - last < 60_000) return;
    sessionStorage.setItem(RELOADED_AT, String(Date.now()));
  } catch {
    // No storage to remember the reload in: leave the error to the boundary.
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <AppInitializer>
    <App />
  </AppInitializer>
);
