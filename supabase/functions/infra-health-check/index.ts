// infra-health-check
// ----------------------------------------------------------------------------
// Hourly probe of the things that fail silently. The ElevenLabs key was
// invalid for ~3 months (June–Sept 2026) and nothing noticed; every Scribe
// call quietly fell back to Gemini. This is the thing that would have noticed.
//
// Checks (each has a state: ok | fail):
//   elevenlabs_key   GET /v1/user with ELEVENLABS_API_KEY → must be 200
//   gemini_key       GET /v1beta/models with GEMINI_API_KEY → must be 200
//   call_jobs        comm_processing_jobs in status=error (last 24h) → must be 0
//   mediateka_feed   hours since last voip_webhook_captures row → fails past 24h
//   telegram_userbot minutes since the MTProto userbot's heartbeat → fails past 5
//                    (only when TELEGRAM_SEND_VIA_USERBOT=1)
//
// mediateka_feed used to stay ok while the feed had been silent for 94 days: it
// only alarmed if the feed had been alive within the previous 7 days, so a
// long-dead integration read as healthy. That is the same blind spot that let
// the ElevenLabs key sit invalid for three months. A silent feed is a fault
// whatever its cause, so the window is now a plain threshold.
//
// Alerts on the TRANSITION only (ok→fail, fail→ok), state kept in infra_health.
// Telegram delivery reuses TELEGRAM_BOT_TOKEN + ALERT_TELEGRAM_CHAT_ID, same as
// channel-health-check. ?dry=1 returns the board without recording or alerting.
// Called hourly by pg_cron.
//
// AUTH: verify_jwt is off at the gateway because the new sb_secret_ API keys
// are not JWTs and can only travel in the `apikey` header. The caller is
// checked here instead: a secret key in `apikey`, or — during the migration off
// the leaked legacy key — a service_role JWT in `Authorization: Bearer`.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ALERT_CHAT_ID = Deno.env.get("ALERT_TELEGRAM_CHAT_ID");

/** How long the Mediateka webhook feed may stay quiet before it counts as broken. */
const MEDIATEKA_SILENT_HOURS = 24;

/**
 * How long the Telegram userbot may go without a heartbeat before it counts as
 * dead. It beats every minute, so this absorbs a restart without hiding an
 * expired session. Kept in step with the same threshold in send-telegram,
 * which refuses to queue replies behind a userbot this quiet.
 */
const USERBOT_STALE_MINUTES = 5;

type State = "ok" | "fail";
interface CheckResult { check: string; state: State; detail: string; }

async function probe(url: string, init?: RequestInit): Promise<number> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
    return r.status;
  } catch (_e) { return -1; }
}

