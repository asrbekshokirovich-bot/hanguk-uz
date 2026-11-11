/**
 * «Telegram matnidan to'ldirish»: what can be read off a job post copied from
 * a Telegram group or channel (Uzbek, Russian or Korean): the day, the hours,
 * the hourly wage, how many people, the employer's phone and Telegram, the
 * address, the post's link. Only what is clearly there is filled; the staff
 * check the form, and the whole post goes into the job's notes.
 */
import { addDays, seoulToday } from './time';

export interface ParsedJobPost {
  date?: string;
  start?: string;
  end?: string;
  wage?: number;
  slots?: number;
  phone?: string;
  telegram?: string;
  address?: string;
  link?: string;
}

const UZ_MONTHS = [
  'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
  'iyul', 'avgust', 'sent(?:y)?abr', 'okt(?:y)?abr', 'noyabr', 'dekabr',
];
// Russian, and Uzbek in Cyrillic («14-ноябрь»).
const RU_MONTHS = [
  'январ', 'феврал', 'март', 'апрел', 'ма[йя]', 'июн',
  'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр',
];
const EN_MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const pad = (n: number) => String(n).padStart(2, '0');

function validDay(month: number, day: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

/** The next [month]/[day] from [today] (this year, or next if it is past). */
function nextDate(today: string, month: number, day: number): string {
  const year = Number(today.slice(0, 4));
  const thisYear = `${year}-${pad(month)}-${pad(day)}`;
  // A post about yesterday is still this year's; older ones are next year's.
  return thisYear >= addDays(today, -1) ? thisYear : `${year + 1}-${pad(month)}-${pad(day)}`;
}

function findDate(text: string, today: string): string | undefined {
  const korean = /[가-힣]/.test(text);
  let m = text.match(/\b(20\d{2})[-./](\d{1,2})[-./](\d{1,2})\b/);
  if (m && validDay(+m[2], +m[3])) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = text.match(/(\d{1,2})\s*월\s*(\d{1,2})\s*일/);
  if (m && validDay(+m[1], +m[2])) return nextDate(today, +m[1], +m[2]);
  for (const [i, name] of UZ_MONTHS.entries()) {
    m = text.match(new RegExp(`(\\d{1,2})\\s*[-–]?\\s*${name}`, 'i'));
    if (m && validDay(i + 1, +m[1])) return nextDate(today, i + 1, +m[1]);
  }
  for (const [i, name] of RU_MONTHS.entries()) {
    m = text.match(new RegExp(`(\\d{1,2})(?:-?го)?\\s*[-–]?\\s*${name}`, 'i'));
    if (m && validDay(i + 1, +m[1])) return nextDate(today, i + 1, +m[1]);
  }
  for (const [i, name] of EN_MONTHS.entries()) {
    m = text.match(new RegExp(`\\b${name}[a-z]*\\.?\\s+(\\d{1,2})\\b|\\b(\\d{1,2})\\s+${name}[a-z]*\\b`, 'i'));
    const day = m ? +(m[1] ?? m[2]) : NaN;
    if (m && validDay(i + 1, day)) return nextDate(today, i + 1, day);
  }
  // 11/12 or 12.11 next to no clock time: Korean posts write month first.
  for (const found of text.matchAll(/(?<![\d:])(\d{1,2})([./])(\d{1,2})(?![\d:])/g)) {
    const [a, b] = [+found[1], +found[3]];
    const [month, day] = korean || found[2] === '/' ? [a, b] : [b, a];
    if (validDay(month, day)) return nextDate(today, month, day);
  }
  if (/(?:^|[^\p{L}])(?:indinga|послезавтра|모레)(?![\p{L}])/iu.test(text)) return addDays(today, 2);
  if (/(?:^|[^\p{L}])(?:ertaga|завтра|tomorrow|내일)(?![\p{L}])/iu.test(text)) return addDays(today, 1);
  if (/(?:^|[^\p{L}])(?:bugun|сегодня|today|오늘)(?![\p{L}])/iu.test(text)) return today;
  return undefined;
}

function clock(hour: number, minute = 0, half?: string): string | undefined {
  let h = hour;
  if (half === '오후' && h < 12) h += 12;
  if (half === '오전' && h === 12) h = 0;
  if (h > 24 || minute > 59) return undefined;
  return `${pad(h === 24 ? 0 : h)}:${pad(minute)}`;
}

function findHours(text: string): { start: string; end: string } | undefined {
  const sep = String.raw`\s*(?:-|–|—|~|dan|до|to|부터)\s*`;
  // Not a piece of a date («2026.11.25») or of a sum («10.500 won»).
  let m = text.match(new RegExp(String.raw`(?<![\d.])(\d{1,2})[:.](\d{2})${sep}(\d{1,2})[:.](\d{2})(?![\d.]\d|\d)`));
  if (m) {
    const start = clock(+m[1], +m[2]);
    const end = clock(+m[3], +m[4]);
    if (start && end) return { start, end };
  }
  m = text.match(new RegExp(String.raw`(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?${sep}(오전|오후)?\s*(\d{1,2})\s*시(?:\s*(\d{1,2})\s*분)?`));
  if (m) {
    const start = clock(+m[2], m[3] ? +m[3] : 0, m[1]);
    const end = clock(+m[5], m[6] ? +m[6] : 0, m[4] ?? (m[1] === '오후' ? '오후' : undefined));
    if (start && end) return { start, end };
  }
  // 8am-5pm, 8:30 am – 5 pm.
  m = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s*(?:-|–|—|~|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (m) {
    const h12 = (h: number, half: string) => (h % 12) + (half.toLowerCase() === 'pm' ? 12 : 0);
    const start = clock(h12(+m[1], m[3]), m[2] ? +m[2] : 0);
    const end = clock(h12(+m[4], m[6]), m[5] ? +m[5] : 0);
    if (start && end) return { start, end };
  }
  // Whole hours: «с 9 до 18», «9 dan 18 gacha», and «Ish vaqti: 9-18» (only
  // after a word for the time: a bare «9-18» may be anything).
  m =
    text.match(/(?:^|[^\p{L}])с\s*(\d{1,2})\s*до\s*(\d{1,2})(?![\d:]|\.\d|\s*(?:лет|год))/iu) ??
    text.match(/(?<![\d:])(\d{1,2})\s*dan\s*(\d{1,2})\s*gacha/i) ??
    text.match(/(?:vaqt\w*|время|время работы|시간|soat|соат)\s*[:：]?\s*(\d{1,2})\s*(?:-|–|—|~)\s*(\d{1,2})(?![\d:]|\.\d)/iu);
  if (m) {
    const start = clock(+m[1]);
    const end = clock(+m[2]);
    if (start && end && +m[1] <= 24 && +m[2] <= 24) return { start, end };
  }
  return undefined;
}

const HOURLY = /시급|시간당|soat|соат|час|hour|\/h\b/i;
const DAILY = /일당|kunlik|kuniga|кунлик|кунига|в день|день|per day|daily/i;

/** «12 ming», «10,5 ming» (Uzbek thousands); «1만2천원», «1.2만원» (Korean). */
function wordAmounts(text: string): { value: number; at: number; length: number }[] {
  const found: { value: number; at: number; length: number }[] = [];
  for (const m of text.matchAll(/(\d{1,2}(?:[.,]\d)?)\s*(?:ming|минг)\b/gi)) {
    found.push({ value: Math.round(Number(m[1].replace(',', '.')) * 1000), at: m.index ?? 0, length: m[0].length });
  }
  for (const m of text.matchAll(/(\d(?:\.\d)?)\s*만\s*(?:(\d)\s*천)?\s*원?/g)) {
    const value = Math.round(Number(m[1]) * 10000) + (m[2] ? Number(m[2]) * 1000 : 0);
    found.push({ value, at: m.index ?? 0, length: m[0].length });
  }
  return found;
}

function findWage(text: string): number | undefined {
  const money = /(\d{1,3}(?:[ ,.\u00A0]\d{3})+|\d{4,6})\s*(원|won|von|вон|₩|krw)?/gi;
  let single: number | undefined;
  let singles = 0;
  for (const w of wordAmounts(text)) {
    if (!(w.value >= 9000 && w.value <= 60000)) continue;
    const around = text.slice(Math.max(0, w.at - 24), w.at + w.length + 16);
    if (DAILY.test(around) && !HOURLY.test(around)) continue;
    if (HOURLY.test(around)) return w.value;
    // Without «soatiga» only with its currency («12 ming won», «1만2천원»).
    if (/^\s*(?:원|won|von|вон|₩|krw)/i.test(text.slice(w.at + w.length)) || /원$/.test(text.slice(w.at, w.at + w.length))) {
      singles++;
      single = w.value;
    }
  }
  for (const m of text.matchAll(money)) {
    const value = Number(m[1].replace(/[ ,.\u00A0]/g, ''));
    if (!(value >= 9000 && value <= 60000)) continue;
    const at = m.index ?? 0;
    // A part of a phone number (010-9876-5432, 010 3456 7890) is no wage.
    if (text[at - 1] === '-' || text[at + m[1].length] === '-' || m[1].startsWith('0')) continue;
    const around = text.slice(Math.max(0, at - 24), at + m[0].length + 16);
    if (DAILY.test(around) && !HOURLY.test(around)) continue;
    if (HOURLY.test(around)) return value;
    if (m[2]) {
      singles++;
      single = value;
    }
  }
  return singles === 1 ? single : undefined;
}

function findSlots(text: string): number | undefined {
  const m =
    text.match(
      /(\d{1,2})\s*(?:명|(?:ta\s+)?(?:kishi|odam|ishchi|yigit|qiz|ayol|erkak)|nafar|киши|нафар|(?:та\s+)?ишчи|человек|чел\b|девуш\p{L}*|парн\p{L}*|мужчин\p{L}*|женщин\p{L}*|people|persons|workers)/iu,
    ) ?? text.match(/(?:ishchi\s+soni|kerakli\s+odam|кол-?во(?:\s+человек)?|количество(?:\s+человек)?)\s*[:：]\s*(\d{1,2})\b/iu);
  const n = m ? Number(m[1]) : NaN;
  return n >= 1 && n <= 50 ? n : undefined;
}

function findPhone(text: string): string | undefined {
  const kr = text.match(/(?:\+?82[\s-]?|\b)0?1([016789])[\s.-]?(\d{3,4})[\s.-]?(\d{4})\b/);
  if (kr) return `01${kr[1]}-${kr[2]}-${kr[3]}`;
  const other = text.match(/\+\d[\d\s-]{7,16}\d/);
  return other ? other[0].replace(/\s+/g, ' ') : undefined;
}

function findTelegram(text: string): string | undefined {
  const m = text.match(/(?<![\w.@/])@([A-Za-z][A-Za-z0-9_]{3,31})\b/);
  if (m) return `@${m[1]}`;
  // t.me/ali_manager is a person; t.me/koreajobs_uz/5678 is a post.
  for (const person of text.matchAll(/(?:https?:\/\/)?t\.me\/([A-Za-z][A-Za-z0-9_]{3,31})(?![\w/])/gi)) {
    const before = text.slice(Math.max(0, (person.index ?? 0) - 24), person.index ?? 0);
    if (/kanal|канал|channel|guruh|группа|group|채널/i.test(before)) continue;
    return `@${person[1]}`;
  }
  return undefined;
}

const ADDRESS_LABEL = String.raw`(?:주소|근무지|위치|manzil(?:i)?|joy(?:i)?|адрес(?:\s+работы)?|место(?:\s+работы)?|address|location)\s*[:：]`;

function findAddress(text: string): string | undefined {
  const m = text.match(new RegExp(String.raw`(?:📍\s*(?:${ADDRESS_LABEL})?|(?:^|[\s(])${ADDRESS_LABEL})\s*([^\n]+)`, 'imu'));
  // A sentence after the place («… Gu. 7 nafar kerak») is not the address.
  const line = m?.[1].split(/\.\s/u)[0].replace(/\.$/u, '').trim();
  return line ? line.slice(0, 200) : undefined;
}

export function parseJobPost(text: string, now: Date = new Date()): ParsedJobPost {
  const today = seoulToday(now);
  const out: ParsedJobPost = {};
  const hours = findHours(text);
  if (hours) Object.assign(out, hours);
  const date = findDate(text, today);
  if (date) out.date = date;
  const wage = findWage(text);
  if (wage) out.wage = wage;
  const slots = findSlots(text);
  if (slots) out.slots = slots;
  const phone = findPhone(text);
  if (phone) out.phone = phone;
  const telegram = findTelegram(text);
  if (telegram) out.telegram = telegram;
  const address = findAddress(text);
  if (address) out.address = address;
  const link = text.match(/https?:\/\/t\.me\/[^\s)/]+\/\d+[^\s)]*/i)?.[0];
  if (link) out.link = link.slice(0, 300);
  return out;
}
