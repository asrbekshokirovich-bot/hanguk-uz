// tv-lead-alerts
// ----------------------------------------------------------------------------
// The feed of the office TV's red warning (spec §14 "Ofis TV", 8.3): the new
// leads nobody has answered for 10 minutes, as fn_lead_tv_warnings() lists them.
// public/tv.html polls it every 15 seconds, on top of its own task-board feed.
//
//   GET ?k=<key>   -> { ok: true, now, warnings: [
//                        { lead_id, label, source, minutes_late, minutes_waiting, timer_kind } ] }
//
// `label` is the person's @username (or name), `minutes_late` counts from the
// deadline, `minutes_waiting` is how long they have really waited (the 10-minute
// window included for a first / reply timer) — the TV shows the latter.
// The list is empty when lead_settings.tv_warning is off.
//
// AUTH: a TV cannot carry a JWT; the key is compared, in constant time, with
// TV_LEAD_KEY. 401 for any other key, 503 while TV_LEAD_KEY is not set.
// verify_jwt is off (config.toml). CORS is open (the key is the gate).
//
// Env: TV_LEAD_KEY.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { constantTimeEqual } from "../_shared/service-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const admin: any = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

/** lead_settings.timer_minutes, remembered for a minute (the TV asks every 15 s). */
let windowCache: { minutes: number; until: number } | null = null;

async function windowMinutes(): Promise<number> {
  if (windowCache && windowCache.until > Date.now()) return windowCache.minutes;
  let minutes = 10;
  try {
    const { data } = await admin.from("lead_settings").select("value").eq("key", "timer_minutes").maybeSingle();
    const v = Number(data?.value);
    if (Number.isFinite(v) && v > 0) minutes = v;
  } catch (_e) { /* the default will do */ }
  windowCache = { minutes, until: Date.now() + 60_000 };
  return minutes;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method Not Allowed" }, 405);

  const expected = Deno.env.get("TV_LEAD_KEY");
  if (!expected) return json({ error: "TV_LEAD_KEY is not configured" }, 503);
  const presented = new URL(req.url).searchParams.get("k") ?? "";
  if (!constantTimeEqual(presented, expected)) return json({ error: "Unauthorized" }, 401);

  try {
    const { data, error } = await admin.rpc("fn_lead_tv_warnings");
    if (error) throw new Error(error.message);
    const window = await windowMinutes();

    const warnings = ((data ?? []) as any[]).map((w) => {
      const late = Math.max(0, Number(w.minutes_late) || 0);
      const kind = w.timer_kind ?? null;
      return {
        lead_id: w.lead_id,
        label: w.label ?? null,
        source: w.source ?? null,
        minutes_late: late,
        minutes_waiting: kind === "ladder" || kind === "callback" ? late : late + window,
        timer_kind: kind,
      };
    });
    return json({ ok: true, now: new Date().toISOString(), warnings });
  } catch (e) {
    console.error("tv-lead-alerts failed:", e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: "temporarily unavailable" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
