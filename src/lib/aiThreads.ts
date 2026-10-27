// Helpers for the Hanguk AI conversation list ("Oxirgi suhbatlar", "Tarix").

export interface AiThread {
  id: string;
  title: string;
  pinned: boolean;
  message_count: number;
  last_preview: string | null;
  created_at: string;
  updated_at: string;
}

/** Title of a new conversation: the first question, on one line, at most 80 chars. */
export function threadTitleFrom(question: string): string {
  const one = question.replace(/\s+/g, ' ').trim();
  return one.length > 80 ? `${one.slice(0, 79).trimEnd()}…` : one;
}

/** Two-letter avatar for a conversation card ("Shoxrux rustamjonov" → "SR"). */
export function threadInitials(title: string): string {
  const words = title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return 'AI';
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

const UZ_MONTHS = ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'];

function tashkentDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tashkent' });
}

/**
 * Day label for a card footer: today / yesterday (from the caller's
 * translations), otherwise a short date ("24-okt" in Uzbek).
 */
export function threadDayLabel(
  iso: string,
  now: Date,
  lang: string,
  words: { today: string; yesterday: string },
): string {
  const d = new Date(iso);
  const day = tashkentDay(d);
  if (day === tashkentDay(now)) return words.today;
  if (day === tashkentDay(new Date(now.getTime() - 864e5))) return words.yesterday;
  const [, m, dd] = day.split('-').map(Number);
  if (lang.startsWith('uz')) return `${dd}-${UZ_MONTHS[m - 1]}`;
  return d.toLocaleDateString(lang, { day: 'numeric', month: 'short', timeZone: 'Asia/Tashkent' });
}

/** Pinned first, then the most recently active. */
export function sortThreads(list: AiThread[]): AiThread[] {
  return [...list].sort((a, b) =>
    a.pinned !== b.pinned ? (a.pinned ? -1 : 1) : b.updated_at.localeCompare(a.updated_at));
}

/** First name for the greeting ("Xo'jamurod Arslanov" → "Xo'jamurod"). */
export function firstName(full: string | null | undefined): string {
  return (full ?? '').trim().split(/\s+/)[0] ?? '';
}
