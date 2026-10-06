// The STORED values of the lead card (what is written to `leads` verbatim and
// reported on), and matchers that turn a free answer ("topik_3", "Farg'ona
// viloyati", "19 yosh") into one of them — or into null when it does not
// clearly match.
//
// Mirror of src/components/crm/lead-desk/copy.ts (GOALS, CERTIFICATES, REGIONS,
// STUDY_YEARS). Edge functions cannot import from src/, so the lists are
// repeated here; change both together. No imports: vitest runs this file.

/** Maqsad -> leads.education_level. (U+2019 in "ta’lim", as in copy.ts.) */
export const GOALS = ["Bakalavr", "Magistr", "Kasbiy ta’lim", "Til kursi", "HanBox", "GKS"] as const;

/** Sertifikat / daraja -> leads.cert_level. */
export const CERTIFICATES = [
  "Yo'q",
  "TOPIK 1",
  "TOPIK 2",
  "TOPIK 3",
  "TOPIK 4",
  "TOPIK 5",
  "TOPIK 6",
  "IELTS 5.5",
  "IELTS 6.0",
  "IELTS 6.5",
  "IELTS 7.0+",
  "TOEFL",
] as const;

/** Viloyat -> leads.city. */
export const REGIONS = [
  "Toshkent",
  "Samarqand",
  "Buxoro",
  "Andijon",
  "Farg'ona",
  "Namangan",
  "Qarshi",
  "Nukus",
  "Urganch",
  "Jizzax",
  "Navoiy",
  "Termiz",
  "Guliston",
  "Chet el",
] as const;

/** Maktab / kollej / universitet kursi -> leads.study_year. */
export const STUDY_YEARS = [
  "9-sinf",
  "10-sinf",
  "11-sinf",
  "Kollej",
  "1-kurs",
  "2-kurs",
  "3-kurs",
  "4-kurs",
  "Bitirgan",
  "Ishlaydi",
] as const;

export const DECIDERS = ["self", "parent", "relative"] as const;

export const MIN_AGE = 15;
export const MAX_AGE = 45;

/**
 * Lower-case, one kind of apostrophe, no accents, single spaces, underscores
 * read as spaces. "Farg‘ona_Viloyati" -> "farg'ona viloyati".
 */
