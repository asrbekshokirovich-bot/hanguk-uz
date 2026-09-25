import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import {
  answerCallbackQuery,
  callTelegram,
  contactRequestKeyboard,
  removeKeyboard,
  sendTelegramMessage,
} from "../_shared/telegram.ts";

// HR bot: hiring runs entirely inside Telegram — no website, no CRM page.
//
// Candidates (anyone who is not an HR admin):
//   /start -> full name -> phone (contact button or typed) -> Tashkent district
//   -> study / work? -> if yes, their busy hours -> application sent to admins.
//
// HR admins (registered by sending `/admin <HR_ADMIN_PASSWORD>`):
//   every new application arrives as a card with buttons
//     ⭐ Tanlash            -> shortlist (candidate is not told)
//     📅 Suhbatga chaqirish -> date and time from buttons, address as text
//                              and/or a map pin, a preview, then the
//                              invitation; the candidate answers
//                              "Kelaman" or "Boshqa vaqt"
//     ❌ Rad etish          -> after a confirm tap, a polite message goes out
//   and a menu lists new / shortlisted / invited candidates and totals.
//
// Setup (see HR_BOT.md): secrets HR_BOT_TOKEN, HR_BOT_WEBHOOK_SECRET and
// HR_ADMIN_PASSWORD, then open `<function url>?action=setup` once.

