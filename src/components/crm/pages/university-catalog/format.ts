/**
 * Katalog kartasidagi matnlar — sof funksiyalar, shuning uchun sinaladi.
 *
 * Ma'lumot ikki manbadan keladi: institutions (koreyscha nom, 시/도) va
 * yuklangan guideline Excel'i (inglizcha nom, shahar, narx, til talabi).
 * Guideline aniqroq bo'lgani uchun ustun turadi; u bo'lmasa institutions'dan
 * bor narsa ko'rsatiladi.
 */

import type { CatalogEntry, GuidelineSummary } from '@/hooks/useUniversityCatalog';

const CURRENCY_SIGN: Record<string, string> = { KRW: '₩', USD: '$' };

/** 2016000, "KRW" -> "₩2,016,000" */
export function formatMoney(value: number | null | undefined, currency: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const sign = CURRENCY_SIGN[currency ?? ''] ?? '';
  const amount = Math.round(value).toLocaleString('en-US');
  return sign ? `${sign}${amount}` : `${amount} ${currency ?? ''}`.trim();
}

const PERIOD_LABEL: Record<string, string> = {
  semestr: 'semestr',
  term: 'term',
  yil: 'yil',
};

export function periodLabel(period: string | null | undefined): string | null {
  if (!period) return null;
  return PERIOD_LABEL[period] ?? period;
}

/**
 * Kontrakt oralig'i: eng arzon va eng qimmat fakultet. Bitta narx bo'lsa —
 * bitta son. Hech qanday fakultet narxi bo'lmasa — null.
 */
export function contractRange(g: GuidelineSummary | null): string | null {
  if (!g || g.kontrakt_min === null || g.kontrakt_min === undefined) return null;
  const min = formatMoney(g.kontrakt_min, g.narx_valyuta);
  if (g.kontrakt_max === null || g.kontrakt_max === g.kontrakt_min) return min;
  // Oraliqda valyuta belgisini takrorlamaymiz: ₩2,016,000–2,779,000
  const max = formatMoney(g.kontrakt_max, g.narx_valyuta).replace(
    CURRENCY_SIGN[g.narx_valyuta ?? ''] ?? '',
    '',
  );
  return `${min}–${max}`;
}

export interface LanguageBadge {
  key: 'topik' | 'ielts' | 'toefl';
  label: string;
}

/**
 * "TOPIK yoki IELTS bilan qabul" — kartada aynan shu ko'rinadi.
 * Ball ko'rsatilmagan bo'lsa, track bor ekani ham o'zi ma'lumot.
 */
export function languageBadges(g: GuidelineSummary | null): LanguageBadge[] {
  if (!g) return [];
  const out: LanguageBadge[] = [];

  if (g.korean_track || g.topik_min !== null) {
    out.push({ key: 'topik', label: g.topik_min !== null ? `TOPIK ${g.topik_min}` : 'TOPIK' });
  }
  if (g.english_track || g.ielts_min !== null) {
    out.push({ key: 'ielts', label: g.ielts_min !== null ? `IELTS ${g.ielts_min}` : 'IELTS' });
  }
  if (g.toefl_ibt_min !== null && g.toefl_ibt_min !== undefined) {
    out.push({ key: 'toefl', label: `TOEFL ${g.toefl_ibt_min}` });
  }
  return out;
}

/** Guideline'dagi inglizcha shahar aniqroq; bo'lmasa institutions'dagi 시/도. */
export function cityLabel(entry: CatalogEntry): string | null {
  const fromGuideline = entry.latest?.shahar?.trim();
  if (fromGuideline) return fromGuideline;
  const fromInstitution = entry.institution.city_ko?.trim();
  return fromInstitution || null;
}

export interface DisplayName {
  primary: string;
  secondary: string | null;
}

/** Kartada: yuqorida inglizcha nom, pastida koreyscha (yoki teskarisi). */
export function displayName(entry: CatalogEntry): DisplayName {
  const en = entry.latest?.univ_nomi_en?.trim() || entry.institution.name_en?.trim() || '';
  const ko = entry.latest?.univ_nomi_kr?.trim() || entry.institution.name_ko?.trim() || '';
  if (en && ko) return { primary: en, secondary: ko };
  return { primary: en || ko || '—', secondary: null };
}

/** jbnu.ac.kr -> jbnu (Excel'dagi univ_kod bilan bir xil qoida). */
export function institutionCode(domain: string): string {
  return (domain ?? '').split('.')[0]?.toLowerCase() ?? '';
}

