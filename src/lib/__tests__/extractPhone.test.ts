import { describe, expect, it } from 'vitest';
import { extractPhoneFromText } from '../../../supabase/functions/_shared/phone';

describe('extractPhoneFromText (Instagram/Telegram, 2026-11-12)', () => {
  it('reads the Meta lead form phone, not "2027" glued to it', () => {
    const form = [
      'Здравствуйте! Я заполнил(-а) форму и хочу узнать больше о вашей компании.',
      'Kim uchun?: Farzandim uchun',
      'Talabaning yoshi:: 21–22',
      "Koreys tili sertifikati bormi?: Yo'q",
      'Qachon ketmoqchisiz?: 2027-yil bahor–yoz',
      'Viloyat:: Boshqa viloyat',
      'Full name: Test Talaba',
      'Phone number: 8 90 111 22 33',
    ].join('\n');
    expect(extractPhoneFromText(form)).toBe('901112233');
  });

  it('handles the usual ways people type a number', () => {
    expect(extractPhoneFromText('raqamim +998 94 000 11 22')).toBe('940001122');
    expect(extractPhoneFromText('998970001122')).toBe('970001122');
    expect(extractPhoneFromText('tel: (90) 123-45-67')).toBe('901234567');
    expect(extractPhoneFromText('20 000 11 22 ga qo‘ng‘iroq qiling')).toBe('200001122');
  });

  it('does not build a number out of years, ages or separate lines', () => {
    expect(extractPhoneFromText('2027-yil bahor, yoshim 19')).toBeNull();
    expect(extractPhoneFromText('2027\n8 90 60')).toBeNull();
    expect(extractPhoneFromText('salom')).toBeNull();
  });
});
