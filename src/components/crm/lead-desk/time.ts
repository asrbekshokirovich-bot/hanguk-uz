/**
 * Lead module v2 — time helpers.
 *
 * The office runs on Tashkent time (UTC+5, no DST) whatever the browser's zone
 * is, so everything shown to an operator goes through `Asia/Tashkent`.
 */

export const TZ = 'Asia/Tashkent';

const clockFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const shortFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit' });

const toDate = (v: string | Date | number | null | undefined): Date | null => {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** "14:05" in Tashkent. */
export function clock(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? clockFmt.format(d) : '—';
}

/** "2026-10-06" — the Tashkent calendar day. */
export function dayKey(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? dayFmt.format(d) : '';
}

/** "06.10" */
export function shortDate(v: string | Date | null | undefined): string {
  const d = toDate(v);
  return d ? shortFmt.format(d).replace('/', '.') : '—';
}

/** "Bugun 14:05", "Ertaga 10:00", "07.10 10:00". */
export function whenLabel(v: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(v);
  if (!d) return '—';
  const diffDays = Math.round(
    (Date.parse(`${dayKey(d)}T00:00:00Z`) - Date.parse(`${dayKey(now)}T00:00:00Z`)) / 86_400_000,
  );
  const hhmm = clock(d);
  if (diffDays === 0) return `Bugun ${hhmm}`;
  if (diffDays === 1) return `Ertaga ${hhmm}`;
  if (diffDays === -1) return `Kecha ${hhmm}`;
  return `${shortDate(d)} ${hhmm}`;
}

/** Whole seconds from `now` until `due` (negative once it has passed). */
export function secondsUntil(due: string | Date | null | undefined, now: Date = new Date()): number | null {
  const d = toDate(due);
  return d ? Math.round((d.getTime() - now.getTime()) / 1000) : null;
}

/** "04:12", "−02:40", "1:02:10" (negative = overdue). */
export function formatCountdown(seconds: number | null): string {
  if (seconds == null) return '—';
  const neg = seconds < 0;
  const s = Math.abs(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const body =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return neg ? `−${body}` : body;
}

export type Urgency = 'late' | 'warn' | 'ok' | 'idle';

/**
 * How a HOZIR row looks (spec §4): green while there is time, yellow from the
 * 5th minute (5:00 left of 10:00), red once the 10 minutes are gone.
 */
export function urgency(due: string | null | undefined, now: Date = new Date()): Urgency {
  const left = secondsUntil(due, now);
  if (left == null) return 'idle';
  if (left < 0) return 'late';
  if (left <= 5 * 60) return 'warn';
  return 'ok';
}

/** "3 daqiqa oldin", "2 soat oldin", "kecha". */
export function ago(v: string | Date | null | undefined, now: Date = new Date()): string {
  const d = toDate(v);
  if (!d) return '—';
  const s = Math.round((now.getTime() - d.getTime()) / 1000);
  if (s < 60) return 'hozir';
  if (s < 3600) return `${Math.floor(s / 60)} daq. oldin`;
  if (s < 86_400) return `${Math.floor(s / 3600)} soat oldin`;
  return `${Math.floor(s / 86_400)} kun oldin`;
}

/** Local `<input type="datetime-local">` value for an ISO instant, in Tashkent. */
export function toLocalInput(v: string | Date | null | undefined): string {
  const d = toDate(v);
  if (!d) return '';
  return `${dayKey(d)}T${clock(d)}`;
}

/** The ISO instant for a Tashkent wall-clock "YYYY-MM-DDTHH:mm" (UTC+5). */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+05:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** Quick picks for "Band / keyin": +1 soat, bugun 18:00, ertaga 10:00 (Tashkent). */
export function quickCallbackTimes(now: Date = new Date()): { label: string; iso: string }[] {
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + 86_400_000));
  const at = (day: string, hhmm: string) => new Date(`${day}T${hhmm}:00+05:00`).toISOString();
  const picks = [{ label: '+1 soat', iso: new Date(now.getTime() + 3_600_000).toISOString() }];
  const evening = at(today, '18:00');
  if (new Date(evening).getTime() > now.getTime() + 600_000) picks.push({ label: 'Bugun 18:00', iso: evening });
  picks.push({ label: 'Ertaga 10:00', iso: at(tomorrow, '10:00') });
  return picks;
}
