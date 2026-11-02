// staff-bot — Hanguk xodimlari uchun Telegram bot (reja: claude/xodim-boti-reja.md).
//
// PR-1: xodimni CRM havolasi bilan ulash, DM menyusi, guruh id'sini eslab qolish.
// PR-3: «Vazifalarim» kartalari (▶ Boshladim / ✅ Bajardim), «Vazifa berish»
// (hamkasb → matn yoki ovoz → muddat/muhimlik ajratiladi → tasdiq → CRM),
// bildirishnomalar (yangi vazifa — mas'ulga, bajarildi — beruvchiga),
// ertalab 09:00 ro'yxat (cron → ?action=morning, Supabase secret key bilan).
// PR-4: kunlik hisobot — 17:00 so'rov, 17:30/18:00 eslatma, 18:15 ownerlarga xulosa
// (cron → ?action=report&kind=ask|remind|summary); «📝 Hisobot» tugmasi; AI 3 qismga ajratadi.
// PR-7: xodimlar guruhi — xabarlar saqlanadi (soya rejimi, PR-8 AI uchun); «#vazifa @odam matn» → vazifa
// va guruhga karta; kartaga «✅»/«bajarildi» javobi → bajarildi.
// PR-8: guruh suhbati AI tahlili — faqat taklif kartasi; yozgan odam (yoki mas'ul/owner) ✅ bossa yaratiladi/yopiladi.
// Rejim bot_settings.group_ai_mode: off | shadow (faqat bot_proposals'ga yoziladi) | on.
// Keyingi PR'lar: Hanguk AI (PR-10).
//
// Sozlash (bir marta): secrets STAFF_BOT_TOKEN va STAFF_BOT_WEBHOOK_SECRET,
// keyin `<function url>?action=setup` ochiladi — webhook, buyruqlar ro'yxati
// va bot_settings.bot_username (deep link uchun) o'rnatiladi.
//
// Xavfsizlik: har update Telegram'ning maxfiy sarlavhasi bilan tekshiriladi
// (hr-bot bilan bir xil usul: saqlangan sirning SHA-256 hex'i). Takror
// yuborilgan update (update_id) tashlab yuboriladi. Bot faqat
// staff_telegram_links'da faol bo'lgan xodimga javob beradi.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { answerCallbackQuery, callTelegram, sendTelegramMessage } from "../_shared/telegram.ts";
import { structuredJSON } from "./ai.ts";
import {
  escapeHtml,
  ANALYSIS_SCHEMA,
  ANALYSIS_SYSTEM,
  type AiAnalysis,
  buildAnalysisPrompt,
  type CtxStaff,
  GROUP_HELP,
  interpretAnalysis,
  renderProposal,
  shouldAnalyze,
  isDoneReply,
  parseGroupCommand,
  type TgEntity,
  groupTasks,
  HELP_TEXT,
  parseTaskText,
  REPORT_PROMPT,
  renderReport,
  renderSummary,
  type ReportParts,
  type SummaryRow,
  tashkentDate,
  type ParsedTask,
  renderDraft,
  renderTaskCard,
  linkResultText,
  MENU,
  MENU_KEYBOARD,
  NOT_LINKED_TEXT,
  parseCommand,
  parseStartCode,
  renderTaskList,
  splitMessage,
  type TaskRow,
} from "./core.ts";

