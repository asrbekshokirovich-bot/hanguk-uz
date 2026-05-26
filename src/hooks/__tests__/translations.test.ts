import { describe, it, expect } from 'vitest';
import { buildTranslationMap, localizeText } from '../useTranslations';

describe('buildTranslationMap', () => {
  it('keys by entity|field|lang and drops blanks', () => {
    const m = buildTranslationMap([
      { entity_id: 'a', field_name: 'name_ko', lang: 'uz', text_value: 'Inha universiteti' },
      { entity_id: 'a', field_name: 'name_ko', lang: 'en', text_value: 'Inha University' },
      { entity_id: 'a', field_name: 'name_ko', lang: 'mn', text_value: '   ' },
    ]);
    expect(m.get('a|name_ko|uz')).toBe('Inha universiteti');
    expect(m.get('a|name_ko|en')).toBe('Inha University');
    expect(m.has('a|name_ko|mn')).toBe(false);
  });
});

describe('localizeText', () => {
  const tr = (map: Record<string, string>) => (l: string) => map[l] ?? null;

  it('returns the Korean original when ko is requested', () => {
    expect(localizeText({ lang: 'ko', ko: '인하대학교', en: 'Inha' })).toEqual({
      text: '인하대학교',
      lang: 'ko',
      fallback: false,
    });
  });

  it('returns the Uzbek translation when present', () => {
    const r = localizeText({
      lang: 'uz',
      ko: '인하대학교',
      en: 'Inha University',
      translation: tr({ uz: 'Inha universiteti', en: 'Inha University' }),
    });
    expect(r).toEqual({ text: 'Inha universiteti', lang: 'uz', fallback: false });
  });

  it('falls back to inline English for uz when no uz translation, flagged as fallback', () => {
    const r = localizeText({ lang: 'uz', ko: '인하대학교', en: 'Inha University' });
    expect(r).toEqual({ text: 'Inha University', lang: 'en', fallback: true });
  });

  it('falls back to an English translation, then Korean', () => {
    expect(localizeText({ lang: 'uz', ko: '인하', translation: tr({ en: 'Inha' }) })).toEqual({
      text: 'Inha',
      lang: 'en',
      fallback: true,
    });
    expect(localizeText({ lang: 'uz', ko: '인하' })).toEqual({
      text: '인하',
      lang: 'ko',
      fallback: true,
    });
  });

  it('uses inline English directly when en is requested (no fallback flag)', () => {
    expect(localizeText({ lang: 'en', ko: '인하', en: 'Inha University' })).toEqual({
      text: 'Inha University',
      lang: 'en',
      fallback: false,
    });
  });

  it('ignores region suffixes like en-US', () => {
    const r = localizeText({ lang: 'en-US', ko: '인하', en: 'Inha University' });
    expect(r.text).toBe('Inha University');
    expect(r.lang).toBe('en');
  });

  it('returns empty (not an error) when nothing is available', () => {
    expect(localizeText({ lang: 'uz', ko: null, en: null })).toEqual({ text: '', lang: 'uz', fallback: false });
  });
});
