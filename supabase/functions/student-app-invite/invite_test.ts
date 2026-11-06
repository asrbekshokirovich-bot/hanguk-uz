// deno test supabase/functions/student-app-invite/invite_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { appLink, decide, PLAY_URL, taskFor, telegramText, type Target } from "./invite.ts";

const now = new Date("2026-11-20T06:10:00Z");
const t = (o: Partial<Target> = {}): Target => ({
  student_id: "s1", full_name: "Aziz Karimov", magic_code: "123456", lang: "uz", contract_date: "2026-11-15",
  telegram_id: "6850847912", account_label: "hanguk", link_code: null, consultant: null, last_invite_at: null, ...o,
});

Deno.test("Telegram when the userbot knows the chat, else a task", () => {
  assertEquals(decide(t(), now, false), { channel: "telegram" });
  assertEquals(decide(t({ account_label: null }), now, false), { channel: "task" });
  assertEquals(decide(t({ telegram_id: null }), now, false), { channel: "task" });
});

Deno.test("auto: new contracts only, never twice; by hand: not within 7 days", () => {
  assertEquals(decide(t({ contract_date: "2026-10-01" }), now, true), { skip: "old_contract" });
  assertEquals(decide(t({ last_invite_at: "2026-11-01T00:00:00Z" }), now, true), { skip: "recent" });
  assertEquals(decide(t({ last_invite_at: "2026-11-18T00:00:00Z" }), now, false), { skip: "recent" });
  assertEquals(decide(t({ last_invite_at: "2026-11-01T00:00:00Z", contract_date: "2026-01-01" }), now, false), { channel: "telegram" });
});

Deno.test("the link ties the phone to the lead when there is a code", () => {
  assertEquals(appLink("Abc1234567"), "https://hanguk.uz/l/abc1234567");
  assertEquals(appLink(null), PLAY_URL);
  assertEquals(appLink("x"), PLAY_URL);
});

Deno.test("the message carries the name, link and code, in five languages", () => {
  for (const lang of ["uz", "ru", "en", "ko", "vi"]) {
    const m = telegramText(t({ lang }), null);
    assertEquals(m.includes("Aziz") && m.includes(PLAY_URL) && m.includes("123456"), true, lang);
  }
  assertEquals(telegramText(t(), "https://apps.apple.com/app/id1").includes("iPhone: https://apps.apple.com/app/id1"), true);
  assertEquals(telegramText(t({ link_code: "abc1234567" }), "https://apps.apple.com/app/id1").includes("iPhone"), false);
  assertEquals(telegramText(t({ lang: "de" }), null).startsWith("Assalomu alaykum, Aziz!"), true);
});

Deno.test("the task names the student and carries the code", () => {
  const k = taskFor(t({ telegram_id: null }), null);
  assertEquals(k.title, "Ilovaga taklif: Aziz Karimov");
  assertEquals(k.description.includes("123456") && k.description.includes(PLAY_URL), true);
});
