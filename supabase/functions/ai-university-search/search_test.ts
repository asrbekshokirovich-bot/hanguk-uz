// deno test supabase/functions/ai-university-search/search_test.ts
import { assertEquals } from "jsr:@std/assert@1";

import { type CatalogRow, cleanTerms, type FacultyRow, sanitizeTerms, searchByField, termIn } from "./search.ts";

const row = (o: Partial<CatalogRow> & { guideline_id: string; institution_id: string }): CatalogRow => ({
  daraja: "bakalavr",
  narx_valyuta: "KRW",
  kontrakt_davri: "semestr",
  is_active: true,
  is_partner: false,
  ...o,
});

const ROWS: CatalogRow[] = [
  row({ guideline_id: "g-a", institution_id: "a", kontrakt_min: 3_000_000 }),
  row({ guideline_id: "g-b", institution_id: "b", kontrakt_min: 2_000_000 }),
  row({ guideline_id: "g-b-m", institution_id: "b", daraja: "magistratura", kontrakt_min: 4_000_000 }),
  row({ guideline_id: "g-c", institution_id: "c", is_partner: true }),
  row({ guideline_id: "g-d", institution_id: "d", daraja: "magistratura" }),
  row({ guideline_id: "g-x", institution_id: "x", is_active: false }),
];

const FACULTIES: FacultyRow[] = [
  { guideline_id: "g-a", fakultet_en: "Computer Science and Engineering" },
  { guideline_id: "g-a", fakultet_en: "Software" },
  { guideline_id: "g-a", fakultet_kr: "치위생학과" },
  { guideline_id: "g-b", fakultet_en: "Library and Information Science" },
  { guideline_id: "g-b", fakultet_en: "Italian Language" },
  { guideline_id: "g-b-m", fakultet_en: "Information Security" },
  { guideline_id: "g-c", fakultet_kr: "컴퓨터공학과" },
  { guideline_id: "g-d", fakultet_en: "Dentistry" },
  { guideline_id: "g-x", fakultet_en: "Computer Engineering" },
];

const IT = ["comput", "software", "information secur", "it", "컴퓨터", "소프트웨어"];
const DENTAL = ["dent", "치의", "치위생", "치기공"];
const ids = (terms: string[]) => [...new Set(searchByField(ROWS, FACULTIES, terms).map((h) => h.institution_id))];

Deno.test("English stems start a word, short acronyms are whole words, Korean sits anywhere", () => {
  assertEquals(termIn("computer science", "comput"), true);
  assertEquals(termIn("department of art", "art"), true);
  assertEquals(termIn("department", "art"), false);
  assertEquals(termIn("it design convergence", "it"), true);
  assertEquals(termIn("italian language", "it"), false);
  assertEquals(termIn("ai융합학과", "ai"), true);
  assertEquals(termIn("컴퓨터공학과", "컴퓨터"), true);
  assertEquals(termIn("library and information science", "information secur"), false);
});

Deno.test("IT finds every university with an IT programme, and only those", () => {
  // Most IT programmes first (a: 2), then the partner (c), then b (1).
  assertEquals(ids(IT), ["a", "c", "b"]);
});

Deno.test("dentistry finds only universities with a dental programme", () => {
  assertEquals(ids(DENTAL).sort(), ["a", "d"]);
  const a = searchByField(ROWS, FACULTIES, DENTAL).find((h) => h.institution_id === "a")!;
  assertEquals(a.matched, ["치위생학과"]);
});

Deno.test("a field found only in the master's guideline still finds the university", () => {
  const b = searchByField(ROWS, FACULTIES, IT).filter((h) => h.institution_id === "b");
  assertEquals(b.map((h) => h.guideline_id), ["g-b-m"]);
  assertEquals(b[0].matched, ["Information Security"]);
});

Deno.test("each university's bachelor guideline comes first", () => {
  const rows = [row({ guideline_id: "g-a-m", institution_id: "a", daraja: "magistratura" }), ...ROWS];
  const faculties = [...FACULTIES, { guideline_id: "g-a-m", fakultet_en: "Computer Science" }];
  const a = searchByField(rows, faculties, IT).filter((h) => h.institution_id === "a");
  assertEquals(a.map((h) => h.guideline_id), ["g-a", "g-a-m"]);
});

Deno.test("inactive guidelines and an empty field find nothing", () => {
  assertEquals(ids(["comput engineering"]), []);
  assertEquals(searchByField(ROWS, FACULTIES, []), []);
  assertEquals(searchByField(ROWS, FACULTIES, ["x", " "]), []);
});

Deno.test("terms are cleaned and the model's answer is checked", () => {
  assertEquals(cleanTerms(["Comput", "comput", "AI·", "x", "치과"]), ["comput", "ai", "치과"]);
  assertEquals(sanitizeTerms({ terms: ["comput", 3, "", " nurs "] }), ["comput", "nurs"]);
  assertEquals(sanitizeTerms({ terms: "comput" }), []);
  assertEquals(sanitizeTerms(null), []);
});
