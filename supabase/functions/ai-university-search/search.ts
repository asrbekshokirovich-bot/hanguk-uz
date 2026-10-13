// Pure search logic for `ai-university-search`: no network, no Deno APIs, so it
// can be unit-tested (search_test.ts) and read in one sitting.
//
// The split of work is deliberate. The language model only turns a student's
// sentence into a small structured `Intent` (city, fee ceiling, TOPIK, field of
// study ...). The universities themselves are then found and ranked here, over
// the catalogue rows the app already shows. The model never sees the catalogue
// and so cannot invent a university, and a request stays a few hundred tokens.

export type Degree = "bakalavr" | "magistratura";

export interface Intent {
  /**
   * The field of study as English stems ("engineer", "comput", "business")
   * and Korean words ("공학", "컴퓨터"): a third of the faculties are named in
   * Korean only.
   */
  keywords: string[];
  /** English city / province names ("Seoul", "Daejeon"). */
  cities: string[];
  /** A university name (any script) when the student is looking for one. */
  name: string | null;
  degree: Degree | null;
  /** Highest tuition per semester the student accepts, in KRW. */
  maxTuitionKrw: number | null;
  /** The TOPIK level the student has: show what asks for at most this. */
  topikMax: number | null;
  type: "national" | "private" | null;
  englishOnly: boolean | null;
  partnerOnly: boolean | null;
}

export const EMPTY_INTENT: Intent = {
  keywords: [],
  cities: [],
  name: null,
  degree: null,
  maxTuitionKrw: null,
  topikMax: null,
  type: null,
  englishOnly: null,
  partnerOnly: null,
};

/** One guideline row of `v_app_university_catalog`. */
export interface CatalogRow {
  guideline_id: string;
  institution_id: string;
  name_ko?: string | null;
  name_ko_short?: string | null;
  name_en?: string | null;
  city_ko?: string | null;
  institution_type?: string | null;
  univ_nomi_en?: string | null;
  univ_nomi_kr?: string | null;
  shahar?: string | null;
  daraja?: string | null;
  english_track?: boolean | null;
  topik_min?: number | string | null;
  narx_valyuta?: string | null;
  kontrakt_min?: number | string | null;
  kontrakt_max?: number | string | null;
  kontrakt_davri?: string | null;
  is_partner?: boolean | null;
  is_active?: boolean | null;
}

/** One row of `v_app_university_faculties`. */
export interface FacultyRow {
  guideline_id: string;
  kollej_en?: string | null;
  fakultet_en?: string | null;
  kollej_kr?: string | null;
  fakultet_kr?: string | null;
}

export interface SearchHit {
  institution_id: string;
  guideline_id: string;
  score: number;
  /** Faculty names (as staff typed them) that matched the field of study. */
  matched: string[];
  matchCount: number;
}

export interface SearchOutcome {
  hits: SearchHit[];
  /** Conditions dropped to find anything: "tuition", "topik", "english". */
  relaxed: string[];
}

/** Rough conversion, only for comparing a USD fee with a KRW ceiling. */
const KRW_PER_USD = 1400;

/**
 * Other spellings of a city or province. The catalogue writes cities in
 * English, often with the province ("Gongju (Chungcheongnam-do)"), and
 * `city_ko` in Korean, so a short province name has to reach both.
 */
const CITY_ALIASES: Record<string, string[]> = {
  seoul: ["서울"],
  busan: ["부산"],
  daegu: ["대구"],
  incheon: ["인천"],
  daejeon: ["대전"],
  gwangju: ["광주"],
  ulsan: ["울산"],
  sejong: ["세종"],
  jeju: ["제주"],
  suwon: ["수원"],
  gyeonggi: ["경기"],
  chungnam: ["chungcheongnam", "충남", "충청남도"],
  chungbuk: ["chungcheongbuk", "충북", "충청북도"],
  gyeongnam: ["gyeongsangnam", "경남", "경상남도"],
  gyeongbuk: ["gyeongsangbuk", "경북", "경상북도"],
  jeonnam: ["jeollanam", "전남", "전라남도"],
  jeonbuk: ["jeollabuk", "전북", "전라북도"],
  gangwon: ["강원"],
};

/** `institution_type` values a "national" / "private" request accepts. */
const TYPES: Record<"national" | "private", string[]> = {
  national: ["national", "national_special", "public"],
  private: ["private"],
};

const HANGUL = /^[\uAC00-\uD7A3]+$/;

