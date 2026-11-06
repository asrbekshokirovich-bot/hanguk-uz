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

import { type AiAnalysis, type CtxStaff, interpretAnalysis, matchStaff, MIN_CONFIDENCE, ON_CONFIDENCE, type Proposal, renderProposal, shouldAnalyze, similarTitle } from "./core.ts";

const STAFF: CtxStaff[] = [
  { user_id: "u-d", name: "Diyora", username: "drantares", tasks: [{ id: "t1", title: "Kim Minsu apostil hujjatlari" }] },
  { user_id: "u-m", name: "Madina", username: "rashidova017", tasks: [] },
  { user_id: "u-o", name: "Omina", username: null, tasks: [{ id: "t2", title: "Toshkent lidlariga qo'ng'iroq" }, { id: "t3", title: "Sumka buyurtma" }] },
];
const ai = (p: Partial<AiAnalysis>): AiAnalysis => ({
  action: "create_task", assignee: "Madina", title: "Ali ga qo'ng'iroq qilish", due_text: "ertaga 15:00",
  priority: "normal", task_ref: 0, confidence: 0.9, reason: "aniq topshiriq", ...p,
});
const NOW = Date.parse("2026-11-02T06:00:00Z");

Deno.test("shouldAnalyze", () => {
  assertEquals(shouldAnalyze("Madina, ertaga Aliga qo'ng'iroq qil"), true);
  assertEquals(shouldAnalyze("ok"), false);
  assertEquals(shouldAnalyze("#vazifa @x biror ish qilish kerak"), false);
  assertEquals(shouldAnalyze("👍👍👍👍👍👍👍👍👍👍👍👍"), false);
  assertEquals(shouldAnalyze(null), false);
});

Deno.test("matchStaff: username, ism, noaniq", () => {
  assertEquals(matchStaff("@drantares", STAFF)?.user_id, "u-d");
  assertEquals(matchStaff("madina", STAFF)?.user_id, "u-m");
  assertEquals(matchStaff("Kimdir", STAFF), null);
  assertEquals(matchStaff("", STAFF), null);
});

Deno.test("similarTitle", () => {
  assertEquals(similarTitle("Kim Minsu apostil hujjatlari", "Kim Minsu apostil hujjatlarini topshirish"), true);
  assertEquals(similarTitle("Sumka buyurtma", "Toshkent lidlariga qo'ng'iroq"), false);
});

Deno.test("interpretAnalysis: yaratish, past ishonch, dublikat, yopish, o'ylab topilgan raqam", () => {
  const p = interpretAnalysis(ai({}), STAFF, NOW)!;
  assertEquals(p.kind, "create");
  assertEquals(p.assignee_user_id, "u-m");
  assertEquals(p.due, "2026-11-03T10:00:00.000Z");
  assertEquals(interpretAnalysis(ai({ confidence: 0.6 }), STAFF, NOW), null);
  assertEquals(interpretAnalysis(ai({ assignee: "Noma'lum" }), STAFF, NOW), null);
  assertEquals(interpretAnalysis(ai({ assignee: "Diyora", title: "Kim Minsu apostil hujjatlari" }), STAFF, NOW), null);
  assertEquals(interpretAnalysis(ai({ action: "none" }), STAFF, NOW), null);
  const c = interpretAnalysis(ai({ action: "close_task", assignee: "Omina", task_ref: 2 }), STAFF, NOW)!;
  assertEquals([c.kind, c.task_id, c.title], ["close", "t3", "Sumka buyurtma"]);
  assertEquals(interpretAnalysis(ai({ action: "close_task", assignee: "Omina", task_ref: 9 }), STAFF, NOW), null);
  assertEquals(interpretAnalysis(null, STAFF, NOW), null);
});

Deno.test("renderProposal", () => {
  const p = interpretAnalysis(ai({ priority: "urgent" }), STAFF, NOW)!;
  const t = renderProposal(p, "Asrbek");
  assertEquals(t.includes("Madina uchun vazifa"), true);
  assertEquals(t.includes("muddat 03.11 15:00 · zarur"), true);
  assertEquals(t.includes("Asrbek tasdiqlasin"), true);
});

Deno.test("renderProposal: update — muddat o'zgarishi taklifi (B5-1)", () => {
  const p: Proposal = {
    kind: "update", assignee_user_id: "u1", assignee_name: "Bobur Aliyev", task_id: "t1",
    title: "Apostil qilish", due: "2026-11-07T10:00:00.000Z", priority: "normal", confidence: 0.9, reason: "sabab",
  };
  const t = renderProposal(p, "Aziz Karimov");
  assertEquals(t.includes("Apostil qilish"), true);
  assertEquals(t.includes("Bobur Aliyev"), true);
  assertEquals(t.includes("o'zgartirilsinmi"), true);
});

