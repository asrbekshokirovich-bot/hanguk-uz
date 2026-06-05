import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  answerCallbackQuery,
  contactRequestKeyboard,
  sendTelegramMessage,
} from "../_shared/telegram.ts";

// Hanguk Education Telegram bot.
//
// Responsibilities:
//   1. Log every incoming message into the CRM unified inbox (messages +
//      message_threads) so staff see Telegram conversations in real time.
//   2. Capture each Telegram user as a CRM lead (deduplicated by Telegram id),
//      enriching it with their phone number and area of interest.
//   3. Send a small set of CANNED replies to run the lead-capture funnel
//      (welcome, contact request, acknowledgements). It does NOT auto-answer
//      questions with AI — staff reply from the CRM inbox (-> send-telegram).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Lang = "uz" | "ru";

// --- Bot copy (canned, human-only funnel) --------------------------------

const COPY: Record<Lang, {
  welcome: string;
  help: string;
  contactButton: string;
  interests: string[];
  contactThanks: string;
  interestAck: (interest: string) => string;
  firstMessageAck: string;
}> = {
  uz: {
    welcome:
      "Assalomu alaykum! 🇰🇷 Hanguk Education botiga xush kelibsiz.\n\n" +
      "Biz O‘zbekistonlik talabalarga Koreya universitetlariga hujjat topshirishda yordam beramiz: " +
      "universitet tanlash, hujjatlar, tarjima, viza va GKS stipendiyasi.\n\n" +
      "Boshlash uchun pastdagi tugma orqali telefon raqamingizni ulashing yoki sizni qiziqtirgan " +
      "yo‘nalishni tanlang. Konsultantimiz tez orada siz bilan bog‘lanadi.\n\n" +
      "Русский тил учун: /ru",
    help:
      "ℹ️ Hanguk Education — Koreyada o‘qish bo‘yicha yordam.\n\n" +
      "Buyruqlar:\n" +
      "/start — boshlash va telefon raqamni ulashish\n" +
      "/ru — rus tilida\n\n" +
      "Savolingizni shu yerga yozing — konsultantimiz javob beradi.",
    contactButton: "📞 Telefon raqamni ulashish",
    interests: ["🎓 Bakalavr", "📚 Magistratura", "🇰🇷 Til kursi", "💰 GKS stipendiya"],
    contactThanks:
      "Rahmat! 📞 Telefon raqamingiz qabul qilindi. Konsultantimiz tez orada bog‘lanadi. " +
      "Qo‘shimcha savollaringiz bo‘lsa, shu yerga yozib qoldiring.",
    interestAck: (interest: string) =>
      `Rahmat! «${interest}» yo‘nalishi bo‘yicha so‘rovingiz qabul qilindi. ` +
      "Konsultantimiz tez orada bog‘lanadi. Tezroq bog‘lanishimiz uchun telefon raqamingizni ulashing. 📞",
    firstMessageAck:
      "Rahmat, xabaringiz uchun! 🙏 Konsultantimiz tez orada javob beradi. " +
      "Tezroq bog‘lanishimiz uchun /start tugmasini bosib, telefon raqamingizni ulashing.",
  },
  ru: {
    welcome:
      "Здравствуйте! 🇰🇷 Добро пожаловать в бот Hanguk Education.\n\n" +
      "Мы помогаем студентам из Узбекистана поступать в университеты Кореи: подбор вуза, " +
      "документы, перевод, виза и стипендия GKS.\n\n" +
      "Чтобы начать, поделитесь номером телефона кнопкой ниже или выберите интересующее " +
      "направление. Наш консультант свяжется с вами в ближайшее время.\n\n" +
      "O‘zbek tili uchun: /uz",
    help:
      "ℹ️ Hanguk Education — помощь с обучением в Корее.\n\n" +
      "Команды:\n" +
      "/start — начать и поделиться номером телефона\n" +
      "/uz — на узбекском\n\n" +
      "Напишите свой вопрос здесь — консультант ответит вам.",
    contactButton: "📞 Поделиться номером телефона",
    interests: ["🎓 Бакалавриат", "📚 Магистратура", "🇰🇷 Языковые курсы", "💰 Стипендия GKS"],
    contactThanks:
      "Спасибо! 📞 Ваш номер телефона получен. Консультант скоро свяжется с вами. " +
      "Если есть вопросы — пишите здесь.",
    interestAck: (interest: string) =>
      `Спасибо! Заявка по направлению «${interest}» принята. ` +
      "Консультант скоро свяжется с вами. Поделитесь номером телефона, чтобы мы связались быстрее. 📞",
    firstMessageAck:
      "Спасибо за сообщение! 🙏 Наш консультант скоро ответит. " +
      "Чтобы мы связались быстрее, нажмите /start и поделитесь номером телефона.",
  },
};

