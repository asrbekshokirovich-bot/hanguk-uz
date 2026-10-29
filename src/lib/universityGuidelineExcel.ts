/**
 * Universitet guideline Excel'i — o'qish va tekshirish.
 *
 * Sayt faqat HANGUK guideline shablonining 4-versiyasini qabul qiladi
 * (egasi, 2026-10-29): boshqa jadval, o'zgartirilgan shablon yoki eski
 * (v2/v3) fayl qatorlari o'qilmaydi — xodim shablonga ko'chirib qayta yuklaydi.
 *
 * Shablon xodimlar tomonidan qo'lda to'ldiriladi, shuning uchun bu yerdagi
 * asosiy ish — xatoni saytga emas, xodimga qaytarish: qaysi varaq, qaysi
 * qator, qaysi ustun. Fayl to'g'ri bo'lsa, natija to'g'ridan-to'g'ri
 * import_university_guideline() RPC'siga yuboriladigan JSON bo'ladi.
 *
 * Qoidalar manbai — faylning "qollanma" varag'i:
 *   - 5 ta majburiy varaq: universitet, muddatlar, fakultetlar, hujjatlar,
 *     grantlar; "qollanma" — faqat odam uchun; boshqa varaq bo'lmaydi
 *   - 1-qator sarlavha — shablondagi ustunlar, xuddi o'sha tartibda;
 *     ma'lumot 2-qatordan
 *   - universitet.format_versiya = 4
 *   - muddatlar: har bir bosqichda 11 ta etap, nomlari qollanmadagidek
 *   - bo'sh katak = "guideline'da ko'rsatilmagan" (NULL), "yoq" = aniq yo'q
 *   - sanalar YYYY-MM-DD matn, vaqt HH:MM matn, pul va ballar — raqam
 *   - universitet varag'ida doim 1 qator; bitta fayl = bitta guideline_id
 */

import { readXlsx } from './xlsxReader';
import { buildGrantImport, type GrantImport } from './universityGuidelineGrants';

/** Sayt qabul qiladigan yagona format: HANGUK shabloni v4 (grantlar varag'i bilan). */
export const SUPPORTED_FORMAT_VERSION = 4;

/** Shablondagi ma'lumot varaqlari — hammasi majburiy. */
export const GUIDELINE_SHEETS = ['universitet', 'muddatlar', 'fakultetlar', 'hujjatlar', 'grantlar'] as const;
export type GuidelineSheet = (typeof GUIDELINE_SHEETS)[number];
/** Shablondagi yo'riqnoma — faqat odam uchun, sayt o'qimaydi. */
const GUIDE_SHEET = 'qollanma';
/** Xatoda ko'rsatiladigan shablon nomi va uni yuklab olish manzili (public/templates). */
export const TEMPLATE_NAME = 'HANGUK guideline shabloni (v4)';
export const TEMPLATE_URL = '/templates/universitet-guideline-shablon.xlsx';

type ColType = 'matn' | 'raqam' | 'butun' | 'sana' | 'vaqt' | 'tanlov' | 'bool';

interface ColSpec {
  readonly name: string;
  readonly type: ColType;
  readonly required?: boolean;
  readonly choices?: readonly string[];
  /** Xodimlar yozadigan boshqa nomlar → rasmiy qiymat ("kollej" → "kasbiy"). */
  readonly aliases?: Readonly<Record<string, string>>;
  readonly min?: number;
  readonly max?: number;
}

const c = (name: string, type: ColType = 'matn', extra: Omit<ColSpec, 'name' | 'type'> = {}): ColSpec =>
  ({ name, type, ...extra });

