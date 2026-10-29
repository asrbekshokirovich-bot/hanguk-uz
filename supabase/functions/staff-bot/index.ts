// staff-bot — Hanguk xodimlari uchun Telegram bot (reja: claude/xodim-boti-reja.md).
//
// PR-1 (shu fayl): xodimni CRM havolasi bilan ulash, DM menyusi, «Vazifalarim»
// (faqat o'qish), guruhga qo'shilganda guruh id'sini eslab qolish.
// Keyingi PR'lar: vazifa berish/bajarish (PR-3), 17:00 hisobot (PR-4),
// guruh tahlili (PR-7/8), Hanguk AI (PR-10).
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
import {
  groupTasks,
  HELP_TEXT,
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
  const g = groupTasks(await myOpenTasks(staff.user_id), Date.now());
  const view = onlyToday ? { ...g, upcoming: [], nodate: [] } : g;
  const text = onlyToday && !view.overdue.length && !view.today.length
    ? "✅ Bugunga muddatli yoki kechikkan vazifa yo'q."
    : renderTaskList(view);
  await sendLong(chatId, text, { reply_markup: MENU_KEYBOARD });
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
    case MENU.report:
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
      // Tugmalar PR-3 dan boshlab; hozircha faqat spinner to'xtatiladi.
      await answerCallbackQuery(BOT_TOKEN, update.callback_query.id);
      return json({ ok: true });
    }

    const message = update.message;
    if (!message?.from) return json({ ok: true });
    if (message.chat?.type === "private") await onPrivateMessage(message);
    // Guruh xabarlari PR-7 dan boshlab saqlanadi; hozircha e'tiborsiz.
  } catch (error) {
    // 200 qaytaramiz: aks holda Telegram shu update'ni qayta-qayta yuboradi.
    console.error("staff-bot error:", error instanceof Error ? error.message : error);
  }
  return json({ ok: true });
});
