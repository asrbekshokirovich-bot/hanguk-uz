// app-quality-alerts
// ----------------------------------------------------------------------------
// Hourly: the app's quality alarms (plan v2, section 11 «Versiya nazorati»,
// stage 6 db/anomaly-alerts) to the boss on Telegram — a new build that
// stopped sending an event the build before it sent, and a day with far
// fewer or far more events than the week before. fn_app_quality_scan finds
// them (once per kind, subject and day); this sends the ones not sent yet
// to lead_alert_recipients where watchdog, and marks them.
//
// Called by pg_cron (app-quality-alerts-hourly) with the secret key in
// `apikey`. ?dry=1 — what it would find, nothing kept or sent.
//
// AUTH: verify_jwt is off at the gateway (sb_secret_ keys are not JWTs); the
// caller is checked in authorized(), as in lead-sla-check.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import { alertText, type Alert } from "./alerts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const CRM_URL = (Deno.env.get("CRM_URL") || "https://hanguk.uz").replace(/\/+$/, "");

Deno.serve(async (req) => {
  if (!authorized(req)) return json({ error: "unauthorized" }, 401);
  const dry = new URL(req.url).searchParams.get("dry") === "1";
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  const { data, error } = await admin.rpc("fn_app_quality_scan", { p_dry: dry });
  if (error) return json({ ok: false, error: error.message }, 500);
  const alerts = (data ?? []) as Alert[];
  if (!alerts.length) return json({ ok: true, alerts: 0 });

  const { data: types } = await admin.from("app_event_types").select("event, description_uz");
  const names = new Map(((types ?? []) as { event: string; description_uz: string }[]).map((t) => [t.event, t.description_uz]));
  const link = `${CRM_URL}/crm/app-analytics/quality`;
  const texts = alerts.map((a) => alertText(a, (e) => names.get(e), link));
  if (dry) return json({ ok: true, dry: true, alerts, texts });

  const { data: rows, error: rerr } = await admin
    .from("lead_alert_recipients").select("chat_id").eq("enabled", true).eq("watchdog", true);
  if (rerr) return json({ ok: false, error: rerr.message }, 500);
  const chats = [...new Set(((rows ?? []) as { chat_id: string }[]).map((r) => String(r.chat_id).trim()).filter(Boolean))];
  if (!chats.length || !TELEGRAM_BOT_TOKEN) {
    console.warn(`app-quality-alerts: ${alerts.length} alarm(s), nobody to send to`);
    return json({ ok: false, error: "no_recipients", alerts: alerts.length });
  }

  const sent: number[] = [];
  for (let i = 0; i < alerts.length; i++) {
    let delivered = false;
    for (const chat of chats) {
      const r = await sendTelegramMessage(TELEGRAM_BOT_TOKEN, chat, texts[i]);
      if (r.ok) delivered = true;
    }
    if (delivered && alerts[i].id != null) sent.push(alerts[i].id as number);
  }
  if (sent.length) {
    await admin.from("app_quality_alerts").update({ sent_at: new Date().toISOString() }).in("id", sent);
  }
  return json({ ok: true, alerts: alerts.length, sent: sent.length });
});

/** A secret key in `apikey`, or the service-role key in `Authorization: Bearer`. */
function authorized(req: Request): boolean {
  const apikey = (req.headers.get("apikey") || "").trim();
  if (apikey.startsWith("sb_secret_") && knownSecretKeys().includes(apikey)) return true;
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  return bearer !== "" && bearer === SERVICE_KEY;
}

function knownSecretKeys(): string[] {
  try {
    const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
    if (!raw) return [];
    return Object.values(JSON.parse(raw)).filter((v): v is string => typeof v === "string");
  } catch (_e) {
    return [];
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