// yoz va qish — faqat til kursi termlari (여름학기 — iyun, 겨울학기 — dekabr).
export const SEMESTRLAR = ['bahor', 'yoz', 'kuz', 'qish'] as const;
const FAQAT_TIL_KURSI_SEMESTRLARI = ['yoz', 'qish'];
// kasbiy — kasbiy ta'lim (전문대학, 전문학사), til_kursi — til kursi (어학당).
export const DARAJALAR = ['bakalavr', 'transfer', 'magistratura', 'doktorantura', 'til_kursi', 'kasbiy'] as const;
/** Kasbiy ta'lim va til kursi fayllarida daraja turlicha yoziladi — rasmiy qiymatga o'giriladi. */
const DARAJA_ALIASES: Readonly<Record<string, string>> = {
  kollej: 'kasbiy',
  college: 'kasbiy',
  kasbiy_talim: 'kasbiy',
  "kasbiy ta'lim": 'kasbiy',
  kasbiy_ta_lim: 'kasbiy',
  junior_college: 'kasbiy',
  '전문대학': 'kasbiy',
  '전문학사': 'kasbiy',
  'til kursi': 'til_kursi',
  'til-kursi': 'til_kursi',
  tilkursi: 'til_kursi',
  'language course': 'til_kursi',
  'language program': 'til_kursi',
  'korean language course': 'til_kursi',
  'korean language program': 'til_kursi',
  '어학당': 'til_kursi',
  '어학연수': 'til_kursi',
  '한국어연수': 'til_kursi',
  '한국어 연수': 'til_kursi',
  '한국어연수과정': 'til_kursi',
};
const VALYUTALAR = ['KRW', 'USD'] as const;
const TRACKLAR = ['english', 'korean'] as const;
const HOLATLAR = ['tasdiqlangan', 'taxminiy', 'nisbiy', 'keyin_elon', 'etap_yoq'] as const;

/** grantlar.mezon_turi — grant nimaga qarab beriladi (qollanma varag'i). */
export const MEZON_TURLARI = [
  'topik', 'ielts', 'toefl_ibt', 'toeic', 'teps', 'cefr', 'duolingo', 'til_kursi', 'gpa', 'reyting', 'hammaga', 'boshqa',
] as const;
export const GRANT_NIMAGA = ['kontrakt', 'kirish_tolovi', 'kontrakt_va_kirish', 'yotoqxona', 'naqd', 'boshqa'] as const;
export const GRANT_DAVRLARI = [
  'birinchi_semestr', 'birinchi_yil', 'har_semestr', 'har_oy', 'butun_oqish', 'bir_martalik',
] as const;

/** muddatlar.etap_nomi uchun qat'iy ro'yxat — qollanma varag'idagi 11 ta etap. */
export const ETAPLAR = [
  'Online hujjat topshirish',
  "Application fee to'lash",
  'Offline hujjat topshirish',
  'Bank statement (universitet uchun)',
  'Intervyu',
  "Natija e'lon qilinishi",
  "Kontrakt to'lash",
  'Certificate of Admission berilishi',
  'Viza uchun bank statement',
  'Viza uchun tarjima va apostil',
  'Vizaga hujjat topshirish',
] as const;