Deno.test("ON_CONFIDENCE: MIN_CONFIDENCE'dan yuqori (B5-1 — guruhga chiqish chegarasi)", () => {
  assertEquals(ON_CONFIDENCE > MIN_CONFIDENCE, true);
});

import { mdToPlain, parseAiStream } from "./core.ts";

Deno.test("parseAiStream: delta'lar yig'iladi, hanguk voqealari tashlanadi", () => {
  const raw = [
    ": hanguk-ai", "",
    'data: {"hanguk":{"type":"step","tools":["search_students"]}}', "",
    'data: {"choices":[{"delta":{"content":"Salom, "}}]}', "",
    'data: {"choices":[{"delta":{"content":"3 ta talaba."}}]}', "",
    "data: [DONE]", "data: {buzilgan",
  ].join("\n");
  assertEquals(parseAiStream(raw), "Salom, 3 ta talaba.");
  assertEquals(parseAiStream(""), "");
});

Deno.test("mdToPlain", () => {
  assertEquals(mdToPlain("## Natija\n**3 ta** talaba, `kod` [havola](https://x.uz)"), "Natija\n3 ta talaba, kod havola (https://x.uz)");
});

import { HELP_GUIDE } from "./core.ts";

Deno.test("HELP_GUIDE: barcha bo'limlar va HTML teglari yopiq", () => {
  for (const k of ["Vazifalarim", "Vazifa berish", "Hisobot", "Savol", "#vazifa", "/bugun", "/cancel", "09:00", "17:00"]) {
    assertEquals(HELP_GUIDE.includes(k), true, k);
  }
  for (const tag of ["b", "i", "code"]) {
    const open = (HELP_GUIDE.match(new RegExp(`<${tag}>`, "g")) ?? []).length;
    const close = (HELP_GUIDE.match(new RegExp(`</${tag}>`, "g")) ?? []).length;
    assertEquals(open, close, tag);
  }
  assertEquals(HELP_GUIDE.length < 4000, true);
});

import { type GroupDigest, renderBrief, renderGroupDigest } from "./core.ts";

const DIGEST: GroupDigest = {
  date: "2026-11-05", weekday: 4, prev_date: "2026-11-04",
  counts: { open: 16, overdue: 6, today: 4, done: 1 },
  people: [
    {
      name: "Xo'jamurod", overdue: 1, today: 1, tasks: [
        { title: "Kamera <integratsiya>", due: "2026-11-03T17:00:00+00:00", kind: "overdue", late_days: 2, wip: true, hi: false },
        { title: "Rejani yakunla", due: "2026-11-05T13:00:00+00:00", kind: "today", late_days: 0, wip: false, hi: true },
      ],
    },
    {
      name: "Olmos", overdue: 7, today: 0,
      tasks: Array.from({ length: 7 }, (_, i) => ({
        title: `V${i}`, due: "2026-10-15T00:00:00+00:00", kind: "overdue" as const, late_days: 21, wip: false, hi: false,
      })),
    },
  ],
  brief: {
    new_leads: 15, docs_waiting: 7, docs_waiting_student: 5, docs_waiting_ai: 2,
    deadlines: [{ university: "Gyeongsang", date: "2026-11-11", days_left: 6, students: 1 }],
  },
  reports: { submitted: 1, expected: 3, missing: ["Diyora", "Omina"] },
};

Deno.test("renderGroupDigest: sarlavha, sonlar, xodimlar, brifing, hisobot", () => {
  const t = renderGroupDigest(DIGEST);
  assertEquals(t.startsWith("☀️ <b>Xayrli tong, jamoa!</b> Payshanba, 05.11"), true, t);
  assertEquals(t.includes("📋 <b>Vazifalar:</b> ochiq 16 · 🔴 kechikkan 6 · 🟡 bugun 4"), true);
  assertEquals(t.includes("✅ Kecha bajarildi: 1"), true);
  assertEquals(t.includes("👤 <b>Xo'jamurod</b> — 🔴 1 · 🟡 1"), true);
  // HTML qochiriladi; kechikkan — sana va kun; bugungi — soat; ❗ va ▶ belgilari
  assertEquals(t.includes("🔴 Kamera &lt;integratsiya&gt; — 03.11, 2 kun kechikdi ▶"), true, t);
  assertEquals(t.includes("🟡 Rejani yakunla — 18:00 gacha ❗"), true, t);
  // hammasi ko'rsatiladi (standart); cheklov berilsa — «yana N ta»
  assertEquals(t.includes("🔴 V6 —"), true);
  assertEquals(t.includes("… yana"), false);
  const short = renderGroupDigest(DIGEST, 5);
  assertEquals(short.includes("🔴 V5 —"), false);
  assertEquals(short.includes("… yana 2 ta"), true);
  assertEquals(t.includes("👤 <b>Olmos</b> — 🔴 7"), true);
  assertEquals(t.includes("• Yangi lidlar (24 soat): <b>15</b>"), true);
  assertEquals(t.includes("• Tekshiruvni kutayotgan hujjatlar: <b>7</b> (talaba yuklagan: 5, AI tarjima: 2)"), true);
  assertEquals(t.includes("• Gyeongsang — 11.11 (6 kun), talabalar: 1"), true);
  assertEquals(t.includes("📝 Kechagi kunlik hisobot: <b>1/3</b> xodim topshirdi\nTopshirmaganlar: Diyora, Omina"), true, t);
});

