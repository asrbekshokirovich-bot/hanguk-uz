// deno test supabase/functions/staff-bot/core_test.ts
import { assertEquals } from "jsr:@std/assert@1";

import {
  fmtDue,
  groupTasks,
  linkResultText,
  parseCommand,
  parseStartCode,
  renderTaskList,
  splitMessage,
  tashkentDate,
  tashkentDayStart,
  type TaskRow,
} from "./core.ts";

Deno.test("parseStartCode: deep link kodi, katta harfga", () => {
  assertEquals(parseStartCode("/start AbC2345678"), "ABC2345678");
  assertEquals(parseStartCode("/start@HangukTeamBot XYZ-1"), "XYZ-1");
  assertEquals(parseStartCode("/start"), null);
  assertEquals(parseStartCode("/start   "), null);
  assertEquals(parseStartCode("salom"), null);
  assertEquals(parseStartCode("/start kod bilan bo'shliq"), null); // ikkita so'z — kod emas
  assertEquals(parseStartCode("/start ab"), null); // juda qisqa
});

Deno.test("parseCommand", () => {
  assertEquals(parseCommand("/bugun"), { cmd: "bugun", arg: "" });
  assertEquals(parseCommand("/vazifa@Bot Diyora: apostil, ertaga"), { cmd: "vazifa", arg: "Diyora: apostil, ertaga" });
  assertEquals(parseCommand("📋 Vazifalarim"), null);
  assertEquals(parseCommand(""), null);
});

Deno.test("Toshkent kuni: UTC+5, DST yo'q", () => {
  // 2026-10-29 19:30 UTC = 30-oktyabr 00:30 Toshkent
  const t = Date.parse("2026-10-29T19:30:00Z");
  assertEquals(tashkentDate(t), "2026-10-30");
  assertEquals(new Date(tashkentDayStart(t)).toISOString(), "2026-10-29T19:00:00.000Z");
  assertEquals(fmtDue("2026-10-30T00:00:00+05:00"), "30.10");
  assertEquals(fmtDue("2026-10-30T09:30:00+05:00"), "30.10 09:30");
  assertEquals(fmtDue(null), "");
  assertEquals(fmtDue("bo'lmagan sana"), "");
});

Deno.test("groupTasks: kechikkan / bugun / keyingi / muddatsiz", () => {
  const now = Date.parse("2026-10-29T07:00:00Z"); // 12:00 Toshkent
  const rows: TaskRow[] = [
    { id: "1", title: "kecha", status: "todo", priority: "normal", due_date: "2026-10-28T10:00:00+05:00" },
    { id: "2", title: "bugun kech", status: "in_progress", priority: "high", due_date: "2026-10-29T18:00:00+05:00" },
    { id: "3", title: "bugun erta", status: "todo", priority: "normal", due_date: "2026-10-29T09:00:00+05:00" },
    { id: "4", title: "ertaga", status: "todo", priority: "urgent", due_date: "2026-10-30T00:00:00+05:00" },
    { id: "5", title: "muddatsiz", status: "todo", priority: "low", due_date: null },
  ];
  const g = groupTasks(rows, now);
  assertEquals(g.overdue.map((t) => t.id), ["1"]);
  assertEquals(g.today.map((t) => t.id), ["3", "2"]); // vaqt bo'yicha
  assertEquals(g.upcoming.map((t) => t.id), ["4"]);
  assertEquals(g.nodate.map((t) => t.id), ["5"]);
  const text = renderTaskList(g);
  assertEquals(text.startsWith("📋 <b>Ochiq vazifalar: 5</b>"), true);
  assertEquals(text.includes("🔴 Muddati o'tgan"), true);
  assertEquals(text.includes("• bugun kech — 29.10 18:00 ❗ ▶"), true);
  assertEquals(renderTaskList(groupTasks([], now)), "✅ Ochiq vazifangiz yo'q.");
});

Deno.test("renderTaskList: HTML belgilar qochiriladi", () => {
  const g = groupTasks([{ id: "1", title: "<b>x</b> & y", status: "todo", priority: "normal", due_date: null }], Date.now());
  assertEquals(renderTaskList(g).includes("&lt;b&gt;x&lt;/b&gt; &amp; y"), true);
});

Deno.test("splitMessage: satr chegarasida bo'linadi", () => {
  const lines = Array.from({ length: 300 }, (_, i) => `• vazifa ${i} — juda uzun sarlavha bilan`);
  const parts = splitMessage(lines.join("\n"), 1000);
  assertEquals(parts.length > 1, true);
  for (const p of parts) assertEquals(p.length <= 1000, true);
  assertEquals(parts.join("\n"), lines.join("\n"));
});

Deno.test("linkResultText", () => {
  assertEquals(linkResultText("linked", "Diyora").startsWith("✅ Xush kelibsiz, Diyora!"), true);
  assertEquals(linkResultText("expired", "").includes("muddati o'tgan"), true);
  assertEquals(linkResultText("nimadir", "").includes("noto'g'ri"), true);
});

import { parseTaskText, renderDraft } from "./core.ts";

Deno.test("parseTaskText: ertaga, soat, zarur", () => {
  const now = Date.parse("2026-11-02T06:00:00Z"); // Du 11:00 Toshkent
  const p = parseTaskText("Kim Minsu apostil hujjatlarini ertaga soat 15:00 gacha topshir, zarur", now);
  assertEquals(p.due, "2026-11-03T10:00:00.000Z");
  assertEquals(p.priority, "urgent");
  assertEquals(p.title.startsWith("Kim Minsu"), true);
});

