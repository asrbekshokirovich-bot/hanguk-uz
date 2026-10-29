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
