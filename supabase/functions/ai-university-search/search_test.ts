// deno test supabase/functions/ai-university-search/search_test.ts
//
// The matching itself is SQL (ai_search_by_field); these pin the helpers that
// prepare its input.
import { assertEquals } from "jsr:@std/assert@1";

import { cleanTerms, parseTermsReply, PROMPT_VERSION, queryKey } from "./search.ts";

Deno.test("the same text, typed any way, has one key", () => {
  assertEquals(queryKey("  IT  "), `${PROMPT_VERSION}:it`);
  assertEquals(queryKey("Hamshiralik\tyo'nalishi"), queryKey("hamshiralik yo'nalishi"));
});

Deno.test("terms keep only what the database matches", () => {
  assertEquals(cleanTerms(["Comput", "comput", "AI·", "x", "치과", 3, "Information  Secur", "компьютер"]), [
    "comput",
    "ai",
    "치과",
    "information secur",
  ]);
  assertEquals(cleanTerms(Array.from({ length: 30 }, (_, i) => `term${i}`)).length, 24);
});

Deno.test("the reply's terms are read, wrapped or not", () => {
  assertEquals(parseTermsReply('{"terms": ["dent", "치위생"]}'), ["dent", "치위생"]);
  assertEquals(parseTermsReply('```json\n{"terms": ["nurs"]}\n```'), ["nurs"]);
  assertEquals(parseTermsReply('{"terms": []}'), []);
  assertEquals(parseTermsReply("no json here"), null);
  assertEquals(parseTermsReply('{"terms": "nurs"}'), null);
});
