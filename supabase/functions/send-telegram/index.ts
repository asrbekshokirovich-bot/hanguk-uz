import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTelegramMedia, sendTelegramMessage } from "../_shared/telegram.ts";

// Outgoing Telegram messages. Called by the CRM inbox (MessagesContext.sendMessage)
// when staff reply to a Telegram thread.
//
// Security: this sends messages AS the business, so it must not be callable
// anonymously. The caller's JWT is validated and must belong to a staff member
// (owner / admin / call_operator) — the same roles allowed to manage messages.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STAFF_ROLES = ["owner", "admin", "call_operator"];
const CHAT_MEDIA_BUCKET = "chat-media";
const MEDIA_URL_TTL_SECONDS = 3600;

/**
 * Send as the account over MTProto instead of through the bot.
 *
 * Set this when no bot is connected in Telegram Business. A connected chatbot
 * makes Telegram's Android app open the BOT when anyone adds the account's
 * phone number as a contact (bugs.telegram.org/c/65751); disconnecting it is
 * the only cure, and then the Bot API can no longer see those chats at all.
 * With this on, replies go to `telegram_outbox` and the userbot sends them.
 */
const SEND_VIA_USERBOT = (Deno.env.get("TELEGRAM_SEND_VIA_USERBOT") ?? "").trim() === "1";

/**
 * How stale a userbot heartbeat may be before we refuse to queue behind it.
 *
 * Queueing for a process that is not running is worse than failing: the
 * operator sees the reply leave, the client never receives it, and nothing
 * says so. The userbot beats every minute, so a few minutes of slack absorbs a
 * restart without hiding a dead session.
 */
const USERBOT_STALE_MINUTES = 5;

type Admin = ReturnType<typeof createClient>;

/** Best-effort update of the CRM row this send belongs to. */
async function markRow(
  supabase: Admin,
  rowId: unknown,
  patch: Record<string, unknown>,
): Promise<void> {
  if (!rowId) return;
  const { error } = await supabase.from("messages").update(patch).eq("id", String(rowId));
  if (error) console.error("send-telegram: could not update message row:", error.message);
}

/**
 * Mark the outgoing row delivered, unless the echo beat us to it.
 *
 * A business-account reply comes back through the webhook as an ordinary
 * message with the same Telegram id. Whichever arrives second must not create
 * a duplicate: if the echo already wrote a row for this id, the CRM's own row
 * is the redundant one and goes.
 */
