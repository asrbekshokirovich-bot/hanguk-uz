/**
 * Qidiruv uchun matn normalizatsiyasi.
 *
 * Uzumdagi nomlar lotin va kirillda, apostrof esa toʻrt xil belgida yozilgan:
 * `ʻ` (U+02BB), `'` (U+2018), `` ` `` va oddiy `'`. Solishtirishdan oldin hammasi
 * bitta koʻrinishga keltiriladi, aks holda "Oʻzbekiston", "O'zbekiston" va
 * "Узбекистон" uch xil soʻzga aylanadi.
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh",
  ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "o", ғ: "g", қ: "q", ҳ: "h", ҷ: "j", ə: "a",
};

/** Apostrofning barcha koʻrinishlari. */
const APOSTROPHES = /[ʻʼ‘’`´']/g;

export function normalize(input: string): string {
  const lowered = input.toLocaleLowerCase("uz");
  let out = "";
  for (const ch of lowered) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch;
  }
  return out
    .replace(APOSTROPHES, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Qidiruv soʻzi nomda uchraydimi. */
export function matches(haystack: string, needle: string): boolean {
  return normalize(haystack).includes(normalize(needle));
}

/**
 * Moslik sifati — roʻyxatni saralash uchun.
 * Nom boshidan mos kelsa yuqoriroq turadi.
 */
export function matchScore(haystack: string, needle: string): number {
  const h = normalize(haystack);
  const n = normalize(needle);
  const at = h.indexOf(n);
  if (at < 0) return -1;
  if (at === 0) return 100;
  // Soʻz boshidan mos kelsa — oʻrtadan mos kelganidan yaxshiroq.
  return h[at - 1] === " " ? 60 : 20;
}

/** Qidiruv natijalari 2 harfdan keyin koʻrsatiladi. */
export const MIN_QUERY_LENGTH = 2;
