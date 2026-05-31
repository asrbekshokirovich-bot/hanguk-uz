import { describe, it, expect } from 'vitest';
import { containsHangul } from '../useReviewTranslation';

describe('containsHangul', () => {
  it('detects Korean in plain strings', () => {
    expect(containsHangul('인터넷 접수만 실시함')).toBe(true);
    expect(containsHangul('마감일은 17:00까지')).toBe(true);
  });

  it('detects Korean nested anywhere in an object', () => {
    expect(containsHangul({ events: [{ notes_ko: '모바일 학생증' }] })).toBe(true);
    expect(containsHangul({ rows: [{ faculty_group: '공과대학', amount_krw: 5_000_000 }] })).toBe(true);
  });

  it('returns false for English / codes / numbers / dates', () => {
    expect(containsHangul('apply_open')).toBe(false);
    expect(containsHangul({ rows: [{ amount_krw: 5_000_000, deadline: '2022-07-08T17:00:00+09:00' }] })).toBe(false);
    expect(containsHangul('Online application opens')).toBe(false);
  });

  it('returns false for nullish / empty', () => {
    expect(containsHangul(null)).toBe(false);
    expect(containsHangul(undefined)).toBe(false);
    expect(containsHangul('')).toBe(false);
    expect(containsHangul({})).toBe(false);
  });
});
