// Pure search logic for `ai-university-search`: no network, no Deno APIs, so it
// can be unit-tested (search_test.ts) and read in one sitting.
//
// The search is by field of study (owner, 2026-10-13: "IT deb yozsam IT ga
// aloqador barcha universitetlar, stomatologiya deb yozsa faqat stomatologiya
// yo'nalishi bor universitetlar chiqsin"). The language model only turns the
// student's words into search terms for that field; the universities are
// found here, by the names of their programmes (`fakultet_en` / `fakultet_kr`
// of `v_app_university_faculties`). The model never sees the catalogue and so
// cannot invent a university, and a request stays a few hundred tokens.

/** One guideline row of `v_app_university_catalog`. */
export interface CatalogRow {
  guideline_id: string;
  institution_id: string;
  daraja?: string | null;
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
  fakultet_en?: string | null;
  fakultet_kr?: string | null;
}

export interface SearchHit {
  institution_id: string;
  guideline_id: string;
  /** Programme names of the field, as staff typed them. */
  matched: string[];
  matchCount: number;
}

const HANGUL = /[가-힣]/;

const norm = (s: string | null | undefined): string =>
  (s ?? "").toLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();

/**
 * Whether a search term names this programme.
 *  * Korean: anywhere, since Korean names are compounds ("컴퓨터공학과").
 *  * An English acronym of up to three letters ("ai", "it", "ict"): a whole
 *    word, or followed by Korean ("AI융합학과"), never inside a word
 *    ("Italian").
 *  * Any other English term: the start of a word ("comput" finds "Computer
 *    Science", "art" does not find "Department"); a phrase works the same.
 */
export function termIn(hay: string, term: string): boolean {
  if (HANGUL.test(term)) return hay.includes(term);
  const padded = ` ${hay}`;
  if (term.length > 3) return padded.includes(` ${term}`);
  for (let at = padded.indexOf(` ${term}`); at !== -1; at = padded.indexOf(` ${term}`, at + 1)) {
    const next = padded[at + term.length + 1];
    if (next === undefined || !/[a-z0-9]/.test(next)) return true;
  }
  return false;
}

/** The model's terms, normalised; one-letter terms dropped. */
export function cleanTerms(terms: string[]): string[] {
  const out: string[] = [];
  for (const t of terms) {
    const n = norm(t);
    if (n.length >= 2 && !out.includes(n)) out.push(n);
  }
  return out;
}

/** Fee per semester in KRW, for ordering only; no fee sorts last. */
function semesterFeeKrw(r: CatalogRow): number {
  const raw = r.kontrakt_min ?? r.kontrakt_max;
  const v = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
  if (!Number.isFinite(v)) return Number.MAX_SAFE_INTEGER;
  const krw = (r.narx_valyuta ?? "KRW").toUpperCase() === "USD" ? v * 1400 : v;
  return r.kontrakt_davri === "yil" ? krw / 2 : krw;
}

interface University {
  hits: { hit: SearchHit; bachelor: boolean }[];
  best: number;
  partner: boolean;
  fee: number;
}

/**
 * Every guideline with at least one programme of the field. Universities with
 * more such programmes come first, then official partners, then the cheaper.
 * A university's guidelines follow one another, the bachelor's first, so the
 * app can pick the one for the degree it shows.
 */
export function searchByField(rows: CatalogRow[], faculties: FacultyRow[], rawTerms: string[]): SearchHit[] {
  const terms = cleanTerms(rawTerms);
  if (terms.length === 0) return [];

  const byGuideline = new Map<string, FacultyRow[]>();
  for (const f of faculties) {
    const list = byGuideline.get(f.guideline_id);
    if (list) list.push(f);
    else byGuideline.set(f.guideline_id, [f]);
  }

  const byUni = new Map<string, University>();
  for (const r of rows) {
    if (r.is_active === false) continue;
    const matched: string[] = [];
    const seen = new Set<string>();
    for (const f of byGuideline.get(r.guideline_id) ?? []) {
      // The programme's own name only: a college name ("College of Natural
      // Science and Information") would pull in every department under it.
      const hay = norm(`${f.fakultet_en ?? ""} ${f.fakultet_kr ?? ""}`);
      if (!hay || !terms.some((t) => termIn(hay, t))) continue;
      const label = (f.fakultet_en ?? "").trim() || (f.fakultet_kr ?? "").trim();
      if (label && !seen.has(norm(label))) {
        seen.add(norm(label));
        matched.push(label);
      }
    }
    if (matched.length === 0) continue;

    const hit = { institution_id: r.institution_id, guideline_id: r.guideline_id, matched, matchCount: matched.length };
    const entry = { hit, bachelor: r.daraja === "bakalavr" };
    const u = byUni.get(r.institution_id);
    if (u) {
      u.hits.push(entry);
      u.best = Math.max(u.best, matched.length);
      u.partner ||= r.is_partner === true;
      u.fee = Math.min(u.fee, semesterFeeKrw(r));
    } else {
      byUni.set(r.institution_id, {
        hits: [entry],
        best: matched.length,
        partner: r.is_partner === true,
        fee: semesterFeeKrw(r),
      });
    }
  }

  return [...byUni.values()]
    .sort((a, b) => b.best - a.best || Number(b.partner) - Number(a.partner) || a.fee - b.fee)
    .flatMap((u) => u.hits.sort((a, b) => Number(b.bachelor) - Number(a.bachelor)).map((e) => e.hit));
}

/** The model's answer → its search terms; [] when it named no field. */
export function sanitizeTerms(raw: unknown): string[] {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const list = Array.isArray(o.terms) ? o.terms : [];
  return list
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 24);
}