// Maps an interest button label (in any supported language) to the normalized
// value stored on the lead's `preferred_program`, plus the language it came from.
const INTEREST_MAP: Record<string, { program: string; lang: Lang }> = {
  "🎓 Bakalavr": { program: "Bachelor's", lang: "uz" },
  "📚 Magistratura": { program: "Master's", lang: "uz" },
  "🇰🇷 Til kursi": { program: "Korean language course", lang: "uz" },
  "💰 GKS stipendiya": { program: "GKS Scholarship", lang: "uz" },
  "🎓 Бакалавриат": { program: "Bachelor's", lang: "ru" },
  "📚 Магистратура": { program: "Master's", lang: "ru" },
  "🇰🇷 Языковые курсы": { program: "Korean language course", lang: "ru" },
  "💰 Стипендия GKS": { program: "GKS Scholarship", lang: "ru" },
};

function welcomeReplyMarkup(lang: Lang) {
  const c = COPY[lang];
  return contactRequestKeyboard(c.contactButton, [
    [c.interests[0], c.interests[1]],
    [c.interests[2], c.interests[3]],
  ]);
}

// --- Telegram message parsing helpers ------------------------------------

function fullNameOf(from: any): string {
  const name = [from?.first_name, from?.last_name].filter(Boolean).join(" ").trim();
  if (name) return name;
  if (from?.username) return `@${from.username}`;
  return "Telegram user";
}

function messageTypeOf(message: any): "text" | "image" | "voice" | "file" {
  if (message.photo) return "image";
  if (message.voice || message.audio) return "voice";
  if (message.document) return "file";
  return "text";
}

function contentOf(message: any): string {
  if (message.contact) {
    const name = [message.contact.first_name, message.contact.last_name].filter(Boolean).join(" ");
    return `📞 Shared contact: ${message.contact.phone_number}${name ? ` (${name})` : ""}`;
  }
  if (message.photo) return message.caption ? `🖼 ${message.caption}` : "[Photo]";
  if (message.voice) return "[Voice message]";
  if (message.audio) return "[Audio]";
  if (message.document) return `[File] ${message.document.file_name || ""}`.trim();
  if (message.location) return "[Location]";
  if (message.sticker) return `[Sticker] ${message.sticker.emoji || ""}`.trim();
  return message.text || message.caption || "[Media message]";
}

// --- Lead capture ---------------------------------------------------------

async function captureLead(
  supabase: any,
  opts: {
    telegramUserId: string;
    fullName: string;
    phone: string | null;
    interest: { program: string } | null;
    firstText: string | null;
  },
): Promise<{ isNew: boolean }> {
  // Deduplicate by Telegram user id (one lead per Telegram user).
  const { data: existing, error: findError } = await supabase
    .from("leads")
    .select("id, phone, preferred_program")
    .eq("source", "telegram")
    .eq("source_id", opts.telegramUserId)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error("Lead lookup error:", findError.message);
  }

  const nowIso = new Date().toISOString();

  if (existing) {
    const update: Record<string, unknown> = { last_contacted_at: nowIso };
    if (opts.phone && !existing.phone) update.phone = opts.phone;
    if (opts.interest && !existing.preferred_program) update.preferred_program = opts.interest.program;
    const { error } = await supabase.from("leads").update(update).eq("id", existing.id);
    if (error) console.error("Lead update error:", error.message);
    return { isNew: false };
  }

  const note = opts.firstText
    ? `First Telegram message: ${opts.firstText.slice(0, 500)}`
    : "Captured from Telegram bot";

  const { error } = await supabase.from("leads").insert({
    full_name: opts.fullName,
    phone: opts.phone,
    source: "telegram",
    source_id: opts.telegramUserId,
    status: "new",
    interest_level: "medium",
    how_heard: "Telegram bot",
    preferred_program: opts.interest?.program ?? null,
    notes: note,
    last_contacted_at: nowIso,
  });
  if (error) {
    console.error("Lead insert error:", error.message);
    return { isNew: false };
  }
  return { isNew: true };
}

// --- Inbox logging --------------------------------------------------------

