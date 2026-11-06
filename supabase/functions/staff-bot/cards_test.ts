// deno test supabase/functions/staff-bot/cards_test.ts — kartaga javob (B1-3): ajratish, ruxsat, xabarlar.
import { assertEquals } from "jsr:@std/assert@1";
import {
  CARD_HINT,
  cardErrorText,
  commentRecipients,
  decideCardAction,
  isCardReplyText,
  parseCardReply,
  renderCommentNotice,
  renderDueNotice,
  renderManageDone,
  renderReassignOld,
  replyKeyboard,
  taskIdFromMarkup,
} from "./cards.ts";
import { type CardDeps, dmCardReply, groupCardReply, handleCardReply } from "./card_actions.ts";
import { GROUP_HELP, HELP_GUIDE, parseTaskText, type TaskRow, type TgEntity } from "./core.ts";

const ID = "7d1f4a52-3b8e-4c1a-9f0e-2a6b5c4d3e21";
// 2026-11-05 (payshanba) 11:00 Toshkent
const NOW = Date.parse("2026-11-05T06:00:00Z");
const mention = (text: string, name: string): TgEntity => ({ type: "mention", offset: text.indexOf("@" + name), length: name.length + 1 });

Deno.test("taskIdFromMarkup: td/ts/tr tugmalaridan id, boshqasi null", () => {
  assertEquals(taskIdFromMarkup({ inline_keyboard: [[{ text: "▶", callback_data: `ts:${ID}` }, { text: "✅", callback_data: `td:${ID}` }]] }), ID);
  assertEquals(taskIdFromMarkup({ inline_keyboard: [[{ text: "✅", callback_data: `td:${ID}` }]] }), ID);
  assertEquals(taskIdFromMarkup(replyKeyboard(ID)), ID);
  assertEquals(taskIdFromMarkup({ inline_keyboard: [[{ text: "✅ Yaratish", callback_data: `pr:y:${ID}` }]] }), null);
  assertEquals(taskIdFromMarkup({ inline_keyboard: [[{ text: "x", callback_data: "td:123" }]] }), null);
  assertEquals(taskIdFromMarkup({ inline_keyboard: [] }), null);
  assertEquals(taskIdFromMarkup(undefined), null);
  assertEquals(taskIdFromMarkup({ inline_keyboard: [[{ text: "CRM", url: "https://hanguk.uz" }]] }), null);
});

Deno.test("isCardReplyText: buyruq, ✅ va bo'sh matn — kartaga javob emas", () => {
  for (const t of ["", "   ", "/help", "#vazifa @ali hisobot", "✅", "bajarildi", "Bajardim!"]) assertEquals(isCardReplyText(t), false, t);
  for (const t of ["ertaga 15:00", "@diyora", "Hujjat yetishmayapti", "✅ lekin pasport nusxasi qoldi"]) {
    assertEquals(isCardReplyText(t), true, t);
  }
});

Deno.test("parseTaskText: sanadan keyingi vaqt ham olinadi («05.11 15:00»)", () => {
  assertEquals(parseTaskText("05.11 15:00", NOW).due, "2026-11-05T10:00:00.000Z");
  assertEquals(parseTaskText("06.11 soat 15:30", NOW).due, "2026-11-06T10:30:00.000Z");
  assertEquals(parseTaskText("06.11.2026 09:00", NOW).due, "2026-11-06T04:00:00.000Z");
  assertEquals(parseTaskText("soat 10.30", NOW).due, "2026-11-05T05:30:00.000Z"); // avvalgidek
  assertEquals(parseTaskText("Narxi 1.50 mln, 05.11 gacha", NOW).due, null); // avvalgidek: summa vaqt emas
  assertEquals(parseTaskText("12.30", NOW).due, null); // avvalgidek
});

