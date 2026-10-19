/**
 * Operator va admin uchun saralash paneli (egasi, 2026-10-19): talabaning
 * TOPIK / IELTS darajasi, shahar, o'qish bosqichi, yo'nalish, kontrakt
 * (arzon / qimmat), nufuz va grant bo'yicha. Sof funksiyalar — sinaladi.
 *
 * Ma'lumot: guideline xulosasi (useUniversityCatalog), fakultet nomlari va
 * grantlar (useCatalogExtras). Hammasi brauzerda hisoblanadi: katalog bir
 * necha yuz universitet, fakultetlar bir necha ming qator.
 */

import type { CatalogEntry, GuidelineSummary } from '@/hooks/useUniversityCatalog';
import { cityLabel, displayName, guidelinesForLevel, type LevelFilter } from './format';

export interface FacultyName {
  guideline_uuid: string;
  track: string | null;
  kollej_en: string | null;
  kollej_kr: string | null;
  fakultet_en: string | null;
  fakultet_kr: string | null;
  kontrakt_summa: number | null;
}

/** Universitetning grantlari (scholarships jadvali) bo'yicha xulosa. */
export interface GrantInfo {
  /** Kontraktdan eng katta chegirma, foizda (tuition_waiver_pct). */
  maxWaiverPct: number | null;
  /** Oylik stipendiya beradimi (stipend_monthly). */
  stipend: boolean;
  count: number;
}

export interface CatalogExtras {
  /** guideline id -> fakultetlar */
  faculties: Map<string, FacultyName[]>;
  /** institution id -> grant xulosasi */
  grants: Map<string, GrantInfo>;
}

export const EMPTY_EXTRAS: CatalogExtras = { faculties: new Map(), grants: new Map() };

export interface ScholarshipRow {
  institution_id: string;
  award_type: string | null;
  award_value: number | null;
}

export function summarizeGrants(rows: ScholarshipRow[]): Map<string, GrantInfo> {
  const out = new Map<string, GrantInfo>();
  for (const r of rows) {
    const info = out.get(r.institution_id) ?? { maxWaiverPct: null, stipend: false, count: 0 };
    info.count += 1;
    if (r.award_type === 'tuition_waiver_pct' && r.award_value !== null && Number.isFinite(r.award_value)) {
      info.maxWaiverPct = Math.max(info.maxWaiverPct ?? 0, Math.min(r.award_value, 100));
    }
    if (r.award_type === 'stipend_monthly') info.stipend = true;
    out.set(r.institution_id, info);
  }
  return out;
}

