// texts.json is the apps' own words: made from their ARB files and the Seoul
// districts (hanguk_ish/tool/push_texts.py). After changing either, run the
// script; until then this fails.
import { assertEquals } from "jsr:@std/assert@1";
import texts from "./texts.json" with { type: "json" };

const root = new URL("../../../", import.meta.url);
const read = (path: string) => Deno.readTextFileSync(new URL(path, root));
const LANGS = ["uz", "ru", "en", "ko"] as const;
const PLACE = /Place\('([^']*)',\s*uz:\s*'([^']*)',\s*ru:\s*'([^']*)',\s*en:\s*'([^']*)',\s*ko:\s*'([^']*)'\)/g;

const places = (source: string) =>
  [...source.matchAll(PLACE)].map((m) => [m[1], Object.fromEntries(LANGS.map((l, i) => [l, m[i + 2]]))] as const);

Deno.test("the strings are the apps' own (A12, 알림), in all four languages", () => {
  for (const lang of LANGS) {
    const arb = JSON.parse(read(`hanguk_ish/lib/l10n/app_${lang}.arb`));
    const ours = (texts.strings as Record<string, Record<string, string>>)[lang];
    for (const [key, value] of Object.entries(ours)) assertEquals(value, arb[key], `${lang}.${key}`);
    assertEquals(Object.keys(ours).length, 20, lang);
  }
});

Deno.test("the Seoul districts and Seoul are the app's", () => {
  const source = read("hanguk_ish/lib/data/catalog/places.dart");
  const list = source.slice(source.indexOf("const seoulDistricts"));
  const districts = Object.fromEntries(places(list.slice(0, list.indexOf("];"))));
  assertEquals(texts.districts, districts);
  const feed = read("hanguk_ish/lib/features/worker/feed/feed_area.dart");
  const seoul = places(feed.split("\n").find((l) => l.startsWith("const seoulPlace"))!)[0][1];
  assertEquals(texts.seoul, seoul);
});
