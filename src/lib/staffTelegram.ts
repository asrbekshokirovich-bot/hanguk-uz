/**
 * Xodim ↔ Telegram ulash (staff-bot) uchun sof yordamchilar.
 * Baza: migratsiya 20261031130000_staff_bot_core.sql (v_staff_telegram,
 * staff_telegram_link_code, staff_telegram_unlink).
 */

export interface StaffTelegramStatus {
  user_id: string;
  telegram_user_id: number | null;
  username: string | null;
  first_name: string | null;
  linked_at: string | null;
  is_linked: boolean;
  pending_code_expires_at: string | null;
}

export interface LinkCode {
  code: string;
  deep_link: string | null;
  expires_at: string;
}

/** Deep link: bot sozlanmagan bo'lsa (username bo'sh) null. */
export function buildDeepLink(botUsername: string | null | undefined, code: string): string | null {
  const u = (botUsername ?? '').trim().replace(/^@/, '');
  if (!u || !code) return null;
  return `https://t.me/${u}?start=${code}`;
}

/** Kod hali amal qiladimi. */
export function isCodeActive(expiresAt: string | null | undefined, nowMs = Date.now()): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return !Number.isNaN(t) && t > nowMs;
}

/** Qolgan daqiqa (yuqoriga yaxlitlangan), tugagan bo'lsa 0. */
export function minutesLeft(expiresAt: string | null | undefined, nowMs = Date.now()): number {
  if (!expiresAt) return 0;
  const t = Date.parse(expiresAt);
  if (Number.isNaN(t) || t <= nowMs) return 0;
  return Math.ceil((t - nowMs) / 60_000);
}

/** Telegram'dagi ko'rinish: @username yoki ism, ikkalasi bo'lmasa id. */
export function telegramDisplay(s: Pick<StaffTelegramStatus, 'username' | 'first_name' | 'telegram_user_id'>): string {
  if (s.username) return `@${s.username}`;
  if (s.first_name) return s.first_name;
  return s.telegram_user_id ? `id ${s.telegram_user_id}` : '';
}