const BOT_TOKEN = Deno.env.get("STAFF_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("STAFF_BOT_WEBHOOK_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/staff-bot`;
const BOT_ID = "staff-bot";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
// Google eski modellarni yangi kalitlar uchun o'chirib boryapti — kerak bo'lsa secret bilan almashtiriladi.
const GEMINI_MODEL = Deno.env.get("STAFF_BOT_GEMINI_MODEL") || "gemini-2.5-flash";
const STATE_TTL_MS = 60 * 60_000;
const REPORT_STATE_TTL_MS = 8 * 60 * 60_000; // 17:00 so'rovga kechroq javob ham qabul qilinadi
const MAX_CARDS = 10;

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// deno-lint-ignore no-explicit-any
type Any = any;

interface Staff {
  user_id: string;
  full_name: string;
  roles: string[];
  dm_chat_id: number | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function telegramSecret(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(WEBHOOK_SECRET));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const send = (chatId: number, text: string, extra: Record<string, unknown> = {}) =>
  sendTelegramMessage(BOT_TOKEN, chatId, text, { parse_mode: "HTML", ...extra });

async function sendLong(chatId: number, text: string, extra: Record<string, unknown> = {}) {
  const parts = splitMessage(text);
  for (let i = 0; i < parts.length; i++) {
    await send(chatId, parts[i], i === parts.length - 1 ? extra : {});
  }
}

// ── sozlash ───────────────────────────────────────────────────────────────

async function setup() {
  const me = await callTelegram<{ username?: string }>(BOT_TOKEN, "getMe", {});
  const username = me.result?.username ?? "";
  if (username) {
    await db.from("bot_settings").upsert({ key: "bot_username", value: username, updated_at: new Date().toISOString() });
  }
  const hook = await callTelegram(BOT_TOKEN, "setWebhook", {
    url: WEBHOOK_URL,
    allowed_updates: ["message", "callback_query", "my_chat_member"],
    secret_token: await telegramSecret(),
    drop_pending_updates: false,
  });
  const commands = await callTelegram(BOT_TOKEN, "setMyCommands", {
    commands: [
      { command: "start", description: "Boshlash" },
      { command: "bugun", description: "Bugungi va kechikkan vazifalar" },
      { command: "help", description: "Yordam" },
      { command: "cancel", description: "Bekor qilish" },
    ],
  });
  return json({ ok: !!hook.ok, bot: username || null, webhook: hook, commands: commands.ok, url: WEBHOOK_URL });
}

// ── takror update himoyasi ───────────────────────────────────────────────

async function seenBefore(updateId: number): Promise<boolean> {
  const { error } = await db.from("telegram_updates_seen").insert({ bot: BOT_ID, update_id: updateId });
  if (!error) return false;
  if (error.code === "23505") return true; // allaqachon ko'rilgan
  console.error("staff-bot: dedupe insert failed:", error.message);
  return false; // baza xatosi — update'ni yo'qotmaymiz
}

// ── xodim ─────────────────────────────────────────────────────────────────

async function resolveStaff(telegramUserId: number): Promise<Staff | null> {
  const { data, error } = await db.rpc("bot_resolve_staff", { p_telegram_user_id: telegramUserId });
  if (error) { console.error("bot_resolve_staff:", error.message); return null; }
  const row = Array.isArray(data) ? data[0] : data;
  return row ? (row as Staff) : null;
}

async function linkWithCode(code: string, from: Any, chatId: number): Promise<{ status: string; full_name: string }> {
  const { data, error } = await db.rpc("bot_link_telegram", {
    p_code: code,
    p_telegram_user_id: from.id,
    p_username: from.username ?? null,
    p_first_name: from.first_name ?? null,
    p_dm_chat_id: chatId,
  });
  if (error) { console.error("bot_link_telegram:", error.message); return { status: "error", full_name: "" }; }
  const row = (Array.isArray(data) ? data[0] : data) as { status: string; full_name: string | null } | undefined;
  return { status: row?.status ?? "invalid", full_name: row?.full_name ?? "" };
}

// ── vazifalar (faqat o'qish; yozish PR-3 da) ──────────────────────────────

async function myOpenTasks(userId: string): Promise<TaskRow[]> {
  const { data, error } = await db
    .from("tasks")
    .select("id, title, status, priority, due_date")
    .eq("assigned_to", userId)
    .in("status", ["todo", "in_progress"])
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) { console.error("tasks:", error.message); return []; }
  return (data ?? []) as TaskRow[];
}

async function showTasks(chatId: number, staff: Staff, onlyToday = false) {
  const all = await myOpenTasks(staff.user_id);
  const g = groupTasks(all, Date.now());
  const view = onlyToday ? { ...g, upcoming: [], nodate: [] } : g;
  if (onlyToday && !view.overdue.length && !view.today.length) {
    await send(chatId, "✅ Bugunga muddatli yoki kechikkan vazifa yo'q.", { reply_markup: MENU_KEYBOARD });
    return;
  }
  await sendLong(chatId, renderTaskList(view), { reply_markup: MENU_KEYBOARD });
  // Tugmali kartalar: avval kechikkan, keyin bugun, keyin qolganlari.
  const ordered = [...view.overdue, ...view.today, ...view.upcoming, ...view.nodate].slice(0, MAX_CARDS);
  for (const t of ordered) await sendTaskCard(chatId, t);
}

function taskButtons(t: TaskRow) {
  const row = [];
  if (t.status === "todo") row.push({ text: "▶ Boshladim", callback_data: `ts:${t.id}` });
  row.push({ text: "✅ Bajardim", callback_data: `td:${t.id}` });
  return { inline_keyboard: [row] };
}

async function sendTaskCard(chatId: number, t: TaskRow) {
  await send(chatId, renderTaskCard(t), { reply_markup: taskButtons(t) });
}

// ── holat (ko'p bosqichli oqim) ───────────────────────────────────────────

// deno-lint-ignore no-explicit-any
type State = Record<string, any>;

async function getState(tgId: number): Promise<State | null> {
  const { data } = await db.from("bot_state").select("state, updated_at").eq("telegram_user_id", tgId).maybeSingle();
  if (!data) return null;
  const ttl = (data.state as State)?.step === "report" ? REPORT_STATE_TTL_MS : STATE_TTL_MS;
  if (Date.now() - Date.parse(data.updated_at) > ttl) {
    await setState(tgId, null);
    return null;
  }
  return data.state as State;
}

async function setState(tgId: number, state: State | null) {
  if (!state) {
    await db.from("bot_state").delete().eq("telegram_user_id", tgId);
    return;
  }
  await db.from("bot_state").upsert({ telegram_user_id: tgId, state, updated_at: new Date().toISOString() });
}

// ── vazifa berish ─────────────────────────────────────────────────────────

async function startAssign(chatId: number, tgId: number, staff: Staff) {
  const { data, error } = await db.rpc("bot_staff_list");
  if (error) { console.error("bot_staff_list:", error.message); await send(chatId, "Hozir ro'yxatni olib bo'lmadi."); return; }
  const people = ((data ?? []) as { user_id: string; full_name: string; is_linked: boolean }[])
    .sort((a, b) => a.full_name.localeCompare(b.full_name));
  const rows: { text: string; callback_data: string }[][] = [];
  let row: { text: string; callback_data: string }[] = [];
  for (const p of people) {
    const label = p.user_id === staff.user_id ? `${p.full_name} (o'zim)` : p.full_name;
    row.push({ text: label, callback_data: `as:${p.user_id}` });
    if (row.length === 2) { rows.push(row); row = []; }
  }
  if (row.length) rows.push(row);
  rows.push([{ text: "✖ Bekor qilish", callback_data: "x" }]);
  await setState(tgId, { step: "pick" });
  await send(chatId, "Kimga vazifa berasiz?", { reply_markup: { inline_keyboard: rows } });
}

