import { assertEquals } from "jsr:@std/assert@1";
import { keyFromMap, publishableKey, serviceKey } from "./keys.ts";

const envOf = (vars: Record<string, string>) => (name: string) => vars[name];

Deno.test("a JSON key map: the default key, else the first one", () => {
  assertEquals(keyFromMap('{"default":"sb_secret_a","other":"sb_secret_b"}'), "sb_secret_a");
  assertEquals(keyFromMap('{"other":"sb_secret_b"}'), "sb_secret_b");
  assertEquals(keyFromMap('{"default":""}'), null);
  assertEquals(keyFromMap("{}"), null);
  assertEquals(keyFromMap("not json"), null);
  assertEquals(keyFromMap("null"), null);
  assertEquals(keyFromMap(undefined), null);
});

Deno.test("hanguk.uz's new keys come first", () => {
  const env = envOf({
    SUPABASE_SECRET_KEYS: '{"default":"sb_secret_new"}',
    SUPABASE_PUBLISHABLE_KEYS: '{"default":"sb_publishable_new"}',
    SUPABASE_SERVICE_ROLE_KEY: "eyJ.legacy.service",
    SUPABASE_ANON_KEY: "eyJ.legacy.anon",
  });
  assertEquals(serviceKey(env), "sb_secret_new");
  assertEquals(publishableKey(env), "sb_publishable_new");
});

Deno.test("the legacy keys when there are no new ones (the local stack)", () => {
  const env = envOf({ SUPABASE_SERVICE_ROLE_KEY: "eyJ.legacy.service", SUPABASE_ANON_KEY: "eyJ.legacy.anon" });
  assertEquals(serviceKey(env), "eyJ.legacy.service");
  assertEquals(publishableKey(env), "eyJ.legacy.anon");
  assertEquals(serviceKey(envOf({ SUPABASE_SECRET_KEYS: "{}", SUPABASE_SERVICE_ROLE_KEY: "eyJ.s" })), "eyJ.s");
  assertEquals(serviceKey(envOf({})), "");
});