export function admissionLabel(g: GuidelineSummary | null): string | null {
  if (!g) return null;
  const parts = [
    g.qabul_yili ? String(g.qabul_yili) : null,
    g.semestr === 'bahor' ? 'bahor' : g.semestr === 'kuz' ? 'kuz' : g.semestr,
    g.daraja,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

/**
 * Qidiruv: inglizcha va koreyscha nom, shahar, domen va univ_kod bo'yicha.
 * Bo'sh so'rov hammasini o'tkazadi.
 */
export function matchesSearch(entry: CatalogEntry, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (query === '') return true;

  const haystack: (string | null | undefined)[] = [
    entry.institution.name_en,
    entry.institution.name_ko,
    entry.institution.name_ko_short,
    entry.institution.city_ko,
    entry.institution.region_code,
    entry.institution.primary_domain,
    institutionCode(entry.institution.primary_domain),
  ];
  for (const g of entry.guidelines) {
    haystack.push(g.univ_nomi_en, g.univ_nomi_kr, g.shahar, g.kampus, g.univ_kod, g.guideline_id);
  }

  return haystack.some((value) => value?.toLowerCase().includes(query));
}

// ---------------------------------------------------------------------------
// O'qish darajalari: bakalavr, magistr, kasbiy ta'lim
// ---------------------------------------------------------------------------

/** Excel alohida yuklanadigan va katalogda alohida filtrlanadigan darajalar. */
export type DegreeLevel = 'bakalavr' | 'magistratura' | 'kasbiy';

/** Filtr, karta va panel darajalarni shu tartibda ko'rsatadi. */
export const DEGREE_LEVELS: readonly { key: DegreeLevel; label: string }[] = [
  { key: 'bakalavr', label: 'Bakalavr' },
  { key: 'magistratura', label: 'Magistr' },
  { key: 'kasbiy', label: "Kasbiy ta'lim" },
];

/** "hammasi" — daraja bo'yicha ajratilmagan. */
export type LevelFilter = DegreeLevel | 'hammasi';

export function levelLabel(level: DegreeLevel): string {
  return DEGREE_LEVELS.find((l) => l.key === level)?.label ?? level;
}

/** Shu darajadagi guideline'lar, eng yangisi birinchi (entry.guidelines tartibi). */
export function guidelinesForLevel(entry: CatalogEntry, level: LevelFilter): GuidelineSummary[] {
  if (level === 'hammasi') return entry.guidelines;
  return entry.guidelines.filter((g) => g.daraja === level);
}

/** Kartada ko'rinadigan guideline: tanlangan darajaning eng yangisi, aks holda umumiy eng yangisi. */
export function focusGuideline(entry: CatalogEntry, level: LevelFilter): GuidelineSummary | null {
  if (level === 'hammasi') return entry.latest;
  return guidelinesForLevel(entry, level)[0] ?? null;
}

/** 대학원대학교, "KDI School"ning 국제정책대학원 kabi faqat magistratura o'qitadigan oliygohlar. */
function isGraduateOnly(entry: CatalogEntry): boolean {
  const ko = entry.institution.name_ko ?? '';
  const en = entry.institution.name_en ?? '';
  return ko.includes('대학원') || /graduate (school|university)/i.test(en);
}

/**
 * Universitet qaysi darajalarda o'qitadi. Excel yuklangan daraja — aniq bor.
 * Qolgani oliygoh turidan: kollej (전문대학) — kasbiy ta'lim, nomida 대학원
 * bo'lgan oliygoh — faqat magistratura, qolgan 4 yillik universitetlarda ham
 * bakalavr, ham magistratura (대학원) bor.
 */
export function offeredLevels(entry: CatalogEntry): DegreeLevel[] {
  const levels = new Set<DegreeLevel>();
  if (entry.institution.institution_type === 'junior_college') {
    levels.add('kasbiy');
  } else if (isGraduateOnly(entry)) {
    levels.add('magistratura');
  } else {
    levels.add('bakalavr');
    levels.add('magistratura');
  }
  for (const g of entry.guidelines) {
    if (DEGREE_LEVELS.some((l) => l.key === g.daraja)) levels.add(g.daraja as DegreeLevel);
  }
  return DEGREE_LEVELS.map((l) => l.key).filter((key) => levels.has(key));
}

export function matchesLevel(entry: CatalogEntry, level: LevelFilter): boolean {
  return level === 'hammasi' || offeredLevels(entry).includes(level);
}

export type CatalogFilter = 'hammasi' | 'malumotli' | 'topik' | 'ielts' | 'hamkor';

/**
 * Daraja tanlangan bo'lsa, ma'lumotga bog'liq filtrlar faqat o'sha darajaning
 * Excel'iga qaraydi: "Magistr" + "Ma'lumotli" — magistratura Excel'i yuklanganlar.
 */
export function matchesFilter(
  entry: CatalogEntry,
  filter: CatalogFilter,
  level: LevelFilter = 'hammasi',
): boolean {
  const guidelines = guidelinesForLevel(entry, level);
  switch (filter) {
    case 'malumotli':
      return guidelines.length > 0;
    case 'topik':
      return guidelines.some((g) => g.korean_track === true || g.topik_min !== null);
    case 'ielts':
      return guidelines.some((g) => g.english_track === true || g.ielts_min !== null);
    case 'hamkor':
      return entry.institution.is_partner;
    default:
      return true;
  }
}

/**
 * Operator ko'rinishi (egasining qoidasi, 2026-10-01): operator faqat
 * ma'lumotli universitetlarni ko'radi va ularni TOPIK, IELTS va shahar bo'yicha
 * ajratadi. TOPIK va IELTS yoqilsa — ikkalasi ham bo'lishi shart; shahar —
 * universitetning asosiy shahri (cityLabel). Daraja tanlansa — faqat shu
 * darajaning Excel'i yuklanganlar.
 */
export interface OperatorFilter {
  topik: boolean;
  ielts: boolean;
  city: string | null;
}

export function matchesOperatorFilter(
  entry: CatalogEntry,
  f: OperatorFilter,
  level: LevelFilter = 'hammasi',
): boolean {
  if (guidelinesForLevel(entry, level).length === 0) return false;
  if (f.topik && !matchesFilter(entry, 'topik', level)) return false;
  if (f.ielts && !matchesFilter(entry, 'ielts', level)) return false;
  if (f.city && cityLabel(entry) !== f.city) return false;
  return true;
}

/** Topilsa — institutionId; topilmasa yoki aniq bo'lmasa — xodimga ko'rsatiladigan error. */
export interface UploadInstitution {
  institutionId: string | null;
  error: string | null;
}

/**
 * Yuqoridagi umumiy "Excel ..." tugmasidan yuklangan fayl qaysi universitetga
 * tegishli. Import RPC'si ham univ_kod (domen prefiksi) bo'yicha qidiradi,
 * lekin katalogdan yashirilganlarni ham ko'radi va bir nechta mos kelsa
 * jimgina birinchisini oladi — kollejlarda bunday prefikslar bor ("dhc":
 * 대구보건대 va 동아보건대). Shuning uchun universitet shu yerda, faqat
 * katalogdagilar orasidan tanlanadi. Avval yuklangan guideline qayta
 * yuklansa — o'sha universitetida qoladi.
 */
export function resolveUploadInstitution(
  entries: CatalogEntry[],
  file: { guideline_id: string; univ_kod: string },
): UploadInstitution {
  const existing = entries.find((e) => e.guidelines.some((g) => g.guideline_id === file.guideline_id));
  if (existing) return { institutionId: existing.institution.id, error: null };

  const code = file.univ_kod.trim().toLowerCase();
  const matches = entries.filter((e) => institutionCode(e.institution.primary_domain) === code);
  if (matches.length === 1) return { institutionId: matches[0].institution.id, error: null };
  if (matches.length === 0) {
    return {
      institutionId: null,
      error: `univ_kod "${code}" bo'yicha katalogda universitet topilmadi. univ_kod universitet domenining birinchi qismi bo'lishi kerak (jbnu.ac.kr → jbnu).`,
    };
  }
  const names = matches.map((e) => e.institution.name_ko).join(', ');
  return {
    institutionId: null,
    error: `univ_kod "${code}" bir nechta universitetga mos keladi: ${names}. Kerakli universitet kartasini oching va Excel'ni o'sha yerdagi tugma orqali yuklang.`,
  };
}

/** Shahar ro'yxati: ma'lumotli universitetlarning asosiy shaharlari, alifbo tartibida. */
export function operatorCities(entries: CatalogEntry[]): string[] {
  const cities = new Set<string>();
  for (const e of entries) {
    if (e.guidelines.length === 0) continue;
    const city = cityLabel(e);
    if (city) cities.add(city);
  }
  return [...cities].sort((a, b) => a.localeCompare(b));
}