const BOT_TOKEN = Deno.env.get("HR_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("HR_BOT_WEBHOOK_SECRET") ?? "";
const ADMIN_PASSWORD = Deno.env.get("HR_ADMIN_PASSWORD") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/hr-bot`;

/**
 * What Telegram is actually given as secret_token: the SHA-256 hex of the
 * stored secret. Telegram accepts only A-Z, a-z, 0-9, _ and -, and a value
 * pasted into the dashboard with a stray space or quote made setWebhook fail
 * with "secret token contains illegal characters". Hashing turns any stored
 * value into a legal one.
 */
async function telegramSecret(): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(WEBHOOK_SECRET));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// deno-lint-ignore no-explicit-any
type Any = any;

interface Candidate {
  id: string;
  telegram_user_id: string;
  chat_id: string;
  username: string | null;
  full_name: string | null;
  phone: string | null;
  district: string | null;
  occupation: string | null;
  busy_hours: string | null;
  step: string;
  status: string;
  interview_info: string | null;
  interview_at: string | null;
  interview_location: { text: string | null; lat: number | null; lon: number | null } | null;
  submitted_at: string | null;
}

/** A place: typed text, a map pin, or both. */
interface Place {
  text: string | null;
  lat: number | null;
  lon: number | null;
}

/**
 * The invitation an admin is putting together, one step at a time:
 * date (buttons) -> time (buttons or typed) -> address (text and/or map pin)
 * -> confirm. Stored in hr_admins.pending_action between messages.
 */
interface PendingInvite {
  action: "invite";
  candidate_id: string;
  step?: "date" | "time" | "address" | "address_extra" | "confirm";
  date?: string; // YYYY-MM-DD, Tashkent time
  time?: string; // HH:MM
  place?: Place;
}

interface Admin {
  telegram_user_id: string;
  chat_id: string;
  name: string | null;
  pending_action: PendingInvite | null;
  last_address: Place | null;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// --- Wording -----------------------------------------------------------------

/** The twelve districts of Tashkent city. */
const DISTRICTS = [
  "Bektemir", "Chilonzor",
  "Mirobod", "Mirzo Ulug'bek",
  "Olmazor", "Sergeli",
  "Shayxontohur", "Uchtepa",
  "Yakkasaroy", "Yangihayot",
  "Yashnobod", "Yunusobod",
];

const OCCUPATIONS: Record<string, string> = {
  "📚 O'qiyman": "study",
  "💼 Ishlayman": "work",
  "📚💼 Ikkalasi ham": "both",
  "❌ Yo'q": "none",
};

const OCCUPATION_LABELS: Record<string, string> = {
  study: "O'qiydi",
  work: "Ishlaydi",
  both: "O'qiydi va ishlaydi",
  none: "O'qimaydi, ishlamaydi",
};

const STATUS_LABELS: Record<string, string> = {
  new: "🆕 Yangi",
  selected: "⭐ Tanlangan",
  invited: "📅 Suhbatga chaqirilgan (javob kutilmoqda)",
  confirmed: "✅ Suhbatga kelishini tasdiqladi",
  reschedule: "🔄 Boshqa vaqt so'radi",
  rejected: "❌ Rad etilgan",
};

const MENU_NEW = "🆕 Yangi arizalar";
const MENU_SELECTED = "⭐ Tanlanganlar";
const MENU_INVITED = "📅 Suhbatga chaqirilganlar";
const MENU_STATS = "📊 Statistika";

const ADMIN_MENU = {
  keyboard: [
    [{ text: MENU_NEW }, { text: MENU_SELECTED }],
    [{ text: MENU_INVITED }, { text: MENU_STATS }],
  ],
  resize_keyboard: true,
  is_persistent: true,
};

const LIST_LIMIT = 10;

// Interview picker: how many days ahead are offered, and the time grid.
const INVITE_DAYS = 10;
const SLOT_FIRST = 9 * 60; // 09:00
const SLOT_LAST = 19 * 60; // 19:00
const SLOT_STEP = 30;

const WEEKDAYS = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
const WEEKDAYS_SHORT = ["Yak", "Du", "Se", "Chor", "Pay", "Ju", "Sha"];
const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];

const BTN_SEND_MY_LOCATION = "📍 Hozirgi joylashuvimni yuborish";
const BTN_LAST_ADDRESS = "♻️ Oldingi manzil";
const BTN_SKIP = "⏭ O'tkazib yuborish";
const BTN_CANCEL = "❌ Bekor qilish";

// --- Small helpers -------------------------------------------------------------

/** Messages go out with parse_mode HTML; everything a candidate types is user-controlled. */
function esc(s: string | null | undefined): string {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function send(chatId: string | number, text: string, replyMarkup?: unknown) {
  return sendTelegramMessage(BOT_TOKEN, chatId, text, {
    parse_mode: "HTML",
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    timeZone: "Asia/Tashkent",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Accepts 901234567, 998901234567, +998 90 123-45-67 and the like. */
function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith("998")) return `+${digits}`;
  return null;
}

function districtKeyboard() {
  const rows: { text: string }[][] = [];
  for (let i = 0; i < DISTRICTS.length; i += 2) {
    rows.push(DISTRICTS.slice(i, i + 2).map((text) => ({ text })));
  }
  return { keyboard: rows, resize_keyboard: true, is_persistent: true };
}

function occupationKeyboard() {
  const labels = Object.keys(OCCUPATIONS);
  return {
    keyboard: [
      [{ text: labels[0] }, { text: labels[1] }],
      [{ text: labels[2] }, { text: labels[3] }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

// --- Data access -----------------------------------------------------------------

async function getAdmin(userId: string): Promise<Admin | null> {
  const { data } = await supabase.from("hr_admins").select("*").eq("telegram_user_id", userId).maybeSingle();
  return data as Admin | null;
}

async function listAdmins(): Promise<Admin[]> {
  const { data } = await supabase.from("hr_admins").select("*");
  return (data ?? []) as Admin[];
}

async function setPending(userId: string, pending: Admin["pending_action"]) {
  await supabase.from("hr_admins").update({ pending_action: pending }).eq("telegram_user_id", userId);
}

async function getCandidate(id: string): Promise<Candidate | null> {
  const { data } = await supabase.from("hr_candidates").select("*").eq("id", id).maybeSingle();
  return data as Candidate | null;
}

async function getCandidateByUser(userId: string): Promise<Candidate | null> {
  const { data } = await supabase.from("hr_candidates").select("*").eq("telegram_user_id", userId).maybeSingle();
  return data as Candidate | null;
}

async function updateCandidate(id: string, fields: Partial<Candidate>): Promise<Candidate | null> {
  const { data, error } = await supabase
    .from("hr_candidates")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .single();
  if (error) console.error("hr_candidates update failed:", error.message);
  return data as Candidate | null;
}

// --- Candidate card (what admins see) ------------------------------------------------

function candidateCard(c: Candidate, heading?: string): string {
  const busy = c.occupation && c.occupation !== "none"
    ? `${OCCUPATION_LABELS[c.occupation] ?? c.occupation}\n🕒 Band vaqti: ${esc(c.busy_hours)}`
    : OCCUPATION_LABELS[c.occupation ?? ""] ?? "—";
  const contact = c.username
    ? `@${esc(c.username)}`
    : `<a href="tg://user?id=${esc(c.telegram_user_id)}">Telegram profil</a>`;
  const lines = [
    heading ? `<b>${heading}</b>\n` : "",
    `👤 <b>${esc(c.full_name)}</b>`,
    `📞 ${esc(c.phone)}`,
    `📍 ${esc(c.district)} tumani`,
    `💼 ${busy}`,
    `✉️ ${contact}`,
    `🗓 Ariza: ${formatDate(c.submitted_at)}`,
    `\nHolat: ${STATUS_LABELS[c.status] ?? c.status}`,
  ];
  if (c.interview_info && ["invited", "confirmed", "reschedule"].includes(c.status)) {
    lines.push(`📅 Suhbat: ${esc(c.interview_info)}`);
  }
  return lines.filter(Boolean).join("\n");
}

function candidateButtons(c: Candidate) {
  if (c.status === "rejected") return { inline_keyboard: [] };
  const row1 = [];
  if (c.status === "new") row1.push({ text: "⭐ Tanlash", callback_data: `hr:sel:${c.id}` });
  row1.push({
    text: c.status === "invited" || c.status === "confirmed" || c.status === "reschedule"
      ? "📅 Qayta chaqirish"
      : "📅 Suhbatga chaqirish",
    callback_data: `hr:inv:${c.id}`,
  });
  return {
    inline_keyboard: [row1, [{ text: "❌ Rad etish", callback_data: `hr:rej:${c.id}` }]],
  };
}

async function sendCard(chatId: string, c: Candidate, heading?: string) {
  await send(chatId, candidateCard(c, heading), candidateButtons(c));
}

async function notifyAdmins(c: Candidate, heading: string, extra?: string) {
  for (const admin of await listAdmins()) {
    await sendCard(admin.chat_id, c, heading);
    if (extra) await send(admin.chat_id, extra);
  }
}

// --- Candidate conversation ---------------------------------------------------------

function askForStep(chatId: string, step: string) {
  switch (step) {
    case "full_name":
      return send(chatId, "1️⃣ Ism va familiyangizni yozing:\n<i>Masalan: Aliyev Vali</i>", removeKeyboard());
    case "phone":
      return send(
        chatId,
        "2️⃣ Telefon raqamingizni yuboring.\nPastdagi tugmani bosing yoki raqamni yozing:\n<i>Masalan: 90 123 45 67</i>",
        contactRequestKeyboard("📱 Raqamni yuborish"),
      );
    case "district":
      return send(chatId, "3️⃣ Toshkent shahrining qaysi tumanida yashaysiz?", districtKeyboard());
    case "occupation":
      return send(chatId, "4️⃣ Hozir biror joyda o'qiysizmi yoki ishlaysizmi?", occupationKeyboard());
    case "busy_hours":
      return send(
        chatId,
        "🕒 O'qish yoki ish vaqtingizni yozing (qaysi kunlari, soat nechadan nechagacha):\n<i>Masalan: Du–Ju, 09:00–14:00</i>",
        removeKeyboard(),
      );
  }
}

async function startCandidate(from: Any, chatId: string) {
  const userId = String(from.id);
  const existing = await getCandidateByUser(userId);

  // Already applied (including a candidate mid-way through asking for another
  // interview time): /start must not wipe the application.
  if (existing?.submitted_at) {
    const text = existing.status === "rejected"
      ? "Arizangiz ko'rib chiqilgan. Qiziqishingiz uchun rahmat!"
      : "✅ Arizangiz qabul qilingan va ko'rib chiqilmoqda. Javobni shu chatda olasiz.";
    await send(chatId, text, removeKeyboard());
    return;
  }

  const fresh = {
    telegram_user_id: userId,
    chat_id: chatId,
    username: from.username ?? null,
    full_name: null,
    phone: null,
    district: null,
    occupation: null,
    busy_hours: null,
    step: "full_name",
    status: "new",
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("hr_candidates").upsert(fresh, { onConflict: "telegram_user_id" });
  if (error) {
    console.error("hr_candidates upsert failed:", error.message);
    await send(chatId, "Kechirasiz, xatolik yuz berdi. Birozdan so'ng /start ni qayta bosing.");
    return;
  }

  await send(
    chatId,
    "Assalomu alaykum! 👋\n\nIshga ariza topshirish uchun 4 ta qisqa savolga javob bering. Bu 1 daqiqa vaqt oladi.",
  );
  await askForStep(chatId, "full_name");
}

async function submitApplication(c: Candidate) {
  const done = await updateCandidate(c.id, {
    step: "done",
    status: "new",
    submitted_at: new Date().toISOString(),
  });
  if (!done) {
    await send(c.chat_id, "Kechirasiz, xatolik yuz berdi. Oxirgi javobingizni qayta yuboring.");
    return;
  }
  await send(
    c.chat_id,
    "✅ Rahmat! Arizangiz qabul qilindi.\n\nHR bo'limi uni ko'rib chiqadi va suhbatga taklif qilinsangiz, shu chatda xabar olasiz.",
    removeKeyboard(),
  );
  await notifyAdmins(done, "🆕 Yangi ariza");
}

async function handleCandidateMessage(message: Any) {
  const chatId = String(message.chat.id);
  const from = message.from;
  const text: string = (message.text ?? "").trim();

  if (text.startsWith("/start")) return startCandidate(from, chatId);

  const c = await getCandidateByUser(String(from.id));
  if (!c) return startCandidate(from, chatId);

  switch (c.step) {
    case "full_name": {
      const words = text.split(/\s+/).filter(Boolean);
      if (words.length < 2 || text.length < 5 || text.length > 100 || /\d/.test(text)) {
        await send(chatId, "Iltimos, ism va familiyangizni to'liq yozing.\n<i>Masalan: Aliyev Vali</i>");
        return;
      }
      await updateCandidate(c.id, { full_name: words.join(" "), step: "phone" });
      return askForStep(chatId, "phone");
    }

    case "phone": {
      let phone: string | null = null;
      if (message.contact) {
        // Only the candidate's own number: a shared contact card could be anyone's.
        if (message.contact.user_id && String(message.contact.user_id) !== String(from.id)) {
          await send(chatId, "Iltimos, o'zingizning raqamingizni yuboring.");
          return;
        }
        phone = normalizePhone(message.contact.phone_number ?? "") ?? `+${String(message.contact.phone_number).replace(/\D/g, "")}`;
      } else {
        phone = normalizePhone(text);
      }
      if (!phone) {
        await send(chatId, "Raqam noto'g'ri. Qaytadan yozing:\n<i>Masalan: 90 123 45 67</i>");
        return;
      }
      await updateCandidate(c.id, { phone, step: "district" });
      return askForStep(chatId, "district");
    }

    case "district": {
      const district = DISTRICTS.find((d) => d.toLowerCase() === text.toLowerCase().replace(/\s*tumani$/, ""));
      if (!district) {
        await send(chatId, "Iltimos, tumaningizni pastdagi tugmalardan tanlang.", districtKeyboard());
        return;
      }
      await updateCandidate(c.id, { district, step: "occupation" });
      return askForStep(chatId, "occupation");
    }

    case "occupation": {
      const occupation = OCCUPATIONS[text];
      if (!occupation) {
        await send(chatId, "Iltimos, pastdagi tugmalardan birini tanlang.", occupationKeyboard());
        return;
      }
      if (occupation === "none") {
        const updated = await updateCandidate(c.id, { occupation, busy_hours: null });
        if (updated) await submitApplication(updated);
        return;
      }
      await updateCandidate(c.id, { occupation, step: "busy_hours" });
      return askForStep(chatId, "busy_hours");
    }

    case "busy_hours": {
      if (text.length < 3 || text.length > 300) {
        await send(chatId, "Iltimos, o'qish yoki ish vaqtingizni yozing.\n<i>Masalan: Du–Ju, 09:00–14:00</i>");
        return;
      }
      const updated = await updateCandidate(c.id, { busy_hours: text });
      if (updated) await submitApplication(updated);
      return;
    }

    case "reschedule_note": {
      if (!text) {
        await send(chatId, "Iltimos, sizga qulay kun va vaqtni matn bilan yozing.");
        return;
      }
      const updated = await updateCandidate(c.id, { step: "done" });
      await send(chatId, "Rahmat! HR bo'limiga yetkazildi, tez orada yangi vaqt yuboriladi.");
      if (updated) {
        await notifyAdmins(updated, "🔄 Nomzod boshqa vaqt so'radi", `💬 Nomzod yozdi: <i>${esc(text)}</i>`);
      }
      return;
    }

    default:
      await send(chatId, "✅ Arizangiz qabul qilingan. Javobni shu chatda olasiz.");
  }
}

async function handleCandidateCallback(cq: Any) {
  const [, action, id] = String(cq.data).split(":");
  const c = await getCandidate(id);
  const chatId = String(cq.message?.chat?.id ?? cq.from.id);
  if (!c || c.telegram_user_id !== String(cq.from.id)) {
    await answerCallbackQuery(BOT_TOKEN, cq.id);
    return;
  }
  if (c.status !== "invited") {
    await answerCallbackQuery(BOT_TOKEN, cq.id, "Bu taklif endi amal qilmaydi.");
    return;
  }
  await answerCallbackQuery(BOT_TOKEN, cq.id);
  // Drop the buttons so the same answer cannot be sent twice.
  if (cq.message) {
    await callTelegram(BOT_TOKEN, "editMessageReplyMarkup", {
      chat_id: chatId,
      message_id: cq.message.message_id,
      reply_markup: { inline_keyboard: [] },
    });
  }

  if (action === "yes") {
    const updated = await updateCandidate(c.id, { status: "confirmed" });
    await send(chatId, "✅ Ajoyib! Sizni suhbatda kutamiz.");
    if (updated) await notifyAdmins(updated, "✅ Nomzod suhbatga kelishini tasdiqladi");
  } else if (action === "resched") {
    await updateCandidate(c.id, { status: "reschedule", step: "reschedule_note" });
    await send(chatId, "Sizga qaysi kun va soat qulay? Matn bilan yozing:\n<i>Masalan: Shanba, 11:00 dan keyin</i>");
  }
}

// --- Admin side --------------------------------------------------------------------------

async function handleAdminCommand(message: Any): Promise<boolean> {
  const text: string = (message.text ?? "").trim();
  if (!text.startsWith("/admin")) return false;

  const chatId = String(message.chat.id);
  const from = message.from;
  const password = text.slice("/admin".length).trim();

  // The password should not sit in the chat history.
  await callTelegram(BOT_TOKEN, "deleteMessage", { chat_id: chatId, message_id: message.message_id });

  if (!ADMIN_PASSWORD) {
    await send(chatId, "Admin paroli hali sozlanmagan (HR_ADMIN_PASSWORD).");
    return true;
  }
  if (password !== ADMIN_PASSWORD) {
    await send(chatId, "❌ Parol noto'g'ri.");
    return true;
  }

  const name = [from.first_name, from.last_name].filter(Boolean).join(" ") || from.username || null;
  await supabase.from("hr_admins").upsert(
    { telegram_user_id: String(from.id), chat_id: chatId, name, pending_action: null },
    { onConflict: "telegram_user_id" },
  );
  // If this person had started the candidate questionnaire, drop it so it
  // does not reappear as an application.
  await supabase.from("hr_candidates").delete().eq("telegram_user_id", String(from.id)).neq("step", "done");

  await send(
    chatId,
    "✅ Siz HR admin sifatida qo'shildingiz.\n\nYangi arizalar shu chatga keladi. Pastdagi menyudan foydalaning.\nAdminlikdan chiqish: /chiqish",
    ADMIN_MENU,
  );
  return true;
}

async function sendList(chatId: string, statuses: string[], emptyText: string) {
  const { data, count } = await supabase
    .from("hr_candidates")
    .select("*", { count: "exact" })
    .eq("step", "done")
    .in("status", statuses)
    .order("submitted_at", { ascending: false })
    .limit(LIST_LIMIT);
  const rows = (data ?? []) as Candidate[];
  if (!rows.length) {
    await send(chatId, emptyText, ADMIN_MENU);
    return;
  }
  for (const c of rows) await sendCard(chatId, c);
  if ((count ?? 0) > rows.length) {
    await send(chatId, `Oxirgi ${rows.length} tasi ko'rsatildi, jami: ${count} ta.`);
  }
}