/** Ovozli xabarni matnga (Gemini). Bo'lmasa null. */
async function transcribeVoice(fileId: string): Promise<string | null> {
  if (!GEMINI_KEY) return null;
  try {
    const f = await callTelegram<{ file_path?: string }>(BOT_TOKEN, "getFile", { file_id: fileId });
    const path = f.result?.file_path;
    if (!path) return null;
    const res = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${path}`);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [
              { text: "Transcribe this voice message verbatim. It is mostly in Uzbek (Latin script), possibly with Russian or Korean words. Output only the transcript, no comments." },
              { inlineData: { mimeType: "audio/ogg", data: btoa(bin) } },
            ],
          }],
          generationConfig: { temperature: 0 },
        }),
      },
    );
    if (!r.ok) { console.error("gemini transcribe:", r.status, (await r.text()).slice(0, 300)); return null; }
    const j = await r.json();
    // deno-lint-ignore no-explicit-any
    const text = (j?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("").trim();
    return text || null;
  } catch (e) {
    console.error("transcribeVoice:", e instanceof Error ? e.message : e);
    return null;
  }
}

const CONFIRM_KB = {
  inline_keyboard: [[
    { text: "✅ Yaratish", callback_data: "tc:ok" },
    { text: "❌ Bekor qilish", callback_data: "x" },
  ]],
};

async function onAssignText(chatId: number, tgId: number, st: State, text: string, heard: string | null) {
  const draft: ParsedTask = parseTaskText(text, Date.now());
  await setState(tgId, { ...st, step: "confirm", draft });
  const prefix = heard ? `🎙 «${heard}»\n\n` : "";
  await send(chatId, prefix.replace(/[<>&]/g, "") + renderDraft(st.assignee_name, draft) +
    "\n\n<i>To'g'rilash uchun matnni qayta yuboring.</i>", { reply_markup: CONFIRM_KB });
}

async function notifyUser(userId: string, text: string, extra: Record<string, unknown> = {}) {
  const { data } = await db.from("staff_telegram_links").select("dm_chat_id").eq("user_id", userId).eq("is_active", true).maybeSingle();
  const chat = data?.dm_chat_id as number | undefined;
  if (chat) await send(chat, text, extra);
}

async function createFromState(cq: Any, staff: Staff, st: State) {
  const d = st.draft as ParsedTask;
  const { data, error } = await db.rpc("bot_create_task", {
    p_actor: staff.user_id, p_assignee: st.assignee, p_title: d.title, p_description: null,
    p_due: d.due, p_priority: d.priority,
  });
  const chatId = cq.message?.chat?.id;
  if (error || !data) {
    console.error("bot_create_task:", error?.message);
    await answerCallbackQuery(BOT_TOKEN, cq.id, "Saqlab bo'lmadi");
    return;
  }
  await setState(cq.from.id, null);
  await answerCallbackQuery(BOT_TOKEN, cq.id, "✅ Yaratildi");
  await callTelegram(BOT_TOKEN, "editMessageText", {
    chat_id: chatId, message_id: cq.message.message_id, parse_mode: "HTML",
    text: renderDraft(st.assignee_name, d) + "\n\n✅ Yaratildi — CRM'da ham ko'rinadi.",
  });
  if (st.assignee !== staff.user_id) {
    const card: TaskRow = { id: String(data), title: d.title, status: "todo", priority: d.priority, due_date: d.due };
    await notifyUser(st.assignee, `🆕 <b>${escapeHtml(staff.full_name)}</b>dan yangi vazifa:\n\n${renderTaskCard(card)}`,
      { reply_markup: taskButtons(card) });
  }
}

// ── tugmalar ──────────────────────────────────────────────────────────────

async function onCallback(cq: Any) {
  const data = String(cq.data ?? "");
  const staff = await resolveStaff(cq.from.id);
  if (!staff) {
    await answerCallbackQuery(BOT_TOKEN, cq.id, "Avval CRM havolasi orqali ulaning.");
    return;
  }
  const chatId = cq.message?.chat?.id;

  if (data === "x") {
    await setState(cq.from.id, null);
    await answerCallbackQuery(BOT_TOKEN, cq.id, "Bekor qilindi");
    if (chatId) await callTelegram(BOT_TOKEN, "editMessageReplyMarkup", { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
    return;
  }

  if (data.startsWith("pr:y:") || data.startsWith("pr:n:")) {
    await onProposalCallback(cq, staff, data.startsWith("pr:y:"), data.slice(5));
    return;
  }

  if (data.startsWith("as:")) {
    const st = await getState(cq.from.id);
    if (!st || st.step !== "pick") { await answerCallbackQuery(BOT_TOKEN, cq.id, "Eskirgan tugma"); return; }
    const uid = data.slice(3);
    const { data: list } = await db.rpc("bot_staff_list");
    const person = ((list ?? []) as { user_id: string; full_name: string }[]).find((p) => p.user_id === uid);
    if (!person) { await answerCallbackQuery(BOT_TOKEN, cq.id, "Topilmadi"); return; }
    await setState(cq.from.id, { step: "text", assignee: person.user_id, assignee_name: person.full_name });
    await answerCallbackQuery(BOT_TOKEN, cq.id);
    await callTelegram(BOT_TOKEN, "editMessageReplyMarkup", { chat_id: chatId, message_id: cq.message.message_id, reply_markup: { inline_keyboard: [] } });
    await send(chatId, `✍️ <b>${escapeHtml(person.full_name)}</b> uchun vazifani yozing yoki ovozli xabar yuboring.\nMuddat va muhimlikni ham ayting: «ertaga soat 15:00», «05.11», «juma», «zarur».\n/cancel — bekor qilish`);
    return;
  }

  if (data === "tc:ok") {
    const st = await getState(cq.from.id);
    if (!st || st.step !== "confirm") { await answerCallbackQuery(BOT_TOKEN, cq.id, "Eskirgan tugma"); return; }
    await createFromState(cq, staff, st);
    return;
  }

  if (data.startsWith("td:") || data.startsWith("ts:")) {
    const taskId = data.slice(3);
    const status = data.startsWith("td:") ? "completed" : "in_progress";
    const via = cq.message?.chat?.type === "private" ? "dm" : "group";
    const { data: res, error } = await db.rpc("bot_set_task_status", { p_actor: staff.user_id, p_task: taskId, p_status: status, p_via: via });
    const r = (Array.isArray(res) ? res[0] : res) as { result: string; title: string; created_by: string; assigned_to: string } | undefined;
    if (error || !r) { console.error("bot_set_task_status:", error?.message); await answerCallbackQuery(BOT_TOKEN, cq.id, "Xatolik"); return; }
    if (r.result === "not_found") { await answerCallbackQuery(BOT_TOKEN, cq.id, "Vazifa topilmadi"); return; }
    if (r.result === "not_allowed") { await answerCallbackQuery(BOT_TOKEN, cq.id, "Bu vazifa sizniki emas"); return; }
    const done = status === "completed";
    await answerCallbackQuery(BOT_TOKEN, cq.id, done ? "✅ Bajarildi" : "▶ Boshlandi");
    await callTelegram(BOT_TOKEN, "editMessageText", {
      chat_id: chatId, message_id: cq.message.message_id, parse_mode: "HTML",
      text: done ? `✅ <s>${escapeHtml(r.title)}</s>` : `▶ ${escapeHtml(r.title)}`,
      ...(done ? {} : { reply_markup: { inline_keyboard: [[{ text: "✅ Bajardim", callback_data: `td:${taskId}` }]] } }),
    });
    if (done && r.result === "ok" && r.created_by && r.created_by !== staff.user_id) {
      await notifyUser(r.created_by, `✅ <b>${escapeHtml(staff.full_name)}</b> vazifani bajardi:\n${escapeHtml(r.title)}`);
    }
    return;
  }

  await answerCallbackQuery(BOT_TOKEN, cq.id);
}

// ── ertalabki ro'yxat (cron) ──────────────────────────────────────────────

function cronAuthorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_")) {
    try {
      const keys = Object.values(JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}"));
      if (keys.includes(apikey)) return true;
    } catch { /* ignore */ }
  }
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer !== "" && bearer === SERVICE_ROLE_KEY;
}

async function morning() {
  const { data, error } = await db.rpc("bot_morning_targets");
  if (error) { console.error("bot_morning_targets:", error.message); return json({ error: error.message }, 500); }
  let sent = 0;
  for (const t of (data ?? []) as { user_id: string; full_name: string; dm_chat_id: number; overdue: number; today: number }[]) {
    const all = await myOpenTasks(t.user_id);
    const g = groupTasks(all, Date.now());
    const head = `☀️ Xayrli tong${t.full_name ? ", " + escapeHtml(t.full_name.split(" ")[0]) : ""}!`;
    await sendLong(t.dm_chat_id, head + "\n\n" + renderTaskList({ ...g, upcoming: [], nodate: [] }), { reply_markup: MENU_KEYBOARD });
    for (const task of [...g.overdue, ...g.today].slice(0, MAX_CARDS)) await sendTaskCard(t.dm_chat_id, task);
    sent++;
  }
  return json({ ok: true, sent });
}

// ── kunlik hisobot ────────────────────────────────────────────────────────

async function startReport(chatId: number, tgId: number, intro = "") {
  await setState(tgId, { step: "report" });
  await send(chatId, (intro ? intro + "\n\n" : "") + REPORT_PROMPT, { reply_markup: MENU_KEYBOARD });
}

/** Hisobotni 3 qismga ajratish (Gemini). Ishlamasa null — asl matn saqlanadi. */
async function splitReport(raw: string): Promise<ReportParts | null> {
  try {
    const { data: r } = await structuredJSON<ReportParts>({
      system:
        "You split a staff member's end-of-day work report into three parts. The report is in Uzbek (Latin), " +
        "maybe mixed with Russian. Keep the author's own words and language; shorten only by removing filler. " +
        "Do not invent anything. If a part is not mentioned, return an empty string for it.",
      prompt: `Report:\n"""${raw.slice(0, 6000)}"""\n\nReturn done (what was done today), blockers (problems, blockers, help needed), plan (plans for tomorrow).`,
      schema: {
        type: "object",
        properties: { done: { type: "string" }, blockers: { type: "string" }, plan: { type: "string" } },
        required: ["done", "blockers", "plan"],
      },
      temperature: 0,
    });
    if (!r) return null;
    const clean = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 3000) : null);
    const parts = { done: clean(r.done), blockers: clean(r.blockers), plan: clean(r.plan) };
    return parts.done || parts.blockers || parts.plan ? parts : null;
  } catch (e) {
    console.error("splitReport:", e instanceof Error ? e.message : e);
    return null;
  }
}

async function onReportText(chatId: number, tgId: number, staff: Staff, raw: string, heard: string | null) {
  const parts = await splitReport(raw);
  const { data, error } = await db.rpc("bot_save_report", {
    p_actor: staff.user_id, p_raw: raw, p_done: parts?.done ?? null, p_blockers: parts?.blockers ?? null,
    p_plan: parts?.plan ?? null, p_ai: parts !== null,
  });
  if (error) {
    console.error("bot_save_report:", error.message);
    await send(chatId, "Hisobotni saqlab bo'lmadi. Birozdan keyin qayta yuboring.");
    return;
  }
  await setState(tgId, null);
  const r = (Array.isArray(data) ? data[0] : data) as { was_update: boolean } | undefined;
  const head = r?.was_update ? "✏️ Hisobot yangilandi." : "✅ Hisobot qabul qilindi. Rahmat!";
  const heardLine = heard ? `🎙 «${escapeHtml(heard)}»\n\n` : "";
  await sendLong(chatId, `${head}\n\n${heardLine}${renderReport(raw, parts)}\n\n<i>O'zgartirish uchun «📝 Hisobot» tugmasini qayta bosing.</i>`,
    { reply_markup: MENU_KEYBOARD });
}

