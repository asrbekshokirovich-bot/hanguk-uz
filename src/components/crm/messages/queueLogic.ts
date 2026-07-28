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

/** True when the conversation has breached the reply SLA. */
export function isOverdue(c: ConversationVM): boolean {
  return !c.isDone && c.waitingMinutes >= SLA_WARNING_MINUTES;
}

/** Does this conversation belong in the given tab? */
export function matchesTab(c: ConversationVM, tab: QueueTab): boolean {
  switch (tab) {
    case 'unassigned':
      return !c.isAssigned && !c.isDone;
    case 'mine':
      return c.isMine && !c.isDone;
    case 'all':
      return !c.isDone;
    case 'done':
      return c.isDone;
  }
}

/** Live count shown next to each tab label. */
export function countForTab(list: ConversationVM[], tab: QueueTab): number {
  return list.filter((c) => matchesTab(c, tab)).length;
}

/**
 * Tab AND channel AND query — the three filters compose, exactly as in the
 * mockup. The query matches name, preview and stage.
 */
export function filterConversations(
  list: ConversationVM[],
  tab: QueueTab,
  channel: ChannelFilter,
  query: string,
): ConversationVM[] {
  const q = query.trim().toLowerCase();
  return list.filter((c) => {
    if (!matchesTab(c, tab)) return false;
    if (channel !== 'all' && c.channel !== channel) return false;
    if (q && !`${c.name} ${c.preview} ${c.stage}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/**
 * Unassigned is a work queue, so it sorts by longest wait first — the operator
 * should always see the most-breached conversation at the top. Every other tab
 * sorts by recency, which is what people expect from an inbox.
 */
export function sortConversations(list: ConversationVM[], tab: QueueTab): ConversationVM[] {
  const sorted = [...list];
  if (tab === 'unassigned') {
    sorted.sort((a, b) => b.waitingMinutes - a.waitingMinutes);
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

/** "12:41" for today, "Yest." for yesterday, "12 Jun" beyond that. */
export function formatRowTime(iso: string, locale: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Yest.';
  return d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
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