export function groupFaculties(rows: FacultyName[]): Map<string, FacultyName[]> {
  const out = new Map<string, FacultyName[]>();
  for (const f of rows) {
    const list = out.get(f.guideline_uuid);
    if (list) list.push(f);
    else out.set(f.guideline_uuid, [f]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Yo'nalish qidiruvi
// ---------------------------------------------------------------------------

/**
 * Fakultet nomlari Excel'da inglizcha va koreyscha. Operator esa o'zbekcha
 * yozadi ("hamshiralik", "IT") — keng tarqalgan yo'nalishlar inglizcha va
 * koreyscha so'zlarga yoyiladi. Ro'yxatda yo'q so'z o'zicha qidiriladi.
 */
const DIRECTION_SYNONYMS: { keys: string[]; terms: string[] }[] = [
  { keys: ['it', 'kompyuter', 'dasturlash', 'axborot', 'informatika'], terms: ['computer', 'software', 'information', 'data', 'artificial intelligence', ' ai ', '컴퓨터', '소프트웨어', '정보'] },
  { keys: ['hamshira', 'nursing'], terms: ['nursing', '간호'] },
  { keys: ['biznes', 'menejment', 'boshqaruv'], terms: ['business', 'management', 'administration', '경영'] },
  { keys: ['iqtisod', 'ekonom'], terms: ['economic', '경제'] },
  { keys: ['muhandis', 'injener'], terms: ['engineering', '공학'] },
  { keys: ['tibbiyot', 'medits', 'shifokor'], terms: ['medicine', 'medical', 'health', '의학', '보건'] },
  { keys: ['huquq', 'yurist'], terms: ['law', 'legal', '법'] },
  { keys: ['pedagog', "o'qituvchi", 'talim', "ta'lim"], terms: ['education', 'teaching', '교육'] },
  { keys: ['turizm', 'mehmonxona', 'otel'], terms: ['tourism', 'hotel', 'hospitality', '관광', '호텔'] },
  { keys: ['oshpaz', 'pazand', 'oziq'], terms: ['culinary', 'cooking', 'food', 'baking', '조리', '외식', '식품'] },
  { keys: ['dizayn'], terms: ['design', '디자인'] },
  { keys: ['koreys tili', 'koreys'], terms: ['korean language', 'korean studies', '한국어', '한국학'] },
  { keys: ['xalqaro', 'diplomat'], terms: ['international', '국제'] },
  { keys: ['marketing', 'reklama'], terms: ['marketing', 'advertising', '마케팅', '광고'] },
  { keys: ['psixolog'], terms: ['psychology', '심리'] },
  { keys: ['arxitekt', 'qurilish'], terms: ['architecture', 'construction', 'civil', '건축', '토목'] },
  { keys: ['kimyo'], terms: ['chemistry', 'chemical', '화학'] },
  { keys: ['matematik'], terms: ['mathematic', 'statistic', '수학', '통계'] },
  { keys: ['fizika'], terms: ['physics', '물리'] },
  { keys: ['biolog'], terms: ['biology', 'bio', '생명', '생물'] },
  { keys: ['jurnalist', 'media'], terms: ['media', 'journalism', 'communication', '미디어', '언론', '방송'] },
  { keys: ['avto', 'mashina'], terms: ['automotive', 'automobile', 'vehicle', '자동차'] },
  { keys: ['kosmetika', "go'zallik", 'gozallik'], terms: ['beauty', 'cosmetic', '뷰티', '미용', '화장품'] },
  { keys: ['logistika'], terms: ['logistics', 'trade', '물류', '무역'] },
  { keys: ['moliya', 'buxgalter', 'hisob'], terms: ['finance', 'accounting', '금융', '회계'] },
  { keys: ['sport'], terms: ['sport', 'physical education', '체육', '스포츠'] },
  { keys: ['musiqa', "san'at", 'sanat'], terms: ['music', 'art', '음악', '예술'] },
];

/** Operator yozgan so'zdan qidiriladigan so'zlar ro'yxati (kichik harfda). */
export function directionTerms(rawQuery: string): string[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  const terms = new Set<string>([query]);
  for (const group of DIRECTION_SYNONYMS) {
    // Qisqa kalit ("it") faqat aynan o'zi yozilganda: "italyan" IT emas.
    const hit = group.keys.some(
      (k) => query === k || (k.length >= 4 && (query.startsWith(k) || (query.length >= 4 && k.startsWith(query)))),
    );
    if (hit) {
      for (const t of group.terms) terms.add(t);
    }
  }
  return [...terms];
}

function facultyLabel(f: FacultyName): string {
  return f.fakultet_en?.trim() || f.fakultet_kr?.trim() || f.kollej_en?.trim() || f.kollej_kr?.trim() || '—';
}

/** Tanlangan darajadagi fakultetlardan so'rovga mos keladiganlari. */
export function matchingFaculties(
  entry: CatalogEntry,
  rawQuery: string,
  level: LevelFilter,
  extras: CatalogExtras,
): FacultyName[] {
  const terms = directionTerms(rawQuery);
  if (terms.length === 0) return [];
  const out: FacultyName[] = [];
  for (const g of guidelinesForLevel(entry, level)) {
    for (const f of extras.faculties.get(g.id) ?? []) {
      const hay = [f.fakultet_en, f.fakultet_kr, f.kollej_en, f.kollej_kr]
        .map((v) => (v ?? '').toLowerCase())
        .join(' | ');
      // " ai " kabi qisqa atamalar so'z o'rtasida topilmasin.
      const padded = ` ${hay} `;
      if (terms.some((t) => padded.includes(t))) out.push(f);
    }
  }
  return out;
}

/** Kartada: birinchi uchta mos yo'nalish nomi (takrorlanmasdan). */
export function directionNames(faculties: FacultyName[], limit = 3): { names: string[]; more: number } {
  const unique = [...new Set(faculties.map(facultyLabel))];
  return { names: unique.slice(0, limit), more: Math.max(unique.length - limit, 0) };
}

// ---------------------------------------------------------------------------
// Filtr
// ---------------------------------------------------------------------------

export interface PanelFilter {
  /** Talabaning TOPIK darajasi: shu darajagacha talab qiladiganlar. null — farqi yo'q. */
  topik: number | null;
  /** Talabaning IELTS bali: shu ballgacha talab qiladiganlar. null — farqi yo'q. */
  ielts: number | null;
  city: string | null;
  /** Yo'nalish qidiruvi (fakultet nomi). */
  direction: string;
  /** Faqat granti borlar. */
  grantOnly: boolean;
}

export const EMPTY_PANEL: PanelFilter = { topik: null, ielts: null, city: null, direction: '', grantOnly: false };

export function isPanelActive(f: PanelFilter): boolean {
  return f.topik !== null || f.ielts !== null || f.city !== null || f.direction.trim() !== '' || f.grantOnly;
}

function topikFits(g: GuidelineSummary, max: number): boolean {
  if (!(g.korean_track === true || g.topik_min !== null)) return false;
  return g.topik_min === null || g.topik_min <= max;
}

function ieltsFits(g: GuidelineSummary, max: number): boolean {
  if (!(g.english_track === true || g.ielts_min !== null)) return false;
  return g.ielts_min === null || g.ielts_min <= max;
}

/**
 * TOPIK va IELTS ikkalasi tanlansa — talabada ikkalasi bor degani, shuning
 * uchun bittasi mos kelsa yetadi. Til talabi ko'rsatilmagan, lekin shu tilda
 * o'qitadigan universitet ham mos sanaladi (kartada talab "TOPIK" deb chiqadi).
 */
export function matchesPanel(
  entry: CatalogEntry,
  f: PanelFilter,
  level: LevelFilter,
  extras: CatalogExtras,
): boolean {
  const guidelines = guidelinesForLevel(entry, level);
  if (f.topik !== null || f.ielts !== null) {
    const fits = guidelines.some(
      (g) => (f.topik !== null && topikFits(g, f.topik)) || (f.ielts !== null && ieltsFits(g, f.ielts)),
    );
    if (!fits) return false;
  }
  if (f.city && cityLabel(entry) !== f.city) return false;
  if (f.direction.trim() && matchingFaculties(entry, f.direction, level, extras).length === 0) return false;
  if (f.grantOnly && !extras.grants.has(entry.institution.id)) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Saralash
// ---------------------------------------------------------------------------

export type SortKey = 'nom' | 'arzon' | 'qimmat' | 'nufuz' | 'grant' | 'topik' | 'ielts';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'nom', label: 'Nomi bo\'yicha (A–Z)' },
  { key: 'arzon', label: 'Kontrakt: arzonidan' },
  { key: 'qimmat', label: 'Kontrakt: qimmatidan' },
  { key: 'nufuz', label: 'Nufuzlisi birinchi' },
  { key: 'grant', label: 'Granti kattasi birinchi' },
  { key: 'topik', label: 'TOPIK talabi: pastidan' },
  { key: 'ielts', label: 'IELTS talabi: pastidan' },
];

/** Taxminiy kurs: bitta USD'li guideline bor, uni KRW bilan solishtirish uchun. */
const KRW_PER_USD = 1400;

/** Narxni "bir semestr, KRW"ga keltiradi — turli valyuta va davrlar bir qatorda saralansin. */
export function perSemesterKrw(amount: number | null, g: GuidelineSummary): number | null {
  if (amount === null || amount === undefined || !Number.isFinite(amount) || amount <= 0) return null;
  const krw = g.narx_valyuta === 'USD' ? amount * KRW_PER_USD : amount;
  return g.kontrakt_davri === 'yil' ? krw / 2 : krw;
}

/**
 * Saralash uchun kontrakt: yo'nalish qidirilgan bo'lsa — mos fakultetlar
 * narxi (bor bo'lsa), aks holda guideline'ning eng arzon / eng qimmat narxi.
 */
export function contractForSort(
  entry: CatalogEntry,
  which: 'min' | 'max',
  level: LevelFilter,
  matched: FacultyName[],
): number | null {
  const guidelines = guidelinesForLevel(entry, level);
  const byId = new Map(guidelines.map((g) => [g.id, g]));
  const values: number[] = [];
  for (const f of matched) {
    const g = byId.get(f.guideline_uuid);
    const v = g ? perSemesterKrw(f.kontrakt_summa, g) : null;
    if (v !== null) values.push(v);
  }
  if (values.length === 0) {
    for (const g of guidelines) {
      const v = perSemesterKrw(which === 'min' ? g.kontrakt_min : (g.kontrakt_max ?? g.kontrakt_min), g);
      if (v !== null) values.push(v);
    }
  }
  if (values.length === 0) return null;
  return which === 'min' ? Math.min(...values) : Math.max(...values);
}

function minRequirement(entry: CatalogEntry, level: LevelFilter, key: 'topik_min' | 'ielts_min'): number | null {
  const values = guidelinesForLevel(entry, level)
    .map((g) => g[key])
    .filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  return values.length ? Math.min(...values) : null;
}

/** Saralash qiymati; null — oxiriga. Kichigi birinchi chiqadi. */
function sortValue(
  entry: CatalogEntry,
  key: SortKey,
  level: LevelFilter,
  extras: CatalogExtras,
  direction: string,
): number | null {
  switch (key) {
    case 'arzon':
    case 'qimmat': {
      const matched = direction.trim() ? matchingFaculties(entry, direction, level, extras) : [];
      const v = contractForSort(entry, key === 'arzon' ? 'min' : 'max', level, matched);
      return v === null ? null : key === 'arzon' ? v : -v;
    }
    case 'nufuz':
      return entry.institution.tier ?? null;
    case 'grant': {
      const g = extras.grants.get(entry.institution.id);
      if (!g) return null;
      // Foizli chegirma birinchi, keyin stipendiya, keyin boshqa grantlar.
      return -((g.maxWaiverPct ?? 0) * 10 + (g.stipend ? 5 : 0) + Math.min(g.count, 4));
    }
    case 'topik':
      return minRequirement(entry, level, 'topik_min');
    case 'ielts':
      return minRequirement(entry, level, 'ielts_min');
    default:
      return null;
  }
}

export function sortEntries(
  entries: CatalogEntry[],
  key: SortKey,
  level: LevelFilter,
  extras: CatalogExtras,
  direction = '',
): CatalogEntry[] {
  const byName = (a: CatalogEntry, b: CatalogEntry) =>
    displayName(a).primary.localeCompare(displayName(b).primary);
  if (key === 'nom') return [...entries].sort(byName);

  const keyed = entries.map((e) => ({ e, v: sortValue(e, key, level, extras, direction) }));
  keyed.sort((a, b) => {
    if (a.v === null && b.v === null) return byName(a.e, b.e);
    if (a.v === null) return 1;
    if (b.v === null) return -1;
    return a.v - b.v || byName(a.e, b.e);
  });
  return keyed.map((k) => k.e);
}

// ---------------------------------------------------------------------------
// Kartadagi qo'shimcha belgilar
// ---------------------------------------------------------------------------

/** institutions.tier: 1 — eng nufuzli (KAIST, Korea, Yonsei...), 4 — eng past. */
export function tierLabel(tier: number | null | undefined): string | null {
  if (tier === null || tier === undefined) return null;
  return `Nufuz: ${tier}-daraja`;
}

export function grantLabel(info: GrantInfo | undefined): string | null {
  if (!info) return null;
  if (info.maxWaiverPct) return `Grant: ${info.maxWaiverPct}% gacha`;
  if (info.stipend) return 'Grant: stipendiya';
  return 'Grant bor';
}