function fmtDay(ms: number): string {
  const [y, m, d] = tashkentDate(ms).split("-");
  return `${d}.${m}.${y}`;
}

async function reportCron(kind: string) {
  if (kind === "summary") {
    const { data, error } = await db.rpc("bot_report_summary");
    if (error) { console.error("bot_report_summary:", error.message); return json({ error: error.message }, 500); }
    const text = renderSummary((data ?? []) as SummaryRow[], fmtDay(Date.now()));
    const { data: owners } = await db.rpc("bot_owner_chats");
    let sent = 0;
    for (const o of (owners ?? []) as { dm_chat_id: number }[]) { await sendLong(o.dm_chat_id, text); sent++; }
    return json({ ok: true, kind, sent });
  }
  if (kind !== "ask" && kind !== "remind") return json({ error: "bad kind" }, 400);
  const { data, error } = await db.rpc("bot_report_targets");
  if (error) { console.error("bot_report_targets:", error.message); return json({ error: error.message }, 500); }
  let sent = 0;
  for (const t of (data ?? []) as { full_name: string; dm_chat_id: number; has_report: boolean }[]) {
    if (t.has_report) continue;
    // Shaxsiy chatda telegram_user_id = chat id
    const intro = kind === "ask"
      ? `🕔 Ish kuni tugayapti${t.full_name ? ", " + escapeHtml(t.full_name.split(" ")[0]) : ""}.`
      : "⏰ Bugungi hisobotingiz hali kelmadi.";
    await startReport(t.dm_chat_id, t.dm_chat_id, intro);
    sent++;
  }
  return json({ ok: true, kind, sent });
}