async function sendStats(chatId: string) {
  const { data } = await supabase.from("hr_candidates").select("status").eq("step", "done");
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  const total = (data ?? []).length;
  const lines = Object.keys(STATUS_LABELS).map((s) => `${STATUS_LABELS[s]}: <b>${counts[s] ?? 0}</b>`);
  await send(chatId, `📊 <b>Jami arizalar: ${total}</b>\n\n${lines.join("\n")}`, ADMIN_MENU);
}

async function handleAdminMessage(admin: Admin, message: Any) {
  const chatId = String(message.chat.id);
  const text: string = (message.text ?? "").trim();

  if (text === "/bekor") {
    await setPending(admin.telegram_user_id, null);
    await send(chatId, "Bekor qilindi.", ADMIN_MENU);
    return;
  }
  if (text === "/chiqish") {
    await supabase.from("hr_admins").delete().eq("telegram_user_id", admin.telegram_user_id);
    await send(chatId, "Siz adminlar ro'yxatidan chiqdingiz.", removeKeyboard());
    return;
  }

  const pending = admin.pending_action;
  if (pending?.action === "invite") {
    if (text === BTN_CANCEL) {
      await setPending(admin.telegram_user_id, null);
      await send(chatId, "Suhbat taklifi bekor qilindi.", ADMIN_MENU);
      return;
    }
    // A menu button or another command abandons the invitation, so nothing
    // typed later is mistaken for part of it.
    if (isMenuButton(text) || text.startsWith("/")) {
      await setPending(admin.telegram_user_id, null);
    } else {
      await handleInviteInput(admin, message, pending);
      return;
    }
  }

  switch (text) {
    case MENU_NEW:
      return sendList(chatId, ["new"], "Yangi arizalar yo'q.");
    case MENU_SELECTED:
      return sendList(chatId, ["selected"], "Tanlangan nomzodlar yo'q.");
    case MENU_INVITED:
      return sendList(chatId, ["invited", "confirmed", "reschedule"], "Suhbatga chaqirilganlar yo'q.");
    case MENU_STATS:
      return sendStats(chatId);
    default:
      await send(chatId, "Menyudan tanlang 👇", ADMIN_MENU);
  }
}

