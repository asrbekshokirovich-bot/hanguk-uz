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
    g.daraja?.replace(/_/g, ' '), // til_kursi -> "til kursi"
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
// O'qish darajalari: bakalavr, magistr, kasbiy ta'lim, til kursi
// ---------------------------------------------------------------------------

/** Excel alohida yuklanadigan va katalogda alohida filtrlanadigan darajalar. */
export type DegreeLevel = 'bakalavr' | 'magistratura' | 'kasbiy' | 'til_kursi';

/** Filtr, karta va panel darajalarni shu tartibda ko'rsatadi. */
export const DEGREE_LEVELS: readonly { key: DegreeLevel; label: string }[] = [
  { key: 'bakalavr', label: 'Bakalavr' },
  { key: 'magistratura', label: 'Magistr' },
  { key: 'kasbiy', label: "Kasbiy ta'lim" },
  { key: 'til_kursi', label: 'Til kursi' },
];

/** "hammasi" — daraja bo'yicha ajratilmagan. */
export type LevelFilter = DegreeLevel | 'hammasi';

export function levelLabel(level: DegreeLevel): string {
  return DEGREE_LEVELS.find((l) => l.key === level)?.label ?? level;
}

/**
 * Shu darajadagi guideline'lar, eng yangisi birinchi (entry.guidelines tartibi).
 * "Barcha darajalar"da til kursi (어학당) faqat boshqa Excel bo'lmasa olinadi:
 * uning narxi term uchun va talablari boshqa, karta, filtr va saralash esa
 * universitetning o'qish darajalariga qarasin.
 */
export function guidelinesForLevel(entry: CatalogEntry, level: LevelFilter): GuidelineSummary[] {
  if (level === 'hammasi') {
    const degrees = entry.guidelines.filter((g) => g.daraja !== 'til_kursi');
    return degrees.length > 0 ? degrees : entry.guidelines;
  }
  return entry.guidelines.filter((g) => g.daraja === level);
}

/** Kartada ko'rinadigan guideline: tanlangan darajaning (yoki "Barcha darajalar"ning) eng yangisi. */
export function focusGuideline(entry: CatalogEntry, level: LevelFilter): GuidelineSummary | null {
  return guidelinesForLevel(entry, level)[0] ?? null;
}

/** Til kursi Excel'ining fakultetlar varag'ida kurslar turadi (masalan, 10 haftalik muntazam kurs). */
export function facultyNoun(daraja: string | null | undefined): { one: string; many: string } {
  return daraja === 'til_kursi' ? { one: 'kurs', many: 'kurslar' } : { one: 'fakultet', many: 'fakultetlar' };
}

/** 대학원대학교, "KDI School"ning 국제정책대학원 kabi faqat magistratura o'qitadigan oliygohlar. */
function isGraduateOnly(entry: CatalogEntry): boolean {
  const ko = entry.institution.name_ko ?? '';
  const en = entry.institution.name_en ?? '';
  return ko.includes('대학원') || /graduate (school|university)/i.test(en);
}

/** Excel'i (guideline'i) yuklangan darajalar. */
function excelLevels(entry: CatalogEntry): Set<DegreeLevel> {
  const levels = new Set<DegreeLevel>();
  for (const g of entry.guidelines) {
    if (DEGREE_LEVELS.some((l) => l.key === g.daraja)) levels.add(g.daraja as DegreeLevel);
  }
  return levels;
}

/**
 * Universitet qaysi darajalarda o'qitadi. Excel yuklangan daraja — aniq bor.
 * Qolgani oliygoh turidan: kollej (전문대학) — kasbiy ta'lim, nomida 대학원
 * bo'lgan oliygoh — faqat magistratura, qolgan 4 yillik universitetlarda ham
 * bakalavr, ham magistratura (대학원) bor. Til kursi (어학당) qaysi
 * universitetda borligi oldindan ma'lum emas — faqat Excel'i yuklanganda.
 *
 * institutions.hidden_levels'dagi darajalar olib tashlanadi — lekin Excel'i
 * yuklangan daraja emas: chet elliklar uchun guideline bor ekan, daraja bor.
 * Ro'yxat xato bo'lsa (서울장신대 magistraturasi, 2026-10-21), Excel yuklash
 * uni o'zi tuzatadi.
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
  const withExcel = excelLevels(entry);
  for (const level of withExcel) levels.add(level);
  for (const hidden of entry.institution.hidden_levels ?? []) {
    if (!withExcel.has(hidden as DegreeLevel)) levels.delete(hidden as DegreeLevel);
  }
  return DEGREE_LEVELS.map((l) => l.key).filter((key) => levels.has(key));
}

/**
 * Yashirilgan, lekin Excel'i yo'q darajalar — katalogda ko'rinmaydi. Excel
 * yuklay oladigan xodim panelda ularni "yashirilgan" belgisi bilan ko'radi:
 * ro'yxat xato bo'lsa, Excel'ni shu yerdan yuklab darajani qaytaradi.
 */
export function hiddenLevels(entry: CatalogEntry): DegreeLevel[] {
  const withExcel = excelLevels(entry);
  const hidden = new Set(entry.institution.hidden_levels ?? []);
  return DEGREE_LEVELS.map((l) => l.key).filter((key) => hidden.has(key) && !withExcel.has(key));
}

/**
 * Universitet panelidagi daraja yorliqlari. Til kursi Excel'i hali yo'q
 * universitetda ham Excel yuklay oladigan xodimga yorliq ochiq turadi —
 * birinchi faylni shu yerdan yuklaydi. Yashirilgan darajalar ham shu xodimga
 * ko'rinadi (hiddenLevels) — boshqalarga yo'q.
 */
export function panelLevels(entry: CatalogEntry, canUpload: boolean): DegreeLevel[] {
  const levels = offeredLevels(entry);
  if (!canUpload) return levels;
  if (!levels.includes('til_kursi')) levels.push('til_kursi');
  const shown = new Set([...levels, ...hiddenLevels(entry)]);
  return DEGREE_LEVELS.map((l) => l.key).filter((key) => shown.has(key));
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
