import { describe, expect, it } from 'vitest';
import i18next from 'i18next';
import { formatCity, formatPhone } from '../format';
import { formatDue } from '../useDueLabel';
import en from '@/locales/en.json';

describe('formatCity', () => {
  it('humanises a machine value', () => {
    expect(formatCity('tashkent_city')).toBe('Tashkent city');
    expect(formatCity('qashqadaryo_region')).toBe('Qashqadaryo region');
  });

  it('leaves prose exactly as written', () => {
    expect(formatCity('Tashkent')).toBe('Tashkent');
    expect(formatCity('Sirdaryo Region')).toBe('Sirdaryo Region');
  });

  it('treats blanks as absent', () => {
    expect(formatCity(null)).toBeNull();
    expect(formatCity('   ')).toBeNull();
  });
});

describe('formatPhone', () => {
  it('groups a nine-digit Uzbek number', () => {
    expect(formatPhone('941966909')).toBe('+998 94 196 69 09');
    expect(formatPhone('+998959441805')).toBe('+998 95 944 18 05');
    expect(formatPhone('998 90 616 28 05')).toBe('+998 90 616 28 05');
  });

  it('returns anything it does not recognise untouched', () => {
    // Guessing at an unknown format would make a wrong number look valid.
    expect(formatPhone('+82 10 1234 5678')).toBe('+82 10 1234 5678');
    expect(formatPhone('12345')).toBe('12345');
    expect(formatPhone(null)).toBeNull();
  });
});

describe('overdue formatting escalates its unit', () => {
  const i18n = i18next.createInstance();
  i18n.init({ lng: 'en', resources: { en: { translation: en } } });
  const t = i18n.t.bind(i18n) as Parameters<typeof formatDue>[1];

  it('reads months of neglect in days, not hours', () => {
    // The bug this covers: 2915 hours overdue is a number nobody can read.
    expect(formatDue(-174900, t)).toBe('121 days overdue');
  });

  it('still uses hours and minutes for recent misses', () => {
    expect(formatDue(-90, t)).toBe('2h overdue');
    expect(formatDue(-30, t)).toBe('30m overdue');
  });

  it('switches to days exactly at 24 hours', () => {
    expect(formatDue(-1439, t)).toBe('24h overdue');
    expect(formatDue(-1440, t)).toBe('1 day overdue');
  });

  it('pluralises the day count', () => {
    expect(formatDue(-1440, t)).toBe('1 day overdue');
    expect(formatDue(-2880, t)).toBe('2 days overdue');
    expect(formatDue(1440, t)).toBe('in 1 day');
  });

  it('formats future times unchanged', () => {
    expect(formatDue(30, t)).toBe('in 30m');
    expect(formatDue(120, t)).toBe('in 2h');
    expect(formatDue(2880, t)).toBe('in 2 days');
    expect(formatDue(null, t)).toBe('Not scheduled');
  });
});
