import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS_FORBIDDEN, } from './fixtures';
import { canSendReply, checkReply, findPriceMention, MAX_REPLY_LENGTH } from '../replyRules';

describe('findPriceMention', () => {
  it.each([
    ["Narxi 2 000 000 so'm", "2 000 000 so'm"],
    ['Narxi 2000 som', '2000 som'],
    ['2 mln + 5 mln vizadan keyin', '2 mln'],
    ['$400 boshlang\'ich', '$400'],
    ['400$ dan', '400$'],
    ['2000 USD', '2000 USD'],
    ['500 dollar', '500 dollar'],
    ['Цена 3 млн', '3 млн'],
    ['150 000 сум', '150 000 сум'],
    ['so‘m 5 000 so‘m', '5 000 so‘m'],
  ])('finds the price in %s', (text, snippet) => {
    expect(findPriceMention(text)).toBe(snippet);
  });

  it.each([
    'Assalomu alaykum! Batafsil ma’lumotni shaxsiy xabarda yozamiz.',
    '10 daqiqada qo‘ng‘iroq qilamiz',
    'Hanbox 26-oktabrda boshlanadi',
    'Ofisimiz 2-qavatda',
    'Summa haqida DM da',
    '',
  ])('does not see a price in %s', (text) => {
    expect(findPriceMention(text)).toBeNull();
  });
});

describe('checkReply', () => {
  const words = DEFAULT_SETTINGS_FORBIDDEN;

  it('a short price-free reply is fine', () => {
    const check = checkReply('Assalomu alaykum! Batafsil DM da yozamiz.', words);
    expect(check).toEqual({ empty: false, forbidden: null, price: null, tooLong: false });
    expect(canSendReply(check, false)).toBe(true);
  });

  it('an empty reply cannot be sent', () => {
    const check = checkReply('   ', words);
    expect(check.empty).toBe(true);
    expect(canSendReply(check, false)).toBe(false);
  });

  it('a forbidden word blocks sending whatever else is ticked', () => {
    const check = checkReply('Biz kafolat beramiz', words);
    expect(check.forbidden).toBe('kafolat');
    expect(canSendReply(check, true)).toBe(false);
  });

  it('"% chegirma" is forbidden too (a promise needs the boss)', () => {
    expect(checkReply('Sizga 10% chegirma qilamiz', words).forbidden).toBe('% chegirma');
  });

  it('a price warns, and only goes out once the person confirms', () => {
    const check = checkReply("Narxi 2 000 000 so'm", words);
    expect(check.price).toBe("2 000 000 so'm");
    expect(check.forbidden).toBeNull();
    expect(canSendReply(check, false)).toBe(false);
    expect(canSendReply(check, true)).toBe(true);
  });

  it('refuses a reply longer than Instagram takes', () => {
    const check = checkReply('a'.repeat(MAX_REPLY_LENGTH + 1), words);
    expect(check.tooLong).toBe(true);
    expect(canSendReply(check, true)).toBe(false);
  });
});
