/**
 * «Telegram matnidan to'ldirish» on posts written the way job groups and
 * channels write them (P46): Uzbek in Latin and Cyrillic, Russian, Korean,
 * some English, with the habits of each — «12 ming», «1만2천원», «9-18»,
 * «5 ta ishchi», «Manzili:», a t.me link to the employer. Every field is
 * checked, so a wrong guess fails as much as a miss: the staff only check
 * the form.
 */
import { describe, expect, it } from 'vitest';
import { parseJobPost, type ParsedJobPost } from '../parseJobPost';

// Wednesday 11 November 2026, 10:00 in Seoul.
const now = new Date('2026-11-11T01:00:00Z');

const corpus: [string, string, ParsedJobPost][] = [
  [
    'Uzbek: «5 ta ishchi», Telegram in brackets',
    [
      '🇰🇷 ISH BOR — Gimpo, zavod',
      'Sana: 13-noyabr (juma)',
      'Vaqt: 08:30 - 17:30',
      'Soatiga: 11 000 won',
      'Kerak: 5 ta ishchi',
      'Aloqa: 010-2345-6789 (Telegram: @gimpo_ish)',
    ].join('\n'),
    { date: '2026-11-13', start: '08:30', end: '17:30', wage: 11000, slots: 5, phone: '010-2345-6789', telegram: '@gimpo_ish' },
  ],
  [
    'Uzbek: «12 ming won», hours without a zero',
    "Ertaga ish bor! Hwaseong, qadoqlash.\n9:00 dan 18:00 gacha, soatiga 12 ming won, 3 kishi.\nMurojaat: @hwaseong_jobs",
    { date: '2026-11-12', start: '09:00', end: '18:00', wage: 12000, slots: 3, telegram: '@hwaseong_jobs' },
  ],
  [
    'Uzbek in Cyrillic: «14-ноябрь», «Соатига», «2 киши»',
    'Иш бор! Ансан, завод\n14-ноябрь, соат 09:00-18:00\nСоатига 10 800 вон\n2 киши керак\nТел: 010 3456 7890',
    { date: '2026-11-14', start: '09:00', end: '18:00', wage: 10800, slots: 2, phone: '010-3456-7890' },
  ],
  [
    'Russian: «с 9 до 18», «вон/час», the address',
    [
      'Требуются 4 человека на склад в Инчхоне.',
      'Дата: 16.11 (пн), с 9 до 18.',
      'Оплата 11 500 вон/час.',
      'Адрес: Инчхон, Намдон-гу',
      'Звонить: +82 10-4567-8901',
    ].join('\n'),
    { date: '2026-11-16', start: '09:00', end: '18:00', wage: 11500, slots: 4, address: 'Инчхон, Намдон-гу', phone: '010-4567-8901' },
  ],
  [
    'Russian: «18-го ноября», a night shift',
    'Работа на 18-го ноября, ночная смена 22:00–06:00, 13 000 вон в час. Нужно 2 человека. Пишите @night_work_kr',
    { date: '2026-11-18', start: '22:00', end: '06:00', wage: 13000, slots: 2, telegram: '@night_work_kr' },
  ],
  [
    'Korean: «근무지:», 주휴 in brackets',
    ['[급구] 물류센터 피킹 알바', '일시: 11/14(토) 08:00~17:00', '시급: 10,700원 (주휴 별도)', '인원: 6명', '근무지: 경기도 이천시 마장면', '문의: 010-5678-9012'].join('\n'),
    { date: '2026-11-14', start: '08:00', end: '17:00', wage: 10700, slots: 6, address: '경기도 이천시 마장면', phone: '010-5678-9012' },
  ],
  [
    'Korean: «시간당 1만2천원», 오후 hours',
    '내일 식당 서빙 2명 구해요. 오후 5시~오후 10시, 시간당 1만2천원. 주소: 서울 마포구 연남동 123',
    { date: '2026-11-12', start: '17:00', end: '22:00', wage: 12000, slots: 2, address: '서울 마포구 연남동 123' },
  ],
  [
    'Korean: a daily pay only — no hourly wage',
    '11월 20일 이삿짐 일당 150,000원 2명 010-6789-0123',
    { date: '2026-11-20', slots: 2, phone: '010-6789-0123' },
  ],
  [
    'Uzbek: «Ish vaqti 9-18», «Ishchi soni: 2», a t.me link to a person',
    'Bugun ish: Seul, Guro. Ish vaqti 9-18. Soatbay 11 000. Ishchi soni: 2. t.me/guro_ish_uz',
    { date: '2026-11-11', start: '09:00', end: '18:00', wage: 11000, slots: 2, telegram: '@guro_ish_uz' },
  ],
  [
    'a post link and a link to the manager',
    "Ish: https://t.me/koreajobs_uz/5678\nBog'lanish: https://t.me/ali_manager",
    { link: 'https://t.me/koreajobs_uz/5678', telegram: '@ali_manager' },
  ],
  [
    'Uzbek: «Manzili:», a dotted date',
    'Manzili: Suwon, Paldal-gu\nSana: 15.11\nSoatiga 10 900 won',
    { address: 'Suwon, Paldal-gu', date: '2026-11-15', wage: 10900 },
  ],
  [
    'Uzbek: «7 nafar», a pin before the place',
    '📍 Pyeongtaek, Samsung zavodi yonida. 7 nafar kerak. 21-noyabr, 07:00-19:00, soatiga 11 500 won. @pt_jobs',
    // The place ends at its full stop: what follows is the rest of the post.
    { address: 'Pyeongtaek, Samsung zavodi yonida', slots: 7, date: '2026-11-21', start: '07:00', end: '19:00', wage: 11500, telegram: '@pt_jobs' },
  ],
  [
    'the hourly wage, not the day\'s total',
    'Soatiga 11 000 won, kuniga 88 000 won. 25-noyabr 9:00-17:00',
    { wage: 11000, date: '2026-11-25', start: '09:00', end: '17:00' },
  ],
  [
    'English: «Nov 14», 8am-5pm, KRW/hour',
    'Factory job in Hwaseong, Nov 14, 8am-5pm, 11,000 KRW/hour, 3 people needed. Contact 010-1111-2222',
    { date: '2026-11-14', start: '08:00', end: '17:00', wage: 11000, slots: 3, phone: '010-1111-2222' },
  ],
  [
    'a deposit is no wage; an Uzbek phone',
    'Kvartira ijaraga: 500 000 won depozit. Telefon: +998 90 123 45 67',
    { phone: '+998 90 123 45 67' },
  ],
  [
    'a full date with the year, a dot as the thousands sign',
    '2026.11.25 — 10.500 won soatiga, 18:00 dan 23:00 gacha',
    { date: '2026-11-25', wage: 10500, start: '18:00', end: '23:00' },
  ],
  [
    'a lunch hour is no wage; a phone with no separators',
    'Vaqti: 9:00–18:00 (tushlik 1 soat). Tel: 01078901234',
    { start: '09:00', end: '18:00', phone: '010-7890-1234' },
  ],
  [
    'Korean: minutes in 시/분; a KakaoTalk ID is no Telegram',
    '오전 8시 30분~오후 5시 30분 근무, 시급 11,000원, 카톡 ID: abc123',
    { start: '08:30', end: '17:30', wage: 11000 },
  ],
  [
    'Uzbek: «2 yigit», «Joy:»',
    'Joy: Cheonan, Seobuk-gu\n2 yigit kerak, ertaga 8:00-17:00, soatiga 10 750 won',
    { address: 'Cheonan, Seobuk-gu', slots: 2, date: '2026-11-12', start: '08:00', end: '17:00', wage: 10750 },
  ],
  [
    'Russian: «нужны 3 девушки», «Место работы:»',
    'Нужны 3 девушки на упаковку. Место работы: Сеул, Кымчхон-гу. Сегодня с 13:00 до 22:00, 10 800 вон/час',
    { slots: 3, address: 'Сеул, Кымчхон-гу', date: '2026-11-11', start: '13:00', end: '22:00', wage: 10800 },
  ],
  [
    'Uzbek: «10,5 ming»',
    "Indinga ish bor, soatiga 10,5 ming. 6 ta odam. Qo'ng'iroq: 010-2222-3333",
    { date: '2026-11-13', wage: 10500, slots: 6, phone: '010-2222-3333' },
  ],
  [
    'Korean: «1.2만원»',
    '시급 1.2만원, 11월 28일 오전 10시~오후 4시, 3명',
    { wage: 12000, date: '2026-11-28', start: '10:00', end: '16:00', slots: 3 },
  ],
  [
    'a bare «9-18» is no time; «с 18 до 45 лет» is an age',
    'Kvartira 9-18 qavat. Возраст с 18 до 45 лет',
    {},
  ],
  [
    '«12 ming» with neither «soatiga» nor «won» is no wage; a channel is not the employer\'s Telegram',
    'Uy: 12 ming depozit, 300 ming oylik. Bizning kanal: t.me/koreajobs_uz',
    {},
  ],
  [
    'nothing to read in small talk',
    'Assalomu alaykum! Kimda ish bor? Iltimos yozinglar 🙏',
    {},
  ],
];

describe('parseJobPost on posts as job groups write them', () => {
  for (const [name, post, expected] of corpus) {
    it(name, () => {
      expect(parseJobPost(post, now)).toEqual(expected);
    });
  }
});
