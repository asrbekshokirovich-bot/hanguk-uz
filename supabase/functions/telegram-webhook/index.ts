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
  // Throw rather than log-and-continue. The handler answers Telegram with 200
  // regardless (see the catch below), so a swallowed failure here meant the
  // message was gone with nothing to show for it: not in the inbox, and not in
  // the logs beyond one line with no chat or content to trace it back to.
  if (error) {
    throw new Error(
      `storeMessage failed for chat ${m.chatId} (${m.direction}, ${m.type ?? "text"}): ${error.message}`,
    );
  }
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

/** What kind of attachment, if any, this Telegram message carries.
 *
 * Photos arrive as an array of the same image at several resolutions; the last
 * entry is the largest, which is the one worth keeping.
 */
function describeMedia(m: Any): {
  type: "image" | "voice" | "video" | "audio" | "file";
  fileId: string;
  mime: string;
  filename: string | null;
  duration: number | null;
} | null {
  if (m.photo?.length)   return { type: "image", fileId: m.photo[m.photo.length - 1].file_id,
                                  mime: "image/jpeg", filename: null, duration: null };
  if (m.voice)           return { type: "voice", fileId: m.voice.file_id,
                                  mime: m.voice.mime_type || "audio/ogg", filename: null,
                                  duration: m.voice.duration ?? null };
  if (m.video)           return { type: "video", fileId: m.video.file_id,
                                  mime: m.video.mime_type || "video/mp4",
                                  filename: m.video.file_name ?? null, duration: m.video.duration ?? null };
  if (m.video_note)      return { type: "video", fileId: m.video_note.file_id,
                                  mime: "video/mp4", filename: null, duration: m.video_note.duration ?? null };
  if (m.audio)           return { type: "audio", fileId: m.audio.file_id,
                                  mime: m.audio.mime_type || "audio/mpeg",
                                  filename: m.audio.file_name ?? null, duration: m.audio.duration ?? null };
  if (m.animation)       return { type: "video", fileId: m.animation.file_id,
                                  mime: m.animation.mime_type || "video/mp4",
                                  filename: m.animation.file_name ?? null, duration: null };
  if (m.sticker)         return { type: "image", fileId: m.sticker.file_id,
                                  mime: m.sticker.is_animated ? "application/x-tgsticker" : "image/webp",
                                  filename: null, duration: null };
  if (m.document)        return { type: "file", fileId: m.document.file_id,
                                  mime: m.document.mime_type || "application/octet-stream",
                                  filename: m.document.file_name ?? null, duration: null };
  return null;
}

/** The text shown in the thread list for a message that is only an attachment. */
function captionFor(media: ReturnType<typeof describeMedia>): string {
  switch (media?.type) {
    case "image": return "🖼 Rasm";
    case "voice": return "🎤 Voice message";
    case "video": return "🎬 Video";
    case "audio": return "🎵 Audio";
    case "file":  return "📎 Fayl";
    default:      return "[Media message]";
  }
}

/** Pull an attachment's bytes into the private chat-media bucket.
 *
 * This used to handle voice notes and nothing else. Everything else was
 * labelled — `message_type: 'file'`, `media_type: 'image'` — and then never
 * fetched, so `media_path` stayed null and the CRM showed "attachment not
 * available" for every photo, video and document a student ever sent. The
 * label was there; the file never was.
 *
 * A link would not have worked either: Telegram's own file URLs expire and
 * carry the bot token, so the bytes have to be ours.
 */