function isMenuButton(text: string): boolean {
  return [MENU_NEW, MENU_SELECTED, MENU_INVITED, MENU_STATS].includes(text);
}

async function editCard(cq: Any, c: Candidate) {
  if (!cq.message) return;
  await callTelegram(BOT_TOKEN, "editMessageText", {
    chat_id: cq.message.chat.id,
    message_id: cq.message.message_id,
    text: candidateCard(c),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: candidateButtons(c),
  });
}

async function handleAdminCallback(admin: Admin, cq: Any) {
  const [, action, id] = String(cq.data).split(":");
  const c = await getCandidate(id);
  const chatId = String(cq.message?.chat?.id ?? admin.chat_id);
  if (!c) {
    await answerCallbackQuery(BOT_TOKEN, cq.id, "Nomzod topilmadi.");
    return;
  }

  switch (action) {
    case "sel": {
      const updated = await updateCandidate(c.id, { status: "selected" });
      await answerCallbackQuery(BOT_TOKEN, cq.id, "⭐ Tanlanganlarga qo'shildi");
      if (updated) await editCard(cq, updated);
      return;
    }
    case "inv": {
      await answerCallbackQuery(BOT_TOKEN, cq.id);
      await startInvite(admin, chatId, c);
      return;
    }
    case "ivd":
    case "ivt":
    case "ivb":
    case "ivx":
    case "ivs":
    case "ivr":
      await handleInviteCallback(admin, cq, c, action, String(cq.data).split(":")[3] ?? "");
      return;
    case "rej": {
      await answerCallbackQuery(BOT_TOKEN, cq.id);
      if (cq.message) {
        await callTelegram(BOT_TOKEN, "editMessageReplyMarkup", {
          chat_id: cq.message.chat.id,
          message_id: cq.message.message_id,
          reply_markup: {
            inline_keyboard: [[
              { text: "✅ Ha, rad etish", callback_data: `hr:rejok:${c.id}` },
              { text: "↩️ Bekor", callback_data: `hr:card:${c.id}` },
            ]],
          },
        });
      }
      return;
    }
    case "rejok": {
      if (c.status === "rejected") {
        await answerCallbackQuery(BOT_TOKEN, cq.id, "Allaqachon rad etilgan.");
        return;
      }
      const updated = await updateCandidate(c.id, { status: "rejected", step: "done" });
      await answerCallbackQuery(BOT_TOKEN, cq.id, "❌ Rad etildi");
      await send(
        c.chat_id,
        `Assalomu alaykum, ${esc(c.full_name)}.\n\nArizangiz uchun rahmat. Afsuski, hozircha sizning nomzodingiz bo'yicha ijobiy qaror qabul qilinmadi. Sizga omad tilaymiz!`,
      );
      if (updated) await editCard(cq, updated);
      return;
    }
    case "card": {
      await answerCallbackQuery(BOT_TOKEN, cq.id);
      await editCard(cq, c);
      return;
    }
    default:
      await answerCallbackQuery(BOT_TOKEN, cq.id);
  }
}