// ── xodimlar guruhi ───────────────────────────────────────────────────────

async function configuredGroupId(): Promise<string> {
  const { data } = await db.from("bot_settings").select("value").eq("key", "group_chat_id").maybeSingle();
  return String(data?.value ?? "");
}

const reply = (chatId: number, replyTo: number, text: string, extra: Record<string, unknown> = {}) =>
  send(chatId, text, { reply_parameters: { message_id: replyTo, allow_sending_without_reply: true }, ...extra });

async function logGroupMessage(msg: Any, staff: Staff | null, kind: string, taskId: string | null = null) {
  const media = msg.voice ? "voice" : msg.photo ? "photo" : msg.document ? "document" : msg.video ? "video"
    : msg.audio ? "audio" : msg.sticker ? "sticker" : null;
  const { error } = await db.from("staff_group_messages").upsert({
    chat_id: msg.chat.id, message_id: msg.message_id, tg_user_id: msg.from?.id ?? null,
    user_id: staff?.user_id ?? null, text: (msg.text ?? msg.caption ?? null)?.slice(0, 8000) ?? null,
    reply_to_message_id: msg.reply_to_message?.message_id ?? null, media, kind, task_id: taskId,
  }, { onConflict: "chat_id,message_id" });
  if (error) console.error("staff_group_messages:", error.message);
}

/** Vazifa kimga: text_mention → @username → javob berilgan xabar muallifi. */
async function resolveAssignee(cmd: { usernames: string[]; userIds: number[] }, msg: Any):
  Promise<{ user_id: string; full_name: string } | "unknown" | null> {
  if (cmd.userIds.length) {
    const s = await resolveStaff(cmd.userIds[0]);
    return s ? { user_id: s.user_id, full_name: s.full_name } : "unknown";
  }
  if (cmd.usernames.length) {
    const { data } = await db.rpc("bot_resolve_username", { p_username: cmd.usernames[0] });
    const row = (Array.isArray(data) ? data[0] : data) as { user_id: string; full_name: string } | undefined;
    return row ?? "unknown";
  }
  const target = msg.reply_to_message?.from;
  if (target && !target.is_bot) {
    const s = await resolveStaff(target.id);
    return s ? { user_id: s.user_id, full_name: s.full_name } : "unknown";
  }
  return null;
}

async function onGroupMessage(msg: Any) {
  const chatId: number = msg.chat.id;
  const groupId = await configuredGroupId();
  if (!groupId || String(chatId) !== groupId) return; // boshqa guruhlar e'tiborsiz
  if (msg.from?.is_bot) return;

  const text: string = msg.text ?? msg.caption ?? "";
  const staff = msg.from ? await resolveStaff(msg.from.id) : null;

  // 1) Bot kartasiga «✅» javobi → bajarildi
  const replyTo = msg.reply_to_message;
  if (replyTo?.from?.is_bot && isDoneReply(text)) {
    const { data: card } = await db.from("bot_group_cards").select("task_id")
      .eq("chat_id", chatId).eq("message_id", replyTo.message_id).maybeSingle();
    if (card?.task_id) {
      await logGroupMessage(msg, staff, "close", card.task_id);
      if (!staff) { await reply(chatId, msg.message_id, "Avval botga ulaning (CRM → Xodimlar → Telegram)."); return; }
      const { data: res, error } = await db.rpc("bot_set_task_status",
        { p_actor: staff.user_id, p_task: card.task_id, p_status: "completed", p_via: "group" });
      const r = (Array.isArray(res) ? res[0] : res) as { result: string; title: string; created_by: string } | undefined;
      if (error || !r) { console.error("bot_set_task_status:", error?.message); return; }
      if (r.result === "not_allowed") { await reply(chatId, msg.message_id, "Bu vazifani faqat mas'ul, bergan odam yoki owner yopadi."); return; }
      if (r.result === "same") { await reply(chatId, msg.message_id, "Bu vazifa allaqachon yopilgan."); return; }
      if (r.result !== "ok") return;
      await callTelegram(BOT_TOKEN, "editMessageReplyMarkup", { chat_id: chatId, message_id: replyTo.message_id, reply_markup: { inline_keyboard: [] } });
      await reply(chatId, msg.message_id, `✅ Bajarildi: <s>${escapeHtml(r.title)}</s>`);
      if (r.created_by && r.created_by !== staff.user_id) {
        await notifyUser(r.created_by, `✅ <b>${escapeHtml(staff.full_name)}</b> vazifani bajardi:\n${escapeHtml(r.title)}`);
      }
      return;
    }
  }

  // 2) #vazifa / /vazifa
  const cmd = parseGroupCommand(text, (msg.entities ?? msg.caption_entities ?? []) as TgEntity[]);
  if (!cmd) {
    // Tizim xabarlari (kimdir qo'shildi/chiqdi va h.k.) saqlanmaydi.
    const hasContent = text || msg.voice || msg.photo || msg.document || msg.video || msg.audio || msg.sticker;
    if (!hasContent) return;
    await logGroupMessage(msg, staff, "message");
    if (staff && shouldAnalyze(text)) background(analyzeGroupMessage(msg, staff, text));
    return;
  }

  if (!staff) {
    await logGroupMessage(msg, null, "command");
    await reply(chatId, msg.message_id, "Avval botga ulaning (CRM → Xodimlar → Telegram), keyin vazifa bera olasiz.");
    return;
  }
  const who = await resolveAssignee(cmd, msg);
  if (who === null || !cmd.body) {
    await logGroupMessage(msg, staff, "command");
    await reply(chatId, msg.message_id, GROUP_HELP);
    return;
  }
  if (who === "unknown") {
    await logGroupMessage(msg, staff, "command");
    await reply(chatId, msg.message_id, "Bu odam botga ulanmagan yoki xodim emas. Avval CRM'dan ulang.");
    return;
  }
  const draft = parseTaskText(cmd.body, Date.now());
  const { data: taskId, error } = await db.rpc("bot_create_task", {
    p_actor: staff.user_id, p_assignee: who.user_id, p_title: draft.title, p_description: null,
    p_due: draft.due, p_priority: draft.priority, p_via: "group",
  });
  if (error || !taskId) {
    console.error("bot_create_task(group):", error?.message);
    await logGroupMessage(msg, staff, "command");
    await reply(chatId, msg.message_id, "Vazifani saqlab bo'lmadi, qayta urinib ko'ring.");
    return;
  }
  await logGroupMessage(msg, staff, "command", String(taskId));
  const card: TaskRow = { id: String(taskId), title: draft.title, status: "todo", priority: draft.priority, due_date: draft.due };
  const sent = await reply(chatId, msg.message_id,
    `🆕 <b>${escapeHtml(who.full_name)}</b> uchun vazifa (${escapeHtml(staff.full_name)}dan):\n\n${renderTaskCard(card)}\n\n<i>Bajarilganda shu xabarga «✅» deb javob yozing.</i>`,
    { reply_markup: taskButtons(card) });
  // deno-lint-ignore no-explicit-any
  const sentId = (sent as any)?.result?.message_id ?? (sent as any)?.message_id;
  if (sentId) await db.from("bot_group_cards").insert({ chat_id: chatId, message_id: sentId, task_id: String(taskId) });
  if (who.user_id !== staff.user_id) {
    await notifyUser(who.user_id, `🆕 <b>${escapeHtml(staff.full_name)}</b> guruhda vazifa berdi:\n\n${renderTaskCard(card)}`,
      { reply_markup: taskButtons(card) });
  }
}