Deno.test("parseCardReply: faqat muddat iborasi — yangi muddat", () => {
  const due = (t: string) => parseCardReply(t, [], NOW).due;
  assertEquals(due("ertaga 15:00"), "2026-11-06T10:00:00.000Z");
  assertEquals(due("Ertaga soat 15"), "2026-11-06T10:00:00.000Z");
  assertEquals(due("05.11 16:30"), "2026-11-05T11:30:00.000Z");
  assertEquals(due("06.11"), "2026-11-06T13:00:00.000Z");
  assertEquals(due("juma"), "2026-11-06T13:00:00.000Z");
  assertEquals(due("dushanbagacha"), "2026-11-09T13:00:00.000Z");
  assertEquals(due("ertagacha"), "2026-11-06T13:00:00.000Z");
  assertEquals(due("15:00gacha"), "2026-11-05T10:00:00.000Z");
  assertEquals(due("Muddatni ertaga soat 15:00 ga o'zgartiring, iltimos"), "2026-11-06T10:00:00.000Z");
  assertEquals(due("muddat: juma kuni 12:00"), "2026-11-06T07:00:00.000Z");
  assertEquals(due("Muddatni indinga suring"), "2026-11-07T13:00:00.000Z");
});

Deno.test("parseCardReply: boshqa so'z yoki noaniq ibora — izoh", () => {
  for (const t of [
    "ertaga kelaman", "Ertaga 15:00 da uchrashuvga boraman", "05.11 yoki 06.11", "ertaga yoki indinga",
    "ertaga 15.00", "ertaga 15:00, zarur", "Rahmat!", "3 kun ichida", "soat 15 yoki 16:00",
  ]) {
    const r = parseCardReply(t, [], NOW);
    assertEquals([r.due, r.assignee], [null, null], t);
    assertEquals(r.text, t.trim(), t);
  }
});

Deno.test("parseCardReply: @odam — boshqa xodimga (muddat bilan ham)", () => {
  let t = "@diyora";
  assertEquals(parseCardReply(t, [mention(t, "diyora")], NOW), { text: t, due: null, assignee: { username: "diyora" } });
  t = "@diyora ga o'tkazing";
  assertEquals(parseCardReply(t, [mention(t, "diyora")], NOW).assignee, { username: "diyora" });
  t = "@diyora ertaga 15:00";
  assertEquals(parseCardReply(t, [mention(t, "diyora")], NOW), { text: t, due: "2026-11-06T10:00:00.000Z", assignee: { username: "diyora" } });
  t = "Diyora qilsin";
  assertEquals(parseCardReply(t, [{ type: "text_mention", offset: 0, length: 6, user: { id: 42 } }], NOW).assignee, { tgUserId: 42 });
  // entity kelmasa ham @username topiladi
  assertEquals(parseCardReply("@diyora_k", [], NOW).assignee, { username: "diyora_k" });
  // bot eslatmasi — oluvchi emas
  t = "@STAFF_HANGUK_BOT ertaga 15:00";
  assertEquals(parseCardReply(t, [mention(t, "STAFF_HANGUK_BOT")], NOW), { text: t, due: "2026-11-06T10:00:00.000Z", assignee: null });
  // izoh: ikki odam yoki boshqa so'zlar
  t = "@ali_v @vali_a";
  assertEquals(parseCardReply(t, [mention(t, "ali_v"), mention(t, "vali_a")], NOW).assignee, null);
  t = "@diyora bilan gaplashing";
  assertEquals(parseCardReply(t, [mention(t, "diyora")], NOW), { text: t, due: null, assignee: null });
});

Deno.test("decideCardAction: muddat/@odam — bergan va owner; izoh — mas'ul, bergan, owner", () => {
  const creator = { assignee: false, creator: true, owner: false };
  const assignee = { assignee: true, creator: false, owner: false };
  const owner = { assignee: false, creator: false, owner: true };
  const other = { assignee: false, creator: false, owner: false };
  const due = parseCardReply("ertaga 15:00", [], NOW);
  assertEquals(decideCardAction(due, creator, NOW), { kind: "manage", due: "2026-11-06T10:00:00.000Z", assignee: null });
  assertEquals(decideCardAction(due, owner, NOW).kind, "manage");
  // mas'ul muddatni o'zgartira olmaydi — bu uning izohi bo'ladi
  assertEquals(decideCardAction(due, assignee, NOW), { kind: "comment", text: "ertaga 15:00" });
  assertEquals(decideCardAction(due, other, NOW), { kind: "denied" });
  const t = "@diyora";
  const who = parseCardReply(t, [mention(t, "diyora")], NOW);
  assertEquals(decideCardAction(who, owner, NOW), { kind: "manage", due: null, assignee: { username: "diyora" } });
  assertEquals(decideCardAction(who, assignee, NOW), { kind: "comment", text: "@diyora" });
  const note = parseCardReply("Pasport nusxasi yetishmayapti", [], NOW);
  for (const r of [creator, assignee, owner]) assertEquals(decideCardAction(note, r, NOW).kind, "comment");
  assertEquals(decideCardAction(note, other, NOW).kind, "denied");
  // o'tib ketgan vaqt: 11:00 da «10:00»
  assertEquals(decideCardAction(parseCardReply("10:00", [], NOW), creator, NOW), { kind: "past" });
});