const SCHEMA: Record<GuidelineSheet, readonly ColSpec[]> = {
  universitet: [
    c('guideline_id', 'matn', { required: true }),
    c('univ_kod', 'matn', { required: true }),
    c('univ_nomi_en'),
    c('univ_nomi_kr'),
    c('kampus'),
    c('shahar'),
    c('qabul_yili', 'butun', { min: 2000, max: 2100 }),
    c('semestr', 'tanlov', { choices: SEMESTRLAR }),
    c('daraja', 'tanlov', { choices: DARAJALAR, aliases: DARAJA_ALIASES }),
    c('guideline_sarlavha'),
    c('guideline_fayl'),
    c('ariza_sayti'),
    c('ariza_tolovi', 'raqam', { min: 0 }),
    c('ariza_tolovi_valyuta', 'tanlov', { choices: VALYUTALAR }),
    c('ariza_tolovi_usuli'),
    c('bank_summa', 'raqam', { min: 0 }),
    c('bank_valyuta', 'tanlov', { choices: VALYUTALAR }),
    c('bank_saqlash_muddati'),
    c('bank_turi', 'tanlov', { choices: ['faqat_kdb', 'istalgan_bank', 'belgilangan_banklar'] }),
    c('bank_vaqti', 'tanlov', {
      choices: ['intervyudan_oldin', 'intervyudan_keyin', 'ikkalasi', 'intervyu_yoq'],
    }),
    c('bank_izoh'),
    c('english_track', 'bool'),
    c('korean_track', 'bool'),
    c('topik_min', 'raqam', { min: 1, max: 6 }),
    c('ielts_min', 'raqam', { min: 0, max: 9 }),
    c('toefl_ibt_min', 'raqam', { min: 0, max: 120 }),
    c('til_izoh'),
    c('tavsiyanoma', 'tanlov', { choices: ['ha', 'yoq', 'ixtiyoriy'] }),
    c('tavsiyanoma_izoh'),
    c('narx_valyuta', 'tanlov', { choices: VALYUTALAR }),
    c('kirish_tolovi', 'raqam', { min: 0 }),
    c('io_manzil_en'),
    c('io_manzil_kr'),
    c('io_zip'),
    c('io_telefon'),
    c('io_email'),
    c('hujjat_yuborish_manzili'),
    c('sahifalar'),
    c('izoh'),
    c('tahlil_sanasi', 'sana'),
    c('format_versiya', 'butun', { required: true, min: 1 }),
  ],
  muddatlar: [
    c('guideline_id', 'matn', { required: true }),
    c('bosqich', 'butun', { required: true, min: 1 }),
    c('etap_raqam', 'butun', { required: true, min: 1, max: 11 }),
    c('etap_nomi', 'matn', { required: true }),
    c('boshlanish_sana', 'sana'),
    c('boshlanish_vaqt', 'vaqt'),
    c('tugash_sana', 'sana'),
    c('tugash_vaqt', 'vaqt'),
    c('holat', 'tanlov', { choices: HOLATLAR }),
    c('izoh'),
    c('sahifa'),
  ],
  fakultetlar: [
    c('guideline_id', 'matn', { required: true }),
    c('track', 'tanlov', { choices: TRACKLAR }),
    c('kollej_en'),
    c('kollej_kr'),
    c('fakultet_en'),
    c('fakultet_kr'),
    c('topik_min', 'raqam', { min: 1, max: 6 }),
    c('ielts_min', 'raqam', { min: 0, max: 9 }),
    c('toefl_ibt_min', 'raqam', { min: 0, max: 120 }),
    c('til_izoh'),
    c('kontrakt_summa', 'raqam', { min: 0 }),
    c('kontrakt_davri', 'tanlov', { choices: ['semestr', 'term', 'yil'] }),
    c('kontrakt_izoh'),
    c('izoh'),
    c('sahifa'),
  ],
  hujjatlar: [
    c('guideline_id', 'matn', { required: true }),
    c('tartib', 'butun', { min: 1 }),
    c('etap_raqam', 'butun', { min: 1, max: 11 }),
    c('hujjat_nomi'),
    c('hujjat_nomi_asl'),
    c('kimlar_uchun'),
    c('majburiy', 'tanlov', { choices: ['ha', 'ixtiyoriy', 'shartli'] }),
    c('shakli'),
    c('apostil', 'tanlov', { choices: ['ha', 'yoq'] }),
    c('notarial_tarjima', 'tanlov', { choices: ['ha', 'yoq'] }),
    c('muddat', 'sana'),
    c('muddat_turi', 'tanlov', { choices: ['yetib_borishi', 'jonatilishi'] }),
    c('izoh'),
    c('sahifa'),
  ],
  grantlar: [
    c('guideline_id', 'matn', { required: true }),
    c('tartib', 'butun', { min: 1 }),
    c('grant_nomi'),
    c('grant_nomi_asl'),
    c('track', 'tanlov', { choices: [...TRACKLAR, 'hammasi'] }),
    c('qamrov'),
    c('mezon_turi', 'tanlov', { choices: MEZON_TURLARI }),
    c('mezon_min', 'raqam', { min: 0 }),
    c('mezon_max', 'raqam', { min: 0 }),
    c('mezon_matn'),
    c('grant_foiz', 'raqam', { min: 0, max: 100 }),
    c('grant_summa', 'raqam', { min: 0 }),
    c('grant_valyuta', 'tanlov', { choices: VALYUTALAR }),
    c('nimaga', 'tanlov', { choices: GRANT_NIMAGA }),
    c('davr', 'tanlov', { choices: GRANT_DAVRLARI }),
    c('davom_sharti'),
    c('qoshiladi', 'tanlov', { choices: ['ha', 'yoq'] }),
    c('izoh'),
    c('sahifa'),
  ],
};