// ── guruh: AI tahlili (PR-8) ──────────────────────────────────────────────

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

/** Javobni kutmasdan fonda bajarish (Telegram'ga darhol 200). */
function background(p: Promise<unknown>) {
  const safe = p.catch((e) => console.error("background:", e instanceof Error ? e.message : e));
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(safe);
}

async function settingValue(key: string): Promise<string> {
  const { data } = await db.from("bot_settings").select("value").eq("key", key).maybeSingle();
  return String(data?.value ?? "");
}

async function analyzeGroupMessage(msg: Any, staff: Staff, text: string) {
  const mode = (await settingValue("group_ai_mode")) || "shadow";
  if (mode === "off") return;
  const { data: ctxData, error: ctxErr } = await db.rpc("bot_group_context");
  if (ctxErr) { console.error("bot_group_context:", ctxErr.message); return; }
  const ctx = (ctxData ?? []) as CtxStaff[];
  const names = new Map(ctx.map((c) => [c.user_id, c.name]));

  const { data: hist } = await db.from("staff_group_messages").select("user_id, text")
    .eq("chat_id", msg.chat.id).lt("message_id", msg.message_id).not("text", "is", null)
    .order("message_id", { ascending: false }).limit(15);
  const history = ((hist ?? []) as { user_id: string | null; text: string }[]).reverse()
    .map((h) => ({ name: (h.user_id && names.get(h.user_id)) || "Noma'lum", text: h.text.slice(0, 500) }));

  const { data: ai, provider } = await structuredJSON<AiAnalysis>({
    system: ANALYSIS_SYSTEM,
    prompt: buildAnalysisPrompt(ctx, history, { name: staff.full_name, text: text.slice(0, 2000) }),
    schema: ANALYSIS_SCHEMA,
    temperature: 0,
  });
  if (provider) console.log(`staff-bot: group analysis via ${provider}`);

  const p = interpretAnalysis(ai, ctx, Date.now());
  if (!p) return;
  if (p.kind === "close") {
    const { count } = await db.from("bot_proposals").select("id", { count: "exact", head: true })
      .eq("task_id", p.task_id).eq("kind", "close").eq("status", "pending");
    if (count) return;
  }

  const { data: row, error } = await db.from("bot_proposals").insert({
    chat_id: msg.chat.id, source_message_id: msg.message_id, kind: p.kind,
    author_user_id: staff.user_id, assignee_user_id: p.assignee_user_id, task_id: p.task_id,
    title: p.title, due_date: p.due, priority: p.priority, confidence: p.confidence, reason: p.reason,
    mode, status: mode === "on" ? "pending" : "shadow",
  }).select("id").single();
  if (error || !row) { if (error?.code !== "23505") console.error("bot_proposals:", error?.message); return; }
  console.log(`staff-bot: proposal ${p.kind} (${mode}) conf=${p.confidence} for ${p.assignee_name}`);
  if (mode !== "on") return;

  const sent = await reply(msg.chat.id, msg.message_id, renderProposal(p, staff.full_name), {
    reply_markup: { inline_keyboard: [[
      { text: p.kind === "close" ? "✅ Ha, bajarildi" : "✅ Yaratish", callback_data: `pr:y:${row.id}` },
      { text: "❌ Yo'q", callback_data: `pr:n:${row.id}` },
    ]] },
  });
  // deno-lint-ignore no-explicit-any
  const cardId = (sent as any)?.result?.message_id;
  if (cardId) await db.from("bot_proposals").update({ card_message_id: cardId }).eq("id", row.id);
}

interface ProposalRow {
  id: string; kind: "create" | "close"; status: string; author_user_id: string | null;
  assignee_user_id: string | null; task_id: string | null; title: string; due_date: string | null;
  priority: string; chat_id: number;
}

