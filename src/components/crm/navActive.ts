/**
 * Whether a sidebar item's URL matches the current route. The most specific match
 * wins via startsWith — except that '/crm' only matches itself, and the leads list
 * ('/crm/leads') matches itself (and one lead's profile URL) but NOT its sibling
 * pages: '/crm/leads/lost' is "Yo'qotilgan", not "Barcha lidlar".
 */
export function isNavItemActive(pathname: string, url: string): boolean {
  if (pathname === url) return true;
  if (url === '/crm') return false;
  if (url === '/crm/leads') return /^\/crm\/leads\/[0-9a-fA-F-]{36}/.test(pathname);
  return pathname.startsWith(url);
}
