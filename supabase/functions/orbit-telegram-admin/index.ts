// orbit-telegram-admin — inspect and repair the Orbit bot's Telegram webhook.
//
// The webhook is the single point where Telegram stops silently: if the
// registration is lost or points at a different bot, nothing errors, the bot
// simply never answers again. Nothing in the project reported that.
//
//   GET  ?action=status        -> Telegram's own getWebhookInfo, verbatim
//   POST {"action":"register"} -> re-point Telegram at orbit-telegram-webhook
//   POST {"action":"ping", "chat_id": 123} -> send a test message, proving the
//        token can actually deliver. getWebhookInfo alone cannot tell you that.
//
// Deployed with verify_jwt = true, so only a caller holding a Supabase JWT
// can reach it; the bot token never leaves Supabase.

const BOT = Deno.env.get("ORBIT_TELEGRAM_BOT_TOKEN") ?? "";
const WH_SECRET = Deno.env.get("ORBIT_TELEGRAM_WEBHOOK_SECRET") ?? "";
const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_URL = `${SUPA_URL}/functions/v1/orbit-telegram-webhook`;

const TG = `https://api.telegram.org/bot${BOT}`;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (!BOT) return json({ error: "ORBIT_TELEGRAM_BOT_TOKEN is not configured" }, 500);

  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const action = req.method === "POST"
    ? (body?.action ?? "status")
    : (url.searchParams.get("action") ?? "status");

  const me = await fetch(`${TG}/getMe`).then((r) => r.json()).catch(() => null);
  const bot = me?.result ? { id: me.result.id, username: me.result.username } : null;

  if (action === "ping") {
    const chatId = body?.chat_id;
    if (!chatId) return json({ error: "chat_id is required for ping" }, 400);
    const res = await fetch(`${TG}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: body?.text ?? "✅ Orbit ulanish testi — bot ishlayapti.",
      }),
    });
    const result = await res.json().catch(() => ({}));
    return json({
      action,
      bot,
      delivered: !!result?.ok,
      error: result?.ok ? null : result?.description ?? "sendMessage failed",
    }, result?.ok ? 200 : 502);
  }

  if (action === "register") {
    const res = await fetch(`${TG}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        // The handler rejects anything without this header, so registering
        // without the secret silently 401s every update.
        secret_token: WH_SECRET,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
    });
    const result = await res.json().catch(() => ({}));
    if (!result?.ok) {
      return json({ ok: false, error: result?.description ?? "setWebhook failed" }, 502);
    }
  }

  const info = await fetch(`${TG}/getWebhookInfo`).then((r) => r.json()).catch(() => null);
  const r = info?.result ?? {};
  return json({
    action,
    bot,
    secret_configured: !!WH_SECRET,
    expected_url: WEBHOOK_URL,
    registered_url: r.url || null,
    matches: r.url === WEBHOOK_URL,
    pending_update_count: r.pending_update_count ?? null,
    last_error_date: r.last_error_date ?? null,
    last_error_message: r.last_error_message ?? null,
    max_connections: r.max_connections ?? null,
    allowed_updates: r.allowed_updates ?? null,
  });
});