async function onProposalCallback(cq: Any, staff: Staff, yes: boolean, id: string) {
  const chatId = cq.message?.chat?.id;
  const msgId = cq.message?.message_id;
  const { data } = await db.from("bot_proposals").select("*").eq("id", id).maybeSingle();
  const p = data as ProposalRow | null;
  if (!p || p.status !== "pending") { await answerCallbackQuery(BOT_TOKEN, cq.id, "Bu taklif endi amal qilmaydi"); return; }

  const isOwner = staff.roles?.includes("owner");
  let allowed = isOwner || staff.user_id === p.author_user_id;
  if (p.kind === "close" && !allowed && p.task_id) {
    const { data: t } = await db.from("tasks").select("assigned_to, created_by").eq("id", p.task_id).maybeSingle();
    allowed = !!t && (t.assigned_to === staff.user_id || t.created_by === staff.user_id);
  }
  if (!allowed) {
    await answerCallbackQuery(BOT_TOKEN, cq.id, p.kind === "create" ? "Faqat xabar yozgan odam yoki owner tasdiqlaydi" : "Faqat mas'ul, bergan yoki owner");
    return;
  }

  const finish = async (status: string, text: string, extra: Record<string, unknown> = {}) => {
    await db.from("bot_proposals").update({ status, decided_by: staff.user_id, decided_at: new Date().toISOString(), ...extra }).eq("id", id);
    if (chatId && msgId) {
      await callTelegram(BOT_TOKEN, "editMessageText", { chat_id: chatId, message_id: msgId, parse_mode: "HTML", text });
    }
  };

  if (!yes) {
    await answerCallbackQuery(BOT_TOKEN, cq.id, "Rad etildi");
    await finish("rejected", `❌ <s>${escapeHtml(p.title)}</s> — taklif rad etildi (${escapeHtml(staff.full_name)}).`);
    return;
  }

  if (p.kind === "close") {
    const { data: res, error } = await db.rpc("bot_set_task_status",
      { p_actor: staff.user_id, p_task: p.task_id, p_status: "completed", p_via: "group" });
    const r = (Array.isArray(res) ? res[0] : res) as { result: string; title: string; created_by: string } | undefined;
    if (error || !r || !["ok", "same"].includes(r.result)) {
      console.error("proposal close:", error?.message ?? r?.result);
      await answerCallbackQuery(BOT_TOKEN, cq.id, "Yopib bo'lmadi");
      return;
    }
    await answerCallbackQuery(BOT_TOKEN, cq.id, "✅ Bajarildi");
    await finish("accepted", `✅ Bajarildi: <s>${escapeHtml(r.title)}</s> (${escapeHtml(staff.full_name)} tasdiqladi)`);
    if (r.result === "ok" && r.created_by && r.created_by !== staff.user_id) {
      await notifyUser(r.created_by, `✅ <b>${escapeHtml(staff.full_name)}</b> vazifani bajarildi deb belgiladi:\n${escapeHtml(r.title)}`);
    }
    return;
  }

  const actor = p.author_user_id ?? staff.user_id;
  const { data: taskId, error } = await db.rpc("bot_create_task", {
    p_actor: actor, p_assignee: p.assignee_user_id, p_title: p.title, p_description: null,
    p_due: p.due_date, p_priority: p.priority, p_via: "group",
  });
  if (error || !taskId) {
    console.error("proposal create:", error?.message);
    await answerCallbackQuery(BOT_TOKEN, cq.id, "Saqlab bo'lmadi");
    return;
  }
  await answerCallbackQuery(BOT_TOKEN, cq.id, "✅ Yaratildi");
  const card: TaskRow = { id: String(taskId), title: p.title, status: "todo", priority: p.priority, due_date: p.due_date };
  await finish("accepted", `✅ Vazifa yaratildi:\n\n${renderTaskCard(card)}\n\n<i>Bajarilganda shu xabarga «✅» deb javob yozing.</i>`,
    { created_task_id: String(taskId) });
  if (chatId && msgId) {
    await callTelegram(BOT_TOKEN, "editMessageReplyMarkup", { chat_id: chatId, message_id: msgId, reply_markup: taskButtons(card) });
    await db.from("bot_group_cards").insert({ chat_id: chatId, message_id: msgId, task_id: String(taskId) });
  }
  if (p.assignee_user_id && p.assignee_user_id !== actor) {
    await notifyUser(p.assignee_user_id, `🆕 Guruhdan yangi vazifa:\n\n${renderTaskCard(card)}`, { reply_markup: taskButtons(card) });
  }
}

// ── guruh a'zoligi ────────────────────────────────────────────────────────

async function onMyChatMember(upd: Any) {
  const chat = upd.chat;
  const status = upd.new_chat_member?.status;
  if (!chat || !["group", "supergroup"].includes(chat.type)) return;
  const { data } = await db.from("bot_settings").select("value").eq("key", "group_chat_id").maybeSingle();
  const current = String(data?.value ?? "");
  if (["member", "administrator"].includes(status)) {
    if (!current) {
      await db.from("bot_settings").update({ value: String(chat.id), updated_at: new Date().toISOString() }).eq("key", "group_chat_id");
      console.log(`staff-bot: group registered ${chat.id} (${chat.title ?? ""}) as ${status}`);
    } else if (current !== String(chat.id)) {
      console.warn(`staff-bot: added to another group ${chat.id} (${chat.title ?? ""}); configured group is ${current}`);
    }
  } else if (["left", "kicked"].includes(status) && current === String(chat.id)) {
    console.warn(`staff-bot: removed from configured group ${chat.id}`);
  }
}

// ── DM ────────────────────────────────────────────────────────────────────

