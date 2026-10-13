// deno test supabase/functions/ai-university-search/search_test.ts
import { assertEquals } from "jsr:@std/assert@1";

import {
  type CatalogRow,
  EMPTY_INTENT,
  type FacultyRow,
  type Intent,
  isEmptyIntent,
  sanitizeIntent,
  searchCatalog,
  tuitionPerSemesterKrw,
} from "./search.ts";

const row = (o: Partial<CatalogRow> & { guideline_id: string; institution_id: string }): CatalogRow => ({
  daraja: "bakalavr",
  narx_valyuta: "KRW",
  kontrakt_davri: "semestr",
  is_active: true,
  is_partner: false,
  ...o,
});

const ROWS: CatalogRow[] = [
  row({
    guideline_id: "g-kongju",
    institution_id: "kongju",
    univ_nomi_en: "Kongju National University",
    name_ko: "공주대학교",
    shahar: "Gongju (Chungcheongnam-do)",
    city_ko: "공주",
    institution_type: "national",
    topik_min: 3,
    kontrakt_min: 1_800_000,
  }),
  row({
    guideline_id: "g-woosong",
    institution_id: "woosong",
    univ_nomi_en: "Woosong University",
    name_ko: "우송대학교",
    shahar: "Daejeon",
    institution_type: "private",
    english_track: true,
    topik_min: null,
    kontrakt_min: 2_700,
    narx_valyuta: "USD",
    is_partner: true,
  }),
  row({
    guideline_id: "g-sejong-b",
    institution_id: "sejong",
    univ_nomi_en: "Sejong University",
    shahar: "Seoul",
    institution_type: "private",
    topik_min: 4,
    kontrakt_min: 9_000_000,
    kontrakt_davri: "yil",
  }),
  row({
    guideline_id: "g-sejong-m",
    institution_id: "sejong",
    univ_nomi_en: "Sejong University",
    shahar: "Seoul",
    institution_type: "private",
    daraja: "magistratura",
    topik_min: 3,
    kontrakt_min: 5_000_000,
  }),
  row({
    guideline_id: "g-closed",
    institution_id: "closed",
    univ_nomi_en: "Closed University",
    shahar: "Seoul",
    is_active: false,
  }),
];

const FACULTIES: FacultyRow[] = [
  { guideline_id: "g-kongju", fakultet_en: "Computer Science and Engineering" },
  { guideline_id: "g-kongju", fakultet_kr: "간호학과" },
  { guideline_id: "g-woosong", fakultet_en: "Global Hotel Management" },
  { guideline_id: "g-woosong", fakultet_en: "Computer Engineering" },
  { guideline_id: "g-sejong-b", fakultet_en: "Department of Hospitality" },
  { guideline_id: "g-sejong-m", fakultet_en: "Artificial Intelligence" },
];

const intent = (o: Partial<Intent>): Intent => ({ ...EMPTY_INTENT, ...o });
const ids = (i: Intent) => searchCatalog(ROWS, FACULTIES, i).hits.map((h) => h.institution_id);

Deno.test("a name finds the university in any script and case", () => {
  assertEquals(ids(intent({ name: "woosong" })), ["woosong"]);
  assertEquals(ids(intent({ name: "공주" })), ["kongju"]);
  assertEquals(ids(intent({ name: "kongju national" })), ["kongju"]);
});

Deno.test("an unknown name falls through to the other conditions", () => {
  assertEquals(ids(intent({ name: "zzz", cities: ["Daejeon"] })), ["woosong"]);
  assertEquals(ids(intent({ name: "zzz" })), []);
});

Deno.test("inactive guidelines never show", () => {
  assertEquals(ids(intent({ name: "closed" })), []);
});

Deno.test("cities match English, provinces and Korean", () => {
  assertEquals(ids(intent({ cities: ["Seoul"] })), ["sejong"]);
  assertEquals(ids(intent({ cities: ["Chungnam"] })), ["kongju"]);
  assertEquals(ids(intent({ cities: ["공주"] })), ["kongju"]);
});

Deno.test("a field of study matches English stems at word starts and Korean inside words", () => {
  const r = searchCatalog(ROWS, FACULTIES, intent({ keywords: ["comput"] }));
  assertEquals(r.hits.map((h) => h.institution_id).sort(), ["kongju", "woosong"]);
  assertEquals(r.hits.find((h) => h.institution_id === "kongju")!.matched, ["Computer Science and Engineering"]);
  // "art" must not find "Department of Hospitality".
  assertEquals(ids(intent({ keywords: ["art"] })), []);
  assertEquals(ids(intent({ keywords: ["간호"] })), ["kongju"]);
});

Deno.test("partners rank first among equal matches", () => {
  assertEquals(ids(intent({ keywords: ["comput"] })), ["woosong", "kongju"]);
});

Deno.test("degree picks that degree's guideline and drops universities without it", () => {
  const r = searchCatalog(ROWS, FACULTIES, intent({ degree: "magistratura" }));
  assertEquals(r.hits.map((h) => h.guideline_id), ["g-sejong-m"]);
});

Deno.test("type national includes national_special and public", () => {
  const rows = [
    ...ROWS,
    row({ guideline_id: "g-ks", institution_id: "ks", shahar: "Seoul", institution_type: "national_special" }),
  ];
  const r = searchCatalog(rows, FACULTIES, intent({ type: "national" }));
  assertEquals(r.hits.map((h) => h.institution_id).sort(), ["kongju", "ks"]);
});

Deno.test("TOPIK: what asks for more is hidden, no requirement passes", () => {
  assertEquals(ids(intent({ topikMax: 3 })).sort(), ["kongju", "woosong"]);
});

Deno.test("fee: USD is converted and a yearly fee is halved", () => {
  assertEquals(tuitionPerSemesterKrw(ROWS[1]), 2_700 * 1400);
  assertEquals(tuitionPerSemesterKrw(ROWS[2]), 4_500_000);
  assertEquals(ids(intent({ maxTuitionKrw: 4_000_000 })).sort(), ["kongju", "woosong"]);
});

Deno.test("too tight a fee is dropped and reported", () => {
  const r = searchCatalog(ROWS, FACULTIES, intent({ cities: ["Seoul"], maxTuitionKrw: 1_000_000 }));
  assertEquals(r.hits.map((h) => h.institution_id), ["sejong"]);
  assertEquals(r.relaxed, ["tuition"]);
});

Deno.test("the city is never relaxed", () => {
  const r = searchCatalog(ROWS, FACULTIES, intent({ cities: ["Busan"], maxTuitionKrw: 1 }));
  assertEquals(r, { hits: [], relaxed: [] });
});

Deno.test("sanitizeIntent keeps only well-formed fields", () => {
  const i = sanitizeIntent({
    keywords: ["comput", 3, "", "  nurs "],
    cities: "Seoul",
    name: "  ",
    degree: "phd",
    max_tuition_krw: -5,
    topik_max: 9,
    type: "national",
    english_only: "yes",
    partner_only: true,
  });
  assertEquals(i, { ...EMPTY_INTENT, keywords: ["comput", "nurs"], type: "national", partnerOnly: true });
  assertEquals(sanitizeIntent(null), EMPTY_INTENT);
  assertEquals(isEmptyIntent(sanitizeIntent("garbage")), true);
});
