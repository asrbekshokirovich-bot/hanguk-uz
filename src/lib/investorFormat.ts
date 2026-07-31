/**
 * Formatting for the investor portal.
 *
 * TOKENS.md rule that matters here: money and counts in tables use the mono
 * face, UZS is shown in millions, and the unit lives in the column header - so
 * these helpers return bare numbers, never "1,840M UZS" glued together.
 */

const THOUSAND = 1_000;
const MILLION = 1_000_000;
const BILLION = 1_000_000_000;

/** 33.00 -> "33", 33.50 -> "33.5". Equity is data, never a literal. */
export function formatEquity(pct: number | null | undefined): string {
  if (pct == null) return '—';
  return String(Number(Number(pct).toFixed(2)));
}

/** UZS in millions, no unit. Put "million UZS" in the header. */
export function millions(n: number | null | undefined, digits = 0): string {
  if (n == null) return '—';
  return (n / MILLION).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/** Headline figures: 1.84B, 734M, 412K. Unit is appended by the caller. */
export function compact(n: number | null | undefined): string {
  if (n == null) return '—';
  const abs = Math.abs(n);
  if (abs >= BILLION) return `${(n / BILLION).toFixed(2)}B`;
  if (abs >= MILLION) return `${(n / MILLION).toFixed(abs >= 10 * MILLION ? 0 : 1)}M`;
  if (abs >= THOUSAND) return `${(n / THOUSAND).toFixed(0)}K`;
  return n.toLocaleString('en-US');
}

export function percent(n: number | null | undefined, digits = 1): string {
  if (n == null) return '—';
  return `${Number(n).toFixed(digits)}%`;
}

export function count(n: number | null | undefined): string {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US');
}

/** USD, whole dollars: $25,000. */
export function usd(n: number | null | undefined): string {
  if (n == null) return '—';
  return `$${Math.round(Number(n)).toLocaleString('en-US')}`;
}

/** "2 hours ago", "3d ago" style. Written locally so no date library is added. */
export function relativeTime(value: string | number | Date | null | undefined): string {
  if (value == null) return '—';
  const then = value instanceof Date ? value : new Date(value);
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Compact form for message and application lists: 09:24, 2h, 3d, 1w. */
export function shortTime(value: string | number | Date | null | undefined): string {
  if (value == null) return '';
  const then = value instanceof Date ? value : new Date(value);
  const minutes = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (minutes < 24 * 60) {
    return then.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  const days = Math.round(minutes / (60 * 24));
  if (days < 7) return `${days}d`;
  return `${Math.round(days / 7)}w`;
}

/** 14 March 2025 */
export function longDate(value: string | number | Date | null | undefined): string {
  if (value == null) return '—';
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function firstName(fullName: string | null | undefined): string {
  return (fullName ?? '').trim().split(/\s+/)[0] ?? '';
}

export function initials(fullName: string | null | undefined): string {
  return (fullName ?? '')
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/* ---------------------------------------------------------------------------
 * Currency.
 *
 * A season can carry money in more than one currency and the database stores no
 * exchange rate, so nothing here ever adds them together. UZS is the headline;
 * every other currency is rendered as its own line beneath it, labelled. If an
 * FX rate is added later, this is the only place that needs to change.
 * ------------------------------------------------------------------------ */

export const HEADLINE_CURRENCY = 'UZS';

export interface HasCurrency {
  currency: string;
}

/** The rows for one currency. Returns [] when the season has none of it. */
export function inCurrency<T extends HasCurrency>(rows: T[] | undefined, currency: string): T[] {
  return (rows ?? []).filter((r) => r.currency === currency);
}

/** Every currency in the rows except the headline one, in a stable order. */
export function secondaryCurrencies<T extends HasCurrency>(rows: T[] | undefined): string[] {
  const seen = new Set<string>();
  for (const r of rows ?? []) if (r.currency !== HEADLINE_CURRENCY) seen.add(r.currency);
  return [...seen].sort();
}

/** A complete money string including its unit. Use for secondary-currency
 *  lines and standalone figures - not for table cells, where the unit lives in
 *  the column header. */
export function moneyWithUnit(amount: number | null | undefined, currency: string): string {
  if (amount == null) return '—';
  if (currency === 'USD') return usd(amount);
  if (currency === HEADLINE_CURRENCY) return `${compact(amount)} UZS`;
  return `${compact(amount)} ${currency}`;
}

/** payment_type and expense category come out of the database as slugs
 *  ("initial_deposit"). The P&L needs them as line items. */
export function humanizeLineItem(slug: string | null | undefined): string {
  if (!slug) return 'Other';
  return slug
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** "Feb", for month buckets coming back as a date. */
export function monthLabel(value: string | Date | null | undefined): string {
  if (value == null) return '';
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString('en-GB', { month: 'short' });
}

/** "Q3 2026" from a date, for grouping accruals. */
export function quarterLabel(value: string | Date = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}