Deno.test("commentRecipients: mas'ul ↔ bergan, owner — ikkalasiga, o'ziga emas", () => {
  assertEquals(commentRecipients("b", "b", "a"), ["a"]);
  assertEquals(commentRecipients("a", "b", "a"), ["b"]);
  assertEquals(commentRecipients("o", "b", "a"), ["b", "a"]);
  assertEquals(commentRecipients("a", "a", "a"), []);
  assertEquals(commentRecipients("o", null, "a"), ["a"]);
  assertEquals(commentRecipients("a", null, "a"), []);
});

Deno.test("matnlar: HTML qochiriladi, tasdiqlar, xatolar, yordam", () => {
  assertEquals(renderCommentNotice("Ali <x>", "a&b", "1<2"), "💬 <b>Ali &lt;x&gt;</b> izoh yozdi:\n1&lt;2\n\n📌 a&amp;b");
  assertEquals(renderDueNotice("Ali", "Apostil", "2026-11-05T13:00:00Z", "2026-11-06T10:00:00.000Z"),
    "⏰ <b>Ali</b> muddatni o'zgartirdi: 05.11 18:00 → <b>06.11 15:00</b>\n📌 Apostil");
  assertEquals(renderDueNotice("Ali", "A", null, "2026-11-06T10:00:00.000Z").includes("— → <b>06.11 15:00</b>"), true);
  // CRM'dagi «faqat sana» (00:00 UTC) — soatsiz
  assertEquals(renderDueNotice("Ali", "A", "2026-11-05T00:00:00+00:00", "2026-11-06T10:00:00.000Z").includes(": 05.11 → <b>"), true);
  assertEquals(renderReassignOld("Ali", "Diyora", "Apostil"), "🔁 Vazifa <b>Diyora</b>ga o'tkazildi (Ali):\nApostil");
  assertEquals(renderManageDone({ newName: null, due: "2026-11-06T10:00:00.000Z", dueError: null }), "⏰ Muddat o'zgardi: <b>06.11 15:00</b>");
  assertEquals(renderManageDone({ newName: "Diyora", due: "2026-11-06T10:00:00.000Z", dueError: null }),
    "🔁 Vazifa <b>Diyora</b>ga o'tkazildi\n⏰ Muddat: <b>06.11 15:00</b>");
  assertEquals(cardErrorText("same", "due"), "Muddat allaqachon shunday.");
  assertEquals(cardErrorText("same", "assignee"), "Vazifa allaqachon shu xodimda.");
  assertEquals(cardErrorText("not_allowed", "comment").includes("mas'ul"), true);
  assertEquals(cardErrorText("boshqa", "due").startsWith("Saqlab bo'lmadi"), true);
  assertEquals(CARD_HINT.length <= 200, true); // answerCallbackQuery chegarasi
  for (const s of [HELP_GUIDE, GROUP_HELP]) {
    assertEquals(s.includes("@username"), true);
    assertEquals(s.includes("ertaga 15:00"), true);
  }
  assertEquals(HELP_GUIDE.includes("Vazifa kartasiga javob"), true);
});

// ── bajarish (card_actions.ts): soxta baza va Telegram ──────────────────────

// deno-lint-ignore no-explicit-any
type Any = any;
const A = "a0000000-0000-4000-8000-00000000000a"; // bergan
const B = "b0000000-0000-4000-8000-00000000000b"; // mas'ul
const C = "c0000000-0000-4000-8000-00000000000c"; // boshqa xodim
const O = "f0000000-0000-4000-8000-0000000000f0"; // owner
const D = "d0000000-0000-4000-8000-00000000000d"; // Diyora (yangi mas'ul)
const TASK = { id: ID, title: "Apostil", status: "todo", priority: "normal", due_date: "2026-11-05T13:00:00Z", assigned_to: B, created_by: A };
const actor = (user_id: string, full_name: string, roles: string[] = ["call_operator"]) => ({ user_id, full_name, roles });

