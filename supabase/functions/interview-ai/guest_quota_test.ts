// deno test supabase/functions/interview-ai/guest_quota_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { countsAgainstQuota, guestInterviewKey, isoWeek, weeklyLimitMessage } from "./guest_quota.ts";

Deno.test("ISO week in Tashkent", () => {
  assertEquals(isoWeek(new Date("2026-11-16T00:00:00Z")), "2026-W47"); // Monday
  assertEquals(isoWeek(new Date("2026-11-22T18:59:00Z")), "2026-W47"); // Sunday 23:59 Tashkent
  assertEquals(isoWeek(new Date("2026-11-22T19:00:00Z")), "2026-W48"); // Monday 00:00 Tashkent
  assertEquals(isoWeek(new Date("2027-01-01T12:00:00Z")), "2026-W53");
});

Deno.test("one key per guest and week", () => {
  assertEquals(guestInterviewKey("u1", new Date("2026-11-18T10:00:00Z")), "interview:u1:2026-W47");
});

Deno.test("only a guest's first message of an interview counts", () => {
  assertEquals(countsAgainstQuota(true, 0), true);
  assertEquals(countsAgainstQuota(true, 3), false);
  assertEquals(countsAgainstQuota(false, 0), false);
});

Deno.test("the limit message in five languages", () => {
  for (const l of ["uz", "ru", "en", "ko", "vi"]) assertEquals(weeklyLimitMessage(l).length > 20, true);
  assertEquals(weeklyLimitMessage("de"), weeklyLimitMessage("uz"));
});
