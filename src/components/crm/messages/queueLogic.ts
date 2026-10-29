import type { ChannelFilter, ConversationVM, QueueTab } from './types';

/**
 * Pure queue logic — filtering, counting and the SLA rule. Kept free of React
 * and Supabase so it can be reasoned about (and unit-tested) on its own.
 */

/**
 * Waiting-time threshold, in minutes, above which a conversation is an SLA
 * breach and its waiting pill turns danger-tinted.
 */
export const SLA_WARNING_MINUTES = 10;

/**
 * A conversation nobody has touched for this long is "old": it stays out of
 * the Waiting list until the operator asks for it, so a 141-day-old greeting
 * never sits above today's messages again (audit 2026-10-29, finding 2).
 */
export const STALE_AFTER_DAYS = 30;

/** True when the conversation has breached the reply SLA. */
export function isOverdue(c: ConversationVM): boolean {
  return !c.isDone && c.isWaiting && c.waitingMinutes >= SLA_WARNING_MINUTES;
}

/** Does this conversation belong in the given tab? */
export function matchesTab(c: ConversationVM, tab: QueueTab): boolean {
  switch (tab) {
    case 'waiting':
      return c.isWaiting && !c.isDone;
    case 'mine':
      return c.isMine && !c.isDone;
    case 'all':
      return !c.isDone;
    case 'done':
      return c.isDone;
  }
}

/**
 * Only lead conversations are the operators' work. Staff, partner and service
 * chats are reachable through the "internal" chip and nowhere else.
 */
export function matchesChannel(c: ConversationVM, channel: ChannelFilter): boolean {
  if (channel === 'internal') return c.kind !== 'lead';
  if (c.kind !== 'lead') return false;
  if (channel === 'all') return true;
  return c.channel === channel;
}

/** Live count shown next to each tab label (lead conversations only). */
export function countForTab(list: ConversationVM[], tab: QueueTab): number {
  return list.filter((c) => c.kind === 'lead' && matchesTab(c, tab) && !(tab === 'waiting' && c.isStale)).length;
}

/**
 * Tab AND channel AND query.
 *
 * A search is a question about EVERY conversation: while a query is typed the
 * tab (and the 30-day rule) no longer narrow the list — "where is the girl
 * with 94 164 39 00?" has to find her whether she is waiting, answered or
 * closed (audit 2026-10-29, finding 5). The local match covers name, handle,
 * preview and stage; `serverMatches` adds what only the database knows — the
 * lead's phone, older messages — from `search_threads`.
 */
export function filterConversations(
  list: ConversationVM[],
  tab: QueueTab,
  channel: ChannelFilter,
  query: string,
  options: { includeStale?: boolean; serverMatches?: ReadonlySet<string> } = {},
): ConversationVM[] {
  const q = query.trim().toLowerCase();
  return list.filter((c) => {
    if (!matchesChannel(c, channel)) return false;
    if (q) {
      if (options.serverMatches?.has(c.threadId)) return true;
      return `${c.name} ${c.handle} ${c.preview} ${c.stage}`.toLowerCase().includes(q);
    }
    if (!matchesTab(c, tab)) return false;
    if (tab === 'waiting' && c.isStale && !options.includeStale) return false;
    return true;
  });
}

/** How many Waiting rows the stale rule is hiding right now. */
export function countHiddenStale(list: ConversationVM[], channel: ChannelFilter): number {
  return list.filter((c) => matchesTab(c, 'waiting') && matchesChannel(c, channel) && c.isStale).length;
}

/**
 * Every tab is an inbox: newest activity first. Waiting sorts by the message
 * the person is waiting on, so the conversation that just wrote is on top and
 * the one that has waited longest is at the bottom — where the operator
 * reaches it after the fresh ones, instead of being greeted by it.
 */
export function sortConversations(list: ConversationVM[], tab: QueueTab): ConversationVM[] {
  const sorted = [...list];
  if (tab === 'waiting') {
    sorted.sort(
      (a, b) =>
        new Date(b.waitingSince ?? b.lastAt).getTime() - new Date(a.waitingSince ?? a.lastAt).getTime(),
    );
  } else {
    sorted.sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
  }
  return sorted;
}

/** Whole minutes elapsed since `iso`, floored at 0. */
export function minutesSince(iso: string, now: number = Date.now()): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((now - then) / 60000));
}

/** Compact waiting label: "4m", "2h", "3d". */
export function formatWait(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / (60 * 24))}d`;
}

/**
 * Short month names. Chrome's "uz" locale renders `{ month: 'short' }` as
 * "M06" (audit 2026-10-29, finding 13), so Uzbek carries its own table; the
 * other interface languages use the browser's.
 */
const UZ_MONTHS_SHORT = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];
const UZ_MONTHS_LONG = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr',
];

/** "12 iyn" / "12 Jun" / "12 июн." — day and short month in the UI language. */
export function formatDayMonth(d: Date, locale: string, long = false): string {
  if (locale.toLowerCase().startsWith('uz')) {
    const months = long ? UZ_MONTHS_LONG : UZ_MONTHS_SHORT;
    return `${d.getDate()} ${months[d.getMonth()]}`;
  }
  return d.toLocaleDateString(locale, { day: 'numeric', month: long ? 'long' : 'short' });
}

/**
 * "12:41" for today, the word for yesterday (translated by the caller via
 * `yesterdayLabel`), "12 iyn" beyond that.
 */
export function formatRowTime(
  iso: string,
  locale: string,
  now: Date = new Date(),
  yesterdayLabel = 'Yest.',
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return yesterdayLabel;
  return formatDayMonth(d, locale);
}

/** Two-letter avatar initials from a display name. */
export function initialsOf(name: string | null | undefined, fallback = '?'): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return fallback;
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Heuristic "is this worth offering a translation for?" check. The operator UI
 * is English; message bodies are mixed Uzbek/Russian. Cyrillic is unambiguous;
 * for Latin text we look for Uzbek-specific letters and common function words,
 * which is enough to avoid putting a Translate link under an English sentence.
 */
const UZ_HINTS =
  /\b(va|uchun|men|siz|bor|yo['’]q|kerak|qancha|qanday|rahmat|salom|assalomu|alaykum|bo['’]l\w*|kel\w*|yubor\w*|hujjat\w*|ariza)\b/i;

export function looksNonEnglish(text: string): boolean {
  if (!text.trim()) return false;
  if (/[Ѐ-ӿ]/.test(text)) return true; // Cyrillic
  if (/[ᄀ-ᇿ가-힯]/.test(text)) return true; // Hangul
  if (/[gGoO][‘’'`]/.test(text)) return true; // o‘, g‘
  return UZ_HINTS.test(text);
}
