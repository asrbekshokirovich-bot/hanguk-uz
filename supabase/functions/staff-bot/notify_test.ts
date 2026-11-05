// deno test supabase/functions/staff-bot/notify_test.ts
import { assertEquals } from "jsr:@std/assert@1";

import {
  type DeadlineTask,
  displayDue,
  dueHasTime,
  dueReminders,
  escalationFor,
  failureOutcome,
  isQuietHours,
  isWorkday,
  lateDays,
  type OutboxRow,
  overdueAt,
  planOutbox,
  renderDueSoon,
  renderEscalation,
  renderOutbox,
  renderOverdueCreator,
  runDeadlines,
  runNotify,
  showDue,
  STALE_MS,
} from "./notify.ts";
import type { TaskRow } from "./core.ts";

const T = (iso: string) => Date.parse(iso);
const iso = (ms: number) => new Date(ms).toISOString();

Deno.test("tungi oyna: 22:00–08:00 Toshkent (UTC+5)", () => {
  assertEquals(isQuietHours(T("2026-11-05T16:59:59Z")), false); // 21:59
  assertEquals(isQuietHours(T("2026-11-05T17:00:00Z")), true); // 22:00
  assertEquals(isQuietHours(T("2026-11-05T21:00:00Z")), true); // 02:00
  assertEquals(isQuietHours(T("2026-11-06T02:59:59Z")), true); // 07:59
  assertEquals(isQuietHours(T("2026-11-06T03:00:00Z")), false); // 08:00
  assertEquals(isQuietHours(T("2026-11-06T09:00:00Z")), false); // 14:00
});

Deno.test("dueHasTime: CRM sanasi (00:00 UTC) va 00:00 Toshkent — faqat sana", () => {
  assertEquals(dueHasTime("2026-11-05T00:00:00+00:00"), false); // CRM sana tanlagichi
  assertEquals(dueHasTime("2026-11-05T00:00:00.000Z"), false);
  assertEquals(dueHasTime("2026-11-04T19:00:00+00:00"), false); // 05.11 00:00 Toshkent
  assertEquals(dueHasTime("2026-11-05T00:00:00+05:00"), false);
  assertEquals(dueHasTime("2026-11-05T13:00:00+00:00"), true); // bot standarti 18:00
  assertEquals(dueHasTime("2026-11-05T05:00:00+00:00"), true); // 10:00
  assertEquals(dueHasTime(null), false);
  assertEquals(dueHasTime("sana emas"), false);
});

Deno.test("overdueAt: soatli — muddatning o'zi, faqat sana — Toshkent kunining oxiri", () => {
  assertEquals(iso(overdueAt("2026-11-05T00:00:00+00:00")), "2026-11-05T19:00:00.000Z");
  assertEquals(iso(overdueAt("2026-11-04T19:00:00+00:00")), "2026-11-05T19:00:00.000Z");
  assertEquals(iso(overdueAt("2026-11-05T13:00:00+00:00")), "2026-11-05T13:00:00.000Z");
});

Deno.test("dueReminders: soatli muddat — 60 daqiqa qolganda due_soon, keyin overdue va 2 kundan keyin escalation", () => {
  const t = { due_date: "2026-11-05T13:00:00+00:00", sent: [] as string[] };
  assertEquals(dueReminders(t, T("2026-11-05T11:59:00Z")), []); // 61 daqiqa
  assertEquals(dueReminders(t, T("2026-11-05T12:00:00Z")), ["due_soon"]); // aynan 60
  assertEquals(dueReminders(t, T("2026-11-05T12:59:59Z")), ["due_soon"]);
  assertEquals(dueReminders({ ...t, sent: ["due_soon"] }, T("2026-11-05T12:30:00Z")), []);
  assertEquals(dueReminders(t, T("2026-11-05T13:00:00Z")), ["overdue"]);
  assertEquals(dueReminders({ ...t, sent: ["due_soon"] }, T("2026-11-06T09:00:00Z")), ["overdue"]);
  assertEquals(dueReminders({ ...t, sent: ["overdue"] }, T("2026-11-07T12:59:00Z")), []);
  assertEquals(dueReminders({ ...t, sent: ["overdue"] }, T("2026-11-07T13:00:00Z")), ["escalation"]);
  assertEquals(dueReminders(t, T("2026-11-08T09:00:00Z")), ["overdue", "escalation"]);
  assertEquals(dueReminders({ ...t, sent: ["due_soon", "overdue", "escalation"] }, T("2026-11-20T09:00:00Z")), []);
});

