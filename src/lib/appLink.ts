/**
 * The operator's link to the student app: hanguk.uz/l/<code>, where <code> is
 * the lead's link code (app analytics, stage 2). Opening it ties the phone to
 * the lead: with the app installed, through the app's own address
 * (hanguk://open/l/<code>); installed from Google Play, through the install
 * referrer (l=<code>); in the browser, through the web app's ?l=<code>.
 */

export const APP_PACKAGE = 'com.hanguk.studentapp.hanguk_app';

/**
 * Where the student app's web build lives: hanguk.uz/ilova/app/, proxied by
 * vercel.json to the separate Vercel project built by web-app-vercel.yml.
 * (hanguk.uz/ilova/ is the desktop phone frame; the app itself is app/, which
 * keeps the ?l=<code> query the frame's phone redirect would drop.)
 */
export const APP_WEB_URL: string =
  (import.meta.env.VITE_APP_WEB_URL as string | undefined) || 'https://hanguk.uz/ilova/app/';

/**
 * Where "get the app" goes: hanguk.uz/app (public/app.html, outside this
 * single-page app). A phone is sent straight to its store — the App Store or
 * Google Play; a computer sees the page with both badges, the QR code and the
 * demo. It is a page of its own, so it is linked with a plain <a href>, never
 * with the router.
 */
export const APP_DOWNLOAD_URL = '/app';

/** The App Store page, once the app is there; no button without it. */
export const APP_STORE_URL: string | null = (import.meta.env.VITE_APP_STORE_URL as string | undefined) || null;

/** A lead's link code as the links carry it, or null when it cannot be one. */
export function linkCode(raw: string | undefined | null): string | null {
  const c = (raw ?? '').trim().toLowerCase();
  return /^[a-z0-9]{6,32}$/.test(c) ? c : null;
}

/** The app's own address for the code. */
export function appUri(code: string): string {
  return `hanguk://open/l/${code}`;
}

/** Google Play, with the code handed to the app on its first launch. */
export function playUrl(code: string | null): string {
  const base = `https://play.google.com/store/apps/details?id=${APP_PACKAGE}`;
  return code ? `${base}&referrer=${encodeURIComponent(`l=${code}`)}` : base;
}

/** Android: open the app if it is installed, Google Play (with the code) if not. */
export function androidIntent(code: string): string {
  return `intent://open/l/${code}#Intent;scheme=hanguk;package=${APP_PACKAGE};S.browser_fallback_url=${encodeURIComponent(playUrl(code))};end`;
}

/** The web app, with the code. */
export function webUrl(code: string | null): string {
  if (!code) return APP_WEB_URL;
  const u = new URL(APP_WEB_URL);
  u.searchParams.set('l', code);
  return u.toString();
}

/** The link an operator sends. */
export function operatorLink(code: string, origin = 'https://hanguk.uz'): string {
  return `${origin}/l/${code}`;
}

export type Device = 'android' | 'ios' | 'other';

export function deviceOf(userAgent: string): Device {
  if (/android/i.test(userAgent)) return 'android';
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios';
  return 'other';
}