const norm = (s: string | null | undefined): string =>
  (s ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Tuition per semester in KRW, or null when the guideline has no fee. */
export function tuitionPerSemesterKrw(r: CatalogRow): number | null {
  const raw = num(r.kontrakt_min) ?? num(r.kontrakt_max);
  if (raw === null) return null;
  const krw = (r.narx_valyuta ?? "KRW").toUpperCase() === "USD" ? raw * KRW_PER_USD : raw;
  return r.kontrakt_davri === "yil" ? krw / 2 : krw;
}

function names(r: CatalogRow): string[] {
  return [r.univ_nomi_en, r.name_en, r.univ_nomi_kr, r.name_ko, r.name_ko_short]
    .map(norm)
    .filter((s) => s.length > 0);
}

function cityMatches(r: CatalogRow, cities: string[]): boolean {
  const hay = `${norm(r.shahar)} ${norm(r.city_ko)}`;
  return cities.some((c) => {
    const key = norm(c);
    if (!key) return false;
    if (hay.includes(key)) return true;
    const aliases = CITY_ALIASES[key.replace(/\s+/g, "")] ?? [];
    return aliases.some((a) => hay.includes(a));
  });
}

function nameScore(r: CatalogRow, query: string): number {
  const q = norm(query);
  if (q.length < 2) return 0;
  let best = 0;
  for (const n of names(r)) {
    if (n === q) best = Math.max(best, 100);
    else if (n.startsWith(q)) best = Math.max(best, 80);
    else if (n.includes(q)) best = Math.max(best, 60);
    else {
      // Every word of the query appears, in any order ("kongju national").
      const words = q.split(" ").filter((w) => w.length >= 2);
      if (words.length > 1 && words.every((w) => n.includes(w))) best = Math.max(best, 50);
    }
  }
  return best;
}

/**
 * An English stem has to start a word ("comput" finds "Computer Science", but
 * "art" does not find "Department"); a Korean word may sit inside a compound
 * ("공학" in "컴퓨터공학과").
 */
function keywordIn(hay: string, k: string): boolean {
  return /[\uAC00-\uD7A3]/.test(k) ? hay.includes(k) : ` ${hay}`.includes(` ${k}`);
}

function facultyMatches(rows: FacultyRow[], keywords: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const f of rows) {
    const hay = norm(`${f.kollej_en ?? ""} ${f.fakultet_en ?? ""} ${f.kollej_kr ?? ""} ${f.fakultet_kr ?? ""}`);
    if (!hay) continue;
    if (keywords.some((k) => keywordIn(hay, k))) {
      const label = [f.fakultet_en, f.fakultet_kr, f.kollej_en, f.kollej_kr]
        .map((v) => (v ?? "").trim())
        .find((v) => v.length > 0) ?? "";
      const key = norm(label);
      if (label && !seen.has(key)) {
        seen.add(key);
        out.push(label);
      }
    }
  }
  return out;
}

interface Options {
  tuition: boolean;
  topik: boolean;
  english: boolean;
}

/**
 * Rank the catalogue for an [Intent]. One entry per university (its guideline
 * for the wanted degree, else the bachelor's one, else any). When the hard
 * conditions leave nothing, fee, TOPIK and the English-taught condition are
 * dropped one after another and reported in `relaxed`.
 */
