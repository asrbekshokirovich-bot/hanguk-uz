// deno test supabase/functions/notify-guest-reminders/plan_test.ts
import { assertEquals } from "jsr:@std/assert@1";
import { isQuiet, parseMode, planBatch, type PendingRow } from "./plan.ts";
import { list, messageText, nameFor, pushData } from "./messages.ts";

const row = (o: Partial<PendingRow>): PendingRow => ({
  queue_id: 1, install_id: "a", kind: "deadline_7", institution_id: "u1", ref_date: "2026-11-20",
  lang: "uz", tokens: ["t1"], is_test: false, sent_today: 0, sent_7d: 0, ...o,
});

Deno.test("nothing goes while the switch is off; test mode only test phones", () => {
  const rows = [row({ install_id: "a" }), row({ queue_id: 2, install_id: "b", is_test: true })];
  assertEquals(planBatch(rows, "off"), { send: [], skip: [], wait: 2 });
  const t = planBatch(rows, "test");
  assertEquals(t.send.map((m) => m.install_id), ["b"]);
  assertEquals(t.wait, 1);
  assertEquals(planBatch(rows, "all").send.length, 2);
});

Deno.test("one message a day: several universities merge, the most urgent names it", () => {
  const p = planBatch([
    row({ queue_id: 1, kind: "deadline_7", institution_id: "u1" }),
    row({ queue_id: 2, kind: "deadline_1", institution_id: "u2" }),
    row({ queue_id: 3, kind: "deadline_1", institution_id: "u3" }),
  ], "all");
  assertEquals(p.send.length, 1);
  assertEquals(p.send[0].kind, "deadline_1");
  assertEquals(p.send[0].institution_ids, ["u2", "u3"]);
  assertEquals(p.skip, [{ queue_id: 1, note: "merged" }]);
});

Deno.test("already sent today: waits", () => {
  assertEquals(planBatch([row({ sent_today: 1, sent_7d: 1 })], "all"), { send: [], skip: [], wait: 1 });
});

Deno.test("two in seven days; the 3-day reminder leaves room for the 1-day one", () => {
  assertEquals(planBatch([row({ sent_7d: 2, kind: "deadline_1" })], "all").skip, [{ queue_id: 1, note: "week_cap" }]);
  assertEquals(planBatch([row({ sent_7d: 1, kind: "deadline_3" })], "all").skip, [{ queue_id: 1, note: "week_cap" }]);
  assertEquals(planBatch([row({ sent_7d: 1, kind: "deadline_1" })], "all").send.length, 1);
  assertEquals(planBatch([row({ sent_7d: 0, kind: "deadline_3" })], "all").send.length, 1);
});

Deno.test("a phone with no token waits, unless it subscribed in Telegram", () => {
  assertEquals(planBatch([row({ tokens: [] })], "all").wait, 1);
  const tg = planBatch([row({ tokens: [], tg_chat: "123" })], "all").send[0];
  assertEquals([tg.channel, tg.tg_chat], ["telegram", "123"]);
  assertEquals(planBatch([row({ tg_chat: "123" })], "all").send[0].channel, "fcm");
});

Deno.test("quiet 22:00–08:00 Tashkent", () => {
  assertEquals(isQuiet(new Date("2026-11-20T05:00:00Z")), false); // 10:00
  assertEquals(isQuiet(new Date("2026-11-20T14:00:00Z")), false); // 19:00
  assertEquals(isQuiet(new Date("2026-11-20T17:00:00Z")), true); // 22:00
  assertEquals(isQuiet(new Date("2026-11-20T02:59:00Z")), true); // 07:59
});

Deno.test("switch values", () => {
  assertEquals(parseMode(undefined), "off");
  assertEquals(parseMode("TEST"), "test");
  assertEquals(parseMode("all"), "all");
  assertEquals(parseMode("true"), "all");
  assertEquals(parseMode("yes"), "off");
});

Deno.test("text in five languages", () => {
  for (const lang of ["uz", "ru", "en", "ko", "vi"] as const) {
    for (const kind of ["deadline_7", "deadline_3", "deadline_1", "guideline_new"] as const) {
      const t = messageText(kind, lang, ["Korea University"]);
      assertEquals(t.title.length > 0 && t.body.startsWith("Korea University"), true, `${kind} ${lang}`);
    }
  }
  assertEquals(messageText("deadline_7", "uz", ["A"]).title, "Onlayn arizaga 7 kun qoldi ⏰");
  assertEquals(messageText("deadline_1", "uz", ["A"]).title, "Ertaga onlayn ariza muddati tugaydi ⏰");
  assertEquals(messageText("deadline_3", "ru", ["A"]).title, "До конца онлайн-подачи 3 дня ⏰");
  assertEquals(list(["A", "B"], "uz"), "A va B");
  assertEquals(list(["A", "B", "C", "D"], "en"), "A, B, C +1");
});

Deno.test("the app opens the university", () => {
  assertEquals(pushData("deadline_3", "u1"), { type: "guest_deadline", kind: "deadline_3", institution_id: "u1" });
  assertEquals(pushData("guideline_new", "u1").type, "guideline_new");
  assertEquals(nameFor({ name_en: "Korea University", name_ko: "고려대학교" }, "ko"), "고려대학교");
  assertEquals(nameFor({ name_en: "", name_ko: "고려대학교" }, "uz"), "고려대학교");
});
