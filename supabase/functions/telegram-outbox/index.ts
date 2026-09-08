// telegram-outbox
// ----------------------------------------------------------------------------
// Work queue endpoint for the personal-account Telegram userbot.
//
// The userbot holds the MTProto session, so it is the only thing that can send
// AS a staff personal account. It runs off-platform and is usually behind NAT,
// so nothing can call it inbound — instead it polls here:
//
//   POST { action: "claim",    account_label?, limit? }  -> rows to send
//   POST { action: "complete", id, ok, tg_message_id?, error? }
//
// Auth: the same shared secret already used for ingest (`x-ingest-secret`).
// Deliberately NOT a JWT and NOT the service role key — the userbot box holds
// one low-value secret, and rotating it costs nothing.
//
// RECOVERED FROM PRODUCTION 2026-09-03 — deployed live, never committed.
//
// DORMANT. `telegram_outbox` has never held a row, and on 2026-09-03 the
// personal-account path was replaced by a Telegram Business connection, which
// sends through the bot API in `send-telegram` and needs no userbot at all.
// This is kept under version control so the decision to delete it can be made
// deliberately rather than by forgetting it exists — which is how the rest of
// this directory got out of step in the first place. If the Business
// connection stays, this function and the `telegram_outbox` table can go.
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

  return json({ error: `Unknown action: ${action || "(none)"}` }, 400);
});