Deno.test("dueReminders: faqat sana — due_soon yo'q, kun tugagach overdue", () => {
  const crm = { due_date: "2026-11-05T00:00:00+00:00", sent: [] as string[] };
  assertEquals(dueReminders(crm, T("2026-11-04T23:30:00Z")), []); // 00:00 UTC ga 30 daqiqa — soat yo'q
  assertEquals(dueReminders(crm, T("2026-11-05T12:00:00Z")), []); // o'sha kun 17:00
  assertEquals(dueReminders(crm, T("2026-11-05T18:59:59Z")), []); // 23:59
  assertEquals(dueReminders(crm, T("2026-11-05T19:00:00Z")), ["overdue"]); // 06.11 00:00
  assertEquals(dueReminders(crm, T("2026-11-06T03:00:00Z")), ["overdue"]); // ertalab 08:00
  assertEquals(dueReminders({ ...crm, sent: ["overdue"] }, T("2026-11-07T18:59:00Z")), []);
  assertEquals(dueReminders({ ...crm, sent: ["overdue"] }, T("2026-11-07T19:00:00Z")), ["escalation"]);
  const tash = { due_date: "2026-11-04T19:00:00+00:00", sent: null };
  assertEquals(dueReminders(tash, T("2026-11-05T18:00:00Z")), []);
  assertEquals(dueReminders(tash, T("2026-11-05T19:00:00Z")), ["overdue"]);
  assertEquals(dueReminders({ due_date: "yo'q" }, T("2026-11-05T19:00:00Z")), []);
});

Deno.test("dueReminders: eski sana bilan yaratilgan — «muddat o'tdi» yo'q, owner'ga yaratilganidan 2 kun keyin", () => {
  const back = { due_date: "2026-11-01T13:00:00+00:00", created_at: "2026-11-05T09:00:00+00:00", sent: [] as string[] };
  assertEquals(dueReminders(back, T("2026-11-05T09:15:00Z")), []); // 4 kun oldingi muddat, hozir yaratildi
  assertEquals(dueReminders(back, T("2026-11-07T08:59:00Z")), []);
  assertEquals(dueReminders(back, T("2026-11-07T09:00:00Z")), ["escalation"]);
  // muddatdan oldin yaratilgan — odatdagidek
  const ok = { ...back, created_at: "2026-11-01T12:00:00+00:00" };
  assertEquals(dueReminders(ok, T("2026-11-05T09:15:00Z")), ["overdue", "escalation"]);
  // yaratilgan vaqt noma'lum — eski vazifa deb olinadi
  assertEquals(dueReminders({ ...back, created_at: null }, T("2026-11-05T09:15:00Z")), ["overdue", "escalation"]);
});

Deno.test("muddatni ko'rsatish: CRM sanasi soatsiz, kechikish kalendar kunlarida", () => {
  assertEquals(showDue("2026-11-05T00:00:00+00:00"), "05.11");
  assertEquals(showDue("2026-11-04T19:00:00+00:00"), "05.11");
  assertEquals(showDue("2026-11-05T13:00:00+00:00"), "05.11 18:00");
  assertEquals(showDue(null), "");
  assertEquals(displayDue("2026-11-05T13:00:00+00:00"), "2026-11-05T13:00:00+00:00");
  assertEquals(lateDays("2026-11-03T13:00:00+00:00", T("2026-11-05T08:00:00Z")), 2);
  assertEquals(lateDays("2026-11-03T00:00:00+00:00", T("2026-11-05T20:00:00Z")), 3); // 06.11 01:00 Toshkent
  assertEquals(lateDays("2026-11-06T13:00:00+00:00", T("2026-11-05T08:00:00Z")), 0);
});

// ── navbat (B1-1) ─────────────────────────────────────────────────────────

const NOW = T("2026-11-05T09:00:00Z"); // 14:00 Toshkent

