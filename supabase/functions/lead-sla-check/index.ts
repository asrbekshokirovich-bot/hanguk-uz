// Watchdog for leads nobody has called yet.
//
// A lead cools fast. This asks Postgres which leads just crossed 10 minutes
// uncontacted (see fn_lead_sla_scan) and sends one Telegram alert per lead to
// the staff alert channel. fn_lead_sla_scan marks each one atomically as it
// reads it, so a lead alerts exactly once, never on the next run too.
//
// Called every minute by pg_cron (lead-sla-check-1min). Pass ?dry=1 to see
// what would fire without marking anything or sending — safe to call by hand.
//
// AUTH: verify_jwt is off at the gateway (same reason as channel-health-check
// — the new sb_secret_ API keys are not JWTs). The caller is checked in
// `authorized()` instead.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
/** Chat that receives the alerts — same staff channel as channel-health-check. */
const ALERT_CHAT_ID = Deno.env.get("ALERT_TELEGRAM_CHAT_ID");

/** How long a lead may sit uncontacted before this fires. Kept in step with
 * the default in `fn_lead_sla_scan` and with `UNCONTACTED_SLA_MINUTES` in
 * `src/components/crm/leads/intake/sla.ts`, which draws the same line red. */
const SLA_MINUTES = 10;

interface OverdueLead {
  id: string;
  full_name: string | null;
  phone: string | null;
  how_heard: string | null;
  source: string | null;
  created_at: string;
  minutes_waiting: number;
}

/** Written for whoever is holding a phone: who, how to reach them, how late. */
function composeAlert(l: OverdueLead): string {
  const name = l.full_name || "(ismsiz lid)";
  const phone = l.phone ? `\nTelefon: ${l.phone}` : "";
  const via = l.how_heard || l.source;
  const source = via ? `\nManba: ${via}` : "";
  return [
    `🔴 Yangi lidga ${l.minutes_waiting} daqiqadan beri aloqa chiqarilmagan!`,
    ``,
    name + phone + source,
    ``,
    `CRM → Lidlar bo'limida ko'ring.`,
  ].join("\n");
}

async function sendTelegram(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !ALERT_CHAT_ID) {
    console.warn(
      "lead-sla-check: TELEGRAM_BOT_TOKEN / ALERT_TELEGRAM_CHAT_ID not set — alert not delivered:\n" + text,
    );
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ALERT_CHAT_ID, text, disable_web_page_preview: true }),
    });
    if (!res.ok) {
      console.error(`lead-sla-check: Telegram send failed ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("lead-sla-check: Telegram send error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  try {
    const { data, error } = await supabase.rpc("fn_lead_sla_scan", {
      p_minutes: SLA_MINUTES,
      p_dry: dry,
    });
    if (error) throw error;

    const overdue = (data ?? []) as OverdueLead[];

    if (dry) {
      return json({ ok: true, dry: true, overdue });
    }

    const alerted: string[] = [];
    for (const lead of overdue) {
      if (await sendTelegram(composeAlert(lead))) alerted.push(lead.id);
    }

    if (overdue.length > 0) {
      console.log(`lead-sla-check: ${overdue.length} overdue, ${alerted.length} alert(s) sent`);
    }

    return json({ ok: true, overdue: overdue.length, alerted: alerted.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("lead-sla-check failed:", e);
    return json({ ok: false, error: message }, 500);
  }
});

/** A secret key in `apikey`, or a service_role JWT in `Authorization: Bearer`. */
function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  if (bearer === SUPABASE_SERVICE_ROLE_KEY) return true;
  try {
    const payload = bearer.split(".")[1];
    const pad = payload + "=".repeat((4 - payload.length % 4) % 4);
    const claims = JSON.parse(atob(pad.replace(/-/g, "+").replace(/_/g, "/")));
    return claims?.role === "service_role";
  } catch (_e) { return false; }
}

/** Every sb_secret_ key configured for this project, whatever it is named. */
function knownSecretKeys(): string[] {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Object.values(parsed).filter((v): v is string => typeof v === "string");
  } catch (_e) { return []; }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
