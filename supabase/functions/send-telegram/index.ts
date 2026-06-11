import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTelegramMessage } from "../_shared/telegram.ts";

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
    if (!TELEGRAM_BOT_TOKEN) {
      console.error("send-telegram called but TELEGRAM_BOT_TOKEN is not set");
      return json({ error: "TELEGRAM_BOT_TOKEN is not configured" }, 500);
    }

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
    const { chat_id, text, parse_mode, reply_markup } = await req.json();
    if (!chat_id || !text) {
      return json({ error: "Missing required fields: chat_id, text" }, 400);
    }

    const result = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, String(chat_id), String(text), {
      ...(parse_mode ? { parse_mode } : {}),
      ...(reply_markup ? { reply_markup } : {}),
    });

    if (!result.ok) {
      return json({ ok: false, error: result.description || "Telegram API error" }, 502);
    }

    return json({ ok: true, result: result.result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("send-telegram error:", message);
    return json({ error: message }, 500);
  }
});
