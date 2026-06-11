import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { resolveIdentity, normalizePhone } from "../_shared/identity.ts";

// Telegram bot webhook: runs the student onboarding conversation AND captures
// every message into the CRM, linked to a student/lead via the identity spine.
//
//   /start            -> welcome + degree buttons (inline keyboard)
//   degree button     -> ask to share phone (contact button)
//   shared contact    -> create/enrich the lead, link the chat, thank you
//   any other message -> captured (the DB trigger links it by identity)

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// deno-lint-ignore no-explicit-any
type Any = any;

const DEGREES: [string, string][] = [
  ["🎓 Bakalavr", "deg:Bakalavr"],
  ["🎓 Magistr", "deg:Magistr"],
  ["📘 Til kursi", "deg:Til kursi"],
];

async function tgSend(chatId: string, text: string, replyMarkup?: Any): Promise<Any> {
  if (!BOT_TOKEN) return null;
  const body: Any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (replyMarkup) body.reply_markup = replyMarkup;
  try {
    const res = await fetch(`${TG_API}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return json?.result ?? null;
  } catch (e) {
    console.error("tgSend failed:", e);
    return null;
  }
}

async function tgAnswerCallback(id: string): Promise<void> {
  if (!BOT_TOKEN) return;
  try {
    await fetch(`${TG_API}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: id }),
    });
  } catch (_e) { /* ignore */ }
}

