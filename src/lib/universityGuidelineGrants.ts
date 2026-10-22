/**
 * Guideline Excel'ining "grantlar" varag'i (format v4) — tekshirish va
 * university_guideline_grants jadvaliga mos qoidalarga o'girish.
 *
 * Excel'da har bir daraja alohida qator: "TOPIK 4 → 50%", "IELTS 6.5 → 70%".
 * Bazadagi jadval esa 2026-10-21 da qo'lda o'qilgan guideline'lar uchun
 * yaratilgan (mezon "TOPIK" / "IELTS" / "boshqa", topik_min / ielts_min ...).
 * CRM'dagi "Grantlar" bo'limi ham, ilovadagi grant hisobi (app_grant_tiers)
 * ham shu ustunlardan o'qiydi — shuning uchun Excel qatori aynan shu shaklga
 * keltiriladi. Guideline qatoridagi xulosa (grant_holat, grant_min/max) ham
 * shu yerda hisoblanadi.
 */

import type { GuidelineRow } from './universityGuidelineExcel';

export type GrantQachon = 'kirishda' | 'oqish_davomida';
export type GrantHolat = 'kirishda' | 'oqish_davomida' | 'aniq_emas' | 'tilga_bogliq_emas' | 'malumot_yoq';

/** university_guideline_grants qatori (id va guideline_uuid'siz). */
export interface GrantRule {
  tartib: number;
  qachon: GrantQachon;
  nomi: string | null;
  kimlar_uchun: string | null;
  /** "TOPIK" | "IELTS" | "TOEFL" | "boshqa" */
  mezon: string;
  /** Excel'dagi mezon_turi aynan: topik, ielts, gpa, hammaga ... */
  mezon_turi: string;
  talab: string | null;
  topik_min: number | null;
  topik_max: number | null;
  ielts_min: number | null;
  toefl_ibt_min: number | null;
  boshqa_test: string | null;
  grant_foiz: number | null;
  /** Foiz / summa nimadan: "kontrakt", "kirish to'lovi" ... */
  grant_asosi: string | null;
  grant_summa: number | null;
  grant_valyuta: string | null;
  grant_qoshimcha: string | null;
  /** Excel'dagi nimaga qiymati aynan: kontrakt, kirish_tolovi, naqd ... */
  nimaga: string | null;
  muddat: string | null;
  davom_shart: string | null;
  sahifa: string | null;
  /** Guideline'dagi asl nomi (grant_nomi_asl). */
  iqtibos: string | null;
  manba: string;
}

/** university_guidelines.grant_* xulosasi. */
export interface GrantSummary {
  grant_holat: GrantHolat;
  grant_min: number | null;
  grant_max: number | null;
  grant_boshqa: string | null;
  grant_manba: string;
}

export interface GrantImport {
  xulosa: GrantSummary;
  qoidalar: GrantRule[];
}

/** Ball bilan o'lchanadigan mezonlar — mezon_min majburiy, chegaralar bilan. */
const SCORE_RANGE: Readonly<Record<string, readonly [number, number]>> = {
  topik: [1, 6],
  ielts: [0, 9],
  toefl_ibt: [0, 120],
  toeic: [0, 990],
  teps: [0, 600],
  duolingo: [0, 160],
  til_kursi: [0, 10],
  gpa: [0, 4.5],
};
/** Raqam emas, matn bilan beriladigan mezonlar — mezon_matn majburiy. */
const TEXT_MEZON = new Set(['cefr', 'reyting']);
/** TOPIK / IELTS / TOEFL'dan boshqa til sertifikatlari — "aniq_emas" xulosasi uchun. */
const OTHER_LANGUAGE = new Set(['toeic', 'teps', 'cefr', 'duolingo', 'til_kursi']);

/** Bazadagi mezon: ilova faqat TOPIK / IELTS'ni hisoblaydi, qolgani "boshqa". */
const MEZON: Readonly<Record<string, string>> = { topik: 'TOPIK', ielts: 'IELTS', toefl_ibt: 'TOEFL' };

const TYPE_LABEL: Readonly<Record<string, string>> = {
  topik: 'TOPIK',
  ielts: 'IELTS',
  toefl_ibt: 'TOEFL iBT',
  toeic: 'TOEIC',
  teps: 'TEPS',
  cefr: 'CEFR',
  duolingo: 'Duolingo',
  til_kursi: 'Til kursi darajasi',
  gpa: 'GPA',
  reyting: 'Reyting',
  hammaga: 'Barcha qabul qilinganlarga',
  boshqa: 'Boshqa shart',
};

