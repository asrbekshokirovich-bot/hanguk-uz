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
const RU_MONTHS = [
  'январ', 'феврал', 'март', 'апрел', 'ма[йя]', 'июн',
  'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр',
];

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
    m = text.match(new RegExp(`(\\d{1,2})\\s+${name}`, 'i'));
    if (m && validDay(i + 1, +m[1])) return nextDate(today, i + 1, +m[1]);
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
  let m = text.match(new RegExp(String.raw`(\d{1,2})[:.](\d{2})${sep}(\d{1,2})[:.](\d{2})`));
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
  return undefined;
}

const HOURLY = /시급|soat|час|hour|\/h\b/i;
const DAILY = /일당|kunlik|kuniga|в день|день|per day|daily/i;

function findWage(text: string): number | undefined {
  const money = /(\d{1,3}(?:[ ,.\u00A0]\d{3})+|\d{4,6})\s*(원|won|von|вон|₩|krw)?/gi;
  let single: number | undefined;
  let singles = 0;
  for (const m of text.matchAll(money)) {
    const value = Number(m[1].replace(/[ ,.\u00A0]/g, ''));
    if (!(value >= 9000 && value <= 60000)) continue;
    const at = m.index ?? 0;
    // A part of a phone number (010-9876-5432) is no wage.
    if (text[at - 1] === '-' || text[at + m[1].length] === '-') continue;
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
  const m = text.match(/(\d{1,2})\s*(?:명|kishi|nafar|ta\s+odam|odam|человек|чел\b|people|persons|workers)/i);
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
  return m ? `@${m[1]}` : undefined;
}

function findAddress(text: string): string | undefined {
  const m = text.match(/(?:📍|주소\s*[:：]|manzil\s*[:：]|адрес\s*[:：])\s*([^\n]+)/i);
  const line = m?.[1].trim();
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
  const link = text.match(/https?:\/\/t\.me\/[^\s)]+/i)?.[0];
  if (link) out.link = link.slice(0, 300);
  return out;
}