Deno.test("parseTaskText: sana, hafta kuni, muddatsiz", () => {
  const now = Date.parse("2026-11-02T06:00:00Z"); // dushanba
  assertEquals(parseTaskText("05.11 gacha paket yig'", now).due, "2026-11-05T13:00:00.000Z"); // 18:00
  assertEquals(parseTaskText("jumagacha hisobot", now).due, "2026-11-06T13:00:00.000Z");
  assertEquals(parseTaskText("dushanba kuni qo'ng'iroq", now).due, "2026-11-09T13:00:00.000Z"); // keyingi dushanba
  assertEquals(parseTaskText("indinga tarjima", now).due, "2026-11-04T13:00:00.000Z");
  assertEquals(parseTaskText("01.01 dan keyin", now).due, "2027-01-01T13:00:00.000Z");
  const n = parseTaskText("Muratovga qo'ng'iroq qil, muhim", now);
  assertEquals(n.due, null);
  assertEquals(n.priority, "high");
});

Deno.test("renderDraft", () => {
  const t = renderDraft("Diyora", { title: "a<b", due: "2026-11-03T10:00:00.000Z", priority: "urgent" });
  assertEquals(t.includes("<b>Diyora</b>ga vazifa"), true);
  assertEquals(t.includes("a&lt;b"), true);
  assertEquals(t.includes("Muddat: 03.11 15:00 · Muhimlik: zarur"), true);
});

import { renderReport, renderSummary, type SummaryRow } from "./core.ts";

Deno.test("renderReport: AI qismlari yoki asl matn", () => {
  assertEquals(renderReport("a<b", null), "📝 a&lt;b");
  assertEquals(renderReport("x", { done: null, blockers: null, plan: null }), "📝 x");
  const t = renderReport("x", { done: "3 ta qo'ng'iroq", blockers: null, plan: "apostil" });
  assertEquals(t, "✅ <b>Bajarildi:</b> 3 ta qo'ng'iroq\n🗓 <b>Ertaga:</b> apostil");
});

Deno.test("renderSummary: topshirgan/topshirmagan, to'siqlar", () => {
  const base = { done: null, blockers: null, plan: null, raw_text: null, completed_today: 0, overdue: 0 };
  const rows: SummaryRow[] = [
    { ...base, full_name: "Omina", is_linked: true, has_report: false, overdue: 2 },
    { ...base, full_name: "Diyora", is_linked: true, has_report: true, done: "hujjat", blockers: "printer buzuq", completed_today: 3 },
    { ...base, full_name: "Olmos", is_linked: false, has_report: false },
    { ...base, full_name: "Madina", is_linked: true, has_report: true, raw_text: "erkin matn" },
  ];
  const s = renderSummary(rows, "02.11");
  assertEquals(s.includes("Topshirdi: 2 / 4"), true);
  assertEquals(s.includes("• Diyora: printer buzuq"), true);
  assertEquals(s.includes("❌ <b>Olmos</b> — hisobot yo'q (botga ulanmagan)"), true);
  assertEquals(s.includes("kechikkan: 2"), true);
  assertEquals(s.includes("   erkin matn"), true);
  assertEquals(s.indexOf("Diyora</b>") < s.indexOf("Madina</b>"), true); // avval topshirganlar, alifbo
  assertEquals(s.indexOf("Madina</b>") < s.indexOf("Olmos</b>"), true);
});

import { isDoneReply, parseGroupCommand } from "./core.ts";

Deno.test("parseGroupCommand: #vazifa, /vazifa@bot, eslatmalar", () => {
  const t = "#vazifa @diyora_h apostil hujjatlari, ertaga 15:00";
  const r = parseGroupCommand(t, [{ type: "hashtag", offset: 0, length: 7 }, { type: "mention", offset: 8, length: 9 }]);
  assertEquals(r, { body: "apostil hujjatlari, ertaga 15:00", usernames: ["diyora_h"], userIds: [] });
  const t2 = "/vazifa@STAFF_HANGUK_BOT Madina: qo'ng'iroq qil";
  const r2 = parseGroupCommand(t2, [{ type: "bot_command", offset: 0, length: 24 }, { type: "text_mention", offset: 25, length: 6, user: { id: 42 } }]);
  assertEquals(r2, { body: "qo'ng'iroq qil", usernames: [], userIds: [42] });
  assertEquals(parseGroupCommand("#vazifa", []), { body: "", usernames: [], userIds: [] });
  assertEquals(parseGroupCommand("bugun vazifa ko'p", []), null);
  assertEquals(parseGroupCommand("#vazifalar ro'yxati", []), null);
  assertEquals(parseGroupCommand(null, []), null);
});

Deno.test("isDoneReply", () => {
  for (const s of ["✅", "✅✅", "+", "👍", "Bajarildi", "bajardim!", "tayyor", "bo‘ldi", "done", "Готово"]) {
    assertEquals(isDoneReply(s), true, s);
  }
  for (const s of ["bajarildimi?", "hali tayyor emas", "ok", "", "ertaga bajaraman"]) {
    assertEquals(isDoneReply(s), false, s);
  }
});
