// Pure helpers for `ai-university-search`: no network, no Deno APIs, so they
// can be unit-tested (search_test.ts).
//
// The search is by field of study (owner, 2026-10-13: "IT deb yozsam IT ga
// aloqador barcha universitetlar, stomatologiya deb yozsa faqat stomatologiya
// yo'nalishi bor universitetlar chiqsin"). The language model only turns the
// student's words into search terms for that field; the matching itself is
// `ai_search_by_field` in the database
// (20261013110000_ai_search_in_database.sql), which reads the terms as:
//   * Korean: anywhere in a programme name ("컴퓨터" in "컴퓨터공학과");
//   * an English acronym of up to three letters ("ai", "it"): a whole word;
//   * any other English term: the start of a word ("comput");
//   * a term with a leading minus excludes the programmes it names
//     ("-veterinar" keeps Veterinary Medicine out of "tibbiyot").

/** The bump that makes every stored answer stale, when the prompt changes. */
export const PROMPT_VERSION = "v1";

/** The key a typed text is stored under: the same text, the same answer. */
export function queryKey(query: string): string {
  return `${PROMPT_VERSION}:${query.toLowerCase().normalize("NFKC").replace(/\s+/g, " ").trim()}`;
}

/**
 * The model's terms in the form the database matches: lower case, letters,
 * digits, Hangul and single spaces only, two characters at least, a leading
 * minus kept for an exclusion, no repeats, at most 24.
 */
export function cleanTerms(terms: unknown[]): string[] {
  const out: string[] = [];
  for (const t of terms) {
    if (typeof t !== "string") continue;
    const raw = t.trim();
    const minus = raw.startsWith("-");
    const n = (minus ? raw.slice(1) : raw).toLowerCase().normalize("NFKC").replace(/[^a-z0-9\uAC00-\uD7A3]+/g, " ")
      .trim().slice(0, 40).trim();
    const term = minus ? `-${n}` : n;
    if (n.length >= 2 && !out.includes(term)) out.push(term);
    if (out.length === 24) break;
  }
  return out;
}

/**
 * The terms in the model's reply, which should be `{"terms": [...]}` but may
 * come wrapped in prose or a code fence. Null when there is no such object.
 */
export function parseTermsReply(text: string): string[] | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const o = JSON.parse(text.slice(start, end + 1));
    return o && typeof o === "object" && Array.isArray(o.terms) ? cleanTerms(o.terms) : null;
  } catch (_e) {
    return null;
  }
}
