import { describe, expect, it, vi } from 'vitest';

// cameraSettings → cameraSession (CAMERA_ID_RE) → supabase client; sinovda tarmoq kerak emas.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { fmtLogTime, nextSort, normalizeCameraId, parseSort, validateName, validateNewCamera } from '../cameraSettings';

describe('yangi kamera', () => {
  it("ID: bo'sh joy olinadi, kichik harfga o'tadi", () => {
    expect(normalizeCameraId('  Kirish ')).toBe('kirish');
  });

  it('ID qoidasi: kichik lotin, raqam, chiziqcha, 1–32 belgi', () => {
    expect(validateNewCamera('kirish', 'Kirish', [])).toBeNull();
    expect(validateNewCamera('zal-2', 'Zal 2', [])).toBeNull();
    expect(validateNewCamera('a'.repeat(32), 'X', [])).toBeNull();
    expect(validateNewCamera('a'.repeat(33), 'X', [])).toBe('invalidId');
    expect(validateNewCamera('', 'X', [])).toBe('invalidId');
    expect(validateNewCamera('-zal', 'X', [])).toBe('invalidId');
    expect(validateNewCamera('Zal', 'X', [])).toBe('invalidId');
    expect(validateNewCamera('zal_sub', 'X', [])).toBe('invalidId');
    expect(validateNewCamera('kirish xona', 'X', [])).toBe('invalidId');
  });

  it('takror ID', () => {
    expect(validateNewCamera('zal', 'Zal', ['kirish', 'zal'])).toBe('duplicate');
  });

  it('nom 1–60 belgi', () => {
    expect(validateNewCamera('zal', '   ', [])).toBe('invalidName');
    expect(validateName('x'.repeat(60))).toBeNull();
    expect(validateName('x'.repeat(61))).toBe('invalidName');
    expect(validateName('  Kirish  ')).toBeNull();
  });
});

describe('tartib', () => {
  it('faqat butun son', () => {
    expect(parseSort('3')).toBe(3);
    expect(parseSort(' -2 ')).toBe(-2);
    expect(parseSort('0')).toBe(0);
    expect(parseSort('1.5')).toBeNull();
    expect(parseSort('')).toBeNull();
    expect(parseSort('1e3')).toBeNull();
    expect(parseSort('1234567')).toBeNull();
  });

  it('yangisi oxirgisidan bitta keyin', () => {
    expect(nextSort([])).toBe(1);
    expect(
      nextSort([
        { id: 'a', name: 'A', sort: 1, enabled: true },
        { id: 'b', name: 'B', sort: 5, enabled: false },
        { id: 'c', name: 'C', sort: 3, enabled: true },
      ]),
    ).toBe(6);
  });
});

describe('jurnal vaqti', () => {
  it('"KK.OO SS:DD" — Toshkent vaqti', () => {
    expect(fmtLogTime('2026-11-03T10:42:00Z')).toBe('03.11 15:42');
    expect(fmtLogTime('2026-12-31T19:30:00Z')).toBe('01.01 00:30');
  });
});
