import { describe, expect, it } from 'vitest';
import { parseStudentRows, phoneKey } from '@/lib/learningCenterRows';

describe('parseStudentRows', () => {
  it('reads name and phone in either order, with comma, semicolon or tab', () => {
    const { rows, invalid } = parseStudentRows(
      'Ali Valiyev, +998 90 123 45 67\n93 456 78 90; Madina Karimova\nSardor\t(97) 111-22-33',
    );
    expect(invalid).toEqual([]);
    expect(rows).toEqual([
      { full_name: 'Ali Valiyev', phone: '+998 90 123 45 67' },
      { full_name: 'Madina Karimova', phone: '93 456 78 90' },
      { full_name: 'Sardor', phone: '(97) 111-22-33' },
    ]);
  });

  it('skips blank lines and reports rows without a usable phone or name', () => {
    const { rows, invalid } = parseStudentRows('\nJasur, 12345\n\n+998901234567\n');
    expect(rows).toEqual([]);
    expect(invalid).toEqual(['Jasur, 12345', '+998901234567']);
  });
});

describe('phoneKey', () => {
  it('compares on the last nine digits, like the database', () => {
    expect(phoneKey('+998 90 123-45-67')).toBe(phoneKey('901234567'));
  });
});
