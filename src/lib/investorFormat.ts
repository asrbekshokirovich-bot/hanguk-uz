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

/* ---------------------------------------------------------------------------
 * Language.
 *
 * The portal follows the active i18n language (uz, ru, en, ko). These helpers
 * stay pure: the caller passes `i18n.language`, and the default 'en' keeps the
 * old English output for any caller that does not.
 * ------------------------------------------------------------------------ */

export type InvestorLang = 'uz' | 'ru' | 'en' | 'ko';

/** 'uz-UZ', 'ru', 'en-US' ... -> one of the four portal languages. */
export function investorLang(lang: string | null | undefined): InvestorLang {
  const base = (lang ?? '').split('-')[0].toLowerCase();
  return base === 'uz' || base === 'ru' || base === 'ko' ? base : 'en';
}

const DATE_LOCALE: Record<Exclude<InvestorLang, 'uz'>, string> = {
  en: 'en-GB',
  ru: 'ru-RU',
  ko: 'ko-KR',
};

// Built in, because some browsers ship no Uzbek month names for 'uz-UZ'.
const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr',
];
const UZ_MONTHS_SHORT = [
  'Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyn',
  'Iyl', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek',
];

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Russian plural form for n: one / few / many. */
function ruForm(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

type Unit = 'minute' | 'hour' | 'day' | 'week';

const UZ_UNIT: Record<Unit, string> = { minute: 'daqiqa', hour: 'soat', day: 'kun', week: 'hafta' };
const KO_UNIT: Record<Unit, string> = { minute: '분', hour: '시간', day: '일', week: '주' };
const RU_UNIT: Record<Unit, [string, string, string]> = {
  minute: ['минуту', 'минуты', 'минут'],
  hour: ['час', 'часа', 'часов'],
  day: ['день', 'дня', 'дней'],
  week: ['неделю', 'недели', 'недель'],
};

function ago(n: number, unit: Unit, lang: InvestorLang): string {
  switch (lang) {
    case 'uz':
      return `${n} ${UZ_UNIT[unit]} oldin`;
    case 'ko':
      return `${n}${KO_UNIT[unit]} 전`;
    case 'ru':
      return `${n} ${ruForm(n, ...RU_UNIT[unit])} назад`;
    default:
      return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
  }
}

const JUST_NOW: Record<InvestorLang, string> = {
  uz: 'hozirgina',
  ru: 'только что',
  en: 'just now',
  ko: '방금',
};

/** 14 Mar 2025 / 14 Mart 2025 - day, short or long month, optional year. */
function formatDay(
  d: Date,
  lang: InvestorLang,
  month: 'short' | 'long',
  withYear: boolean,
): string {
  if (lang === 'uz') {
    const name = (month === 'long' ? UZ_MONTHS : UZ_MONTHS_SHORT)[d.getMonth()];
    return withYear ? `${d.getDate()} ${name} ${d.getFullYear()}` : `${d.getDate()} ${name}`;
  }
  return d.toLocaleDateString(DATE_LOCALE[lang], {
    day: 'numeric',
    month,
    ...(withYear ? { year: 'numeric' as const } : {}),
  });
}

/** "2 hours ago", "3d ago" style. Written locally so no date library is added. */
export function relativeTime(
  value: string | number | Date | null | undefined,
  lang: string = 'en',
): string {
  if (value == null) return '—';
  const l = investorLang(lang);
  const then = toDate(value);
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return JUST_NOW[l];
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return ago(minutes, 'minute', l);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ago(hours, 'hour', l);
  const days = Math.round(hours / 24);
  if (days < 7) return ago(days, 'day', l);
  const weeks = Math.round(days / 7);
  if (weeks < 5) return ago(weeks, 'week', l);
  return formatDay(then, l, 'short', true);
}

const SHORT_DAY: Record<InvestorLang, (n: number) => string> = {
  uz: (n) => `${n} kun`,
  ru: (n) => `${n} д`,
  en: (n) => `${n}d`,
  ko: (n) => `${n}일`,
};
const SHORT_WEEK: Record<InvestorLang, (n: number) => string> = {
  uz: (n) => `${n} hafta`,
  ru: (n) => `${n} нед`,
  en: (n) => `${n}w`,
  ko: (n) => `${n}주`,
};

/** Compact form for message and application lists: 09:24, 2h, 3d, 1w. */
export function shortTime(
  value: string | number | Date | null | undefined,
  lang: string = 'en',
): string {
  if (value == null) return '';
  const l = investorLang(lang);
  const then = toDate(value);
  const minutes = Math.max(0, Math.round((Date.now() - then.getTime()) / 60000));
  if (minutes < 24 * 60) {
    return then.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  }
  const days = Math.round(minutes / (60 * 24));
  if (days < 7) return SHORT_DAY[l](days);
  return SHORT_WEEK[l](Math.round(days / 7));
}

/** 14 March 2025 */
export function longDate(
  value: string | number | Date | null | undefined,
  lang: string = 'en',
): string {
  if (value == null) return '—';
  return formatDay(toDate(value), investorLang(lang), 'long', true);
}

/** 14 March - the day header in a message thread. */
export function dayMonth(value: string | number | Date, lang: string = 'en'): string {
  return formatDay(toDate(value), investorLang(lang), 'long', false);
}

const GREETINGS: Record<InvestorLang, [string, string, string]> = {
  uz: ['Xayrli tong', 'Xayrli kun', 'Xayrli kech'],
  ru: ['Доброе утро', 'Добрый день', 'Добрый вечер'],
  en: ['Good morning', 'Good afternoon', 'Good evening'],
  ko: ['좋은 아침입니다', '좋은 오후입니다', '좋은 저녁입니다'],
};

export function greeting(now = new Date(), lang: string = 'en'): string {
  const [morning, afternoon, evening] = GREETINGS[investorLang(lang)];
  const h = now.getHours();
  if (h < 12) return morning;
  if (h < 18) return afternoon;
  return evening;
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
export function monthLabel(value: string | Date | null | undefined, lang: string = 'en'): string {
  if (value == null) return '';
  const d = toDate(value);
  const l = investorLang(lang);
  if (l === 'uz') return UZ_MONTHS_SHORT[d.getMonth()];
  return d.toLocaleDateString(DATE_LOCALE[l], { month: 'short' });
}

/** "Q3 2026" from a date, for grouping accruals. */
export function quarterLabel(value: string | Date = new Date()): string {
  const d = value instanceof Date ? value : new Date(value);
  return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
}
