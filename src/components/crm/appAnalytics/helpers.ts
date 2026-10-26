import type { QualityData } from './api';

export const TABS = ['marketing', 'flow', 'overview', 'people', 'live', 'quality', 'settings'] as const;
export type Tab = (typeof TABS)[number];
export const BASE = '/crm/app-analytics';

/**
 * /crm/app-analytics opens the marketing panel; /crm/app-analytics/<tab> the
 * others; the old /crm/app-activity, the activity page it was.
 */
export function tabOf(path: string): Tab {
  if (path.startsWith('/crm/app-activity')) return 'overview';
  const rest = path.startsWith(BASE) ? path.slice(BASE.length).replace(/^\//, '').split('/')[0] : '';
  return (TABS as readonly string[]).includes(rest) ? (rest as Tab) : 'marketing';
}

/** Share as a whole percent; null when there is nothing to divide. */
export function share(part: number, whole: number): number | null {
  return whole > 0 ? Math.round((part / whole) * 100) : null;
}

/** Stage 1's bar per build: ≥ 95% of taps named, screens timed. */
export function coverageOf(q: QualityData, build: number) {
  const c = q.coverage?.find((x) => x.build === build);
  if (!c) return { named: null, timed: null };
  return { named: share(c.named_taps, c.taps), timed: share(c.timed_leaves, c.screen_views) };
}
