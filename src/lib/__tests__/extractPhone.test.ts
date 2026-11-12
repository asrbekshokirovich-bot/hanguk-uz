import { describe, expect, it, vi } from 'vitest';

vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({}));

import { extractPhoneFromText } from '../../../supabase/functions/_shared/identity';

describe('extractPhoneFromText (Instagram/Telegram, 2026-11-12)', () => {
  it('reads the Meta lead form phone, not "2027" glued to it', () => {
    const form = [
      'Здравствуйте! Я заполнил(-а) форму и хочу узнать больше о вашей компании.',
      'Kim uchun?: Farzandim uchun',
      'Talabaning yoshi:: 21–22',
      "Koreys tili sertifikati bormi?: Yo'q",
      'Qachon ketmoqchisiz?: 2027-yil bahor–yoz',
      'Viloyat:: Boshqa viloyat',
      'Full name: ergashevaa',
      'Phone number: 8 90 608 85 42',
    ].join('\n');
    expect(extractPhoneFromText(form)).toBe('906088542');
  });

  it('handles the usual ways people type a number', () => {
    expect(extractPhoneFromText('raqamim +998 94 978 43 53')).toBe('949784353');
    expect(extractPhoneFromText('998977733378')).toBe('977733378');
    expect(extractPhoneFromText('tel: (90) 123-45-67')).toBe('901234567');
    expect(extractPhoneFromText('20 278 97 15 ga qo‘ng‘iroq qiling')).toBe('202789715');
  });

  it('does not build a number out of years, ages or separate lines', () => {
    expect(extractPhoneFromText('2027-yil bahor, yoshim 19')).toBeNull();
    expect(extractPhoneFromText('2027\n8 90 60')).toBeNull();
    expect(extractPhoneFromText('salom')).toBeNull();
  });
});
