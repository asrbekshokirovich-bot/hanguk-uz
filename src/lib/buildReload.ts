/**
 * Loading the page again for a new build.
 *
 * After a deploy, a page opened before it still asks for the old build's
 * chunks (a CRM tab, a lazily loaded page), and those files are gone. Vite
 * reports that as `vite:preloadError`; loading the page again brings the new
 * build. Once per minute at most, so a chunk that is really missing shows the
 * error instead of reloading forever.
 *
 * While the reload is on its way the page is still alive for a moment: the
 * import that failed resolves to nothing, React throws "Cannot read properties
 * of undefined (reading 'default')" and the error boundary catches it. That is
 * not a crash — the page is about to be replaced — so the boundary shows
 * nothing and nothing is reported while [isReloadingForNewBuild] holds. (On
 * 2026-11-12 an operator's open tab did exactly this after a deploy, and the
 * hourly check sent a "CRM page crashed" alert for it.)
 */
const RELOADED_AT = 'chunk-reload-at';
const ONCE_PER_MS = 60_000;

let reloading = false;

/** True from the moment the page decided to load itself again. */
export const isReloadingForNewBuild = (): boolean => reloading;

type ReloadStore = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Loads the page again, unless it already did within the last minute or there
 * is no storage to remember it in. Returns whether the reload was started.
 */
export function reloadForNewBuild(
  now: number = Date.now(),
  store: ReloadStore | null = sessionStore(),
  reload: () => void = () => window.location.reload(),
): boolean {
  if (!store) return false;
  try {
    const last = Number(store.getItem(RELOADED_AT) ?? 0);
    if (now - last < ONCE_PER_MS) return false;
    store.setItem(RELOADED_AT, String(now));
  } catch {
    // Storage that cannot be written to: leave the error to the boundary.
    return false;
  }
  reloading = true;
  reload();
  return true;
}

function sessionStore(): ReloadStore | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
