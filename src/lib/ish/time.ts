/**
 * Jobs are in Korea: their dates and clock times are Seoul's (UTC+9 all year,
 * no summer time), whatever the staff member's own time zone.
 */

const HOUR = 3_600_000;

/** '2026-11-12' and '10:00' in Seoul → '2026-11-12T10:00:00+09:00'. */
export function seoulIso(date: string, time: string): string {
  return `${date}T${time}:00+09:00`;
}

/** [date] moved by [days] ('YYYY-MM-DD'). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** A job on [date] from [start] to [end] in Seoul; an end not after the start is the next day. */
export function jobTimes(date: string, start: string, end: string): { startsAt: string; endsAt: string } {
  return {
    startsAt: seoulIso(date, start),
    endsAt: seoulIso(end <= start ? addDays(date, 1) : date, end),
  };
}

/** The Seoul date and clock time of an instant. */
export function seoulParts(instant: string | Date): { date: string; time: string } {
  const d = typeof instant === 'string' ? new Date(instant) : instant;
  const shifted = new Date(d.getTime() + 9 * HOUR).toISOString();
  return { date: shifted.slice(0, 10), time: shifted.slice(11, 16) };
}

/** Today's date in Seoul. */
export function seoulToday(now: Date = new Date()): string {
  return seoulParts(now).date;
}

/** Midnight of a Seoul date, as an instant. */
export function seoulMidnight(date: string): Date {
  return new Date(`${date}T00:00:00+09:00`);
}

/** The Monday of the week holding [date]. */
export function weekStart(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

/** «10:00–14:00» in Seoul. */
export function timeRange(startsAt: string, endsAt: string): string {
  return `${seoulParts(startsAt).time}–${seoulParts(endsAt).time}`;
}

const LOCALES: Record<string, string> = { uz: 'uz-Latn', ru: 'ru-RU', en: 'en-GB', ko: 'ko-KR' };

/** «Wed, 12 Nov» in the CRM's language, on Seoul's calendar. */
export function dayLabel(instant: string, lang: string): string {
  return new Intl.DateTimeFormat(LOCALES[lang] ?? 'en-GB', {
    timeZone: 'Asia/Seoul',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(instant));
}

/** «13 000 ₩». */
export function won(amount: number): string {
  return `${String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₩`;
}

/** «4 soat 30 daqiqa» style: hours and minutes with the given unit words. */
export function hoursMinutes(minutes: number, h: string, m: string): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} ${m}`;
  return rest === 0 ? `${hours} ${h}` : `${hours} ${h} ${rest} ${m}`;
}
