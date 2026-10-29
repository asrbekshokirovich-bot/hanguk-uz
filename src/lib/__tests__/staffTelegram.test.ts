import { describe, expect, it } from 'vitest';
import { buildDeepLink, isCodeActive, minutesLeft, telegramDisplay } from '../staffTelegram';

describe('staffTelegram', () => {
  it('deep link bot username bilan, @ olib tashlanadi', () => {
    expect(buildDeepLink('HangukTeamBot', 'ABC2345678')).toBe('https://t.me/HangukTeamBot?start=ABC2345678');
    expect(buildDeepLink('@HangukTeamBot', 'ABC2345678')).toBe('https://t.me/HangukTeamBot?start=ABC2345678');
    expect(buildDeepLink('', 'ABC2345678')).toBeNull();
    expect(buildDeepLink(null, 'ABC2345678')).toBeNull();
    expect(buildDeepLink('Bot', '')).toBeNull();
  });

  it('kod muddati', () => {
    const now = Date.parse('2026-10-29T12:00:00Z');
    expect(isCodeActive('2026-10-29T12:14:30Z', now)).toBe(true);
    expect(isCodeActive('2026-10-29T11:59:59Z', now)).toBe(false);
    expect(isCodeActive(null, now)).toBe(false);
    expect(minutesLeft('2026-10-29T12:14:30Z', now)).toBe(15);
    expect(minutesLeft('2026-10-29T12:00:30Z', now)).toBe(1);
    expect(minutesLeft('2026-10-29T11:00:00Z', now)).toBe(0);
  });

  it('telegram ko\'rinishi', () => {
    expect(telegramDisplay({ username: 'diyora_t', first_name: 'Diyora', telegram_user_id: 1 })).toBe('@diyora_t');
    expect(telegramDisplay({ username: null, first_name: 'Diyora', telegram_user_id: 1 })).toBe('Diyora');
    expect(telegramDisplay({ username: null, first_name: null, telegram_user_id: 777 })).toBe('id 777');
    expect(telegramDisplay({ username: null, first_name: null, telegram_user_id: null })).toBe('');
  });
});