// --- Interview invitation: date -> time -> address -> confirm -------------------------------

/** "Now" shifted to Tashkent wall-clock time (UTC+5, no DST); read it with getUTC*. */
function tashkentNow(): Date {
  return new Date(Date.now() + 5 * 60 * 60 * 1000);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function ymdToDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

/** "27-sentabr, Shanba" */
function dateLabel(value: string): string {
  const d = ymdToDate(value);
  return `${d.getUTCDate()}-${MONTHS[d.getUTCMonth()]}, ${WEEKDAYS[d.getUTCDay()]}`;
}

function minutesToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Accepts 15:00, 15.00, 1500, 9:30 and the like. */
export function parseTime(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2})[:.\s-]?(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return minutesToHHMM(h * 60 + min);
}

/** Accepts 27.09, 27/09, 27.09.2026. Without a year, a date already past means next year. */
export function parseDate(raw: string, today: Date = tashkentNow()): string | null {
  const m = raw.trim().match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2}|\d{4}))?$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getUTCFullYear();
  const build = (y: number) => new Date(Date.UTC(y, month - 1, day));
  let d = build(year);
  if (d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null; // 31.02 etc.
  if (!m[3] && ymd(d) < ymd(today)) d = build(++year);
  if (ymd(d) < ymd(today)) return null;
  return ymd(d);
}