async function storeMessage(supabase: Any, m: {
  chatId: string; messageId?: number | string | null; senderName: string;
  content: string; direction: "incoming" | "outgoing"; type?: string;
  studentId?: string | null; extraMeta?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from("messages").insert({
    source: "telegram",
    external_id: m.messageId != null ? String(m.messageId) : null,
    sender_id: m.chatId,
    sender_name: m.senderName,
    content: m.content,
    message_type: m.type ?? "text",
    direction: m.direction,
    status: m.direction === "incoming" ? "unread" : "read",
    student_id: m.studentId ?? null, // BEFORE INSERT trigger fills this if null
    metadata: { telegram_chat_id: m.chatId, ...(m.extraMeta ?? {}) },
  });
  if (error) console.error("storeMessage error:", error.message);
}

async function bumpThread(supabase: Any, chatId: string, name: string, direction: "incoming" | "outgoing"): Promise<void> {
  await supabase.rpc("upsert_message_thread", {
    p_source: "telegram", p_sender_id: chatId, p_sender_name: name, p_sender_avatar: null,
    p_student_id: null, p_last_message_at: new Date().toISOString(), p_direction: direction,
  });
}

/** Resolve a Telegram file_id to its downloadable bytes (Bot API getFile). */
async function fetchTelegramFile(fileId: string): Promise<{ bytes: Uint8Array; filePath: string } | null> {
  if (!BOT_TOKEN) return null;
  try {
    const res = await fetch(`${TG_API}/getFile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_id: fileId }),
    });
    const json = await res.json().catch(() => ({}));
    const filePath: string | undefined = json?.result?.file_path;
    if (!filePath) return null;
    const fileRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
    if (!fileRes.ok) return null;
    return { bytes: new Uint8Array(await fileRes.arrayBuffer()), filePath };
  } catch (e) {
    console.error("fetchTelegramFile failed:", e);
    return null;
  }
}

/** Download a voice note and store it in the private chat-media bucket. */
async function storeVoice(supabase: Any, chatId: string, messageId: number | string, voice: Any):
  Promise<{ path: string; mime: string; duration: number | null; size: number } | null> {
  const file = await fetchTelegramFile(voice.file_id);
  if (!file) return null;
  const mime = voice.mime_type || "audio/ogg";
  const ext = file.filePath.includes(".") ? file.filePath.split(".").pop() : "ogg";
  const path = `telegram/${chatId}/${messageId}.${ext}`;
  const up = await supabase.storage.from("chat-media").upload(path, file.bytes, { contentType: mime, upsert: true });
  if (up.error) { console.error("voice upload failed:", up.error.message); return null; }
  return { path, mime, duration: voice.duration ?? null, size: file.bytes.byteLength };
}

/** Find-or-create the lead for this chat (keyed by source_id = chatId). */
async function upsertLead(supabase: Any, chatId: string, fields: Record<string, unknown>): Promise<{ id: string } | null> {
  const { data: existing } = await supabase.from("leads")
    .select("id").eq("source", "telegram").eq("source_id", chatId).maybeSingle();
  if (existing) {
    const upd = { ...fields };
    delete (upd as Any).source; delete (upd as Any).source_id;
    if (Object.keys(upd).length) await supabase.from("leads").update(upd).eq("id", existing.id);
    return existing;
  }
  const { data, error } = await supabase.from("leads")
    .insert({ source: "telegram", source_id: chatId, status: "new", ...fields })
    .select("id").single();
  if (error) { console.error("lead insert error:", error.message); return null; }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ message: "Telegram webhook endpoint", configured: !!BOT_TOKEN }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const update = await req.json();
    console.log("Telegram update:", JSON.stringify(update));

    // --- Button press (degree choice) ------------------------------------
    if (update.callback_query) {
      const cq = update.callback_query;
      const chatId = String(cq.message?.chat?.id ?? cq.from?.id);
      await tgAnswerCallback(cq.id);
      const data: string = cq.data ?? "";
      if (data.startsWith("deg:")) {
        const degree = data.slice(4);
        await upsertLead(supabase, chatId, { education_level: degree });
        const sent = await tgSend(chatId,
          `Ajoyib — <b>${degree}</b> tanlandi! 📱

Iltimos, telefon raqamingizni ulashing — menejerimiz siz bilan tez orada bog'lanadi.`,
          { keyboard: [[{ text: "📱 Telefon raqamni ulashish", request_contact: true }]], resize_keyboard: true, one_time_keyboard: true });
        await bumpThread(supabase, chatId, cq.from?.first_name ?? "Telegram user", "outgoing");
        if (sent) await storeMessage(supabase, { chatId, messageId: sent.message_id, senderName: "Hanguk bot", content: `Daraja: ${degree}. Telefon raqami so'raldi.`, direction: "outgoing" });
      }
      return ok();
    }

    const message = update.message || update.edited_message;
    if (!message || !message.chat) return ok();

    const chatId = String(message.chat.id);
    const fromName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ")
      || message.from?.username || message.chat?.title || "Telegram user";
    const username = message.from?.username ?? null;
    const tgUserId = String(message.from?.id ?? message.chat.id);

    // --- /start: greeting + degree buttons -------------------------------
    if (typeof message.text === "string" && message.text.trim().toLowerCase().startsWith("/start")) {
      await upsertLead(supabase, chatId, { full_name: fromName });
      await bumpThread(supabase, chatId, fromName, "incoming");
      await storeMessage(supabase, { chatId, messageId: message.message_id, senderName: fromName, content: "/start", direction: "incoming", extraMeta: { telegram_user_id: tgUserId, username } });

      const sent = await tgSend(chatId,
        `Assalomu alaykum! Hanguk Consulting'ga xush kelibsiz 🇰🇷🎓

Koreyada o'qish va til kurslari bo'yicha yordam beramiz. Sizni qaysi yo'nalish qiziqtiradi?`,
        { inline_keyboard: DEGREES.map(([label, d]) => [{ text: label, callback_data: d }]) });
      if (sent) {
        await bumpThread(supabase, chatId, fromName, "outgoing");
        await storeMessage(supabase, { chatId, messageId: sent.message_id, senderName: "Hanguk bot", content: "Xush kelibsiz! Yo'nalishni tanlang.", direction: "outgoing" });
      }
      return ok();
    }

    // --- Shared contact: create/enrich lead + link the chat --------------
    if (message.contact) {
      const phone = message.contact.phone_number;
      const contactName = [message.contact.first_name, message.contact.last_name].filter(Boolean).join(" ") || fromName;
      await bumpThread(supabase, chatId, contactName, "incoming");
      await storeMessage(supabase, { chatId, messageId: message.message_id, senderName: contactName, content: `📞 ${phone}`, direction: "incoming", extraMeta: { telegram_user_id: tgUserId, phone } });

      // Link by phone (matches an existing student/lead and remembers the chat).
      const identity = await resolveIdentity(supabase, "telegram", chatId, { displayName: contactName, phone, identifierLabel: username ? `@${username}` : phone });

      if (identity.studentId) {
        await supabase.from("message_threads").update({ student_id: identity.studentId })
          .eq("source", "telegram").eq("sender_id", chatId).is("student_id", null);
      } else {
        // New person → enrich the lead and map the chat/phone to it.
        const lead = await upsertLead(supabase, chatId, { full_name: contactName, phone });
        if (lead?.id) {
          await supabase.from("communication_identities").upsert(
            { channel: "telegram", identifier: chatId, identifier_label: username ? `@${username}` : phone, lead_id: lead.id, display_name: contactName, confidence: "inferred", source: "auto" },
            { onConflict: "channel,identifier", ignoreDuplicates: true });
          const np = normalizePhone(phone);
          if (np) await supabase.from("communication_identities").upsert(
            { channel: "phone", identifier: np, identifier_label: phone, lead_id: lead.id, display_name: contactName, confidence: "inferred", source: "auto" },
            { onConflict: "channel,identifier", ignoreDuplicates: true });
        }
      }

      const sent = await tgSend(chatId, `Rahmat! 🎉 Ma'lumotlaringiz qabul qilindi. Menejerimiz tez orada siz bilan bog'lanadi.

Savolingiz bo'lsa, shu yerda — Telegram orqali — bemalol yozing. 💬 Xodimlarimiz javob berishadi.`, { remove_keyboard: true });
      if (sent) {
        await bumpThread(supabase, chatId, contactName, "outgoing");
        await storeMessage(supabase, { chatId, messageId: sent.message_id, senderName: "Hanguk bot", content: "Rahmat! Ma'lumotlaringiz qabul qilindi.", direction: "outgoing", studentId: identity.studentId });
      }
      return ok();
    }

    // --- Any other message: just capture (trigger links by identity) -----
    const identity = await resolveIdentity(supabase, "telegram", chatId, { displayName: fromName });
    await bumpThread(supabase, chatId, fromName, "incoming");
    if (identity.studentId) {
      await supabase.from("message_threads").update({ student_id: identity.studentId })
        .eq("source", "telegram").eq("sender_id", chatId).is("student_id", null);
    }

    // Voice note: pull the audio bytes into chat-media so staff can play it back.
    const voiceMeta = message.voice
      ? await storeVoice(supabase, chatId, message.message_id, message.voice)
      : null;
    const messageType = message.photo ? "image" : message.voice ? "voice" : message.document ? "file" : "text";
    const content = message.text || message.caption ||
      (message.voice ? "🎤 Voice message" : "[Media message]");

    await storeMessage(supabase, {
      chatId, messageId: message.message_id, senderName: fromName, content, direction: "incoming",
      type: messageType, studentId: identity.studentId,
      extraMeta: {
        telegram_user_id: tgUserId, username, lead_id: identity.leadId,
        media_type: message.voice ? "voice" : message.photo ? "image" : message.document ? "file" : null,
        media_path: voiceMeta?.path ?? null,
        media_mime: voiceMeta?.mime ?? null,
        media_duration: voiceMeta?.duration ?? null,
        media_size: voiceMeta?.size ?? null,
      },
    });
    return ok();
  } catch (error: unknown) {
    console.error("telegram-webhook error:", error);
    // 200 so Telegram doesn't disable the webhook on a transient error.
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "error" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
