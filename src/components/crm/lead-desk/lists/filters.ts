/**
 * The filter bar of the list pages -> the arguments of the api calls
 * (`fetchAllLeads` / `fetchLostLeads` / `fetchBazaLeads`).
 *
 * Dates are Tashkent calendar days typed into <input type="date">; the api
 * wants instants, so a day becomes [00:00, next 00:00) in UTC+5.
 */
import type { LeadListFilter } from '../api';
import type { Stage } from '../types';
import { PAGE_SIZE } from './labels';

export interface ListFilterState {
  q: string;
  stage: Stage | '';
  source: string;
  /** '' = everybody, 'none' = the pool, otherwise a user id */
  owner: string;
  city: string;
  cert: string;
  fromDay: string;
  toDay: string;
  lostReason: string;
}

export const EMPTY_FILTERS: ListFilterState = {
  q: '',
  stage: '',
  source: '',
  owner: '',
  city: '',
  cert: '',
  fromDay: '',
  toDay: '',
  lostReason: '',
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

const dayStart = (day: string): number => new Date(`${day}T00:00:00+05:00`).getTime();

/**
 * Inclusive Tashkent days -> [from, to) instants. A reversed range is put the
 * right way round; one open end stays open.
 */
export function dayRangeToIso(fromDay: string, toDay: string): { from: string | null; to: string | null } {
  let a = DAY_RE.test(fromDay) ? fromDay : '';
  let b = DAY_RE.test(toDay) ? toDay : '';
  if (a && b && a > b) [a, b] = [b, a];
  const from = a && !Number.isNaN(dayStart(a)) ? new Date(dayStart(a)).toISOString() : null;
  const to = b && !Number.isNaN(dayStart(b)) ? new Date(dayStart(b) + DAY_MS).toISOString() : null;
  return { from, to };
}

/** What the page sends to the api for page `page` (0-based) of the current filter. */
export function buildListFilter(state: ListFilterState, page = 0, pageSize = PAGE_SIZE): LeadListFilter {
  const { from, to } = dayRangeToIso(state.fromDay, state.toDay);
  return {
    q: state.q.trim() || undefined,
    stage: state.stage || null,
    source: state.source || null,
    ownerId: state.owner || null,
    city: state.city || null,
    cert: state.cert || null,
    lostReason: state.lostReason || null,
    from,
    to,
    limit: pageSize,
    offset: Math.max(0, page) * pageSize,
  };
}

/** How many filters (other than the search box) are set: drives the "Tozalash" button. */
export function activeFilterCount(state: ListFilterState): number {
  const keys: (keyof ListFilterState)[] = ['stage', 'source', 'owner', 'city', 'cert', 'fromDay', 'toDay', 'lostReason'];
  return keys.filter((k) => state[k] !== '').length;
}