async function storeTelegramMedia(
  supabase: Any,
  chatId: string,
  messageId: number | string,
  media: NonNullable<ReturnType<typeof describeMedia>>,
): Promise<{ path: string; mime: string; filename: string | null; duration: number | null; size: number } | null> {
  const file = await fetchTelegramFile(media.fileId);
  if (!file) return null;
  const ext = file.filePath.includes(".") ? file.filePath.split(".").pop() : "bin";
  const path = `telegram/${chatId}/${messageId}.${ext}`;
  const up = await supabase.storage.from("chat-media")
    .upload(path, file.bytes, { contentType: media.mime, upsert: true });
  if (up.error) {
    // A failed download must not lose the message itself: the text, the sender
    // and the timestamp are still worth having, and the operator can ask for
    // the file again.
    console.error("media upload failed:", up.error.message);
    return null;
  }
  return { path, mime: media.mime, filename: media.filename, duration: media.duration,
           size: file.bytes.byteLength };
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

/**
 * Shared secret Telegram echoes back in X-Telegram-Bot-Api-Secret-Token.
 *
 * Until 2026-09-03 this endpoint had no authentication of any kind: the POST
 * handler went straight from `req.json()` into writing `messages`, `leads` and
 * `telegram_business_connections`. Anyone who knew the URL could inject a
 * conversation, invent a lead, or register a business connection. The staff
 * check in this file guards only ?action=status and action:"register" — never
 * the update path.
 *
 * Set TELEGRAM_WEBHOOK_SECRET, then press Connect in the CRM so setWebhook
 * registers it. While it is unset the endpoint keeps accepting updates and
 * logs a warning on every one, because failing closed on a secret nobody has
 * configured yet would take the channel down instead of securing it.
 */
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");

const STAFF_ROLES = ["owner", "admin", "call_operator"];

/** The URL Telegram must be told to deliver updates to — this function's own. */
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/telegram-webhook`;

/**
 * Is the caller staff? Used to gate the admin actions below.
 *
 * Telegram itself never sends an Authorization header, so an update can never
 * satisfy this and can never reach an admin branch.
 */
async function isStaff(supabase: Any, req: Request): Promise<boolean> {
  const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
  if (!jwt) return false;
  const { data, error } = await supabase.auth.getUser(jwt);
  if (error || !data?.user) return false;
  const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id);
  return (roles || []).some((r: { role: string }) => STAFF_ROLES.includes(r.role));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const ok = () => new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (req.method !== "POST") {
      // `configured` only says the bot token is present. It says nothing about
      // whether Telegram is actually delivering here — that is what silently
      // stopped, with this endpoint answering 200 the whole time. `?action=status`
      // asks Telegram itself, and is the first thing to check when the inbox
      // goes quiet.
      const action = new URL(req.url).searchParams.get("action");
      if (action === "status") {
        if (!BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, 500);
        if (!(await isStaff(supabase, req))) return json({ error: "Forbidden: staff role required" }, 403);
        const res = await fetch(`${TG_API}/getWebhookInfo`);
        const info = await res.json().catch(() => ({}));
        const allowed: string[] = info?.result?.allowed_updates ?? [];
        const { data: connections } = await supabase
          .from("telegram_business_connections")
          .select("owner_username, user_chat_id, is_enabled, can_reply, updated_at")
          .order("updated_at", { ascending: false });
        const live = (connections ?? []).find((c) => c.is_enabled);
        return json({
          expected_url: WEBHOOK_URL,
          registered_url: info?.result?.url ?? null,
          matches: info?.result?.url === WEBHOOK_URL,
          pending_update_count: info?.result?.pending_update_count ?? null,
          last_error_date: info?.result?.last_error_date ?? null,
          last_error_message: info?.result?.last_error_message ?? null,
          // Telegram only delivers what the registration asked for. A webhook
          // registered before business support was added is subscribed to
          // `message` alone and will never receive a single business update —
          // it looks perfectly healthy while the company account stays silent.
          business_updates_subscribed: allowed.length === 0
            ? false
            : allowed.includes("business_message"),
          business_account: live
            ? {
              username: live.owner_username,
              chat_id: live.user_chat_id,
              can_reply: live.can_reply,
            }
            : null,
        });
      }
      return json({ message: "Telegram webhook endpoint", configured: !!BOT_TOKEN });
    }

    const update = await req.json();

    // Reject forged updates. `action: "register"` is a CRM call rather than a
    // Telegram delivery, so it authenticates with a staff JWT below instead.
    if (update?.action !== "register") {
      const presented = req.headers.get("x-telegram-bot-api-secret-token");
      if (WEBHOOK_SECRET) {
        if (presented !== WEBHOOK_SECRET) {
          console.error("telegram-webhook: rejected update with bad or missing secret token");
          return json({ error: "Forbidden" }, 403);
        }
      } else {
        console.warn(
          "telegram-webhook: TELEGRAM_WEBHOOK_SECRET is not set — this endpoint accepts unauthenticated updates",
        );
      }
    }

    // Point Telegram back at this function. Staff-gated; see isStaff above for
    // why an update cannot land here.
    if (update?.action === "register") {
      if (!BOT_TOKEN) return json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, 500);
      if (!(await isStaff(supabase, req))) return json({ error: "Forbidden: staff role required" }, 403);
      const res = await fetch(`${TG_API}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: WEBHOOK_URL,
          // Telegram sends only what is listed here, and the business_* types
          // are NOT in the default set — omitting them is a silent way to
          // receive nothing from the company account.
          allowed_updates: [
            "message",
            "callback_query",
            "business_connection",
            "business_message",
            "edited_business_message",
          ],
          // Telegram returns this on every delivery, which is how the handler
          // above tells a real update from anything else pointed at the URL.
          ...(WEBHOOK_SECRET ? { secret_token: WEBHOOK_SECRET } : {}),
        }),
      });
      const result = await res.json().catch(() => ({}));
      if (!result?.ok) return json({ ok: false, error: result?.description || "setWebhook failed" }, 502);
      return json({
        ok: true,
        url: WEBHOOK_URL,
        description: result?.description,
        secret_token_set: !!WEBHOOK_SECRET,
      });
    }
    console.log("Telegram update:", JSON.stringify(update));

    // --- Business account linked / unlinked / rights changed --------------
    if (update.business_connection) {
      const bc = update.business_connection;
      // Telegram moved from a flat `can_reply` to a `rights` object; accept
      // either so a link made from an older or newer client both work.
      const canReply = bc.rights
        ? !!bc.rights.can_reply
        : !!bc.can_reply;
      const { error } = await supabase.from("telegram_business_connections").upsert({
        id: String(bc.id),
        user_chat_id: String(bc.user_chat_id),
        owner_user_id: bc.user?.id != null ? String(bc.user.id) : null,
        owner_username: bc.user?.username ?? null,
        is_enabled: bc.is_enabled !== false,
        can_reply: canReply,
        raw: bc,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });
      if (error) throw new Error(`business_connection upsert: ${error.message}`);
      console.log(`business_connection ${bc.id}: enabled=${bc.is_enabled !== false} can_reply=${canReply}`);
      return ok();
    }

    // --- Message in a chat of the connected business account --------------
    // Covers both directions: what a client writes to the company account, and
    // what staff answer from their own phone. Both belong in the inbox, or the
    // CRM shows half a conversation.
    if (update.business_message || update.edited_business_message) {
      const bm = update.business_message || update.edited_business_message;
      const connectionId = String(bm.business_connection_id ?? "");

      const { data: conn } = await supabase
        .from("telegram_business_connections")
        .select("owner_user_id")
        .eq("id", connectionId)
        .maybeSingle();

      // A message whose sender is the account owner is staff replying from
      // their phone; anything else is the client writing in.
      const senderId = String(bm.from?.id ?? "");
      const outgoing = !!conn?.owner_user_id && senderId === conn.owner_user_id;

      // Thread by the *client's* chat, never the owner's, so both directions
      // land in one conversation.
      const chatId = String(bm.chat?.id ?? "");
      if (!chatId) return ok();

      const clientName = [bm.chat?.first_name, bm.chat?.last_name].filter(Boolean).join(" ")
        || bm.chat?.username || bm.chat?.title || "Telegram user";
      const senderName = outgoing ? "Hanguk Consulting" : clientName;

      const identity = await resolveIdentity(supabase, "telegram", chatId, { displayName: clientName });
      await bumpThread(supabase, chatId, clientName, outgoing ? "outgoing" : "incoming");
      if (identity.studentId) {
        await supabase.from("message_threads").update({ student_id: identity.studentId })
          .eq("source", "telegram").eq("sender_id", chatId).is("student_id", null);
      }

      const media = describeMedia(bm);
      const messageType = media ? media.type : "text";
      const mediaMeta = media ? await storeTelegramMedia(supabase, chatId, bm.message_id, media) : null;

      await storeMessage(supabase, {
        chatId,
        messageId: bm.message_id,
        senderName,
        content: bm.text || bm.caption || captionFor(media),
        direction: outgoing ? "outgoing" : "incoming",
        type: messageType,
        studentId: identity.studentId,
        extraMeta: {
          // send-telegram reads this back to answer as the account.
          business_connection_id: connectionId,
          telegram_user_id: senderId,
          username: bm.from?.username ?? null,
          lead_id: identity.leadId,
          media_type: media?.type ?? null,
          media_path: mediaMeta?.path ?? null,
          media_mime: mediaMeta?.mime ?? null,
          media_filename: mediaMeta?.filename ?? null,
          media_duration: mediaMeta?.duration ?? null,
          media_size: mediaMeta?.size ?? null,
        },
      });
      return ok();
    }

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

    // Pull the attachment's bytes into chat-media so staff can open it. Every
    // kind, not only voice notes — see storeTelegramMedia.
    const media = describeMedia(message);
    const mediaMeta = media
      ? await storeTelegramMedia(supabase, chatId, message.message_id, media)
      : null;
    const messageType = media ? media.type : "text";
    const content = message.text || message.caption || captionFor(media);

    await storeMessage(supabase, {
      chatId, messageId: message.message_id, senderName: fromName, content, direction: "incoming",
      type: messageType, studentId: identity.studentId,
      extraMeta: {
        telegram_user_id: tgUserId, username, lead_id: identity.leadId,
        media_type: media?.type ?? null,
        media_path: mediaMeta?.path ?? null,
        media_mime: mediaMeta?.mime ?? null,
        media_filename: mediaMeta?.filename ?? null,
        media_duration: mediaMeta?.duration ?? null,
        media_size: mediaMeta?.size ?? null,
      },
    });
    return ok();
  } catch (error: unknown) {
    console.error("telegram-webhook error:", error);
    // 500, not 200. Telegram retries a failed delivery; answering 200 threw
    // the message away and left a console line as the only trace. Retrying is
    // safe now that (source, external_id) is unique, so a redelivery of a
    // message that did land is rejected by the database rather than
    // duplicated. Telegram backs off and gives up rather than disabling the
    // webhook, so a persistent bug costs a few retries, not the channel.
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
