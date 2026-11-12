/**
 * The service worker (vite-plugin-pwa) keeps the CRM's files on the device:
 * about 200 files, 2.3 MB over the wire, fetched in the background the first
 * time a page of the site is opened. For somebody who works in the CRM every
 * day that makes every screen open at once and keeps an open tab working
 * through a deploy. For a visitor of the home page it was 2.3 MB of somebody
 * else's application, downloaded on their mobile data, for nothing.
 *
 * So it is no longer registered by index.html for everyone (vite.config.ts:
 * injectRegister false) but from the CRM, once the person is known to be
 * staff or the investor. A browser that already has it keeps it.
 */
export function registerServiceWorker(env: { prod: boolean } = { prod: import.meta.env.PROD }): boolean {
  // No worker in development or in tests: vite-plugin-pwa builds one for production only.
  if (!env.prod) return false;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
  navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
    console.warn('service worker: not registered', error);
  });
  return true;
}
