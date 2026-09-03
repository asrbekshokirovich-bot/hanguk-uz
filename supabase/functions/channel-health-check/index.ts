// Hourly heartbeat for the messaging channels.
//
// Telegram went silent on 2026-08-04 and nobody noticed for 29 days. This is
// the thing that would have noticed: it asks Postgres which channels changed
// state (see fn_channel_health_scan) and sends a Telegram message when one
// does. It sends on the TRANSITION only — going quiet, and coming back — so a
// channel that stays broken over a weekend produces one message, not fifty.
//
// Called hourly by pg_cron with the service-role key. Also safe to call by
// hand from the CRM to check the current picture: pass ?dry=1 to see the state
// without recording alerts.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
/** Chat that receives the alerts — a staff group, or one admin's chat id. */
const ALERT_CHAT_ID = Deno.env.get("ALERT_TELEGRAM_CHAT_ID");

interface Change {
  source: string;
  from_state: string | null;
  to_state: string;
  last_inbound_at: string | null;
  silent_hours: number | null;
}

const CHANNEL_LABEL: Record<string, string> = {
  telegram: "Telegram",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
};

/**
 * The alert text. Written for whoever is holding a phone at the time, so it
 * leads with which channel and how long, and says what to do — an alert that
 * only says "something is wrong" gets read once and muted afterwards.
 */
function composeAlert(c: Change): string {
  const name = CHANNEL_LABEL[c.source] ?? c.source;
  if (c.to_state === "silent") {
    const hours = c.silent_hours ?? 0;
    const since = c.last_inbound_at
      ? new Date(c.last_inbound_at).toISOString().slice(0, 16).replace("T", " ")
      : "hech qachon";
    return [
      `🔴 ${name}: xabar kelmayapti`,
      ``,
      `Oxirgi kiruvchi xabar: ${since} (${hours} soat oldin).`,
      `Kanal ishlamayotgan bo'lishi mumkin — ulanishni tekshiring.`,
    ].join("\n");
  }
  return `🟢 ${name}: xabarlar yana kelmoqda.`;
}

async function sendTelegram(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !ALERT_CHAT_ID) {
    console.warn(
      "channel-health-check: TELEGRAM_BOT_TOKEN / ALERT_TELEGRAM_CHAT_ID not set — alert not delivered:\n" + text,
    );
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: ALERT_CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!res.ok) {
      console.error(`channel-health-check: Telegram send failed ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("channel-health-check: Telegram send error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  try {
    // The current board is always useful in the response, whether or not
    // anything changed — this is what a human checking by hand wants to see.
    const { data: board } = await supabase
      .from("channel_health")
      .select("source, state, last_inbound_at, silent_after_hours, state_since, enabled")
      .order("source");

    if (dry) {
      return json({ ok: true, dry: true, channels: board ?? [] });
    }

    const { data: changes, error } = await supabase.rpc("fn_channel_health_scan");
    if (error) throw error;

    const list = (changes ?? []) as Change[];
    const delivered: string[] = [];
    for (const change of list) {
      if (await sendTelegram(composeAlert(change))) delivered.push(change.source);
    }

    if (list.length > 0) {
      console.log(`channel-health-check: ${list.length} transition(s), ${delivered.length} alert(s) sent`);
    }

    return json({ ok: true, changes: list, alerted: delivered, channels: board ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("channel-health-check failed:", e);
    return json({ ok: false, error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
