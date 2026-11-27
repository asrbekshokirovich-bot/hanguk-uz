// ish-tg-bot — the HanPyol bot's webhook (2026-11-27). Telegram sends every
// message to the bot here; /start answers with the greeting and the button
// that opens the mini app (see bot.ts).
//
// Secret: TELEGRAM_HANPYOL_BOT_TOKEN (the same as ish-telegram-auth).
// The webhook is set by .github/workflows/ish-tg-web.yml with secret_token =
// webhookSecret(token); a request without it is refused.
// verify_jwt = false (config.toml): Telegram calls without a Supabase key.
import { reply, webhookSecret } from "./bot.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_HANPYOL_BOT_TOKEN") ?? "";
const APP_URL = Deno.env.get("ISH_MINI_APP_URL") || "https://hanpyol-tg.vercel.app";

Deno.serve(async (req) => {
  if (req.method !== "POST" || !BOT_TOKEN) return new Response("ok");
  if (req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== await webhookSecret(BOT_TOKEN)) {
    return new Response("forbidden", { status: 403 });
  }
  try {
    const update = await req.json();
    const msg = update?.message;
    // Only private chats with a person.
    if (msg?.chat?.type === "private" && typeof msg?.chat?.id === "number") {
      const body = reply(msg.chat.id, String(msg.text ?? ""), String(msg.from?.language_code ?? ""), APP_URL);
      const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) console.error("ish-tg-bot sendMessage", res.status, (await res.text()).slice(0, 300));
      else await res.body?.cancel();
    }
  } catch (e) {
    console.error("ish-tg-bot", e);
  }
  // Always 200: Telegram would otherwise resend the same update.
  return new Response("ok");
});