/** The interview moment as an absolute timestamp, for sorting and reminders later. */
function interviewAt(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:00`).toISOString();
}

function dateKeyboard(candidateId: string) {
  const today = tashkentNow();
  const buttons = [];
  for (let i = 0; i < INVITE_DAYS; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const dm = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const prefix = i === 0 ? "Bugun, " : i === 1 ? "Ertaga, " : "";
    buttons.push({
      text: `${prefix}${dm} ${WEEKDAYS_SHORT[d.getUTCDay()]}`,
      callback_data: `hr:ivd:${candidateId}:${ymd(d)}`,
    });
  }
  const rows = [];
  for (let i = 0; i < buttons.length; i += 2) rows.push(buttons.slice(i, i + 2));
  rows.push([{ text: BTN_CANCEL, callback_data: `hr:ivx:${candidateId}` }]);
  return { inline_keyboard: rows };
}

/** Half-hour slots; for today, only the ones still ahead. */
function timeSlots(date: string): string[] {
  const now = tashkentNow();
  const isToday = date === ymd(now);
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const slots: string[] = [];
  for (let m = SLOT_FIRST; m <= SLOT_LAST; m += SLOT_STEP) {
    if (!isToday || m > nowMin) slots.push(minutesToHHMM(m));
  }
  return slots;
}

function timeKeyboard(candidateId: string, date: string) {
  const buttons = timeSlots(date).map((t) => ({
    text: t,
    callback_data: `hr:ivt:${candidateId}:${t.replace(":", "")}`,
  }));
  const rows = [];
  for (let i = 0; i < buttons.length; i += 4) rows.push(buttons.slice(i, i + 4));
  rows.push([
    { text: "⬅️ Sanani o'zgartirish", callback_data: `hr:ivb:${candidateId}` },
    { text: BTN_CANCEL, callback_data: `hr:ivx:${candidateId}` },
  ]);
  return { inline_keyboard: rows };
}

function datePrompt(c: Candidate): string {
  return `📅 <b>${esc(c.full_name)}</b> uchun suhbat <b>kunini</b> tanlang:\n\n<i>Boshqa sana kerak bo'lsa, yozib yuboring: 03.10</i>`;
}

function timePrompt(c: Candidate, date: string): string {
  const none = timeSlots(date).length === 0 ? "\n\nBugun uchun bo'sh vaqt qolmadi." : "";
  return `📅 ${dateLabel(date)}\n\n<b>${esc(c.full_name)}</b> uchun suhbat <b>vaqtini</b> tanlang:${none}\n\n<i>Boshqa vaqt kerak bo'lsa, yozib yuboring: 15:45</i>`;
}

function addressKeyboard(admin: Admin) {
  const rows: Record<string, unknown>[][] = [[{ text: BTN_SEND_MY_LOCATION, request_location: true }]];
  if (admin.last_address) rows.push([{ text: BTN_LAST_ADDRESS }]);
  rows.push([{ text: BTN_CANCEL }]);
  return { keyboard: rows, resize_keyboard: true, one_time_keyboard: true };
}

/** Plain text, not HTML-escaped: stored in interview_info. */
function placeText(p: Place | undefined | null): string {
  if (!p) return "—";
  if (p.text && p.lat != null) return `${p.text} (xaritada belgilangan)`;
  if (p.text) return p.text;
  if (p.lat != null) return "xaritada belgilangan joy";
  return "—";
}

function placeLine(p: Place | undefined | null): string {
  return esc(placeText(p));
}

function invitationText(c: Candidate, p: PendingInvite): string {
  const mapNote = p.place?.lat != null ? "\n<i>Joylashuv xaritada, yuqorida yuborildi.</i>" : "";
  return [
    `Assalomu alaykum, ${esc(c.full_name)}! 🎉`,
    "",
    "Siz <b>suhbatga taklif qilindingiz</b>.",
    "",
    `📅 Sana: <b>${dateLabel(p.date!)}</b>`,
    `🕒 Vaqt: <b>${p.time}</b>`,
    `📍 Manzil: ${p.place?.text ? esc(p.place.text) : "xaritada ko'rsatilgan"}${mapNote}`,
    "",
    "Iltimos, javob bering:",
  ].join("\n");
}

async function startInvite(admin: Admin, chatId: string, c: Candidate) {
  const pending: PendingInvite = { action: "invite", candidate_id: c.id, step: "date" };
  await setPending(admin.telegram_user_id, pending);
  admin.pending_action = pending;
  await send(chatId, datePrompt(c), dateKeyboard(c.id));
}

async function askTime(admin: Admin, chatId: string, c: Candidate, date: string) {
  await setPending(admin.telegram_user_id, { action: "invite", candidate_id: c.id, step: "time", date });
  await send(chatId, timePrompt(c, date), timeKeyboard(c.id, date));
}

async function askAddress(admin: Admin, chatId: string, p: PendingInvite) {
  await setPending(admin.telegram_user_id, { ...p, step: "address" });
  const last = admin.last_address ? `\n\n${BTN_LAST_ADDRESS}: ${placeLine(admin.last_address)}` : "";
  await send(
    chatId,
    `📅 ${dateLabel(p.date!)}, 🕒 ${p.time}\n\n📍 Endi suhbat <b>manzilini</b> yuboring:\n• manzilni matn bilan yozing, yoki\n• 📎 → <b>Location</b> orqali xaritadan joy belgilang, yoki\n• pastdagi tugmani bosing${last}`,
    addressKeyboard(admin),
  );
}

async function askAddressExtra(admin: Admin, chatId: string, p: PendingInvite) {
  await setPending(admin.telegram_user_id, { ...p, step: "address_extra" });
  const hasPin = p.place?.lat != null;
  const rows: Record<string, unknown>[][] = [];
  if (!hasPin) rows.push([{ text: BTN_SEND_MY_LOCATION, request_location: true }]);
  rows.push([{ text: BTN_SKIP }], [{ text: BTN_CANCEL }]);
  const question = hasPin
    ? "✅ Xaritadagi joy qabul qilindi.\n\nNomzodga tushunarli bo'lishi uchun <b>manzil matnini</b> ham yozing (ko'cha, mo'ljal, qavat) yoki o'tkazib yuboring:"
    : "✅ Manzil qabul qilindi.\n\nNomzod oson topishi uchun <b>xaritadagi joylashuvni</b> ham yuborasizmi? 📎 → <b>Location</b> yoki o'tkazib yuboring:";
  await send(chatId, question, { keyboard: rows, resize_keyboard: true, one_time_keyboard: true });
}