const NIMAGA_LABEL: Readonly<Record<string, string>> = {
  kontrakt: 'kontrakt',
  kirish_tolovi: "kirish to'lovi",
  kontrakt_va_kirish: "kontrakt va kirish to'lovi",
  yotoqxona: 'yotoqxona',
  naqd: 'naqd stipendiya',
  boshqa: 'boshqa',
};

const DAVR_LABEL: Readonly<Record<string, string>> = {
  birinchi_semestr: '1-semestr',
  birinchi_yil: '1-yil',
  har_semestr: 'har semestr',
  har_oy: 'har oy',
  butun_oqish: "butun o'qish davomida",
  bir_martalik: 'bir martalik',
};

/** Kartadagi foizlar oralig'iga kiradigan foizlar — butun kontraktdan. */
const TUITION_NIMAGA = new Set(['kontrakt', 'kontrakt_va_kirish']);

const normalize = (text: string): string =>
  text.trim().toLowerCase().replace(/[ʻʼ‘’`]/g, "'").replace(/\s+/g, ' ').replace(/\.$/, '');

/** "Guideline'da yo'q." — guideline'da grant umuman yo'q (qollanma, 6-qoida). */
const isNoGrantRow = (row: GuidelineRow): boolean =>
  typeof row.grant_nomi === 'string' && normalize(row.grant_nomi) === "guideline'da yo'q";

/** "Guideline'da summa yo'q." bilan boshlangan izoh — grant bor, summasi yozilmagan. */
const NO_AMOUNT_RE = /^guideline'da summa yo'q/;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** 4 → "4+", 4..4 → "4", 3.5..3.99 → "3.5–3.99" */
function rangeText(min: number | null, max: number | null): string {
  if (min === null) return max === null ? '' : `${max} gacha`;
  if (max === null) return `${min}+`;
  return min === max ? `${min}` : `${min}–${max}`;
}

function audience(row: GuidelineRow): string | null {
  const parts: string[] = [];
  if (row.track === 'korean') parts.push('Korean track');
  if (row.track === 'english') parts.push('English track');
  const qamrov = str(row.qamrov);
  if (qamrov && !/^hammasi\b/i.test(qamrov)) parts.push(qamrov);
  return parts.length > 0 ? parts.join(' — ') : null;
}

function toRule(row: GuidelineRow, tartib: number, faylNomi: string): GrantRule {
  const turi = row.mezon_turi as string;
  const min = num(row.mezon_min);
  const max = num(row.mezon_max);
  const matn = str(row.mezon_matn);
  const mezon = MEZON[turi] ?? 'boshqa';
  const scoreText = min !== null || max !== null ? `${TYPE_LABEL[turi]} ${rangeText(min, max)}` : null;
  const qoshiladi =
    row.qoshiladi === 'ha'
      ? 'Boshqa grantlar bilan birga beriladi.'
      : row.qoshiladi === 'yoq'
        ? 'Boshqa grantlar bilan birga berilmaydi.'
        : null;
  const nimaga = str(row.nimaga);

  return {
    tartib,
    // GPA bo'yicha grantlar — keyingi semestrlar uchun (qollanma, 5-qoida).
    qachon: turi === 'gpa' ? 'oqish_davomida' : 'kirishda',
    nomi: str(row.grant_nomi),
    kimlar_uchun: audience(row),
    mezon,
    mezon_turi: turi,
    talab: matn ?? scoreText,
    topik_min: turi === 'topik' ? min : null,
    topik_max: turi === 'topik' ? max : null,
    ielts_min: turi === 'ielts' ? min : null,
    toefl_ibt_min: turi === 'toefl_ibt' ? min : null,
    boshqa_test: mezon === 'boshqa' ? (matn ?? scoreText ?? TYPE_LABEL[turi]) : null,
    grant_foiz: num(row.grant_foiz),
    grant_asosi: nimaga ? NIMAGA_LABEL[nimaga] : null,
    grant_summa: num(row.grant_summa),
    grant_valyuta: str(row.grant_valyuta),
    grant_qoshimcha: [str(row.izoh), qoshiladi].filter((t): t is string => t !== null).join(' ') || null,
    nimaga,
    muddat: typeof row.davr === 'string' ? DAVR_LABEL[row.davr] : null,
    davom_shart: str(row.davom_sharti),
    sahifa: row.sahifa === undefined ? null : String(row.sahifa),
    iqtibos: str(row.grant_nomi_asl),
    manba: faylNomi,
  };
}

/** Bitta qatorni qollanma qoidalari bo'yicha tekshiradi. */
function checkRow(row: GuidelineRow, where: string, errors: string[], warnings: string[]): void {
  const turi = row.mezon_turi as string | undefined;
  if (!turi) {
    errors.push(`${where}: "mezon_turi" to'ldirilmagan`);
    return;
  }
  const min = num(row.mezon_min);
  const max = num(row.mezon_max);

  const range = SCORE_RANGE[turi];
  if (range) {
    const [lo, hi] = range;
    if (min === null) errors.push(`${where}: ${turi} uchun "mezon_min" (ball) majburiy`);
    for (const [name, v] of [['mezon_min', min], ['mezon_max', max]] as const) {
      if (v !== null && (v < lo || v > hi)) errors.push(`${where}, ${name}: ${v} — ${turi} uchun ${lo}–${hi}`);
    }
  }
  if (min !== null && max !== null && max < min) {
    errors.push(`${where}: mezon_max (${max}) mezon_min (${min}) dan kichik`);
  }
  if (TEXT_MEZON.has(turi) && !str(row.mezon_matn)) {
    errors.push(`${where}: ${turi} uchun "mezon_matn" majburiy`);
  }
  if (num(row.grant_summa) !== null && !str(row.grant_valyuta)) {
    errors.push(`${where}: grant_summa bor, lekin "grant_valyuta" to'ldirilmagan`);
  }
  if (num(row.grant_foiz) === null && num(row.grant_summa) === null) {
    const izoh = str(row.izoh);
    if (!izoh || !NO_AMOUNT_RE.test(normalize(izoh))) {
      warnings.push(
        `${where}: grant_foiz ham, grant_summa ham yo'q — summa guideline'da bo'lmasa, izoh "Guideline'da summa yo'q." bilan boshlansin`,
      );
    }
  }
}