async function runChecks(supabase: ReturnType<typeof createClient>): Promise<CheckResult[]> {
  const out: CheckResult[] = [];

  // 1. ElevenLabs key
  const el = Deno.env.get("ELEVENLABS_API_KEY");
  if (!el) out.push({ check: "elevenlabs_key", state: "fail", detail: "ELEVENLABS_API_KEY o'rnatilmagan" });
  else {
    const s = await probe("https://api.elevenlabs.io/v1/user", { headers: { "xi-api-key": el } });
    out.push({ check: "elevenlabs_key", state: s === 200 ? "ok" : "fail", detail: `HTTP ${s}` });
  }

  // 2. Gemini key
  const gk = Deno.env.get("GEMINI_API_KEY");
  if (!gk) out.push({ check: "gemini_key", state: "fail", detail: "GEMINI_API_KEY o'rnatilmagan" });
  else {
    const s = await probe(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(gk)}`);
    out.push({ check: "gemini_key", state: s === 200 ? "ok" : "fail", detail: `HTTP ${s}` });
  }

  // 3. Call-processing jobs stuck in error (last 24h)
  {
    const since = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { count, error } = await supabase
      .from("comm_processing_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "error")
      .gte("updated_at", since);
    if (error) out.push({ check: "call_jobs", state: "fail", detail: `so'rov xatosi: ${error.message}` });
    else out.push({ check: "call_jobs", state: (count ?? 0) === 0 ? "ok" : "fail", detail: `${count ?? 0} ta xatoli job (24 soat)` });
  }

  // 4. Mediateka feed — silent for more than a day is a fault, full stop
  {
    const { data } = await supabase
      .from("voip_webhook_captures")
      .select("received_at")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const last = data?.received_at ? new Date(data.received_at as string) : null;
    const hours = last ? Math.round((Date.now() - last.getTime()) / 3600e3) : null;
    const state: State = hours !== null && hours <= MEDIATEKA_SILENT_HOURS ? "ok" : "fail";
    const detail = hours === null
      ? "hech qachon webhook kelmagan"
      : `oxirgi webhook ${hours} soat oldin` + (state === "fail" ? ` (chegara: ${MEDIATEKA_SILENT_HOURS} soat)` : "");
    out.push({ check: "mediateka_feed", state, detail });
  }

  // 5. Telegram userbot — only when it is the send path
  //
  // The MTProto session dies quietly: a revoked device, a changed password, a
  // container that never came back. On 2026-07-28 it did exactly that and the
  // inbox stayed silent for a week with every status page green. The userbot
  // beats every minute, so a timestamp that stops moving is the fault itself.
  // Checked only when TELEGRAM_SEND_VIA_USERBOT is on, because on the bot path
  // there is no userbot to be missing.
  if ((Deno.env.get("TELEGRAM_SEND_VIA_USERBOT") ?? "").trim() === "1") {
    const { data } = await supabase
      .from("telegram_userbot_status")
      .select("account_label, last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const last = data?.last_seen_at ? new Date(data.last_seen_at as string) : null;
    const minutes = last ? Math.round((Date.now() - last.getTime()) / 60_000) : null;
    const state: State = minutes !== null && minutes <= USERBOT_STALE_MINUTES ? "ok" : "fail";
    const detail = minutes === null
      ? "userbot hech qachon ishga tushmagan"
      : `oxirgi signal ${minutes} daqiqa oldin (${data?.account_label ?? "?"})` +
        (state === "fail" ? ` — chegara: ${USERBOT_STALE_MINUTES} daqiqa` : "");
    out.push({ check: "telegram_userbot", state, detail });
  }

  return out;
}

const LABEL: Record<string, string> = {
  elevenlabs_key: "ElevenLabs API kaliti",
  gemini_key: "Gemini API kaliti",
  call_jobs: "Qo'ng'iroq tahlili (process-call-recording)",
  mediateka_feed: "Mediateka webhook oqimi",
  telegram_userbot: "Telegram userbot (akkaunt sessiyasi)",
};

/**
 * What to do about it, per check.
 *
 * An alert that names the wrong remedy is worse than a terse one: it sends
 * whoever is holding the phone to a settings page that was never the problem.
 * The default suits the API-key checks, which are the majority.
 */
const HINT: Record<string, string> = {
  mediateka_feed: "Mediateka ulanishini va webhook manzilini tekshiring.",
  telegram_userbot:
    "Railway'dagi userbot to'xtagan yoki sessiyasi tugagan. Logini tekshiring; " +
    "sessiya bekor qilingan bo'lsa LOGIN_MODE=1 bilan qayta kiring.",
};

function compose(r: CheckResult): string {
  const name = LABEL[r.check] ?? r.check;
  return r.state === "fail"
    ? `🔴 ${name}: ishlamayapti\n${r.detail}\n${
      HINT[r.check] ?? "Supabase → Edge Functions → Secrets ni tekshiring."
    }`
    : `🟢 ${name}: yana ishlayapti (${r.detail})`;
}

async function sendTelegram(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !ALERT_CHAT_ID) {
    console.warn("infra-health-check: TELEGRAM_BOT_TOKEN / ALERT_TELEGRAM_CHAT_ID not set — alert not delivered:\n" + text);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ALERT_CHAT_ID, text, disable_web_page_preview: true }),
    });
    if (!res.ok) { console.error(`infra-health-check: Telegram ${res.status}: ${await res.text()}`); return false; }
    return true;
  } catch (e) { console.error("infra-health-check: Telegram error:", e); return false; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!authorized(req)) return json({ error: "Unauthorized" }, 401);

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  try {
    const results = await runChecks(supabase);
    if (dry) return json({ ok: true, dry: true, checks: results });

    const { data: prevRows } = await supabase.from("infra_health").select("check, state");
    const prev = new Map((prevRows ?? []).map((r: { check: string; state: string }) => [r.check, r.state]));

    const alerted: string[] = [];
    const now = new Date().toISOString();
    for (const r of results) {
      const before = prev.get(r.check);
      const changed = before !== undefined && before !== r.state;
      const firstFail = before === undefined && r.state === "fail";
      if (changed || firstFail) {
        if (await sendTelegram(compose(r))) alerted.push(r.check);
      }
      await supabase.from("infra_health").upsert({
        check: r.check,
        state: r.state,
        detail: r.detail,
        checked_at: now,
        ...(changed || before === undefined ? { state_since: now } : {}),
      }, { onConflict: "check" });
    }

    return json({ ok: true, checks: results, alerted });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("infra-health-check failed:", e);
    return json({ ok: false, error: message }, 500);
  }
});

/** A secret key in `apikey`, or a service_role JWT in `Authorization: Bearer`. */
function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;

  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return false;
  if (bearer === SERVICE_KEY) return true;
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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