Deno.test("renderGroupDigest: dushanba — shanbadan beri; bo'sh kun", () => {
  const t = renderGroupDigest({
    ...DIGEST, date: "2026-11-09", weekday: 1, prev_date: "2026-11-07",
    people: [], brief: { new_leads: 0, docs_waiting: 0, deadlines: [] }, reports: { submitted: 0, expected: 0 },
  });
  assertEquals(t.includes("Dushanba, 09.11"), true);
  assertEquals(t.includes("✅ Shanbadan beri bajarildi: 1"), true);
  assertEquals(t.includes("Kechikkan va bugungi vazifa yo'q"), true);
  assertEquals(t.includes("Ish holati"), false);
  assertEquals(t.includes("kunlik hisobot"), false); // kutilgan 0 — qator chiqmaydi
  const t2 = renderGroupDigest({ ...DIGEST, date: "2026-11-09", weekday: 1, prev_date: "2026-11-07" });
  assertEquals(t2.includes("📝 Shanba kungi kunlik hisobot: <b>1/3</b>"), true);
  // CRM sana tanlagichi (00:00 UTC) — soat ko'rsatilmaydi
  const t3 = renderGroupDigest({ ...DIGEST, people: [{ name: "A", overdue: 0, today: 1, tasks: [
    { title: "Sana", due: "2026-11-05T00:00:00+00:00", kind: "today", late_days: 0, wip: false, hi: false }] }] });
  assertEquals(t3.includes("🟡 Sana\n") || t3.endsWith("🟡 Sana"), true, t3);
});

Deno.test("renderBrief: muddatlar bo'limi o'zgarmadi", () => {
  const t = renderBrief({ new_leads: 2, my_new_leads: 1, my_overdue_tasks: 0, docs_waiting: 0, deadlines: DIGEST.brief!.deadlines });
  assertEquals(t, [
    "📊 <b>Bugungi brifing</b>",
    "• Yangi lidlar (24 soat): <b>2</b>, sizga: <b>1</b>",
    "",
    "⏰ <b>7 kun ichida onlayn ariza muddati</b>",
    "• Gyeongsang — 11.11 (6 kun), talabalar: 1",
  ].join("\n"));
});

import { fmtUsd, renderAiLine } from "./core.ts";

Deno.test("renderSummary: oxirida AI qatori (24 soat); ma'lumot bo'lmasa qator yo'q", () => {
  const rows: SummaryRow[] = [{ full_name: "Diyora", is_linked: true, has_report: true, done: "hujjat", blockers: null,
    plan: null, raw_text: null, completed_today: 1, overdue: 0 }];
  const s = renderSummary(rows, "05.11", { calls: 27, errors: 3, cost_usd: 0.0042 });
  assertEquals(s.endsWith("\n\n🤖 AI (24 soat): 27 chaqiruv, 3 xato, $0,0042"), true, s);
  assertEquals(renderSummary(rows, "05.11").includes("🤖 AI"), false);
  assertEquals(renderSummary(rows, "05.11", null).includes("🤖 AI"), false);
  assertEquals(renderAiLine({ calls: 0, errors: 0, cost_usd: null }), "🤖 AI (24 soat): 0 chaqiruv, 0 xato, $0");
});

Deno.test("fmtUsd", () => {
  assertEquals([fmtUsd(0), fmtUsd(null), fmtUsd(0.00035), fmtUsd(0.0042), fmtUsd(0.15312), fmtUsd(1.274), fmtUsd(0.000001)],
    ["$0", "$0", "$0,00035", "$0,0042", "$0,153", "$1,27", "$0,000001"]);
});