async function showConfirm(admin: Admin, chatId: string, c: Candidate, p: PendingInvite) {
  await setPending(admin.telegram_user_id, { ...p, step: "confirm" });
  // Brings the menu keyboard back; the preview below carries the inline buttons.
  await send(chatId, "Taklif tayyor. Tekshirib chiqing 👇", ADMIN_MENU);
  await send(
    chatId,
    `<b>Nomzodga shunday xabar boradi:</b>\n\n${invitationText(c, p)}${p.place?.lat != null ? "\n\n<i>(+ xaritadagi joylashuv)</i>" : ""}`,
    {
      inline_keyboard: [
        [{ text: "✅ Yuborish", callback_data: `hr:ivs:${c.id}` }],
        [
          { text: "✏️ Qaytadan", callback_data: `hr:ivr:${c.id}` },
          { text: BTN_CANCEL, callback_data: `hr:ivx:${c.id}` },
        ],
      ],
    },
  );
}

/** Location from a Telegram message: a shared pin or a venue picked on the map. */
function placeFromMessage(message: Any): Place | null {
  const loc = message.venue?.location ?? message.location;
  if (!loc) return null;
  const venueText = message.venue
    ? [message.venue.title, message.venue.address].filter(Boolean).join(", ")
    : "";
  return { text: venueText || null, lat: loc.latitude, lon: loc.longitude };
}

async function handleInviteInput(admin: Admin, message: Any, p: PendingInvite) {
  const chatId = String(message.chat.id);
  const text: string = (message.text ?? "").trim();
  const c = await getCandidate(p.candidate_id);
  if (!c) {
    await setPending(admin.telegram_user_id, null);
    await send(chatId, "Nomzod topilmadi.", ADMIN_MENU);
    return;
  }

  switch (p.step ?? "date") {
    case "date": {
      const date = parseDate(text);
      if (!date) {
        await send(chatId, "Sanani tugmadan tanlang yoki shunday yozing: <b>03.10</b>", dateKeyboard(c.id));
        return;
      }
      return askTime(admin, chatId, c, date);
    }

    case "time": {
      const time = parseTime(text);
      if (!time) {
        await send(chatId, "Vaqtni tugmadan tanlang yoki shunday yozing: <b>15:45</b>", timeKeyboard(c.id, p.date!));
        return;
      }
      return askAddress(admin, chatId, { ...p, time });
    }

    case "address": {
      const pin = placeFromMessage(message);
      if (pin) {
        const next = { ...p, place: pin };
        return pin.text ? showConfirm(admin, chatId, c, next) : askAddressExtra(admin, chatId, next);
      }
      if (text === BTN_LAST_ADDRESS && admin.last_address) {
        return showConfirm(admin, chatId, c, { ...p, place: admin.last_address });
      }
      if (text.length < 3 || text.length > 300) {
        await send(chatId, "Manzilni matn bilan yozing yoki xaritadan joylashuv yuboring.", addressKeyboard(admin));
        return;
      }
      return askAddressExtra(admin, chatId, { ...p, place: { text, lat: null, lon: null } });
    }

    case "address_extra": {
      const place = p.place ?? { text: null, lat: null, lon: null };
      if (text === BTN_SKIP) return showConfirm(admin, chatId, c, p);
      const pin = placeFromMessage(message);
      if (pin && place.lat == null) {
        return showConfirm(admin, chatId, c, { ...p, place: { ...place, lat: pin.lat, lon: pin.lon } });
      }
      if (text && !place.text && text.length <= 300) {
        return showConfirm(admin, chatId, c, { ...p, place: { ...place, text } });
      }
      await send(chatId, `Davom etish uchun "${BTN_SKIP}" tugmasini bosing.`);
      return;
    }

    case "confirm":
      await send(chatId, 'Taklifni yuborish uchun yuqoridagi "✅ Yuborish" tugmasini bosing yoki /bekor yozing.');
      return;
  }
}

async function sendInvitation(admin: Admin, chatId: string, c: Candidate, p: PendingInvite) {
  await setPending(admin.telegram_user_id, null);
  const place = p.place!;

  // The map goes first so the answer buttons stay at the bottom of the chat.
  if (place.lat != null && place.lon != null) {
    if (place.text) {
      await callTelegram(BOT_TOKEN, "sendVenue", {
        chat_id: c.chat_id,
        latitude: place.lat,
        longitude: place.lon,
        title: "Suhbat joyi",
        address: place.text.slice(0, 250),
      });
    } else {
      await callTelegram(BOT_TOKEN, "sendLocation", {
        chat_id: c.chat_id,
        latitude: place.lat,
        longitude: place.lon,
      });
    }
  }

  const sent = await send(c.chat_id, invitationText(c, p), {
    inline_keyboard: [[
      { text: "✅ Kelaman", callback_data: `hr:yes:${c.id}` },
      { text: "🔄 Boshqa vaqt kerak", callback_data: `hr:resched:${c.id}` },
    ]],
  });
  if (!sent.ok) {
    await send(
      chatId,
      `⚠️ Taklif yuborilmadi: nomzod botni bloklagan bo'lishi mumkin. Unga ${esc(c.phone)} raqami orqali qo'ng'iroq qiling.`,
      ADMIN_MENU,
    );
    return;
  }

  const info = `${dateLabel(p.date!)}, ${p.time}, ${placeText(place)}`;
  const updated = await updateCandidate(c.id, {
    status: "invited",
    interview_info: info,
    interview_at: interviewAt(p.date!, p.time!),
    interview_location: place,
    step: "done",
  });
  await supabase.from("hr_admins").update({ last_address: place }).eq("telegram_user_id", admin.telegram_user_id);
  await send(chatId, "✅ Taklif nomzodga yuborildi. Javobini shu chatda olasiz.", ADMIN_MENU);
  if (updated) await sendCard(chatId, updated);
}

