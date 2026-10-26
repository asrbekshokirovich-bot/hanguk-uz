import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dayMonth,
  greeting,
  investorLang,
  longDate,
  monthLabel,
  relativeTime,
  shortTime,
} from '../investorFormat';

describe('investorFormat language', () => {
  afterEach(() => vi.useRealTimers());

  it('normalises i18n language codes', () => {
    expect(investorLang('uz')).toBe('uz');
    expect(investorLang('uz-UZ')).toBe('uz');
    expect(investorLang('ru-RU')).toBe('ru');
    expect(investorLang('ko')).toBe('ko');
    expect(investorLang('en-US')).toBe('en');
    expect(investorLang(undefined)).toBe('en');
    expect(investorLang('de')).toBe('en');
  });

  it('uses the built-in Uzbek month names', () => {
    expect(monthLabel('2026-02-10', 'uz')).toBe('Fev');
    expect(monthLabel('2026-06-10', 'uz')).toBe('Iyn');
    expect(monthLabel('2026-09-10', 'uz')).toBe('Sen');
    expect(longDate('2025-03-14T12:00:00', 'uz')).toBe('14 Mart 2025');
    expect(dayMonth('2025-12-01T12:00:00', 'uz')).toBe('1 Dekabr');
  });

  it('keeps English output by default', () => {
    expect(monthLabel('2026-02-10')).toBe('Feb');
    expect(longDate('2025-03-14T12:00:00')).toBe('14 March 2025');
  });

  it('greets by time of day in each language', () => {
    const morning = new Date(2026, 9, 26, 9, 0);
    const afternoon = new Date(2026, 9, 26, 14, 0);
    const evening = new Date(2026, 9, 26, 20, 0);
    expect(greeting(morning, 'uz')).toBe('Xayrli tong');
    expect(greeting(afternoon, 'uz')).toBe('Xayrli kun');
    expect(greeting(evening, 'uz')).toBe('Xayrli kech');
    expect(greeting(morning, 'ru')).toBe('Доброе утро');
    expect(greeting(morning)).toBe('Good morning');
  });

  it('writes relative time in the active language', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-26T12:00:00Z'));
    expect(relativeTime('2026-10-26T11:59:30Z', 'uz')).toBe('hozirgina');
    expect(relativeTime('2026-10-26T11:55:00Z', 'uz')).toBe('5 daqiqa oldin');
    expect(relativeTime('2026-10-26T09:00:00Z', 'uz')).toBe('3 soat oldin');
    expect(relativeTime('2026-10-26T11:55:00Z', 'ru')).toBe('5 минут назад');
    expect(relativeTime('2026-10-26T11:58:00Z', 'ru')).toBe('2 минуты назад');
    expect(relativeTime('2026-10-26T11:59:00Z', 'ru')).toBe('1 минуту назад');
    expect(relativeTime('2026-10-26T11:55:00Z', 'ko')).toBe('5분 전');
    expect(relativeTime('2026-10-26T11:59:00Z')).toBe('1 minute ago');
    expect(relativeTime('2026-10-26T11:55:00Z')).toBe('5 minutes ago');
    expect(shortTime('2026-10-23T12:00:00Z', 'uz')).toBe('3 kun');
    expect(shortTime('2026-10-23T12:00:00Z')).toBe('3d');
  });
});
