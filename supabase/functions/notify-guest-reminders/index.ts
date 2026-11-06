// notify-guest-reminders (ushlab qolish rejasi P09, U2)
// ----------------------------------------------------------------------------
// Sends what guest_push_queue holds (P08: ♥ university's online deadline 7/3/1
// days before; P15: a new guideline) to the guest's phone, in its language.
// pg_cron calls it at 05:00 and 14:00 UTC (10:00 and 19:00 Tashkent).
// Rules in plan.ts: one a day, two in 7 days, quiet 22:00–08:00.
//
// NOTIFY_GUEST_ENABLED: unset/"off" — nothing goes; "test" — only phones
// marked test (app_installs.test_reason); "all" — everyone (Asrbek's «yoq»).
// POST { dry: true } with the service key: the plan, nothing sent or changed.
// Every send is kept in app_push_sends (P03), so the CRM counts it.
//
// AUTH: verify_jwt is off (the sb_secret_ key pg_cron sends is not a JWT);
// service callers only, checked by isServiceRequest.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { fcmAccessToken, fcmSend, type ServiceAccount } from "../_shared/fcm.ts";
import { serviceKey } from "../_shared/keys.ts";
import { isServiceRequest } from "../_shared/caller.ts";
import { isQuiet, parseMode, planBatch, type PendingRow } from "./plan.ts";
import { messageText, nameFor, pushData, stopLabel, telegramHtml } from "./messages.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = serviceKey();
const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");
const MAX_ATTEMPTS = 3;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

/** P16: the reminder through the bot, with its «To'xtatish» button. */
async function tgSend(chatId: string, html: string, stop: string): Promise<{ ok: boolean; gone: boolean; error?: string }> {
  if (!BOT_TOKEN) return { ok: false, gone: false, error: "TELEGRAM_BOT_TOKEN is not set" };
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId, text: html, parse_mode: "HTML",
      reply_markup: { inline_keyboard: [[{ text: stop, callback_data: "sub_stop" }]] },
    }),
  });
  if (res.ok) return { ok: true, gone: false };
  const text = await res.text();
  // 403: the person blocked the bot
  return { ok: false, gone: res.status === 403, error: text.slice(0, 300) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (!isServiceRequest(req)) return json({ error: "forbidden" }, 403);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    body = {};
  }
  const dry = body.dry === true;
  const mode = parseMode(Deno.env.get("NOTIFY_GUEST_ENABLED"));
  const now = new Date();
  if (!dry && isQuiet(now)) return json({ ok: true, quiet: true });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("guest_push_pending", { p_limit: 2000 });
  if (error) return json({ error: error.message }, 500);
  const rows = (data ?? []) as PendingRow[];
  // dry shows what "all" would do, whatever the switch says
  const plan = planBatch(rows, dry ? "all" : mode);

  const ids = [...new Set(plan.send.flatMap((m) => m.institution_ids))];
  const names = new Map<string, { name_en: string | null; name_ko: string | null }>();
  if (ids.length) {
    const { data: inst } = await admin.from("institutions").select("id, name_en, name_ko").in("id", ids);
    for (const i of inst ?? []) names.set(i.id, i);
  }
  const textOf = (m: (typeof plan.send)[number]) =>
    messageText(m.kind, m.lang, m.institution_ids.map((id) => (names.has(id) ? nameFor(names.get(id)!, m.lang) : "")));

  if (dry) {
    return json({
      ok: true,
      dry: true,
      mode,
      pending: rows.length,
      phones: plan.send.length,
      wait: plan.wait,
      skip: plan.skip.length,
      messages: plan.send.map((m) => ({ install_id: m.install_id, channel: m.channel, kind: m.kind, lang: m.lang, test: m.is_test, ...textOf(m) })),
    });
  }

  if (plan.skip.length) {
    for (const note of new Set(plan.skip.map((s) => s.note))) {
      await admin.from("guest_push_queue").update({ status: "skipped", note })
        .in("id", plan.skip.filter((s) => s.note === note).map((s) => s.queue_id));
    }
  }
  if (mode === "off" || plan.send.length === 0) {
    return json({ ok: true, mode, sent: 0, wait: plan.wait, skipped: plan.skip.length });
  }
  const needsFcm = plan.send.some((m) => m.channel === "fcm");
  if (needsFcm && !FCM_SERVICE_ACCOUNT_JSON) return json({ error: "FCM_SERVICE_ACCOUNT_JSON is not set" }, 500);
  const sa: ServiceAccount | null = needsFcm ? JSON.parse(FCM_SERVICE_ACCOUNT_JSON!) : null;
  const access = sa ? await fcmAccessToken(sa) : "";

  let sent = 0;
  let failed = 0;
  for (const m of plan.send) {
    const text = textOf(m);
    const payload = pushData(m.kind, m.institution_ids[0]);
    let ok = false;
    let lastError: string | undefined;
    const gone: string[] = [];
    let allGone = false;
    if (m.channel === "telegram") {
      const r = await tgSend(m.tg_chat!, telegramHtml(text), stopLabel(m.lang));
      ok = r.ok;
      lastError = r.error;
      allGone = r.gone;
      if (r.gone) await admin.rpc("telegram_sub_stop", { p_chat_id: m.tg_chat });
    } else {
      for (const token of m.tokens) {
        const r = await fcmSend(sa!, access, token, text.title, text.body, payload);
        if (r.ok) ok = true;
        else {
          lastError = r.error;
          if (r.gone) gone.push(token);
        }
      }
      allGone = gone.length === m.tokens.length;
      // a test phone's tokens are kept as they are (Asrbek: «tegma»)
      if (gone.length && !m.is_test) await admin.from("app_guest_push_tokens").update({ enabled: false }).in("token", gone);
    }
    const status = ok ? "sent" : allGone ? "gone" : "failed";
    await admin.from("app_push_sends").insert({
      channel: m.channel, audience: "guest", install_id: m.install_id, kind: m.kind,
      institution_id: m.institution_ids[0], ref_date: m.ref_date, status, error: ok ? null : lastError ?? null,
    });
    if (ok) {
      sent++;
      await admin.from("guest_push_queue").update({ status: "sent", sent_at: new Date().toISOString() }).in("id", m.queue_ids);
    } else {
      failed++;
      const { data: q } = await admin.from("guest_push_queue").select("id, attempts").in("id", m.queue_ids);
      for (const r of q ?? []) {
        const attempts = (r.attempts ?? 0) + 1;
        await admin.from("guest_push_queue").update({
          attempts, status: attempts >= MAX_ATTEMPTS || status === "gone" ? "failed" : "pending", note: status,
        }).eq("id", r.id);
      }
    }
  }
  return json({ ok: true, mode, sent, failed, wait: plan.wait, skipped: plan.skip.length });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
