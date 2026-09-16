// telegram-outbox
// ----------------------------------------------------------------------------
// Work queue endpoint for the personal-account Telegram userbot.
//
// The userbot holds the MTProto session, so it is the only thing that can send
// AS a staff personal account. It runs off-platform and is usually behind NAT,
// so nothing can call it inbound — instead it polls here:
//
//   POST { action: "claim",     account_label?, limit? }  -> rows to send
//   POST { action: "complete",  id, ok, tg_message_id?, error? }
//   POST { action: "heartbeat", account_label, tg_user_id?, username?, detail? }
//
// Auth: the same shared secret already used for ingest (`x-ingest-secret`).
// Deliberately NOT a JWT and NOT the service role key — the userbot box holds
// one low-value secret, and rotating it costs nothing.
//
// RECOVERED FROM PRODUCTION 2026-09-03 — deployed live, never committed.
//
// This was marked DORMANT on 2026-09-03, when a Telegram Business connection
// replaced the personal-account path. It is live again: with a chatbot
// connected, Telegram's Android app opens the BOT when anyone adds the
// account's phone number as a contact (bugs.telegram.org/c/65751), and only
// disconnecting the bot removes that. Sending as the account over MTProto is
// the one route that does not require a connected bot, so this queue is the
// supported send path again rather than a leftover.
//
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
};

const CHAT_MEDIA_BUCKET = "chat-media";
const MEDIA_URL_TTL_SECONDS = 600; // 10 min is plenty for the bot to fetch it

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("TELEGRAM_INGEST_SECRET");
  if (!secret || req.headers.get("x-ingest-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let body: any;
  try {
    body = await req.json();
  } catch (_e) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const action = String(body?.action || "");

  // ------------------------------------------------------------------ claim
  if (action === "claim") {
    const accountLabel = body.account_label ?? null;
    const limit = Number.isFinite(body.limit) ? Number(body.limit) : 10;

    const { data, error } = await supabase.rpc("claim_telegram_outbox", {
      p_account_label: accountLabel,
      p_limit: limit,
    });
    if (error) {
      console.error("claim failed:", error.message);
      return json({ error: error.message }, 500);
    }

    // Attach a short-lived signed URL for any attachment so the userbot can
    // fetch the bytes without holding storage credentials.
    const rows = await Promise.all(
      (data ?? []).map(async (row: any) => {
        if (!row.media_path) return row;
        const signed = await supabase.storage
          .from(CHAT_MEDIA_BUCKET)
          .createSignedUrl(row.media_path, MEDIA_URL_TTL_SECONDS);
        if (signed.error) {
          console.error(`signed url failed for ${row.media_path}:`, signed.error.message);
          return { ...row, media_url: null };
        }
        return { ...row, media_url: signed.data?.signedUrl ?? null };
      }),
    );

    return json({ ok: true, count: rows.length, rows });
  }

  // --------------------------------------------------------------- complete
  if (action === "complete") {
    const id = body.id;
    if (!id) return json({ error: "Missing id" }, 400);

    const ok = !!body.ok;
    const tgMessageId = Number.isFinite(body.tg_message_id)
      ? Number(body.tg_message_id)
      : null;
    // Keep stored errors bounded — some MTProto errors are enormous.
    const errText = body.error ? String(body.error).slice(0, 500) : null;

    const { error } = await supabase.rpc("complete_telegram_outbox", {
      p_id: id,
      p_ok: ok,
      p_tg_message_id: tgMessageId,
      p_error: errText,
    });
    if (error) {
      console.error("complete failed:", error.message);
      return json({ error: error.message }, 500);
    }
    return json({ ok: true });
  }

  // -------------------------------------------------------------- heartbeat
  // The userbot says it is alive. An MTProto session dies quietly — a revoked
  // device, a changed password, a container that never came back — and on
  // 2026-07-28 exactly that happened and the inbox stayed silent for a week
  // while every status page read green. A timestamp that stops moving is what
  // infra-health-check alarms on, so this is the whole cure for that class of
  // outage. Cheap on purpose: one upsert, no reads.
  if (action === "heartbeat") {
    const accountLabel = body.account_label ? String(body.account_label) : null;
    if (!accountLabel) return json({ error: "Missing account_label" }, 400);

    const { error } = await supabase.from("telegram_userbot_status").upsert({
      account_label: accountLabel,
      tg_user_id: body.tg_user_id != null ? String(body.tg_user_id) : null,
      username: body.username ? String(body.username) : null,
      last_seen_at: new Date().toISOString(),
      detail: body.detail ? String(body.detail).slice(0, 500) : null,
    }, { onConflict: "account_label" });

    if (error) {
      console.error("heartbeat failed:", error.message);
      return json({ error: error.message }, 500);
    }
    return json({ ok: true });
  }

  return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
});
