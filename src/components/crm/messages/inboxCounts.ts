import { STALE_AFTER_DAYS } from './queueLogic';

/** The thread fields the counters need — a subset of MessageThread. */
export interface CountableThread {
  kind?: string | null;
  status: string;
  unread_count: number;
  last_message_at: string;
  last_incoming_at?: string | null;
  last_human_out_at?: string | null;
}

/** The person wrote and no PERSON on our side has answered since. */
export function isThreadWaiting(t: CountableThread): boolean {
  if (!t.last_incoming_at) return false;
  if (!t.last_human_out_at) return true;
  return new Date(t.last_incoming_at).getTime() > new Date(t.last_human_out_at).getTime();
}

/**
 * What the sidebar badge and the tab title show: lead conversations waiting
 * for a reply, not older than STALE_AFTER_DAYS — the same rows the "Kutmoqda"
 * tab lists, so the number and the list never disagree.
 */
export function countWaiting(threads: CountableThread[], now: number = Date.now()): number {
  const staleBefore = now - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;
  return threads.filter(
    (t) =>
      (t.kind ?? 'lead') === 'lead' &&
      t.status !== 'archived' &&
      new Date(t.last_message_at).getTime() >= staleBefore &&
      isThreadWaiting(t),
  ).length;
}

/** Lead conversations with at least one message nobody has opened. */
export function countUnreadThreads(threads: CountableThread[]): number {
  return threads.filter((t) => (t.kind ?? 'lead') === 'lead' && t.status !== 'archived' && t.unread_count > 0).length;
}

/** "(3) Hanguk" — the browser tab shows the number like Telegram Web does. */
export function titleWithCount(base: string, count: number): string {
  const clean = base.replace(/^\(\d+\)\s*/, '');
  return count > 0 ? `(${count}) ${clean}` : clean;
}
