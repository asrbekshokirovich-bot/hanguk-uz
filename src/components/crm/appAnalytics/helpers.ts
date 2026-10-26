import type { QualityData } from './api';

export const TABS = ['overview', 'people', 'quality', 'settings'] as const;
export type Tab = (typeof TABS)[number];
export const BASE = '/crm/app-analytics';

/** /crm/app-analytics/<tab>; the old /crm/app-activity opens the overview. */
export function tabOf(path: string): Tab {
  const rest = path.startsWith(BASE) ? path.slice(BASE.length).replace(/^\//, '').split('/')[0] : '';
  return (TABS as readonly string[]).includes(rest) ? (rest as Tab) : 'overview';
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
