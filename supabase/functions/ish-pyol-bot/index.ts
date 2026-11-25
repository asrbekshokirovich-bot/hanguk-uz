// ish-pyol-bot — the Telegram bot workers buy puyl through (2026-11-25).
//
// The app shows no payment details (Google Play / App Store rules for
// digital coins); the bot does (bot.ts). It files top-up requests that the
// staff approve in the CRM, as before.
//
// Setup, once (README «Puyl boti»):
//   1. @BotFather → /newbot → the token.
//   2. Supabase → Edge Functions → Secrets: ISH_PYOL_BOT_TOKEN = the token.
//   3. Open https://<project>.supabase.co/functions/v1/ish-pyol-bot?setup=1
//      in a browser: it registers this function as the bot's webhook.
//
// Auth: Telegram calls it (verify_jwt = false) with the secret header set at
// setup (derived from the token), so nobody else can post updates.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serviceKey } from "../_shared/keys.ts";
import { type Deps, handle } from "./bot.ts";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function webhookSecret(token: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`ish-pyol-bot:${token}`));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 48);
}

Deno.serve(async (req) => {
  const token = Deno.env.get("ISH_PYOL_BOT_TOKEN") ?? "";
  if (!token) return json(503, { error: "ISH_PYOL_BOT_TOKEN is not set" });
  const api = (method: string, body: unknown) =>
    fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const secret = await webhookSecret(token);
  const url = new URL(req.url);

  // One-time setup: point the bot at this function.
  if (req.method === "GET" && url.searchParams.get("setup") === "1") {
    const self = `${Deno.env.get("SUPABASE_URL")}/functions/v1/ish-pyol-bot`;
    const result = await api("setWebhook", {
      url: self,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: true,
    });
    const me = await api("getMe", {});
    return json(200, { webhook: result, bot: me?.result?.username ?? null });
  }

  if (req.method !== "POST" || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== secret) {
    return json(401, { error: "unauthorized" });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    db: { schema: "ish" },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const deps: Deps = {
    chat: async (chatId) => {
      const { data } = await db.from("bot_chats").select("worker_id, pyols").eq("chat_id", chatId).maybeSingle();
      return data as any;
    },
    saveChat: async (chatId, chat) => {
      await db.from("bot_chats").upsert({ chat_id: chatId, ...chat, updated_at: new Date().toISOString() });
    },
    findWorker: async (text) => {
      const { data } = await db.rpc("bot_find_worker", { p_text: text });
      return (data as any) ?? null;
    },
    details: async () => {
      const { data } = await db.rpc("bot_payment_details");
      return { packs: (data as any)?.packs ?? [], methods: (data as any)?.methods ?? {} };
    },
    storeProof: async (workerId, fileId) => {
      const file = await api("getFile", { file_id: fileId });
      const filePath = file?.result?.file_path;
      if (!filePath) throw new Error("NO_FILE");
      const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
      if (!res.ok) throw new Error("NO_FILE");
      const bytes = new Uint8Array(await res.arrayBuffer());
      const ext = (String(filePath).split(".").pop() ?? "jpg").toLowerCase().slice(0, 5);
      const path = `${workerId}/${Date.now()}.${ext}`;
      const { error } = await db.storage.from("ish-topup-proofs").upload(path, bytes, {
        contentType: ext === "png" ? "image/png" : "image/jpeg",
        upsert: false,
      });
      if (error) throw new Error("UPLOAD");
      return path;
    },
    requestTopup: async (workerId, pyols, payer, proof) => {
      const { error } = await db.rpc("bot_request_topup", {
        p_worker: workerId,
        p_pyols: pyols,
        p_payer: payer,
        p_proof: proof,
      });
      if (error) throw new Error(/TOO_MANY/.test(error.message) ? "TOO_MANY" : "ERROR");
    },
    send: async (chatId, text, buttons) => {
      await api("sendMessage", {
        chat_id: chatId,
        text,
        ...(buttons ? { reply_markup: { inline_keyboard: buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))) } } : {}),
      });
    },
    answerCallback: async (id) => {
      await api("answerCallbackQuery", { callback_query_id: id });
    },
  };

  try {
    await handle(await req.json(), deps);
  } catch (e) {
    console.error("ish-pyol-bot", e);
  }
  // Always 200: Telegram retries anything else.
  return json(200, { ok: true });
});