export function fold(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[ʻʼ‘’‛`´ʹ]/g, "'")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** fold() without any apostrophe, for "fargona" == "farg'ona". */
function bare(s: unknown): string {
  return fold(s).replace(/'/g, "");
}

function hasWord(haystack: string, ...needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/** Exact (folded) hit in a stored-value list, or null. */
export function matchList<T extends string>(list: readonly T[], value: unknown): T | null {
  const v = bare(value);
  if (!v) return null;
  return list.find((x) => bare(x) === v) ?? null;
}

/** Maqsad. */
export function matchGoal(value: unknown): (typeof GOALS)[number] | null {
  const v = fold(value);
  if (!v) return null;
  if (hasWord(v, "hanbox", "han box")) return "HanBox";
  if (/\bgks\b/.test(v)) return "GKS";
  if (hasWord(v, "bakalavr", "бакалавр", "bachelor")) return "Bakalavr";
  if (hasWord(v, "magistr", "магистр", "master")) return "Magistr";
  if (hasWord(v, "kasbiy", "professional", "професс")) return "Kasbiy ta’lim";
  // a bare "til" inside a sentence is too weak; only the explicit forms count
  if (hasWord(v, "til kurs", "til o'rgan", "til oqish", "korean language", "язык") || v === "til") {
    return "Til kursi";
  }
  return matchList(GOALS, value);
}

/** Sertifikat / daraja. IELTS bands below 5.5 have no stored value -> null. */
export function matchCertificate(value: unknown): (typeof CERTIFICATES)[number] | null {
  const v = fold(value);
  if (!v) return null;

  const topik = /topik\s*[-:]?\s*([1-6])\b/.exec(v) ?? /\b([1-6])\s*[- ]?\s*(?:daraja|level|bosqich|уровень)\s*topik/.exec(v);
  if (topik) return `TOPIK ${topik[1]}` as (typeof CERTIFICATES)[number];

  const ielts = /ielts\s*[-:]?\s*(\d(?:[.,]\d)?)/.exec(v);
  if (ielts) {
    const band = parseFloat(ielts[1].replace(",", "."));
    if (band >= 7) return "IELTS 7.0+";
    if (band >= 6.5) return "IELTS 6.5";
    if (band >= 6) return "IELTS 6.0";
    if (band >= 5.5) return "IELTS 5.5";
    return null;
  }
  if (/\btoefl\b/.test(v)) return "TOEFL";

  // "yo'q", "hali yo'q", "no", "нет" — an answer, not a blank
  if (/(^|[\s,.;:!?])(yo'?q|yoq|olmaganman|no|none|нет|нету)($|[\s,.;:!?])/.test(v)) {
    return "Yo'q";
  }
  return matchList(CERTIFICATES, value);
}

const REGION_ALIASES: [string, (typeof REGIONS)[number]][] = [
  ["toshkent", "Toshkent"], ["tashkent", "Toshkent"], ["ташкент", "Toshkent"],
  ["samarqand", "Samarqand"], ["samarkand", "Samarqand"], ["самарканд", "Samarqand"],
  ["buxoro", "Buxoro"], ["bukhara", "Buxoro"], ["бухара", "Buxoro"],
  ["andijon", "Andijon"], ["andijan", "Andijon"], ["андижан", "Andijon"],
  ["fargona", "Farg'ona"], ["fergana", "Farg'ona"], ["фергана", "Farg'ona"],
  ["namangan", "Namangan"], ["наманган", "Namangan"],
  ["qarshi", "Qarshi"], ["qashqadaryo", "Qarshi"], ["karshi", "Qarshi"], ["карши", "Qarshi"], ["кашкадарья", "Qarshi"],
  ["nukus", "Nukus"], ["qoraqalpog", "Nukus"], ["karakalpak", "Nukus"], ["нукус", "Nukus"], ["каракалпак", "Nukus"],
  ["urganch", "Urganch"], ["xorazm", "Urganch"], ["khorezm", "Urganch"], ["ургенч", "Urganch"], ["хорезм", "Urganch"],
  ["jizzax", "Jizzax"], ["jizzakh", "Jizzax"], ["джизак", "Jizzax"],
  ["navoiy", "Navoiy"], ["navoi", "Navoiy"], ["навои", "Navoiy"],
  ["termiz", "Termiz"], ["termez", "Termiz"], ["surxondaryo", "Termiz"], ["термез", "Termiz"], ["сурхандарья", "Termiz"],
  ["guliston", "Guliston"], ["gulistan", "Guliston"], ["sirdaryo", "Guliston"], ["гулистан", "Guliston"], ["сырдарья", "Guliston"],
  ["chet el", "Chet el"], ["xorij", "Chet el"], ["abroad", "Chet el"], ["за границ", "Chet el"], ["зарубеж", "Chet el"],
];

/** Viloyat: "Toshkent shahri", "farg'ona viloyati", "Ташкент" -> a stored region, or null. */
export function matchRegion(value: unknown): (typeof REGIONS)[number] | null {
  const v = bare(value);
  if (!v) return null;
  for (const [alias, region] of REGION_ALIASES) {
    if (v.includes(alias)) return region;
  }
  return null;
}

/** Maktab / kollej / universitet kursi. */
export function matchStudyYear(value: unknown): (typeof STUDY_YEARS)[number] | null {
  const v = fold(value);
  if (!v) return null;
  const sinf = /\b(9|10|11)\s*[- ]?\s*(?:sinf|класс)/.exec(v);
  if (sinf) return `${sinf[1]}-sinf` as (typeof STUDY_YEARS)[number];
  const kurs = /\b([1-4])\s*[- ]?\s*(?:kurs|курс)/.exec(v);
  if (kurs) return `${kurs[1]}-kurs` as (typeof STUDY_YEARS)[number];
  if (hasWord(v, "kollej", "college", "колледж")) return "Kollej";
  if (hasWord(v, "bitirgan", "окончил")) return "Bitirgan";
  if (hasWord(v, "ishlay", "работа")) return "Ishlaydi";
  return null;
}

/** Kim qaror qiladi / to'laydi. */
export function matchDecider(value: unknown): (typeof DECIDERS)[number] | null {
  const v = fold(value);
  if (!v) return null;
  if ((DECIDERS as readonly string[]).includes(v)) return v as (typeof DECIDERS)[number];
  if (hasWord(v, "ota", "ona", "parent", "родител")) return "parent";
  if (hasWord(v, "qarindosh", "aka", "opa", "amaki", "tog'a", "relative", "родств")) return "relative";
  if (hasWord(v, "o'zi", "ozim", "o'zim", "self", "сам")) return "self";
  return null;
}

/** An age inside the card's range (15-45), from "19", "19 yosh", "19 y.o.". */
export function matchAge(value: unknown): number | null {
  const m = /\b(\d{2})\b/.exec(String(value ?? ""));
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= MIN_AGE && n <= MAX_AGE ? n : null;
}