async function onPrivateMessage(msg: Any) {
  const chatId: number = msg.chat.id;
  const from = msg.from;
  const text: string = msg.text ?? msg.caption ?? "";
  const staff = await resolveStaff(from.id);

  // Ulanmagan: faqat /start KOD qabul qilinadi
  if (!staff) {
    const code = parseStartCode(text);
    if (code) {
      const r = await linkWithCode(code, from, chatId);
      if (r.status === "error") {
        await send(chatId, "Hozir ulab bo'lmadi, birozdan keyin qayta urinib ko'ring.");
        return;
      }
      await send(chatId, linkResultText(r.status, r.full_name), r.status === "linked" ? { reply_markup: MENU_KEYBOARD } : {});
      return;
    }
    await send(chatId, NOT_LINKED_TEXT);
    return;
  }

  // DM chat id yangilangan bo'lsa (kam uchraydi) saqlab qo'yamiz
  if (staff.dm_chat_id !== chatId) {
    await db.from("staff_telegram_links").update({ dm_chat_id: chatId }).eq("user_id", staff.user_id);
  }

  const cmd = parseCommand(text);
  const isMenu = (Object.values(MENU) as string[]).includes(text.trim());

  // Vazifa berish oqimi: matn yoki ovoz kutilmoqda
  if (!cmd && !isMenu) {
    const st = await getState(from.id);
    if (st && (st.step === "text" || st.step === "confirm")) {
      const voice = msg.voice ?? msg.audio;
      if (voice) {
        await send(chatId, "🎧 Tinglayapman…");
        const heard = await transcribeVoice(voice.file_id);
        if (!heard) { await send(chatId, "Ovozni tushunib bo'lmadi. Matn bilan yozing."); return; }
        await onAssignText(chatId, from.id, st, heard, heard);
        return;
      }
      if (text.trim()) { await onAssignText(chatId, from.id, st, text, null); return; }
    }
    if (st && st.step === "report") {
      const voice = msg.voice ?? msg.audio;
      if (voice) {
        await send(chatId, "🎧 Tinglayapman…");
        const heard = await transcribeVoice(voice.file_id);
        if (!heard) { await send(chatId, "Ovozni tushunib bo'lmadi. Matn bilan yozing."); return; }
        await onReportText(chatId, from.id, staff, heard, heard);
        return;
      }
      if (text.trim()) { await onReportText(chatId, from.id, staff, text, null); return; }
    }
  }

  if (cmd) {
    switch (cmd.cmd) {
      case "start": {
        // Ulangan xodim yangi havola ochsa — qayta ulash (masalan, boshqa akkauntdan)
        const code = parseStartCode(text);
        if (code) {
          const r = await linkWithCode(code, from, chatId);
          await send(chatId, r.status === "linked" ? `✅ Qayta ulandi, ${staff.full_name}.` : linkResultText(r.status, ""), { reply_markup: MENU_KEYBOARD });
          return;
        }
        await send(chatId, `Salom, ${staff.full_name}!\n\n${HELP_TEXT}`, { reply_markup: MENU_KEYBOARD });
        return;
      }
      case "help":
        await send(chatId, HELP_TEXT, { reply_markup: MENU_KEYBOARD });
        return;
      case "bugun":
        await showTasks(chatId, staff, true);
        return;
      case "cancel":
        await db.from("bot_state").delete().eq("telegram_user_id", from.id);
        await send(chatId, "Bekor qilindi.", { reply_markup: MENU_KEYBOARD });
        return;
      default:
        await send(chatId, "Bunday buyruq yo'q. /help", { reply_markup: MENU_KEYBOARD });
        return;
    }
  }

  switch (text.trim()) {
    case MENU.tasks:
      await showTasks(chatId, staff);
      return;
    case MENU.assign:
      await startAssign(chatId, from.id, staff);
      return;
    case MENU.report:
      await startReport(chatId, from.id);
      return;
    case MENU.ask:
      await send(chatId, "Bu bo'lim keyingi yangilanishda ulanadi.", { reply_markup: MENU_KEYBOARD });
      return;
  }

  await send(chatId, `Tugmalardan foydalaning yoki /help yozing.`, { reply_markup: MENU_KEYBOARD });
}

// ── kirish nuqtasi ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error("staff-bot: STAFF_BOT_TOKEN or STAFF_BOT_WEBHOOK_SECRET is not set");
    return json({ error: "staff bot is not configured" }, 500);
  }

  if (req.method === "GET") {
    const action = new URL(req.url).searchParams.get("action");
    // Webhook'ni ro'yxatdan o'tkazish xavfsiz: u faqat shu funksiyaga, shu sir bilan ko'rsatadi.
    if (action === "setup") return setup();
    if (action === "status") {
      const info = await callTelegram(BOT_TOKEN, "getWebhookInfo", {});
      return json({ expected_url: WEBHOOK_URL, info: info.result ?? info });
    }
    return json({ message: "staff bot webhook" });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Cron: ertalabki ro'yxat (Telegram sirisiz, Supabase secret key bilan)
  if (new URL(req.url).searchParams.get("action") === "morning") {
    if (!cronAuthorized(req)) return json({ error: "unauthorized" }, 401);
    return await morning();
  }
  if (new URL(req.url).searchParams.get("action") === "report") {
    if (!cronAuthorized(req)) return json({ error: "unauthorized" }, 401);
    return await reportCron(new URL(req.url).searchParams.get("kind") ?? "");
  }

  if (req.headers.get("x-telegram-bot-api-secret-token") !== await telegramSecret()) {
    console.error("staff-bot: rejected update with bad or missing secret token");
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const update = await req.json();
    if (typeof update.update_id === "number" && await seenBefore(update.update_id)) return json({ ok: true });

    if (update.my_chat_member) {
      await onMyChatMember(update.my_chat_member);
      return json({ ok: true });
    }

    if (update.callback_query) {
      await onCallback(update.callback_query);
      return json({ ok: true });
    }

    const message = update.message;
    if (!message?.from) return json({ ok: true });
    if (message.chat?.type === "private") await onPrivateMessage(message);
    else if (["group", "supergroup"].includes(message.chat?.type)) await onGroupMessage(message);
  } catch (error) {
    // 200 qaytaramiz: aks holda Telegram shu update'ni qayta-qayta yuboradi.
    console.error("staff-bot error:", error instanceof Error ? error.message : error);
  }
  return json({ ok: true });
});