/** Har bir varaqning shablondagi ustunlari — xuddi shu tartibda bo'lishi shart. */
const columnNames = (sheet: GuidelineSheet): readonly string[] => SCHEMA[sheet].map((spec) => spec.name);
export const TEMPLATE_COLUMNS: Readonly<Record<GuidelineSheet, readonly string[]>> = {
  universitet: columnNames('universitet'),
  muddatlar: columnNames('muddatlar'),
  fakultetlar: columnNames('fakultetlar'),
  hujjatlar: columnNames('hujjatlar'),
  grantlar: columnNames('grantlar'),
};

export type CellValue = string | number | boolean;
export type GuidelineRow = Record<string, CellValue>;

export interface GuidelinePayload {
  fayl_nomi: string;
  universitet: GuidelineRow;
  muddatlar: GuidelineRow[];
  fakultetlar: GuidelineRow[];
  hujjatlar: GuidelineRow[];
  /**
   * grantlar varag'ida qator bo'lsa — guideline'ning grantlari shu bilan to'liq
   * almashtiriladi; varaq bo'sh bo'lsa — bazadagi grantlarga tegilmaydi.
   */
  grantlar?: GrantImport;
}

export interface ParseResult {
  ok: boolean;
  /** ok bo'lsa — RPC'ga yuboriladigan JSON. */
  payload: GuidelinePayload | null;
  /** Import to'xtatadigan xatolar. */
  errors: string[];
  /** Import'ga xalaqit bermaydigan, lekin ko'rsatishga arziydigan holatlar. */
  warnings: string[];
  /** Fayl shablon formatida emas (varaq, ustun yoki versiya) — xodimga shablonni berish kerak. */
  notTemplate?: boolean;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

/** Excel seriya raqamini (1900 tizimi) ISO sanaga o'giradi. */
function serialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial <= 0 || serial > 2958465) return null;
  // Excel 1900-ni kabisa yili deb hisoblaydi — 1899-12-30 dan sanaymiz.
  const ms = Math.round(serial) * 86400000;
  const d = new Date(Date.UTC(1899, 11, 30) + ms);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