const row = (o: Partial<OutboxRow> = {}): OutboxRow => ({
  id: "n1", kind: "created", recipient: "B", payload: { actor: "A", via: "crm" }, created_at: "2026-11-05T08:59:00+00:00",
  attempts: 1, dm_chat_id: 200, task_id: "T1", title: "Apostil <tez>", status: "todo", priority: "high",
  due_date: "2026-11-06T13:00:00+00:00", assigned_to: "B", created_by: "A", actor_name: "Asrbek",
  assignee_name: "Diyora", from_name: null, to_name: null, ...o,
});

const CARD = "Apostil &lt;tez&gt;\n⏰ 06.11 18:00 ❗";

Deno.test("renderOutbox: mas'ulga karta (tugmalar uchun), beruvchiga qisqa matn", () => {
  const created = renderOutbox(row());
  assertEquals(created.text, `🆕 <b>Asrbek</b> CRM'da vazifa berdi:\n\n${CARD}`);
  assertEquals(created.card?.id, "T1");
  assertEquals(created.card?.status, "todo");

  assertEquals(renderOutbox(row({ kind: "assigned", payload: { actor: "A", from: "C", to: "B" } })).text,
    `👤 <b>Asrbek</b> vazifani sizga biriktirdi:\n\n${CARD}`);

  const un = renderOutbox(row({ kind: "unassigned", recipient: "B", assigned_to: "C", to_name: "Olmos",
    payload: { actor: "A", from: "B", to: "C" } }));
  assertEquals(un.text, "↪️ <b>Asrbek</b> vazifani sizdan oldi, <b>Olmos</b>ga berdi:\nApostil &lt;tez&gt;");
  assertEquals(un.card, null);
  assertEquals(renderOutbox(row({ kind: "unassigned", assigned_to: null, payload: { actor: "A", from: "B", to: null } })).text,
    "↪️ <b>Asrbek</b> vazifani sizdan oldi:\nApostil &lt;tez&gt;");
  assertEquals(renderOutbox(row({ kind: "unassigned", assigned_to: "A", to_name: "Asrbek", payload: { actor: "A", from: "B", to: "A" } })).text,
    "↪️ <b>Asrbek</b> vazifani o'ziga oldi:\nApostil &lt;tez&gt;");

  // «Boshladi» — beruvchiga (A); mas'ul o'zi bosgan yoki CRM'da boshqasi belgilagan
  assertEquals(renderOutbox(row({ kind: "started", recipient: "A", status: "in_progress", actor_name: "Diyora",
    payload: { actor: "B", from: "todo", to: "in_progress", via: "dm" } })).text,
    "▶ <b>Diyora</b> vazifani boshladi:\nApostil &lt;tez&gt;");
  assertEquals(renderOutbox(row({ kind: "started", recipient: "A", status: "in_progress", actor_name: "Xo'jamurod",
    payload: { actor: "X", from: "todo", to: "in_progress", via: "crm" } })).text,
    "▶ <b>Xo'jamurod</b> vazifani «boshlandi» deb belgiladi (mas'ul: <b>Diyora</b>):\nApostil &lt;tez&gt;");

  assertEquals(renderOutbox(row({ kind: "completed", recipient: "A", status: "completed", actor_name: "Diyora",
    payload: { actor: "B", to: "completed" } })).text, "✅ <b>Diyora</b> vazifani bajardi:\nApostil &lt;tez&gt;");
  assertEquals(renderOutbox(row({ kind: "completed", recipient: "A", status: "completed", actor_name: "Davrbek",
    payload: { actor: "D", to: "completed" } })).text, "✅ <b>Davrbek</b> vazifani bajarildi deb belgiladi:\nApostil &lt;tez&gt;");
  assertEquals(renderOutbox(row({ kind: "cancelled", status: "cancelled", payload: { actor: "A", to: "cancelled" } })).text,
    "🚫 <b>Asrbek</b> vazifani bekor qildi:\n<s>Apostil &lt;tez&gt;</s>");
});

