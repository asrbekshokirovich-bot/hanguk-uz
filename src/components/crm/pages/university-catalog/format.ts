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

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'j', з: 'z', и: 'i',
  й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
  у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sh', ъ: '', ы: 'i', ь: '',
  э: 'e', ю: 'yu', я: 'ya', ў: 'o', қ: 'q', ғ: 'g', ҳ: 'h',
};

/** Koreyscha bitta unli turlicha yoziladi: 경 = gyeong / kyung / kyong, 대 = dae / tae. */
const VOWEL_RUNS: Record<string, string> = {
  ae: 'e', ai: 'e', ei: 'e', oe: 'e',
  eo: 'o', eu: 'o', oo: 'o', ou: 'o', eou: 'o', u: 'o',
  ee: 'i', ui: 'i', eui: 'i',
};

/** Bitta so'zning kaliti — unli birikmalari so'z chegarasidan o'tib ketmasin ("Kyung Hee" = "Kyunghee"). */
function wordKey(word: string): string {
  return word
    .replace(/sh/g, 's')
    .replace(/ch/g, 'j')
    .replace(/kh/g, 'h')
    .replace(/th/g, 't')
    .replace(/ph/g, 'p')
    .replace(/[gqc]/g, 'k')
    .replace(/d/g, 't')
    .replace(/[bf]/g, 'p')
    .replace(/v/g, 'w')
    .replace(/x/g, 'h')
    .replace(/[aeiou]+/g, (run) => VOWEL_RUNS[run] ?? run.replace(/u/g, 'o'))
    .replace(/ye/g, 'e');
}

/**
 * Lotincha (yoki kirillcha) nomning "tovush kaliti": bir xil o'qiladigan
 * yozuvlar bir xil kalitga tushadi. Kimpo, Gimpo, Kimbo, Кимпо → "kimpo";
 * Daekyung, Daekyeung → "tekyonk"; Busan, Pusan → "posan". Koreyscha
 * harflar tushib qoladi — ular oddiy qidiruvda solishtiriladi.
 */
export function romanKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? '')
    .split(/[^a-z]+/)
    .map(wordKey)
    .join('')
    .replace(/(.)\1+/g, '$1');
}

// Katalogdagi nomlar o'zgarmaydi, qidiruv esa har harfda ~1500 ta nomni
// solishtiradi (darajalar yonidagi sonlar bilan) — kalitlar bir marta hisoblanadi.
const romanKeyCache = new Map<string, string>();

function cachedRomanKey(value: string): string {
  let key = romanKeyCache.get(value);
  if (key === undefined) {
    key = romanKey(value);
    romanKeyCache.set(value, key);
  }
  return key;
}

/**
 * Qidiruv: inglizcha va koreyscha nom, shahar, domen va univ_kod bo'yicha.
 * Lotincha yozuvdagi farq xalaqit bermaydi ("kimpo" ham "Gimpo University"ni
 * topadi). Bo'sh so'rov hammasini o'tkazadi.
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

  if (haystack.some((value) => value?.toLowerCase().includes(query))) return true;

  const key = romanKey(query);
  return key.length >= 2 && haystack.some((value) => !!value && cachedRomanKey(value).includes(key));
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
 * bakalavr, ham magistratura (대학원) bor. institutions.hidden_levels'dagi
 * darajalar olib tashlanadi.
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
  // Xodim yashirgan daraja (chet ellik qabuli yo'q, faqat diniy) — Excel bo'lsa ham ko'rinmaydi.
  for (const hidden of entry.institution.hidden_levels ?? []) levels.delete(hidden as DegreeLevel);
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

/** Excel faylidan universitetni topish uchun kerak bo'lgan maydonlar. */
export interface UploadFile {
  guideline_id: string;
  univ_kod: string;
  univ_nomi_kr?: string | null;
  univ_nomi_en?: string | null;
}

/** Koreyscha nomni solishtirish uchun: bo'shliqsiz va "국립"siz (국립창원대학교 = 창원대학교). */
function koKey(name: string): string {
  return name.replace(/\s+/g, '').replace(/국립/g, '');
}

/** Inglizcha nomning asosiy qismi: "Yonsei University — Graduate School" → "Yonsei University". */
function enKey(name: string): string {
  return romanKey(name.split(/\s[—–-]\s|\s\(/)[0]);
}

/**
 * Fayldagi nom bo'yicha: avval koreyscha nom (to'liq, so'ng birinchi so'zi —
 * "전북대학교 대학원" → 전북대학교), bo'lmasa inglizcha nomning tovush kaliti.
 */
function matchByName(pool: CatalogEntry[], file: UploadFile): CatalogEntry[] {
  const ko = (file.univ_nomi_kr ?? '').trim();
  if (ko) {
    for (const candidate of [ko, ko.split(/\s+/)[0]]) {
      const key = koKey(candidate);
      const found = pool.filter((e) => koKey(e.institution.name_ko ?? '') === key);
      if (found.length > 0) return found;
    }
  }
  const en = enKey(file.univ_nomi_en ?? '');
  if (en.length >= 4) {
    return pool.filter((e) => enKey(e.institution.name_en ?? '') === en);
  }
  return [];
}

/**
 * Yuqoridagi umumiy "Excel ..." tugmasidan yuklangan fayl qaysi universitetga
 * tegishli. Import RPC'si univ_kod'ni domen prefiksi bilan solishtiradi,
 * katalogdan yashirilganlarni ham ko'radi va bir nechta mos kelsa jimgina
 * birinchisini oladi. Xodimlar esa univ_kod'ni o'zlari tuzadi ("kwu" —
 * 광운대 fayli, kwu.ac.kr esa 광주여자대), kollejlarda esa bir xil
 * prefikslar bor ("dhc": 대구보건대 va 동아보건대). Shuning uchun universitet
 * shu yerda, faqat katalogdagilar orasidan tanlanadi:
 *   1. avval yuklangan guideline qayta yuklansa — o'sha universitet;
 *   2. fayldagi universitet nomi (koreyscha, so'ng inglizcha) yagona mos kelsa — o'sha;
 *   3. univ_kod domen prefiksiga yagona mos kelsa — o'sha;
 *   4. aks holda — xato, jimgina tanlanmaydi.
 */
export function resolveUploadInstitution(entries: CatalogEntry[], file: UploadFile): UploadInstitution {
  const found = (e: CatalogEntry): UploadInstitution => ({ institutionId: e.institution.id, error: null });

  const existing = entries.find((e) => e.guidelines.some((g) => g.guideline_id === file.guideline_id));
  if (existing) return found(existing);

  const code = file.univ_kod.trim().toLowerCase();
  const byCode = entries.filter((e) => institutionCode(e.institution.primary_domain) === code);
  const byName = matchByName(entries, file);

  if (byName.length === 1) return found(byName[0]);
  // Nom bir nechtasiga mos kelsa — univ_kod ajratib bersin.
  const narrowed = byName.length > 1 ? byName.filter((e) => byCode.includes(e)) : byCode;
  if (narrowed.length === 1) return found(narrowed[0]);

  const openCard = "Kerakli universitet kartasini oching va Excel'ni o'sha yerdagi tugma orqali yuklang.";
  const candidates = byName.length > 1 ? byName : byCode;
  if (candidates.length > 1) {
    const names = candidates.map((e) => e.institution.name_ko).join(', ');
    return {
      institutionId: null,
      error: `Fayl bir nechta universitetga mos keladi: ${names}. ${openCard}`,
    };
  }
  return {
    institutionId: null,
    error: `univ_kod "${code}" va fayldagi universitet nomi bo'yicha katalogda universitet topilmadi. ${openCard}`,
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