async function handleInviteCallback(admin: Admin, cq: Any, c: Candidate, action: string, arg: string) {
  const chatId = String(cq.message?.chat?.id ?? admin.chat_id);
  const p = admin.pending_action;

  // Buttons from an older or finished invitation must not act on the current one.
  if (!p || p.action !== "invite" || p.candidate_id !== c.id) {
    await answerCallbackQuery(BOT_TOKEN, cq.id, "Bu tanlov eskirgan. Kartadagi \"📅 Suhbatga chaqirish\"ni qayta bosing.");
    return;
  }
  await answerCallbackQuery(BOT_TOKEN, cq.id);

  const editPicker = (text: string, markup: unknown) =>
    cq.message
      ? callTelegram(BOT_TOKEN, "editMessageText", {
        chat_id: cq.message.chat.id,
        message_id: cq.message.message_id,
        text,
        parse_mode: "HTML",
        reply_markup: markup,
      })
      : send(chatId, text, markup);

  switch (action) {
    case "ivd": {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(arg) || arg < ymd(tashkentNow())) {
        await editPicker(datePrompt(c), dateKeyboard(c.id));
        return;
      }
      await setPending(admin.telegram_user_id, { action: "invite", candidate_id: c.id, step: "time", date: arg });
      await editPicker(timePrompt(c, arg), timeKeyboard(c.id, arg));
      return;
    }
    case "ivt": {
      const time = parseTime(arg);
      if (!time || !p.date) return;
      await editPicker(`✅ ${dateLabel(p.date)}, ${time}`, { inline_keyboard: [] });
      await askAddress(admin, chatId, { ...p, time });
      return;
    }
    case "ivb": {
      await setPending(admin.telegram_user_id, { action: "invite", candidate_id: c.id, step: "date" });
      await editPicker(datePrompt(c), dateKeyboard(c.id));
      return;
    }
    case "ivr": {
      await editPicker("✏️ Qaytadan tuzamiz.", { inline_keyboard: [] });
      await startInvite(admin, chatId, c);
      return;
    }
    case "ivx": {
      await setPending(admin.telegram_user_id, null);
      await editPicker("Suhbat taklifi bekor qilindi.", { inline_keyboard: [] });
      await send(chatId, "Menyudan tanlang 👇", ADMIN_MENU);
      return;
    }
    case "ivs": {
      if (p.step !== "confirm" || !p.date || !p.time || !p.place) return;
      await editPicker("📤 Yuborilmoqda…", { inline_keyboard: [] });
      await sendInvitation(admin, chatId, c, p);
      return;
    }
  }
}

// --- Entry point ---------------------------------------------------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function setup() {
  const hook = await callTelegram(BOT_TOKEN, "setWebhook", {
    url: WEBHOOK_URL,
    allowed_updates: ["message", "callback_query"],
    secret_token: await telegramSecret(),
  });
  const commands = await callTelegram(BOT_TOKEN, "setMyCommands", {
    commands: [{ command: "start", description: "Ishga ariza topshirish" }],
  });
  return json({ ok: !!hook.ok, webhook: hook, commands: commands.ok, url: WEBHOOK_URL });
}

Deno.serve(async (req) => {
  if (!BOT_TOKEN || !WEBHOOK_SECRET) {
    console.error("hr-bot: HR_BOT_TOKEN or HR_BOT_WEBHOOK_SECRET is not set");
    return json({ error: "HR bot is not configured" }, 500);
  }

  if (req.method === "GET") {
    // Registering the webhook is safe to expose: it can only point the bot at
    // this same function with this same secret.
    const action = new URL(req.url).searchParams.get("action");
    if (action === "setup") return setup();
    if (action === "status") {
      const info = await callTelegram(BOT_TOKEN, "getWebhookInfo", {});
      return json({ expected_url: WEBHOOK_URL, info: info.result ?? info });
    }
    return json({ message: "HR bot webhook" });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Only Telegram knows the secret; anything else posting here is rejected.
  if (req.headers.get("x-telegram-bot-api-secret-token") !== await telegramSecret()) {
    console.error("hr-bot: rejected update with bad or missing secret token");
    return json({ error: "Forbidden" }, 403);
  }

  try {
    const update = await req.json();

    if (update.callback_query) {
      const cq = update.callback_query;
      const admin = await getAdmin(String(cq.from.id));
      const action = String(cq.data ?? "").split(":")[1];
      if (action === "yes" || action === "resched") await handleCandidateCallback(cq);
      else if (admin) await handleAdminCallback(admin, cq);
      else await answerCallbackQuery(BOT_TOKEN, cq.id);
      return json({ ok: true });
    }

    const message = update.message;
    // Private chats only: the bot is not meant to run inside groups.
    if (!message?.from || message.chat?.type !== "private") return json({ ok: true });

    if (await handleAdminCommand(message)) return json({ ok: true });

    const admin = await getAdmin(String(message.from.id));
    if (admin) await handleAdminMessage(admin, message);
    else await handleCandidateMessage(message);
  } catch (error) {
    // Answer 200 anyway: a non-2xx makes Telegram redeliver the same update
    // over and over, and a bad update would block every one after it.
    console.error("hr-bot error:", error instanceof Error ? error.message : error);
  }
  return json({ ok: true });
});
