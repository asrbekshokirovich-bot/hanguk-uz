// ish-telegram-auth — signs a HanPyol worker in from the Telegram Mini App
// (2026-11-26).
//
// Body: { init_data }                      first call
//       { init_data, contact }             the signed answer of requestContact
//       { init_data, contact: null }       the person did not share the number
// Answer: { token_hash, type } — the app calls auth.verifyOtp with them — or
//         { need_contact: true } for a new person, or { error }.
//
// Secret (Supabase → Edge Functions → Secrets):
//   TELEGRAM_HANPYOL_BOT_TOKEN   the token of the mini app's bot (BotFather)
//
// verify_jwt = false (config.toml): nobody is signed in yet; Telegram's
// signature is the proof of who is calling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceKey } from "../_shared/keys.ts";
import { type Accounts, AuthError, signIn } from "./auth.ts";
import { contactPhone, TelegramError, telegramUser, verifySigned } from "./telegram.ts";

const cors = { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function accounts(url: string): Accounts {
  const admin = createClient(url, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async existing(email, telegramId) {
      // A recovery link is refused for an e-mail nobody has (and makes no
      // account, unlike a magic link): the way to ask whether it exists.
      const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
      if (error) {
        if (error.status === 404 || /not found/i.test(error.message)) return null;
        throw new AuthError("SERVER");
      }
      if (Number(data.user?.app_metadata?.["telegram_id"]) !== telegramId) throw new AuthError("MISMATCH");
      return { token_hash: data.properties.hashed_token, type: "recovery" };
    },
    async byPhone(digits) {
      const { data, error } = await admin.schema("ish").from("profiles").select("id").eq("phone", digits).limit(1);
      if (error) throw new AuthError("SERVER");
      const id = data?.[0]?.id as string | undefined;
      if (!id) return null;
      const { data: u, error: e2 } = await admin.auth.admin.getUserById(id);
      if (e2 || !u?.user) return null;
      return { id, email: u.user.email ?? "" };
    },
    async attach(userId, email, telegramId) {
      const { error } = await admin.auth.admin.updateUserById(userId, {
        email,
        email_confirm: true,
        app_metadata: { telegram_id: telegramId },
      });
      if (error) throw new AuthError("SERVER");
    },
    async create(email, user, phone) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
      const make = (withPhone: boolean) =>
        admin.auth.admin.createUser({
          email,
          email_confirm: true,
          ...(withPhone && phone ? { phone, phone_confirm: true } : {}),
          user_metadata: { app: "hanguk_ish", name, telegram_username: user.username || undefined },
          app_metadata: { telegram_id: user.id },
        });
      let { error } = await make(true);
      // The number is on another sign-in already: the account is made without it.
      if (error && phone) ({ error } = await make(false));
      if (error) throw new AuthError("SERVER");
    },
    async link(email) {
      const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
      if (error || !data?.properties?.hashed_token) throw new AuthError("SERVER");
      return { token_hash: data.properties.hashed_token, type: "magiclink" };
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "METHOD" });

  const botToken = Deno.env.get("TELEGRAM_HANPYOL_BOT_TOKEN") ?? "";
  if (!botToken) return json(503, { error: "NOT_CONFIGURED" });

  let body: { init_data?: unknown; contact?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "INVALID" });
  }
  try {
    const user = telegramUser(await verifySigned(String(body.init_data ?? ""), botToken));
    let contact: string | null | undefined;
    if (typeof body.contact === "string" && body.contact) {
      try {
        // The contact may be signed long after the app opened, but not long ago.
        contact = contactPhone(await verifySigned(body.contact, botToken, Date.now(), 60 * 60), user.id);
      } catch {
        contact = null;
      }
    } else if ("contact" in body) {
      contact = null;
    }
    return json(200, await signIn(accounts(Deno.env.get("SUPABASE_URL")!), user, contact));
  } catch (e) {
    if (e instanceof TelegramError) return json(401, { error: e.code });
    if (e instanceof AuthError) return json(e.code === "MISMATCH" ? 409 : 500, { error: e.code });
    console.error("ish-telegram-auth", e);
    return json(500, { error: "SERVER" });
  }
});
