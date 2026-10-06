// The automatic reply to new chats that arrive outside working hours — and
// nothing else.
//
// Until lead module v2 (2026-10-05) this was also the "Yangi lid" watchdog: it
// asked Postgres which leads were past 10 minutes (fn_lead_sla_scan) and sent
// one Telegram alert per lead, and it ran the owner's watchdogs (watchdog.ts):
// a lead closed within 30 seconds, and the 09:30 daily count. All of that moved:
// the 10-minute rule is leads.due_at + fn_lead_timer_scan, delivered by
// lead-alert-dispatch, and the daily report is lead-reports. fn_lead_sla_scan is
// now a no-op in the database. It is NOT called from here any more, and neither
// is runWatchdogs — either one would alert twice. (watchdog.ts is left in this
// folder, unused.)
//
// Each run sends the automatic reply to new chats that arrived outside working
// hours (after_hours.ts).
//
// Called every minute by pg_cron (lead-sla-check-1min). Pass ?dry=1 to see
// what would be sent without marking anything or sending — safe to call by hand.
//
// AUTH: verify_jwt is off at the gateway (same reason as channel-health-check
// — the new sb_secret_ API keys are not JWTs). The caller is checked in
// `authorized()` instead.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendAfterHoursReplies } from "./after_hours.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  try {
    const afterHours = await sendAfterHoursReplies(supabase, dry);

    if (dry) {
      return json({ ok: true, dry: true, after_hours: afterHours.leads ?? [] });
    }

    return json({
      ok: true,
      after_hours_claimed: afterHours.claimed,
      after_hours_sent: afterHours.sent,
    });
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
