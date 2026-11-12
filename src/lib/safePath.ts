/**
 * A path on this site to continue to (after sign-in, say), or null when `raw`
 * is anything else.
 *
 * `/auth?next=…` comes from a link, so anyone can write it. Checking for a
 * leading "/" and no "//" is not enough: a browser reads "\" as "/" and drops
 * tabs and line breaks from an address, so "/\evil.example" and
 * "/<tab>/evil.example" both mean "//evil.example" — another site. The router
 * then leaves this one (history.pushState refuses a foreign address and
 * React Router falls back to location.assign). So the address is resolved the
 * way the browser would and kept only when it stays on this origin.
 */
export function safeInternalPath(
  raw: string | null | undefined,
  origin: string = window.location.origin,
): string | null {
  if (!raw || !raw.startsWith('/')) return null;
  // Backslashes and control characters have no place in a path of ours.
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return null;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}
