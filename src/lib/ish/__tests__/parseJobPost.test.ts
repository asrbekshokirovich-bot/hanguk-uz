import { describe, expect, it } from 'vitest';
import { parseJobPost } from '../parseJobPost';

// Wednesday 11 November 2026, 10:00 in Seoul.
const now = new Date('2026-11-11T01:00:00Z');

describe('parseJobPost', () => {
  it('reads an Uzbek post: day, hours, hourly wage, people, phone, Telegram, address, link', () => {
    const post = [
      '🔥 ISH BOR! Hongdae ko\'chish xizmati',
      '📍 Manzil: Mapo-gu, Wausan-ro 21',
      '🗓 12-noyabr (payshanba)',
      '⏰ 10:00-14:00',
      '💰 Soatiga 13 000 won',
      '👥 2 kishi kerak',
      '📞 010-5555-1234, Telegram: @hongdae_move',
      'https://t.me/koreajobs_uz/1234',
    ].join('\n');
    expect(parseJobPost(post, now)).toEqual({
      date: '2026-11-12',
      start: '10:00',
      end: '14:00',
      wage: 13000,
      slots: 2,
      phone: '010-5555-1234',
      telegram: '@hongdae_move',
      address: 'Manzil: Mapo-gu, Wausan-ro 21',
      link: 'https://t.me/koreajobs_uz/1234',
    });
  });

  it('reads a Korean post: 월/일, 오전/오후 hours, 시급 with a comma, 명', () => {
    const post = '[알바] 물류센터 상하차 11월 13일 오전 9시~오후 6시 시급 12,000원 3명 연락: +82 10 9876 5432\n주소: 인천 서구';
    expect(parseJobPost(post, now)).toEqual({
      date: '2026-11-13',
      start: '09:00',
      end: '18:00',
      wage: 12000,
      slots: 3,
      phone: '010-9876-5432',
      address: '인천 서구',
    });
  });

  it('reads a Russian post with a month name and «завтра» words', () => {
    expect(parseJobPost('Работа 14 ноября, 18:00–23:00, 11 500 вон в час, 4 человека', now)).toEqual({
      date: '2026-11-14',
      start: '18:00',
      end: '23:00',
      wage: 11500,
      slots: 4,
    });
    expect(parseJobPost('Завтра нужен 1 человек', now)).toEqual({ date: '2026-11-12', slots: 1 });
  });

  it('relative days: bugun, ertaga, 내일, indinga', () => {
    expect(parseJobPost('Bugun kechqurun ish', now).date).toBe('2026-11-11');
    expect(parseJobPost('Ertaga 9:00 dan 18:00 gacha', now)).toMatchObject({ date: '2026-11-12', start: '09:00', end: '18:00' });
    expect(parseJobPost('내일 알바', now).date).toBe('2026-11-12');
    expect(parseJobPost('Indinga ish bor', now).date).toBe('2026-11-13');
  });

  it('a day already past is next year\'s; month first in Korean and with «/»', () => {
    expect(parseJobPost('3월 2일', now).date).toBe('2027-03-02');
    expect(parseJobPost('11/20 근무', now).date).toBe('2026-11-20');
    expect(parseJobPost('20.11 kuni ish', now).date).toBe('2026-11-20');
    expect(parseJobPost('2026-12-01', now).date).toBe('2026-12-01');
  });

  it('a daily pay is not taken for the hourly wage; a phone part is no wage', () => {
    expect(parseJobPost('Kunlik 100 000 won', now).wage).toBeUndefined();
    expect(parseJobPost('일당 150,000원', now).wage).toBeUndefined();
    expect(parseJobPost('Tel 010-9876-5432', now).wage).toBeUndefined();
    expect(parseJobPost('Maosh: 12000 won', now).wage).toBe(12000);
  });

  it('hours: 24 is midnight, overnight stays as written; nothing found is nothing', () => {
    expect(parseJobPost('22:00~06:00', now)).toEqual({ start: '22:00', end: '06:00' });
    expect(parseJobPost('18:00-24:00', now)).toEqual({ start: '18:00', end: '00:00' });
    expect(parseJobPost('Salom, ish bormi?', now)).toEqual({});
  });

  it('an e-mail is no Telegram handle', () => {
    expect(parseJobPost('info@hanguk.uz', now).telegram).toBeUndefined();
  });
});