Deno.test("renderOutbox: muddat o'zgarishi — eski → yangi, qo'yildi, olib tashlandi; CRM sanasi soatsiz", () => {
  const moved = renderOutbox(row({ kind: "due_changed", due_date: "2026-11-07T10:00:00+00:00",
    payload: { actor: "A", from: "2026-11-05T00:00:00+00:00", to: "2026-11-07T10:00:00+00:00" } }));
  assertEquals(moved.text, "⏰ <b>Asrbek</b> muddatni o'zgartirdi: 05.11 → <b>07.11 15:00</b>\n\nApostil &lt;tez&gt;\n⏰ 07.11 15:00 ❗");
  assertEquals(moved.card?.id, "T1");
  assertEquals(renderOutbox(row({ kind: "due_changed", due_date: "2026-11-10T00:00:00+00:00",
    payload: { actor: "A", from: null, to: "2026-11-10T00:00:00+00:00" } })).text,
    "⏰ <b>Asrbek</b> muddat qo'ydi: <b>10.11</b>\n\nApostil &lt;tez&gt;\n⏰ 10.11 ❗");
  assertEquals(renderOutbox(row({ kind: "due_changed", due_date: null,
    payload: { actor: "A", from: "2026-11-05T00:00:00+00:00", to: null } })).text,
    "⏰ <b>Asrbek</b> muddatni olib tashladi (edi: 05.11)\n\nApostil &lt;tez&gt; ❗");
  // Ism yo'q bo'lsa ham matn buzilmaydi, HTML qochiriladi
  assertEquals(renderOutbox(row({ actor_name: null })).text.startsWith("🆕 <b>Kimdir</b>"), true);
  assertEquals(renderOutbox(row({ actor_name: "<Ali>" })).text.startsWith("🆕 <b>&lt;Ali&gt;</b>"), true);
});

Deno.test("planOutbox: ulanmagan, eskirgan, endi mas'ul emas — yuborilmaydi", () => {
  assertEquals(planOutbox(row({ dm_chat_id: null }), NOW), { action: "skip", reason: "not_linked" });
  assertEquals(planOutbox(row({ created_at: iso(NOW - STALE_MS - 1000) }), NOW), { action: "skip", reason: "stale" });
  assertEquals(planOutbox(row({ kind: "assigned", assigned_to: "C" }), NOW), { action: "skip", reason: "outdated" });
  assertEquals(planOutbox(row({ status: "completed" }), NOW), { action: "skip", reason: "outdated" });
  assertEquals(planOutbox(row({ kind: "due_changed", status: "cancelled" }), NOW), { action: "skip", reason: "outdated" });
  // beruvchiga boradigan xabar vazifa yopilgan bo'lsa ham yuboriladi
  const started = planOutbox(row({ kind: "started", recipient: "A", status: "completed", payload: { actor: "B" } }), NOW);
  assertEquals(started.action, "send");
  const ok = planOutbox(row(), NOW);
  assertEquals(ok.action === "send" && ok.card?.id, "T1");
});

Deno.test("failureOutcome: 429/5xx/tarmoq — qayta (3 martagacha), 403/400 — failed", () => {
  assertEquals(failureOutcome({ ok: false, error_code: 429 }, 1), "retry");
  assertEquals(failureOutcome({ ok: false, error_code: 502 }, 2), "retry");
  assertEquals(failureOutcome({ ok: false, description: "Network error" }, 1), "retry");
  assertEquals(failureOutcome({ ok: false, error_code: 429 }, 3), "failed");
  assertEquals(failureOutcome({ ok: false, error_code: 403, description: "bot was blocked by the user" }, 1), "failed");
  assertEquals(failureOutcome({ ok: false, error_code: 400 }, 1), "failed");
  assertEquals(failureOutcome(null, 1), "retry");
});

// ── soxta baza va Telegram ────────────────────────────────────────────────

type Call = { op: string; name: string; args?: unknown };