async function stampSent(
  supabase: Admin,
  rowId: unknown,
  chatId: string,
  externalId: string,
): Promise<void> {
  const { data: echo } = await supabase
    .from("messages")
    .select("id")
    .eq("source", "telegram")
    .eq("external_id", externalId)
    .maybeSingle();

  if (!rowId) return;

  if (echo) {
    await supabase.from("messages").delete().eq("id", String(rowId)).is("external_id", null);
    return;
  }

  const { error } = await supabase
    .from("messages")
    .update({ external_id: externalId, delivery_status: "sent", delivery_error: null })
    .eq("id", String(rowId));

  // 23505: the echo landed between the check and the update. Same conclusion.
  if (error && (error as { code?: string }).code === "23505") {
    await supabase.from("messages").delete().eq("id", String(rowId)).is("external_id", null);
  } else if (error) {
    console.error(`send-telegram: could not stamp row for chat ${chatId}:`, error.message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // The bot token is checked further down, past the userbot branch. Only the
    // bot path needs it: on the userbot path there may be no bot at all, which
    // is the point of it, and demanding one here would fail every reply on a
    // correctly configured install.

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Authenticate the caller and require a staff role ---
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Missing Authorization header" }, 401);

    const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !userData?.user) {
      return json({ error: "Invalid or expired session" }, 401);
    }

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);

    const isStaff = (roles || []).some((r: { role: string }) => STAFF_ROLES.includes(r.role));
    if (!isStaff) {
      return json({ error: "Forbidden: staff role required" }, 403);
    }

    // --- Send ---
    // message_id / media_path were being sent by the CRM and ignored here.
    // Two consequences, both live: an attachment on a Telegram reply was
    // dropped on the floor (stored, rendered in the CRM, never delivered), and
    // the row was never stamped with an external_id, so the delivery trigger
    // could not fire and every delivered message sat under a "sending" clock
    // for ever. send-instagram had handled both for weeks.
    const {
      chat_id,
      text,
      parse_mode,
      reply_markup,
      message_id: rowId,
      media_path: mediaPath,
      media_mime: mediaMime,
      media_filename: mediaFilename,
    } = await req.json();

    if (!chat_id || (!text && !mediaPath)) {
      return json({ error: "Missing required fields: chat_id, and text or media_path" }, 400);
    }

    // --- Route to the userbot when the bot is not the send path -------------
    if (SEND_VIA_USERBOT) {
      const cutoff = new Date(Date.now() - USERBOT_STALE_MINUTES * 60_000).toISOString();
      const { data: live } = await supabase
        .from("telegram_userbot_status")
        .select("account_label, last_seen_at")
        .gte("last_seen_at", cutoff)
        .order("last_seen_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!live) {
        // Fail in the operator's face rather than into a queue nobody drains.
        const reason = "Telegram userbot is not running — the reply was not sent";
        await markRow(supabase, rowId, { delivery_status: "failed", delivery_error: reason });
        return json({ ok: false, error: reason }, 503);
      }

      const { error: queueError } = await supabase.from("telegram_outbox").insert({
        // Null would let any account claim it; naming the live one keeps a
        // reply on the account the client has been talking to.
        account_label: live.account_label,
        chat_id: String(chat_id),
        text: text ? String(text) : null,
        media_path: mediaPath ? String(mediaPath) : null,
        media_mime: mediaMime ? String(mediaMime) : null,
        media_filename: mediaFilename ? String(mediaFilename) : null,
        // Carries the outcome back onto this exact row once the userbot reports.
        message_id: rowId ? String(rowId) : null,
        requested_by: userData.user.id,
      });

      if (queueError) {
        await markRow(supabase, rowId, { delivery_status: "failed", delivery_error: queueError.message });
        return json({ ok: false, error: queueError.message }, 500);
      }

      // Not delivered yet — `complete_telegram_outbox` stamps 'sent' and the
      // external id when the userbot has actually handed it to Telegram.
      await markRow(supabase, rowId, { delivery_status: "sending", delivery_error: null });
      return json({ ok: true, queued: true, account_label: live.account_label });
    }

    // --- Bot path -----------------------------------------------------------
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("send-telegram called but TELEGRAM_BOT_TOKEN is not set");
      return json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, 500);
    }

    // Answer as the company account when this chat belongs to one.
    //
    // Clients write to @hangukuz_consulting, not to the bot, so a reply that
    // leaves as the bot arrives in a different conversation from the one they
    // are looking at. The connection id is stamped on every business message by
    // the webhook; the most recent one for this chat is the live link.
    const { data: lastBusinessMessage } = await supabase
      .from("messages")
      .select("metadata")
      .eq("source", "telegram")
      .eq("sender_id", String(chat_id))
      .not("metadata->>business_connection_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const connectionId = (lastBusinessMessage?.metadata as { business_connection_id?: string } | null)
      ?.business_connection_id;

    let businessConnectionId: string | undefined;
    if (connectionId) {
      const { data: conn } = await supabase
        .from("telegram_business_connections")
        .select("is_enabled, can_reply")
        .eq("id", connectionId)
        .maybeSingle();
      // Sending with a disabled or read-only connection is rejected by
      // Telegram; fall back to the bot rather than failing the reply outright.
      if (conn?.is_enabled && conn?.can_reply) businessConnectionId = connectionId;
      else if (conn) {
        console.warn(
          `business connection ${connectionId} unusable (enabled=${conn.is_enabled} can_reply=${conn.can_reply}); sending as bot`,
        );
      }
    }

    const shared = {
      ...(businessConnectionId ? { business_connection_id: businessConnectionId } : {}),
      ...(parse_mode ? { parse_mode } : {}),
      ...(reply_markup ? { reply_markup } : {}),
    };

    let result;
    if (mediaPath) {
      // Telegram fetches the file from a URL, so a short-lived signed link to
      // the private bucket is enough — no multipart upload from here.
      const { data: signed, error: signErr } = await supabase.storage
        .from(CHAT_MEDIA_BUCKET)
        .createSignedUrl(String(mediaPath), MEDIA_URL_TTL_SECONDS);

      if (signErr || !signed?.signedUrl) {
        const reason = "Could not create a URL for the attachment";
        await markRow(supabase, rowId, { delivery_status: "failed", delivery_error: reason });
        return json({ ok: false, error: reason }, 500);
      }

      result = await sendTelegramMedia(
        TELEGRAM_BOT_TOKEN,
        String(chat_id),
        signed.signedUrl,
        String(mediaMime || "application/octet-stream"),
        {
          ...shared,
          ...(text ? { caption: String(text) } : {}),
          ...(mediaFilename ? { filename: String(mediaFilename) } : {}),
        },
      );
    } else {
      result = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, String(chat_id), String(text), shared);
    }

    if (!result.ok) {
      const reason = result.description || "Telegram API error";
      await markRow(supabase, rowId, { delivery_status: "failed", delivery_error: reason });
      return json({ ok: false, error: reason }, 502);
    }

    // Stamp the row the operator is looking at. The external_id also lets the
    // business-message echo coming back through the webhook recognise this as
    // a message we already have (unique index on source + external_id) instead
    // of showing the reply twice.
    const sentId = (result.result as { message_id?: number } | undefined)?.message_id ?? null;
    if (sentId != null) {
      await stampSent(supabase, rowId, String(chat_id), String(sentId));
    }

    return json({ ok: true, result: result.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-telegram error:", message);
    return json({ error: message }, 500);
  }
});