function harness(task: Any = TASK, rpc: Record<string, (a: Any) => Any> = {}, card: Any = { task_id: ID }) {
  const calls: [string, Any][] = [];
  const replies: string[] = [];
  const notes: [string, string, Any][] = [];
  const q = (data: unknown) => {
    const b: Any = { select: () => b, eq: () => b, maybeSingle: () => Promise.resolve({ data, error: null }) };
    return b;
  };
  const row = (t: Any, extra: Any = {}) => ({
    result: "ok", title: t.title, created_by: t.created_by, assigned_to: t.assigned_to, status: t.status,
    priority: t.priority, due_date: t.due_date, ...extra,
  });
  const fns: Record<string, (a: Any) => Any> = {
    bot_add_task_comment: () => row(task, { comment_id: "c1" }),
    bot_set_task_due: (a) => row(task, { old_due: task.due_date, new_due: a.p_due }),
    bot_reassign_task: (a) => row(task, { old_assignee: task.assigned_to, new_assignee: a.p_assignee }),
    bot_resolve_username: (a) => (a.p_username === "diyora" ? { user_id: D, full_name: "Diyora", telegram_user_id: 5 } : null),
    ...rpc,
  };
  const deps: CardDeps = {
    db: {
      from: (t: string) => q(t === "tasks" ? task : t === "bot_group_cards" ? card : null),
      rpc: (fn: string, args: Any) => {
        calls.push([fn, args]);
        const r = fns[fn]?.(args);
        return Promise.resolve(r === undefined ? { data: null, error: { message: "boom" } } : { data: r === null ? [] : [r], error: null });
      },
    },
    reply: (text) => { replies.push(text); return Promise.resolve({ ok: true }); },
    notifyUser: (uid, text, extra) => { notes.push([uid, text, extra ?? {}]); return Promise.resolve(); },
    taskButtons: (t: TaskRow) => ({ buttons: t.id, due: t.due_date }),
    resolveStaff: (tg) => Promise.resolve(tg === 42 ? { user_id: D, full_name: "Diyora" } : null),
    now: () => NOW,
  };
  return { deps, calls, replies, notes };
}

const groupMsg = (text: string, entities: TgEntity[] = []) => ({
  chat: { id: -100 }, message_id: 77, text, entities, reply_to_message: { message_id: 55, from: { is_bot: true } },
});

Deno.test("guruh: bergan «ertaga 15:00» → muddat, mas'ulga xabar (tugmalar bilan)", async () => {
  const h = harness();
  const r = await groupCardReply(h.deps, groupMsg("ertaga 15:00"), actor(A, "Ali"));
  assertEquals(r, { taskId: ID, kind: "command" });
  assertEquals(h.calls, [["bot_set_task_due", { p_actor: A, p_task: ID, p_due: "2026-11-06T10:00:00.000Z", p_via: "group" }]]);
  assertEquals(h.replies, ["⏰ Muddat o'zgardi: <b>06.11 15:00</b>"]);
  assertEquals(h.notes.length, 1);
  assertEquals(h.notes[0][0], B);
  assertEquals(h.notes[0][1], "⏰ <b>Ali</b> muddatni o'zgartirdi: 05.11 18:00 → <b>06.11 15:00</b>\n📌 Apostil");
  assertEquals(h.notes[0][2], { reply_markup: { buttons: ID, due: "2026-11-06T10:00:00.000Z" } });
});

Deno.test("guruh: mas'ulning «ertaga 15:00» javobi — izoh, bergan odamga «💬 Javob yozish» bilan", async () => {
  const h = harness();
  const r = await groupCardReply(h.deps, groupMsg("ertaga 15:00"), actor(B, "Botir"));
  assertEquals(r, { taskId: ID, kind: "message" });
  assertEquals(h.calls, [["bot_add_task_comment", { p_actor: B, p_task: ID, p_content: "ertaga 15:00", p_via: "group" }]]);
  assertEquals(h.replies, ["💬 Izoh qo'shildi"]);
  assertEquals(h.notes, [[A, "💬 <b>Botir</b> izoh yozdi:\nertaga 15:00\n\n📌 Apostil", { reply_markup: replyKeyboard(ID) }]]);
});

Deno.test("guruh: boshqa xodimning javobi — oddiy suhbat (null), hech narsa o'zgarmaydi", async () => {
  const h = harness(TASK, { bot_add_task_comment: () => ({ result: "not_allowed" }) });
  assertEquals(await groupCardReply(h.deps, groupMsg("Men ham yordam beraman"), actor(C, "Cho'lpon")), null);
  assertEquals([h.calls.length, h.replies.length, h.notes.length], [0, 0, 0]);
});

