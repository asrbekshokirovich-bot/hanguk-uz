import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppInitializer } from "./components/native/AppInitializer";
import "./index.css";
import { i18nReady } from "./lib/i18n";
import { reloadForNewBuild } from "./lib/buildReload";

// A page opened before a deploy asks for chunks that are gone: load it again
// for the new build (src/lib/buildReload.ts). When the reload is not started
// — it already was a minute ago — the error is left to the error boundary.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewBuild()) event.preventDefault();
});

// Uzbek ships with the page; another language is fetched first, so the page
// does not flash Uzbek before turning Russian. Never wait long for it: a slow
// or failed download must not hold the whole site back.
const LANGUAGE_WAIT_MS = 3000;
Promise.race([i18nReady, new Promise<void>((resolve) => setTimeout(resolve, LANGUAGE_WAIT_MS))]).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <AppInitializer>
      <App />
    </AppInitializer>
  );
});