function summarize(rules: GrantRule[], faylNomi: string): GrantSummary {
  const manba = `Excel: ${faylNomi}`;
  const table = rules.filter((r) => r.mezon !== 'boshqa');
  const entry = table.filter((r) => r.qachon === 'kirishda');

  let holat: GrantHolat;
  if (rules.length === 0) holat = 'malumot_yoq';
  else if (entry.length > 0) holat = 'kirishda';
  else if (table.length > 0) holat = 'oqish_davomida';
  else if (rules.some((r) => OTHER_LANGUAGE.has(r.mezon_turi))) holat = 'aniq_emas';
  else holat = 'tilga_bogliq_emas';

  // Oraliqqa faqat kirishdagi, butun kontraktdan foizlar (yoki nimaga
  // ko'rsatilmagan foizlar) kiradi — kirish to'lovi, yotoqxona va naqd
  // stipendiya kontrakt chegirmasi emas.
  const pcts = entry
    .filter((r) => r.grant_foiz !== null && (r.nimaga === null || TUITION_NIMAGA.has(r.nimaga)))
    .map((r) => r.grant_foiz as number);

  const other = [...new Set(rules.filter((r) => r.mezon === 'boshqa').map((r) => r.nomi).filter(Boolean))];

  return {
    grant_holat: holat,
    grant_min: pcts.length > 0 ? Math.min(...pcts) : null,
    grant_max: pcts.length > 0 ? Math.max(...pcts) : null,
    grant_boshqa: other.length > 0 ? other.join('; ') : null,
    grant_manba: manba,
  };
}

/**
 * grantlar varag'i qatorlaridan import uchun qoidalar va xulosa.
 * Varaq bo'sh bo'lsa — undefined: bazadagi grantlarga tegilmaydi.
 */
export function buildGrantImport(
  rows: GuidelineRow[],
  faylNomi: string,
  errors: string[],
  warnings: string[],
): GrantImport | undefined {
  if (rows.length === 0) {
    warnings.push(
      "grantlar varag'i bo'sh — bazadagi grantlar o'zgarmadi. Guideline'da grant bo'lmasa, bitta qator yozing: grant_nomi \"Guideline'da yo'q.\"",
    );
    return undefined;
  }

  const noGrant = rows.filter(isNoGrantRow);
  const real = rows.filter((r) => !isNoGrantRow(r));
  if (noGrant.length > 0 && real.length > 0) {
    warnings.push(`grantlar: "Guideline'da yo'q." qatori boshqa grantlar bilan birga — u e'tiborsiz qoldirildi`);
  }

  const seen = new Set<number>();
  const rules: GrantRule[] = [];
  real.forEach((row, i) => {
    const tartib = typeof row.tartib === 'number' ? row.tartib : i + 1;
    const where = `grantlar, tartib ${tartib}${str(row.grant_nomi) ? ` ("${str(row.grant_nomi)}")` : ''}`;
    if (seen.has(tartib)) warnings.push(`grantlar: tartib ${tartib} bir necha qatorda takrorlangan`);
    seen.add(tartib);

    const before = errors.length;
    checkRow(row, where, errors, warnings);
    if (errors.length > before) return;

    rules.push(toRule(row, tartib, faylNomi));
  });

  return { xulosa: summarize(rules, faylNomi), qoidalar: rules };
}