function fakeDb(rpcs: Record<string, unknown>, claim: (rows: Record<string, unknown>[]) => Record<string, unknown>[] = (r) => r) {
  const log: Call[] = [];
  const db = {
    rpc(name: string, args?: unknown) {
      log.push({ op: "rpc", name, args });
      return Promise.resolve({ data: rpcs[name] ?? null, error: null });
    },
    from(table: string) {
      return {
        update(vals: Record<string, unknown>) {
          return {
            eq(col: string, val: unknown) {
              log.push({ op: "update", name: table, args: { [col]: val, ...vals } });
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert(rows: Record<string, unknown>[], opts: unknown) {
          log.push({ op: "upsert", name: table, args: { rows, opts } });
          return { select: (_c: string) => Promise.resolve({ data: claim(rows), error: null }) };
        },
      };
    },
  };
  return { db, log };
}

type Sent = { chat: number; text: string; buttons: string | null };

function fakeSend(result: (chat: number, text: string) => { ok: boolean; error_code?: number; description?: string } = () => ({ ok: true })) {
  const sent: Sent[] = [];
  const send = (chat: number, text: string, extra: Record<string, unknown> = {}) => {
    const rm = extra.reply_markup as { task: string } | undefined;
    sent.push({ chat, text, buttons: rm ? rm.task : null });
    return Promise.resolve(result(chat, text));
  };
  return { send, sent };
}

const taskButtons = (t: TaskRow) => ({ task: `${t.id}:${t.status}` });

Deno.test("runNotify: tunda hech narsa olinmaydi", async () => {
  const { db, log } = fakeDb({ bot_notify_claim: [row()] });
  const { send, sent } = fakeSend();
  const r = await runNotify({ db, send, taskButtons, now: () => T("2026-11-05T18:00:00Z") }); // 23:00
  assertEquals(r, { ok: true, quiet: true });
  assertEquals(log.length, 0);
  assertEquals(sent.length, 0);
});

Deno.test("runNotify: yuboradi, tugma qo'yadi, holatni yozadi (sent/skipped/failed/retry)", async () => {
  const rows = [
    row({ id: "n1" }), // created → B, karta
    row({ id: "n2", kind: "unassigned", recipient: "C", dm_chat_id: null, payload: { actor: "A", from: "C", to: "B" } }),
    row({ id: "n3", kind: "started", recipient: "A", dm_chat_id: 100, status: "in_progress", actor_name: "Diyora", payload: { actor: "B" } }),
    row({ id: "n4", kind: "assigned", recipient: "C", dm_chat_id: 300 }), // endi B mas'ul → outdated
    row({ id: "n5", kind: "due_changed", dm_chat_id: 500, payload: { actor: "A", from: null, to: "2026-11-06T13:00:00+00:00" } }),
    row({ id: "n6", kind: "cancelled", status: "cancelled", dm_chat_id: 600, payload: { actor: "A" } }),
  ];
  const { db, log } = fakeDb({ bot_notify_claim: rows });
  const { send, sent } = fakeSend((chat) =>
    chat === 100 ? { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }
    : chat === 500 ? { ok: false, error_code: 429, description: "Too Many Requests" }
    : { ok: true }
  );
  const r = await runNotify({ db, send, taskButtons, now: () => NOW });
  assertEquals(r, { ok: true, sent: 2, skipped: 2, failed: 1, retry: 1 });
  assertEquals(log[0], { op: "rpc", name: "bot_notify_claim", args: { p_limit: 50 } });
  assertEquals(sent.map((s) => [s.chat, s.buttons]), [[200, "T1:todo"], [100, null], [500, "T1:todo"], [600, null]]);
  assertEquals(sent[0].text.startsWith("🆕 <b>Asrbek</b> CRM'da vazifa berdi"), true);
  const upd = (id: string) => log.find((c) => c.op === "update" && (c.args as { id: string }).id === id)?.args as Record<string, unknown>;
  assertEquals(upd("n1").status, "sent");
  assertEquals(typeof upd("n1").sent_at, "string");
  assertEquals([upd("n2").status, upd("n2").error], ["skipped", "not_linked"]);
  assertEquals([upd("n3").status, upd("n3").error], ["failed", "403: Forbidden: bot was blocked by the user"]);
  assertEquals([upd("n4").status, upd("n4").error], ["skipped", "outdated"]);
  // 429 — pending qoladi, band saqlanadi (5 daqiqadan keyin qayta)
  assertEquals([upd("n5").status, "claimed_at" in upd("n5"), upd("n5").error], [undefined, false, "429: Too Many Requests"]);
  assertEquals(upd("n6").status, "sent");
});

// ── muddat nazorati (B1-2) ────────────────────────────────────────────────

const DNOW = T("2026-11-05T12:05:00Z"); // 17:05 Toshkent

const task = (o: Partial<DeadlineTask>): DeadlineTask => ({
  id: "D", title: "Vazifa", status: "todo", priority: "normal", due_date: "2026-11-05T13:00:00+00:00",
  assigned_to: "B", created_by: "A", assignee_name: "Diyora", assignee_chat: 200, assignee_ok: true,
  creator_name: "Asrbek", creator_chat: 100, creator_ok: true, created_at: "2026-10-30T06:00:00+00:00", sent: [], ...o,
});

Deno.test("deadline matnlari", () => {
  assertEquals(renderDueSoon(task({ priority: "urgent" }), DNOW), "⏳ <b>Muddatga 55 daqiqa qoldi</b>\n\nVazifa\n⏰ 05.11 18:00 ❗");
  assertEquals(renderDueSoon(task({}), T("2026-11-05T12:00:00Z")).startsWith("⏳ <b>Muddatga 1 soat qoldi</b>"), true);
  assertEquals(renderOverdueCreator(task({ due_date: "2026-11-04T00:00:00+00:00", title: "A & B" })),
    "🔴 <b>Siz bergan vazifa muddati o'tdi</b>\nMas'ul: <b>Diyora</b>\n\nA &amp; B\n⏰ 04.11");
  assertEquals(renderOverdueCreator(task({ assigned_to: null, assignee_name: null })).includes("Mas'ul belgilanmagan"), true);
  const list = [
    task({ id: "1", title: "Kamera", due_date: "2026-11-02T00:00:00+00:00" }),
    task({ id: "2", title: "Shartnoma", due_date: "2026-11-03T08:00:00+00:00", assigned_to: null, assignee_name: null }),
  ];
  const text = renderEscalation(list, DNOW);
  assertEquals(text.split("\n").slice(0, 4), [
    "🚨 <b>Muddatidan 2 kundan ortiq o'tgan vazifalar: 2</b>",
    "",
    "• Kamera — <b>Diyora</b>, 02.11 (3 kun)",
    "• Shartnoma — <b>mas'ul yo'q</b>, 03.11 13:00 (2 kun)",
  ]);
  assertEquals(renderEscalation(Array.from({ length: 5 }, (_, i) => task({ id: String(i) })), DNOW, 3).includes("… yana 2 ta"), true);
  assertEquals(escalationFor("B", list).map((t) => t.id), ["2"]); // o'zi mas'ul bo'lgani kirmaydi
});

Deno.test("runDeadlines: tunda ishlamaydi", async () => {
  const { db, log } = fakeDb({ bot_deadline_candidates: [task({})] });
  const { send, sent } = fakeSend();
  assertEquals(await runDeadlines({ db, send, taskButtons, now: () => T("2026-11-05T02:00:00Z") }), { ok: true, quiet: true });
  assertEquals([log.length, sent.length], [0, 0]);
});

Deno.test("runDeadlines: band qilinganlarga bir marta — mas'ul, beruvchi, ownerlarga yig'ma", async () => {
  const cands = [
    task({ id: "D1" }), // 55 daqiqa qoldi → due_soon
    task({ id: "D2", due_date: "2026-11-05T11:00:00+00:00" }), // 1 soat oldin o'tdi → overdue (B + A)
    task({ id: "D3", due_date: "2026-11-05T00:00:00+00:00" }), // faqat sana, kun tugamagan → hech narsa
    task({ id: "D4", due_date: "2026-11-02T00:00:00+00:00", sent: ["overdue"] }), // → escalation
    task({ id: "D5", due_date: "2026-11-01T13:00:00+00:00", assigned_to: "O1", created_by: "O1", assignee_name: "Asrbek",
      assignee_chat: 900 }), // → overdue (o'ziga) + escalation
    task({ id: "D6", due_date: "2026-11-05T11:30:00+00:00" }), // boshqa chaqiruv band qilgan
    task({ id: "D7", due_date: "2026-11-05T11:45:00+00:00", assignee_chat: null, created_by: "B" }), // ulanmagan
  ];
  const { db, log } = fakeDb(
    { bot_deadline_candidates: cands, bot_owner_chats: [{ user_id: "O1", dm_chat_id: 900 }, { user_id: "O2", dm_chat_id: 901 }] },
    (rows) => rows.filter((r) => r.task_id !== "D6"),
  );
  const { send, sent } = fakeSend();
  const r = await runDeadlines({ db, send, taskButtons, now: () => DNOW });
  assertEquals(r, { ok: true, candidates: 7, claimed: 6, sent: 4, escalated: 2, owners: 2 });

  const up = log.find((c) => c.op === "upsert")!;
  assertEquals(up.name, "task_reminders");
  const a = up.args as { rows: { task_id: string; kind: string; due_date: string }[]; opts: unknown };
  assertEquals(a.rows.map((x) => `${x.task_id}:${x.kind}`),
    ["D1:due_soon", "D2:overdue", "D4:escalation", "D5:overdue", "D5:escalation", "D6:overdue", "D7:overdue"]);
  assertEquals(a.rows[0].due_date, "2026-11-05T13:00:00+00:00"); // bazadagi qiymat o'zgarmasdan
  assertEquals(a.opts, { onConflict: "task_id,kind,due_date", ignoreDuplicates: true });

  assertEquals(sent.map((s) => [s.chat, s.buttons, s.text.split("\n")[0]]), [
    [200, "D1:todo", "⏳ <b>Muddatga 55 daqiqa qoldi</b>"],
    [200, "D2:todo", "🔴 <b>Vazifa muddati o'tdi</b>"],
    [100, null, "🔴 <b>Siz bergan vazifa muddati o'tdi</b>"],
    [900, "D5:todo", "🔴 <b>Vazifa muddati o'tdi</b>"],
    [900, null, "🚨 <b>Muddatidan 2 kundan ortiq o'tgan vazifalar: 1</b>"], // O1: o'z vazifasi (D5) kirmaydi
    [901, null, "🚨 <b>Muddatidan 2 kundan ortiq o'tgan vazifalar: 2</b>"],
  ]);
});

Deno.test("isWorkday: workdays bo'yicha (Toshkent kuni), bo'sh — har kuni", () => {
  const W = "1,2,3,4,5,6";
  assertEquals(isWorkday(T("2026-11-08T05:00:00Z"), W), false); // yakshanba 10:00
  assertEquals(isWorkday(T("2026-11-07T18:59:00Z"), W), true); // shanba 23:59
  assertEquals(isWorkday(T("2026-11-08T19:00:00Z"), W), true); // yakshanba 19:00 UTC = dushanba 00:00
  assertEquals(isWorkday(T("2026-11-08T05:00:00Z"), ""), true);
  assertEquals(isWorkday(T("2026-11-08T05:00:00Z"), "1,2,3,4,5,6,7"), true);
});

Deno.test("runDeadlines: dam olish kuni ishlamaydi (bazaga ham murojaat yo'q)", async () => {
  const { db, log } = fakeDb({ bot_deadline_candidates: [task({ due_date: "2026-11-07T11:00:00+00:00" })] });
  const { send, sent } = fakeSend();
  const r = await runDeadlines({
    db, send, taskButtons, workdays: () => Promise.resolve("1,2,3,4,5,6"), now: () => T("2026-11-08T05:00:00Z"),
  });
  assertEquals(r, { ok: true, offday: true });
  assertEquals([log.length, sent.length], [0, 0]);
  // ish kuni — odatdagidek
  const r2 = await runDeadlines({
    db, send, taskButtons, workdays: () => Promise.resolve("1,2,3,4,5,6"), now: () => DNOW,
  });
  assertEquals(r2.ok && !("offday" in r2), true);
});

Deno.test("runDeadlines: kerakli eslatma yo'q — band qilish ham, yuborish ham yo'q", async () => {
  const { db, log } = fakeDb({ bot_deadline_candidates: [task({ due_date: "2026-11-05T00:00:00+00:00" })] });
  const { send, sent } = fakeSend();
  assertEquals(await runDeadlines({ db, send, taskButtons, now: () => DNOW }), { ok: true, candidates: 1, claimed: 0, sent: 0 });
  assertEquals([log.map((c) => c.op), sent.length], [["rpc"], 0]);
});
