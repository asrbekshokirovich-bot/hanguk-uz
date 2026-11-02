/**
 * CRM «Sozlamalar → Bot» uchun sof yordamchilar.
 * Baza: bot_settings_overview / bot_settings_save — migratsiya 20261102190000_staff_bot_settings.sql.
 * Vaqtlar Toshkent bo'yicha, 05:00–23:59 (bazadagi bot_cron_expr bilan bir xil qoida).
 */

export interface BotStaff {
  user_id: string;
  full_name: string;
  is_owner: boolean;
  is_linked: boolean;
}

export interface BotOverview {
  settings: Record<string, string>;
  staff: BotStaff[];
}

/** HH:MM, 05:00–23:59. */
export function isValidTime(v: string): boolean {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v.trim());
  return !!m && Number(m[1]) >= 5;
}

/** "17:30, 18:00" → ["17:30","18:00"] (bo'shlar tashlanadi). */
export function parseList(v: string | undefined | null): string[] {
  return (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
}

/** Ish kunlari (ISO 1–7) ni yoqish/o'chirish, tartiblangan satr qaytaradi. */
export function toggleDay(workdays: string, day: number): string {
  const set = new Set(parseList(workdays).map(Number).filter((d) => d >= 1 && d <= 7));
  if (set.has(day)) set.delete(day); else set.add(day);
  return [...set].sort((a, b) => a - b).join(',');
}

/** Xulosa oluvchini qo'shish/olib tashlash. */
export function toggleId(list: string, id: string): string {
  const ids = parseList(list);
  return (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]).join(',');
}

/** Saqlashdan oldin tekshirish; xato kalitlari ro'yxati (bo'sh — hammasi to'g'ri). */
export function validate(s: Record<string, string>): string[] {
  const bad: string[] = [];
  for (const k of ['report_time', 'digest_time', 'morning_time']) {
    if (!isValidTime(s[k] ?? '')) bad.push(k);
  }
  const rem = parseList(s.reminder_times);
  if (rem.length > 3 || rem.some((t) => !isValidTime(t))) bad.push('reminder_times');
  if (parseList(s.workdays).length === 0) bad.push('workdays');
  return bad;
}