async function logIncomingMessage(
  supabase: any,
  message: any,
  chatId: string,
  senderName: string,
) {
  // Atomic upsert + unread increment (shared RPC, fixes the race condition).
  const { error: threadError } = await supabase.rpc("increment_thread_unread", {
    p_source: "telegram",
    p_sender_id: chatId,
    p_sender_name: senderName,
  });
  if (threadError) console.error("Thread upsert error:", threadError.message);

  const { error: msgError } = await supabase.from("messages").insert({
    source: "telegram",
    external_id: message.message_id?.toString(),
    sender_id: chatId,
    sender_name: senderName,
    content: contentOf(message),
    message_type: messageTypeOf(message),
    direction: "incoming",
    status: "unread",
    metadata: {
      telegram_chat_id: chatId,
      telegram_message_id: message.message_id,
      telegram_user_id: message.from?.id?.toString(),
      telegram_username: message.from?.username ?? null,
      ...(message.contact ? { shared_phone: message.contact.phone_number } : {}),
    },
  });
  if (msgError) console.error("Message insert error:", msgError.message);
}

// --- Main handler ---------------------------------------------------------

async function handleMessage(supabase: any, message: any) {
  const chatId = message.chat.id.toString();
  const from = message.from || {};
  const telegramUserId = (from.id ?? message.chat.id).toString();
  const senderName = fullNameOf(from);
  const text: string = typeof message.text === "string" ? message.text.trim() : "";
  const sharedPhone: string | null = message.contact?.phone_number ?? null;
  const interest = text ? INTEREST_MAP[text] ?? null : null;

  // 1) Always log to the CRM inbox.
  await logIncomingMessage(supabase, message, chatId, senderName);

  // 2) Capture / enrich the lead.
  const { isNew } = await captureLead(supabase, {
    telegramUserId,
    fullName: senderName,
    phone: sharedPhone,
    interest: interest ? { program: interest.program } : null,
    firstText: text || (sharedPhone ? null : contentOf(message)),
  });

  // 3) Canned funnel replies (no AI). Default language is Uzbek.
  if (!TELEGRAM_BOT_TOKEN) return; // logging-only if the bot token isn't set yet

  const isCommand = (cmd: string) => text === cmd || text.startsWith(`${cmd}@`) || text.startsWith(`${cmd} `);

  if (isCommand("/start")) {
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, COPY.uz.welcome, {
      reply_markup: welcomeReplyMarkup("uz"),
    });
    return;
  }
  if (isCommand("/ru")) {
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, COPY.ru.welcome, {
      reply_markup: welcomeReplyMarkup("ru"),
    });
    return;
  }
  if (isCommand("/uz")) {
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, COPY.uz.welcome, {
      reply_markup: welcomeReplyMarkup("uz"),
    });
    return;
  }
  if (isCommand("/help")) {
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, COPY.uz.help);
    return;
  }

  if (sharedPhone) {
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, COPY.uz.contactThanks);
    return;
  }

  if (interest) {
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, COPY[interest.lang].interestAck(text));
    return;
  }

  // Free-form text: greet a brand-new lead once, then stay silent so a human
  // consultant handles the conversation from the CRM inbox.
  if (isNew) {
    await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chatId, COPY.uz.firstMessageAck, {
      reply_markup: welcomeReplyMarkup("uz"),
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (req.method === "POST") {
      const update = await req.json();
      console.log("Telegram update:", JSON.stringify(update).slice(0, 1000));

      if (update.message) {
        await handleMessage(supabase, update.message);
      } else if (update.callback_query) {
        // Quick-reply buttons send plain text, so callbacks aren't part of the
        // funnel — just acknowledge to clear the client spinner.
        if (TELEGRAM_BOT_TOKEN) {
          await answerCallbackQuery(TELEGRAM_BOT_TOKEN, update.callback_query.id);
        }
      }

      // Always 200 so Telegram doesn't retry the update.
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: simple status / health endpoint.
    return new Response(
      JSON.stringify({
        message: "Hanguk Telegram webhook",
        configured: !!TELEGRAM_BOT_TOKEN,
        setup_instructions: TELEGRAM_BOT_TOKEN
          ? "Webhook is configured"
          : "Set TELEGRAM_BOT_TOKEN secret and register the webhook URL with BotFather/setWebhook",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error processing webhook:", errorMessage);
    // Still return 200 to avoid Telegram retry storms on transient errors.
    return new Response(JSON.stringify({ ok: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
