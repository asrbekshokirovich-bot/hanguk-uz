// deno test supabase/functions/infra-health-check/ig_token_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { IG_TOKEN_MIN_DAYS, igTokenLine } from "./ig_token.ts";

const NOW = Date.parse("2026-11-12T10:00:00Z");
const inDays = (d: number) => new Date(NOW + d * 86_400_000 + 3_600_000).toISOString();

Deno.test("a token refreshed this week is fine", () => {
  assertEquals(igTokenLine([{ username: "hanguk_consulting", token_expires_at: inDays(56) }], NOW), {
    state: "ok",
    detail: "token yana 56 kun amal qiladi",
  });
  // One missed Monday is not yet a fault: the next one may mend it.
  assertEquals(igTokenLine([{ username: "hanguk_consulting", token_expires_at: inDays(46) }], NOW).state, "ok");
  assertEquals(igTokenLine([{ token_expires_at: inDays(IG_TOKEN_MIN_DAYS) }], NOW).state, "ok");
});

Deno.test("two missed refreshes: a fault with five weeks to mend it", () => {
  assertEquals(igTokenLine([{ username: "hanguk_consulting", token_expires_at: inDays(39) }], NOW), {
    state: "fail",
    detail: "@hanguk_consulting: tokenga 39 kun qoldi — haftalik yangilash ishlamayapti",
  });
});

Deno.test("an expired token, and one with no date", () => {
  assertEquals(igTokenLine([{ username: "a", token_expires_at: inDays(-3) }], NOW), {
    state: "fail",
    detail: "@a: token muddati 3 kun oldin tugagan",
  });
  assertEquals(igTokenLine([{ username: null, token_expires_at: null }], NOW), {
    state: "fail",
    detail: "akkaunt: token muddati yozilmagan",
  });
});

Deno.test("several accounts: every fault is named; the least days when all are fine", () => {
  assertEquals(
    igTokenLine([
      { username: "a", token_expires_at: inDays(55) },
      { username: "b", token_expires_at: inDays(10) },
      { username: "c", token_expires_at: "not a date" },
    ], NOW),
    { state: "fail", detail: "@b: tokenga 10 kun qoldi — haftalik yangilash ishlamayapti; @c: token muddati yozilmagan" },
  );
  assertEquals(
    igTokenLine([{ username: "a", token_expires_at: inDays(55) }, { username: "b", token_expires_at: inDays(58) }], NOW).detail,
    "token yana 55 kun amal qiladi",
  );
});

Deno.test("no connected account is not this check's fault", () => {
  assertEquals(igTokenLine([], NOW), { state: "ok", detail: "faol Instagram akkaunti yo'q" });
});
