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

export type CatalogFilter = 'hammasi' | 'malumotli' | 'topik' | 'ielts' | 'hamkor';

export function matchesFilter(entry: CatalogEntry, filter: CatalogFilter): boolean {
  switch (filter) {
    case 'malumotli':
      return entry.guidelines.length > 0;
    case 'topik':
      return entry.guidelines.some((g) => g.korean_track === true || g.topik_min !== null);
    case 'ielts':
      return entry.guidelines.some((g) => g.english_track === true || g.ielts_min !== null);
    case 'hamkor':
      return entry.institution.is_partner;
    default:
      return true;
  }
}