Deno.test("guruh: karta emas, buyruq yoki ✅ — null (bazaga yozilmaydi)", async () => {
  const none = harness(TASK, {}, null);
  assertEquals(await groupCardReply(none.deps, groupMsg("izoh"), actor(A, "Ali")), null);
  const h = harness();
  for (const t of ["/help", "#vazifa @ali hisobot", "✅", "bajarildi"]) {
    assertEquals(await groupCardReply(h.deps, groupMsg(t), actor(A, "Ali")), null, t);
  }
  const notBot = { ...groupMsg("izoh"), reply_to_message: { message_id: 55, from: { is_bot: false } } };
  assertEquals(await groupCardReply(h.deps, notBot, actor(A, "Ali")), null);
  assertEquals(h.calls.length, 0);
});

Deno.test("guruh: owner «@diyora ertaga 15:00» → o'tkazish + muddat, yangi va eski mas'ulga xabar", async () => {
  const h = harness();
  const text = "@diyora ertaga 15:00";
  const r = await groupCardReply(h.deps, groupMsg(text, [mention(text, "diyora")]), actor(O, "Asrbek", ["owner"]));
  assertEquals(r, { taskId: ID, kind: "command" });
  assertEquals(h.calls.map((c) => c[0]), ["bot_resolve_username", "bot_reassign_task", "bot_set_task_due"]);
  assertEquals(h.calls[1][1], { p_actor: O, p_task: ID, p_assignee: D, p_via: "group" });
  assertEquals(h.replies, ["🔁 Vazifa <b>Diyora</b>ga o'tkazildi\n⏰ Muddat: <b>06.11 15:00</b>"]);
  assertEquals(h.notes.map((n) => n[0]), [D, B]);
  assertEquals(h.notes[0][1], "🔁 <b>Asrbek</b> vazifani sizga o'tkazdi:\n\nApostil\n⏰ 06.11 15:00");
  assertEquals(h.notes[0][2], { reply_markup: { buttons: ID, due: "2026-11-06T10:00:00.000Z" } });
  assertEquals(h.notes[1][1], "🔁 Vazifa <b>Diyora</b>ga o'tkazildi (Asrbek):\nApostil");
});

Deno.test("guruh: «@hozirgi_mas'ul ertaga 15:00» — faqat muddat; «@hozirgi_mas'ul» — tushuntirish", async () => {
  const task = { ...TASK, assigned_to: D };
  const h = harness(task, { bot_reassign_task: () => ({ result: "same" }) });
  const text = "@diyora ertaga 15:00";
  await groupCardReply(h.deps, groupMsg(text, [mention(text, "diyora")]), actor(A, "Ali"));
  assertEquals(h.calls.map((c) => c[0]), ["bot_resolve_username", "bot_reassign_task", "bot_set_task_due"]);
  assertEquals(h.replies, ["⏰ Muddat o'zgardi: <b>06.11 15:00</b>"]);
  assertEquals(h.notes.map((n) => n[0]), [D]);
  const s = harness(task, { bot_reassign_task: () => ({ result: "same" }) });
  await groupCardReply(s.deps, groupMsg("@diyora", [mention("@diyora", "diyora")]), actor(A, "Ali"));
  assertEquals([s.replies, s.notes.length], [["Vazifa allaqachon shu xodimda."], 0]);
});

Deno.test("guruh: username'siz odam (text_mention) va noma'lum @username", async () => {
  const h = harness();
  const r = await groupCardReply(h.deps, groupMsg("Diyora", [{ type: "text_mention", offset: 0, length: 6, user: { id: 42 } }]), actor(A, "Ali"));
  assertEquals(r?.kind, "command");
  assertEquals(h.calls.map((c) => c[0]), ["bot_reassign_task"]);
  const u = harness();
  const text = "@nomalum_odam";
  await groupCardReply(u.deps, groupMsg(text, [mention(text, "nomalum_odam")]), actor(A, "Ali"));
  assertEquals(u.calls.map((c) => c[0]), ["bot_resolve_username"]);
  assertEquals(u.replies[0].startsWith("@nomalum_odam botga ulanmagan"), true);
  assertEquals(u.notes.length, 0);
});

