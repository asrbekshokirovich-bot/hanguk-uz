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
//     📅 Suhbatga chaqirish -> bot asks for time + place, then sends the
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
  submitted_at: string | null;
}

interface Admin {
  telegram_user_id: string;
  chat_id: string;
  name: string | null;
  pending_action: { action: string; candidate_id: string } | null;
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

  // Waiting for the interview time + place for a candidate.
  if (admin.pending_action?.action === "invite" && text && !text.startsWith("/") && !isMenuButton(text)) {
    await setPending(admin.telegram_user_id, null);
    const c = await getCandidate(admin.pending_action.candidate_id);
    if (!c) {
      await send(chatId, "Nomzod topilmadi.", ADMIN_MENU);
      return;
    }
    const sent = await send(
      c.chat_id,
      `Assalomu alaykum, ${esc(c.full_name)}! 🎉\n\nSiz <b>suhbatga taklif qilindingiz</b>.\n📅 ${esc(text)}\n\nIltimos, javob bering:`,
      {
        inline_keyboard: [[
          { text: "✅ Kelaman", callback_data: `hr:yes:${c.id}` },
          { text: "🔄 Boshqa vaqt kerak", callback_data: `hr:resched:${c.id}` },
        ]],
      },
    );
    if (!sent.ok) {
      await send(
        chatId,
        `⚠️ Taklif yuborilmadi: nomzod botni bloklagan bo'lishi mumkin. Unga ${esc(c.phone)} raqami orqali qo'ng'iroq qiling.`,
        ADMIN_MENU,
      );
      return;
    }
    const updated = await updateCandidate(c.id, { status: "invited", interview_info: text, step: "done" });
    await send(chatId, "✅ Taklif nomzodga yuborildi. Javobini shu chatda olasiz.", ADMIN_MENU);
    if (updated) await sendCard(chatId, updated);
    return;
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
      await setPending(admin.telegram_user_id, { action: "invite", candidate_id: c.id });
      await answerCallbackQuery(BOT_TOKEN, cq.id);
      await send(
        chatId,
        `📅 <b>${esc(c.full_name)}</b> uchun suhbat kuni, vaqti va manzilini bitta xabarda yozing:\n<i>Masalan: 27-sentabr, soat 15:00, Chilonzor, Bunyodkor ko'chasi 5</i>\n\nBekor qilish: /bekor`,
        removeKeyboard(),
      );
      return;
    }
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

// --- Entry point ---------------------------------------------------------------------------

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function setup() {
  const hook = await callTelegram(BOT_TOKEN, "setWebhook", {
    url: WEBHOOK_URL,
    allowed_updates: ["message", "callback_query"],
    secret_token: WEBHOOK_SECRET,
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
  if (req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) {
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