function parseNumber(raw: string): number | null {
  // Xodim "16 000 000" yoki "16,000,000" deb yozib qo'yishi mumkin.
  const cleaned = raw.replace(/[\s\u00a0]/g, '').replace(/,/g, '');
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

interface CoerceOutcome {
  value?: CellValue;
  error?: string;
}

function coerce(spec: ColSpec, raw: string): CoerceOutcome {
  const text = raw.trim();
  if (text === '') return {}; // bo'sh katak — NULL, tekshirilmaydi

  switch (spec.type) {
    case 'matn':
      return { value: text };

    case 'bool': {
      const low = text.toLowerCase();
      if (low === 'ha' || low === 'true' || low === '1') return { value: true };
      if (low === 'yoq' || low === "yo'q" || low === 'false' || low === '0') return { value: false };
      return { error: `"${text}" — "ha" yoki "yoq" bo'lishi kerak` };
    }

    case 'tanlov': {
      const choices = spec.choices ?? [];
      if (choices.includes(text)) return { value: text };
      const ci = choices.find((o) => o.toLowerCase() === text.toLowerCase());
      if (ci) return { value: ci };
      const alias = spec.aliases?.[text.toLowerCase().replace(/[ʻʼ‘’`]/g, "'")];
      if (alias) return { value: alias };
      return { error: `"${text}" — ruxsat etilgan qiymatlar: ${choices.join(', ')}` };
    }

    case 'raqam':
    case 'butun': {
      const n = parseNumber(text);
      if (n === null) return { error: `"${text}" — raqam emas` };
      if (spec.type === 'butun' && !Number.isInteger(n)) {
        return { error: `"${text}" — butun son bo'lishi kerak` };
      }
      if (spec.min !== undefined && n < spec.min) {
        return { error: `${n} — eng kichik qiymat ${spec.min}` };
      }
      if (spec.max !== undefined && n > spec.max) {
        return { error: `${n} — eng katta qiymat ${spec.max}` };
      }
      return { value: n };
    }

    case 'sana': {
      if (DATE_RE.test(text)) {
        const d = new Date(`${text}T00:00:00Z`);
        if (Number.isNaN(d.getTime()) || !d.toISOString().startsWith(text)) {
          return { error: `"${text}" — mavjud bo'lmagan sana` };
        }
        return { value: text };
      }
      // Katak sana formatida bo'lsa Excel raqam saqlaydi — uni ham qabul qilamiz.
      const serial = parseNumber(text);
      const iso = serial === null ? null : serialToIso(serial);
      if (iso) return { value: iso };
      return { error: `"${text}" — sana YYYY-MM-DD ko'rinishida bo'lsin` };
    }

    case 'vaqt': {
      if (TIME_RE.test(text)) {
        const [h, m] = text.split(':').map((p) => Number.parseInt(p, 10));
        if (h > 23 || m > 59) return { error: `"${text}" — noto'g'ri vaqt` };
        return { value: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
      }
      return { error: `"${text}" — vaqt HH:MM ko'rinishida bo'lsin` };
    }

    default:
      return { value: text };
  }
}

/** Sarlavha qatorini ustun nomi -> indeks jadvaliga aylantiradi. */
function headerMap(row: string[] | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < (row?.length ?? 0); i += 1) {
    const name = (row?.[i] ?? '').trim();
    if (name && !map.has(name)) map.set(name, i);
  }
  return map;
}

function isBlankRow(row: string[] | undefined): boolean {
  return !row || row.every((cell) => (cell ?? '').trim() === '');
}

/** Sarlavha qatori oxiridagi bo'sh kataklarsiz (Excel ularni ham saqlab qo'yadi). */
function headerNames(row: string[] | undefined): string[] {
  const names = (row ?? []).map((cell) => (cell ?? '').trim());
  while (names.length > 0 && names[names.length - 1] === '') names.pop();
  return names;
}

/**
 * Fayl shablon formatidami: varaqlar va har bir varaqning ustunlari
 * shablondagidek — nomi ham, tartibi ham. Mos kelmasa — qatorlar o'qilmaydi:
 * boshqa jadvaldan bir nechta ustun tasodifan mos kelib qolsa ham, ma'lumot
 * aralashib ketmasin.
 */
function checkTemplate(sheets: Map<string, string[][]>): string[] {
  const errors: string[] = [];

  const missingSheets = GUIDELINE_SHEETS.filter((name) => !sheets.has(name));
  if (missingSheets.length > 0) errors.push(`Faylda varaq yetishmaydi: ${missingSheets.join(', ')}`);
  const known = new Set<string>([...GUIDELINE_SHEETS, GUIDE_SHEET]);
  const unknownSheets = [...sheets.keys()].filter((name) => !known.has(name));
  if (unknownSheets.length > 0) {
    errors.push(`Shablonda yo'q varaq: ${unknownSheets.join(', ')} — o'chirib, qayta yuklang`);
  }

  for (const sheet of GUIDELINE_SHEETS) {
    const rows = sheets.get(sheet);
    if (!rows) continue;
    const expected = TEMPLATE_COLUMNS[sheet];
    const actual = headerNames(rows[0]);

    const missing = expected.filter((name) => !actual.includes(name));
    const extra = actual
      .map((name, i) => (expected.includes(name) ? null : name || `${i + 1}-ustun (nomsiz)`))
      .filter((name): name is string => name !== null);
    if (missing.length > 0) errors.push(`"${sheet}" varag'ida ustun yetishmaydi: ${missing.join(', ')}`);
    if (extra.length > 0) errors.push(`"${sheet}" varag'ida shablonda yo'q ustun: ${extra.join(', ')}`);
    if (missing.length === 0 && extra.length === 0) {
      const i = expected.findIndex((name, idx) => actual[idx] !== name);
      if (i >= 0 || actual.length !== expected.length) {
        const at = i >= 0 ? i : expected.length;
        errors.push(
          `"${sheet}" varag'ida ustunlar tartibi shablondagidek emas: ${at + 1}-ustun ` +
            `"${expected[at] ?? '—'}" bo'lishi kerak, faylda "${actual[at] ?? '—'}"`,
        );
      }
    }
  }
  return errors;
}

function readSheetRows(sheet: GuidelineSheet, rows: string[][], errors: string[]): GuidelineRow[] {
  const specs = SCHEMA[sheet];
  // Ustunlar checkTemplate'da tekshirilgan — shablondagidek, shu tartibda.
  const header = headerMap(rows[0]);

  const out: GuidelineRow[] = [];
  for (let r = 1; r < rows.length; r += 1) {
    if (isBlankRow(rows[r])) continue;
    const excelRow = r + 1; // xodim Excel'da ko'radigan raqam
    const record: GuidelineRow = {};

    for (const spec of specs) {
      const raw = rows[r][header.get(spec.name) as number] ?? '';
      const { value, error } = coerce(spec, raw);
      if (error) {
        errors.push(`${sheet} ${excelRow}-qator, ${spec.name}: ${error}`);
        continue;
      }
      if (value !== undefined) record[spec.name] = value;
      else if (spec.required) {
        errors.push(`${sheet} ${excelRow}-qator: "${spec.name}" to'ldirilmagan`);
      }
    }
    out.push(record);
  }
  return out;
}

/** muddatlar varag'i qollanmadagidek: har bir bosqichda 11 ta etap, nomlari ro'yxatdagidek. */
function checkRounds(rounds: GuidelineRow[], errors: string[]): void {
  const byStage = new Map<number, Set<number>>();
  for (const row of rounds) {
    const stage = row.bosqich as number;
    const step = row.etap_raqam as number;
    if (!byStage.has(stage)) byStage.set(stage, new Set());
    byStage.get(stage)?.add(step);

    const expected = ETAPLAR[step - 1];
    if (expected && row.etap_nomi !== expected) {
      errors.push(
        `muddatlar: ${stage}-bosqich ${step}-etap nomi "${row.etap_nomi}" — shablonda "${expected}"`,
      );
    }
  }
  for (const [stage, steps] of byStage) {
    if (steps.size !== ETAPLAR.length) {
      errors.push(
        `muddatlar: ${stage}-bosqichda ${steps.size} ta etap bor, shablon bo'yicha ${ETAPLAR.length} ta bo'lishi kerak`,
      );
    }
  }
}

// Summa katagi bo'sh qolib, narx faqat izohda yozilgan fayllar bor
// ("1-kurs: taxminan 5,090,000–5,530,000 KRW ..."). Katalog narxni faqat
// kontrakt_summa'dan oladi, shuning uchun bunday qatorlarda izohdagi birinchi
// summani olamiz — boshqa universitetlarda ham 1-kurs, 1-semestr narxi yoziladi.
const NOTE_AMOUNT_RE = /\d{1,3}(?:[,\s\u00a0]\d{3})+|\d{6,}/;
// Stipendiya summasi kontrakt narxi emas (masalan, KAIST izohi).
const NOT_TUITION_RE = /stipend|scholarship|장학/i;
const MIN_TUITION = 100000;

export function contractFromNote(note: string): number | null {
  if (NOT_TUITION_RE.test(note)) return null;
  const match = note.match(NOTE_AMOUNT_RE);
  if (!match) return null;
  const n = parseNumber(match[0]);
  return n !== null && n >= MIN_TUITION ? n : null;
}

function fillContractFromNotes(fakultetlar: GuidelineRow[], warnings: string[]): void {
  let filled = 0;
  for (const row of fakultetlar) {
    if (row.kontrakt_summa !== undefined || typeof row.kontrakt_izoh !== 'string') continue;
    const n = contractFromNote(row.kontrakt_izoh);
    if (n === null) continue;
    row.kontrakt_summa = n;
    filled += 1;
  }
  if (filled > 0) {
    warnings.push(
      `fakultetlar: ${filled} ta qatorda kontrakt_summa bo'sh edi — narx kontrakt_izoh'dagi birinchi summadan olindi`,
    );
  }
}

/**
 * Guideline Excel faylini o'qiydi va import uchun JSON tayyorlaydi.
 * Xato bo'lsa `ok: false` va `errors` to'ladi — payload yuborilmaydi.
 */
export async function parseGuidelineWorkbook(
  data: ArrayBuffer | Uint8Array,
  faylNomi: string,
): Promise<ParseResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  let sheets: Map<string, string[][]>;
  try {
    sheets = await readXlsx(data);
  } catch (err) {
    return {
      ok: false,
      payload: null,
      errors: [err instanceof Error ? err.message : String(err)],
      warnings,
    };
  }

  const templateErrors = checkTemplate(sheets);
  if (templateErrors.length > 0) {
    return { ok: false, payload: null, errors: templateErrors, warnings, notTemplate: true };
  }

  const universitetRows = readSheetRows('universitet', sheets.get('universitet') ?? [], errors);
  const muddatlar = readSheetRows('muddatlar', sheets.get('muddatlar') ?? [], errors);
  const fakultetlar = readSheetRows('fakultetlar', sheets.get('fakultetlar') ?? [], errors);
  const hujjatlar = readSheetRows('hujjatlar', sheets.get('hujjatlar') ?? [], errors);
  const grantRows = readSheetRows('grantlar', sheets.get('grantlar') ?? [], errors);

  if (universitetRows.length === 0) {
    errors.push("universitet varag'i bo'sh — bitta ma'lumot qatori bo'lishi kerak");
  } else if (universitetRows.length > 1) {
    errors.push(
      `universitet varag'ida ${universitetRows.length} qator bor — bitta fayl = bitta guideline`,
    );
  }

  const universitet = universitetRows[0];
  let wrongVersion = false;
  if (universitet) {
    // Bo'sh bo'lsa "to'ldirilmagan" xatosi readSheetRows'da chiqqan.
    const version = universitet.format_versiya as number | undefined;
    if (version !== SUPPORTED_FORMAT_VERSION) {
      wrongVersion = true;
      if (version !== undefined) {
        errors.push(
          `universitet 2-qator, format_versiya: ${version} — sayt faqat ${SUPPORTED_FORMAT_VERSION}-versiyani qabul qiladi`,
        );
      }
    }

    // Bolalar varaqlari boshqa guideline'dan ko'chirib qo'yilgan bo'lsa,
    // import jim ravishda aralash ma'lumot yozib yuborardi.
    const gid = universitet.guideline_id;
    const mismatched = (
      [
        ['muddatlar', muddatlar],
        ['fakultetlar', fakultetlar],
        ['hujjatlar', hujjatlar],
        ['grantlar', grantRows],
      ] as const
    ).filter(([, rows]) => rows.some((row) => row.guideline_id !== gid));
    for (const [sheet] of mismatched) {
      errors.push(`"${sheet}" varag'ida boshqa guideline_id bor — "${gid}" bo'lishi kerak`);
    }

    // Bakalavr, magistr va kollejlar bahor yoki kuzda qabul qiladi — yoz/qish
    // boshqa darajada yozilgan bo'lsa, bu xato.
    const semestr = universitet.semestr as string | undefined;
    if (semestr && FAQAT_TIL_KURSI_SEMESTRLARI.includes(semestr) && universitet.daraja !== 'til_kursi') {
      errors.push(
        `universitet 2-qator, semestr: "${semestr}" faqat til kursi uchun (daraja = til_kursi) — boshqa darajalar bahor yoki kuzda qabul qiladi`,
      );
    }
  }

  checkRounds(muddatlar, errors);
  fillContractFromNotes(fakultetlar, warnings);
  const grantlar = buildGrantImport(grantRows, faylNomi, errors, warnings);

  if (errors.length > 0 || !universitet) {
    return { ok: false, payload: null, errors, warnings, ...(wrongVersion ? { notTemplate: true } : {}) };
  }

  return {
    ok: true,
    payload: {
      fayl_nomi: faylNomi,
      universitet,
      muddatlar,
      fakultetlar,
      hujjatlar,
      ...(grantlar ? { grantlar } : {}),
    },
    errors,
    warnings,
  };
}