Deno.test("muddat: RPC rad etsa (same, closed, past) — tushuntirish, xabar yo'q", async () => {
  for (const [code, text] of [["same", "Muddat allaqachon shunday."], ["closed", cardErrorText("closed", "due")]]) {
    const h = harness(TASK, { bot_set_task_due: () => ({ result: code }) });
    await groupCardReply(h.deps, groupMsg("ertaga 15:00"), actor(A, "Ali"));
    assertEquals([h.replies, h.notes.length], [[text], 0]);
  }
  const p = harness();
  await groupCardReply(p.deps, groupMsg("10:00"), actor(A, "Ali")); // 11:00 da
  assertEquals([p.calls.length, p.replies], [0, [cardErrorText("past", "due")]]);
});

Deno.test("izoh: owner yozsa ikkalasiga; yopilgan vazifada mas'ulga tugmasiz", async () => {
  const h = harness();
  await groupCardReply(h.deps, groupMsg("Tezroq, talaba kutyapti"), actor(O, "Asrbek", ["owner"]));
  assertEquals(h.notes.map((n) => [n[0], n[2]]), [[B, { reply_markup: { buttons: ID, due: TASK.due_date } }], [A, { reply_markup: replyKeyboard(ID) }]]);
  const closed = harness({ ...TASK, status: "completed" });
  await groupCardReply(closed.deps, groupMsg("Rahmat!"), actor(A, "Ali"));
  assertEquals(closed.notes.map((n) => [n[0], n[2]]), [[B, { reply_markup: replyKeyboard(ID) }]]);
});

Deno.test("izoh: baza xatosi — foydalanuvchiga aytiladi", async () => {
  const h = harness(TASK, { bot_add_task_comment: () => undefined });
  const r = await groupCardReply(h.deps, groupMsg("Hujjat tayyor"), actor(B, "Botir"));
  assertEquals(r, { taskId: ID, kind: "message" });
  assertEquals(h.replies, [cardErrorText("error", "comment")]);
  assertEquals(h.notes.length, 0);
});

Deno.test("DM: karta tugmasidan id — izoh; kartasiz xabar oddiy oqimga qaytadi", async () => {
  const h = harness();
  const dm = (text: string, markup: Any) => ({
    chat: { id: 5 }, message_id: 9, text, reply_to_message: { message_id: 8, from: { is_bot: true }, reply_markup: markup },
  });
  const kb = { inline_keyboard: [[{ text: "✅ Bajardim", callback_data: `td:${ID}` }]] };
  assertEquals(await dmCardReply(h.deps, dm("Bugun soat 16 da tayyor bo'ladi", kb), actor(B, "Botir")), true);
  assertEquals(h.calls, [["bot_add_task_comment", { p_actor: B, p_task: ID, p_content: "Bugun soat 16 da tayyor bo'ladi", p_via: "dm" }]]);
  assertEquals(h.notes.map((n) => n[0]), [A]);
  // bergan odam «💬 Javob yozish» xabariga javob yozsa — muddat
  assertEquals(await dmCardReply(h.deps, dm("ertaga 15:00", replyKeyboard(ID)), actor(A, "Ali")), true);
  assertEquals(h.calls[1], ["bot_set_task_due", { p_actor: A, p_task: ID, p_due: "2026-11-06T10:00:00.000Z", p_via: "dm" }]);
  const n = harness();
  assertEquals(await dmCardReply(n.deps, dm("salom", undefined), actor(B, "Botir")), false);
  assertEquals(await dmCardReply(n.deps, dm("/bugun", kb), actor(B, "Botir")), false);
  assertEquals(await dmCardReply(n.deps, { chat: { id: 5 }, message_id: 9, text: "salom" }, actor(B, "Botir")), false);
  assertEquals(n.calls.length, 0);
});

Deno.test("DM: ruxsat yo'q yoki vazifa o'chirilgan — tushuntiriladi", async () => {
  const h = harness();
  const out = await handleCardReply(h.deps, { taskId: ID, staff: actor(C, "Cho'lpon"), text: "salom", via: "dm" });
  assertEquals([out, h.replies], ["denied", [cardErrorText("not_allowed", "comment")]]);
  const gone = harness(null);
  const out2 = await handleCardReply(gone.deps, { taskId: ID, staff: actor(B, "Botir"), text: "salom", via: "dm" });
  assertEquals([out2, gone.replies], ["error", [cardErrorText("not_found", "comment")]]);
});
