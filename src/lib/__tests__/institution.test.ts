import { describe, it, expect } from 'vitest';
import { institutionName, institutionCity } from '../institution';

const knu = { name_en: 'Kyungpook National University', name_ko: '경북대학교', city_ko: '대구' };

describe('institutionName', () => {
  it('uses the English name for uz, ru and en', () => {
    for (const lang of ['uz', 'ru', 'en', 'en-US']) {
      expect(institutionName(knu, lang)).toBe('Kyungpook National University');
    }
  });

  it('uses the Korean name for ko', () => {
    expect(institutionName(knu, 'ko')).toBe('경북대학교');
    expect(institutionName(knu, 'ko-KR')).toBe('경북대학교');
  });

  it('falls back to the other name when one is missing', () => {
    expect(institutionName({ name_en: null, name_ko: '경북대학교' }, 'uz')).toBe('경북대학교');
    expect(institutionName({ name_en: 'KNU', name_ko: '' }, 'ko')).toBe('KNU');
    expect(institutionName({ name_en: '  ', name_ko: '경북대학교' }, 'en')).toBe('경북대학교');
  });

  it('defaults to English-first without a language and is empty without a row', () => {
    expect(institutionName(knu)).toBe('Kyungpook National University');
    expect(institutionName(null, 'uz')).toBe('');
    expect(institutionName(undefined, 'ko')).toBe('');
  });
});

describe('institutionCity', () => {
  it('returns the Korean city or an empty string', () => {
    expect(institutionCity(knu)).toBe('대구');
    expect(institutionCity({ city_ko: null })).toBe('');
    expect(institutionCity(undefined)).toBe('');
  });
});