export function searchCatalog(
  rows: CatalogRow[],
  faculties: FacultyRow[],
  intent: Intent,
  limit = 12,
): SearchOutcome {
  const byGuideline = new Map<string, FacultyRow[]>();
  for (const f of faculties) {
    const list = byGuideline.get(f.guideline_id);
    if (list) list.push(f);
    else byGuideline.set(f.guideline_id, [f]);
  }
  // Three letters at least for an English stem; two Hangul syllables are
  // already a whole word ("공학", "경영").
  const keywords = intent.keywords.map(norm).filter((k) => k.length >= 3 || (k.length === 2 && HANGUL.test(k)));
  const active = rows.filter((r) => r.is_active !== false);

  // A university name beats every other condition.
  if (intent.name && norm(intent.name).length >= 2) {
    const hits = pickPerUniversity(active, intent.degree).flatMap((r) => {
      const s = nameScore(r, intent.name!);
      return s > 0
        ? [{
          institution_id: r.institution_id,
          guideline_id: r.guideline_id,
          score: s + (r.is_partner ? 1 : 0),
          matched: [],
          matchCount: 0,
        }]
        : [];
    });
    if (hits.length) {
      hits.sort((a, b) => b.score - a.score);
      return { hits: hits.slice(0, limit), relaxed: [] };
    }
    // No such name: the model may have read a field or a city as a name, so
    // the other conditions still get their turn below, if there are any.
    if (isEmptyIntent({ ...intent, name: null })) return { hits: [], relaxed: [] };
  }

  const attempt = (o: Options): SearchHit[] => {
    const hits: SearchHit[] = [];
    for (const r of pickPerUniversity(active, intent.degree)) {
      if (intent.cities.length && !cityMatches(r, intent.cities)) continue;
      if (intent.type && !TYPES[intent.type].includes(r.institution_type ?? "")) continue;
      if (intent.partnerOnly && !r.is_partner) continue;
      if (o.english && intent.englishOnly && r.english_track !== true) continue;
      if (o.topik && intent.topikMax !== null) {
        const t = num(r.topik_min);
        if (t !== null && t > intent.topikMax) continue;
      }
      if (o.tuition && intent.maxTuitionKrw !== null) {
        const fee = tuitionPerSemesterKrw(r);
        if (fee !== null && fee > intent.maxTuitionKrw) continue;
      }
      let matched: string[] = [];
      if (keywords.length) {
        matched = facultyMatches(byGuideline.get(r.guideline_id) ?? [], keywords);
        if (matched.length === 0) continue;
      }
      hits.push({
        institution_id: r.institution_id,
        guideline_id: r.guideline_id,
        score: Math.min(matched.length, 10) * 10 + (r.is_partner ? 5 : 0),
        matched: matched.slice(0, 3),
        matchCount: matched.length,
      });
    }
    return hits;
  };

  // Only the conditions the student actually gave can be relaxed, in this
  // order: fee first (most often too tight), then TOPIK, then English-taught.
  const given: string[] = [];
  if (intent.maxTuitionKrw !== null) given.push("tuition");
  if (intent.topikMax !== null) given.push("topik");
  if (intent.englishOnly) given.push("english");
  for (let n = 0; n <= given.length; n++) {
    const dropped = given.slice(0, n);
    const hits = attempt({
      tuition: !dropped.includes("tuition"),
      topik: !dropped.includes("topik"),
      english: !dropped.includes("english"),
    });
    if (hits.length) {
      hits.sort((a, b) => b.score - a.score || cheaperFirst(rows, a, b));
      return { hits: hits.slice(0, limit), relaxed: dropped };
    }
  }
  return { hits: [], relaxed: [] };
}

function cheaperFirst(rows: CatalogRow[], a: SearchHit, b: SearchHit): number {
  const fee = (h: SearchHit) => {
    const r = rows.find((x) => x.guideline_id === h.guideline_id);
    return r ? tuitionPerSemesterKrw(r) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
  };
  return fee(a) - fee(b);
}

/** The guideline to represent each university with, for the wanted degree. */
function pickPerUniversity(rows: CatalogRow[], degree: Degree | null): CatalogRow[] {
  const byUni = new Map<string, CatalogRow[]>();
  for (const r of rows) {
    const list = byUni.get(r.institution_id);
    if (list) list.push(r);
    else byUni.set(r.institution_id, [r]);
  }
  const out: CatalogRow[] = [];
  for (const list of byUni.values()) {
    const wanted = degree ? list.find((r) => r.daraja === degree) : undefined;
    if (degree && !wanted) continue; // no guideline for that degree: not a match
    out.push(wanted ?? list.find((r) => r.daraja === "bakalavr") ?? list[0]);
  }
  return out;
}

/** The text fallback when the model is unavailable: names and cities only. */
export function fallbackIntent(query: string): Intent {
  return { ...EMPTY_INTENT, name: query.trim().slice(0, 80) || null };
}

const DEGREES = new Set(["bakalavr", "magistratura"]);

/** Turn whatever the model returned into a safe [Intent]. */
export function sanitizeIntent(raw: unknown): Intent {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const strings = (v: unknown, max: number): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, max)
      : [];
  const numberOrNull = (v: unknown): number | null => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  return {
    keywords: strings(o.keywords, 8).map((s) => s.slice(0, 30)),
    cities: strings(o.cities, 4).map((s) => s.slice(0, 40)),
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 80) : null,
    degree: typeof o.degree === "string" && DEGREES.has(o.degree) ? (o.degree as Degree) : null,
    maxTuitionKrw: numberOrNull(o.max_tuition_krw),
    topikMax: (() => {
      const t = numberOrNull(o.topik_max);
      return t !== null && t <= 6 ? t : null;
    })(),
    type: o.type === "national" || o.type === "private" ? o.type : null,
    englishOnly: o.english_only === true ? true : null,
    partnerOnly: o.partner_only === true ? true : null,
  };
}

/** True when the intent asks for nothing the catalogue could filter on. */
export function isEmptyIntent(i: Intent): boolean {
  return !i.name && i.keywords.length === 0 && i.cities.length === 0 && i.degree === null &&
    i.maxTuitionKrw === null && i.topikMax === null && i.type === null && !i.englishOnly && !i.partnerOnly;
}
