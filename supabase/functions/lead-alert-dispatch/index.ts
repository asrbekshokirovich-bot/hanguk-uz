// lead-alert-dispatch
// ----------------------------------------------------------------------------
// Delivers the Telegram messages the lead engine queues in lead_alert_outbox
// (spec §4, §11, §14). SQL only ENQUEUES — fn_lead_timer_scan writes an
// escalation for every lead past its 10 minutes (and again every 10 minutes
// until it is answered), lead_request_promise / the message trigger / the stage
// trigger write the boss-only alerts — and this function sends them.
//
// Called every 30 seconds by pg_cron (lead-alert-dispatch) with the service-role
// bearer. Each run:
//   1. fn_lead_alert_expire()      closes stale escalations (answered meanwhile)
//   2. fn_lead_alert_claim(50)     takes up to 50 unsent rows, once (two runs
//                                  never send the same row)
//   3. sends each row to its recipients — audience `everyone` -> lead_alert_recipients
//      with escalate = true, audience `boss` -> boss_alerts = true, and the
//      staff channel ALERT_TELEGRAM_CHAT_ID for both
//   4. fn_lead_alert_done(id, ok, error)
//
// One recipient failing (403: never pressed Start on the bot) never stops the
// others; a row counts as sent when at least one recipient received it. A row
// that nobody could receive goes back to the queue (up to 5 attempts, then the
// SQL expires it).
//
// `?dry=1` only counts what is waiting. No message text is ever logged: it holds
// names and phone numbers.
//
// AUTH: verify_jwt is off at the gateway (config.toml); the caller is checked in
// _shared/service-auth.ts (service key / sb_secret_ key / a service_role JWT that
// PostgREST accepts).
//
// Env: TELEGRAM_BOT_TOKEN, ALERT_TELEGRAM_CHAT_ID (optional staff channel),
// CRM_BASE_URL (optional, default https://hanguk.uz).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import { isServiceRequest, restJwtVerifier } from "../_shared/service-auth.ts";
import { formatAlert, pickRecipients, type AlertRow, type RecipientRow } from "./format.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ENV_CHAT = Deno.env.get("ALERT_TELEGRAM_CHAT_ID");
const CRM_BASE_URL = Deno.env.get("CRM_BASE_URL") || undefined;

/** The cron's HTTP call times out at 30 s; leave the rest of the batch for the next run. */
const RUN_BUDGET_MS = 24_000;
const BATCH = 50;

const verifyJwt = restJwtVerifier(SUPABASE_URL);

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** One Telegram send; a 429 is retried once after the wait Telegram asks for. */
async function sendOne(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
  let res = await sendTelegramMessage(BOT_TOKEN!, chatId, text);
  if (!res.ok && res.error_code === 429) {
    const asked = Number(/retry after (\d+)/i.exec(res.description ?? "")?.[1] ?? 1);
    await sleep((Math.min(5, Math.max(1, asked)) + 0.2) * 1000);
    res = await sendTelegramMessage(BOT_TOKEN!, chatId, text);
  }
  if (res.ok) return { ok: true };
  return { ok: false, error: `${res.error_code ?? "?"} chat ${chatId}: ${String(res.description ?? "").slice(0, 120)}` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (!(await isServiceRequest(req, {
    serviceKey: SERVICE_KEY,
    secretKeysJson: Deno.env.get("SUPABASE_SECRET_KEYS"),
    verifyJwt,
  }))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);
  const dry = new URL(req.url).searchParams.get("dry") === "1";

  try {
    if (dry) {
      const { count } = await supabase
        .from("lead_alert_outbox")
        .select("id", { count: "exact", head: true })
        .is("sent_at", null);
      return json({ ok: true, dry: true, pending: count ?? 0 });
    }

    const started = Date.now();

    const expired = await supabase.rpc("fn_lead_alert_expire");
    if (expired.error) console.error("lead-alert-dispatch: expire:", expired.error.message);

    if (!BOT_TOKEN) {
      // Claiming would burn an attempt per row for nothing.
      console.error("lead-alert-dispatch: TELEGRAM_BOT_TOKEN is not set — nothing sent");
      return json({ ok: true, skipped: "no_telegram_token" });
    }

    const claimed = await supabase.rpc("fn_lead_alert_claim", { p_limit: BATCH });
    if (claimed.error) throw new Error(`claim: ${claimed.error.message}`);
    const rows = (claimed.data ?? []) as AlertRow[];
    if (!rows.length) return json({ ok: true, claimed: 0, sent: 0, failed: 0, skipped: 0 });

    // Who gets what, and the names the texts need — loaded once per run.
    const { data: recipientRows, error: recErr } = await supabase
      .from("lead_alert_recipients")
      .select("chat_id, escalate, boss_alerts, reports_daily, reports_weekly")
      .eq("enabled", true);
    if (recErr) console.error("lead-alert-dispatch: recipients:", recErr.message);
    const recipients = (recipientRows ?? []) as RecipientRow[];

    const userIds = new Set<string>();
    const escalationLeads: string[] = [];
    for (const r of rows) {
      const p = (r.payload ?? {}) as Record<string, unknown>;
      for (const k of ["owner_id", "operator_id"]) if (p[k]) userIds.add(String(p[k]));
      if (r.kind === "escalation" && r.lead_id) escalationLeads.push(r.lead_id);
    }

    const names: Record<string, string> = {};
    if (userIds.size) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", [...userIds]);
      for (const p of (profiles ?? []) as { user_id: string; full_name: string | null }[]) {
        if (p.full_name) names[p.user_id] = p.full_name;
      }
    }

    // The SQL claim already leaves out escalations for answered leads; one more
    // look, because a lead can be answered between the claim and the send.
    const open = new Map<string, { due_at: string | null; merged_into_id: string | null }>();
    if (escalationLeads.length) {
      const { data: leads } = await supabase.from("leads").select("id, due_at, merged_into_id").in("id", escalationLeads);
      for (const l of (leads ?? []) as { id: string; due_at: string | null; merged_into_id: string | null }[]) open.set(l.id, l);
    }

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of rows) {
      const done = (ok: boolean, error?: string) =>
        supabase.rpc("fn_lead_alert_done", { p_id: row.id, p_ok: ok, p_error: error ?? null });

      try {
        if (Date.now() - started > RUN_BUDGET_MS) {
          // Give the row back: the next run claims it again.
          await done(false, "run budget used up");
          failed++;
          continue;
        }

        if (row.kind === "escalation" && row.lead_id) {
          const l = open.get(row.lead_id);
          if (!l || l.due_at == null || l.merged_into_id != null) {
            await done(true);
            skipped++;
            continue;
          }
        }

        const text = formatAlert(row, { crmBaseUrl: CRM_BASE_URL, names });
        if (text == null) {
          await done(false, `unsupported kind: ${row.kind}`);
          failed++;
          continue;
        }

        const chats = pickRecipients(row.audience, recipients, ENV_CHAT);
        if (!chats.length) {
          console.warn(`lead-alert-dispatch: no recipients for audience ${row.audience}`);
          await done(false, "no recipients");
          failed++;
          continue;
        }

        const results = await Promise.all(chats.map((c) => sendOne(c, text)));
        const delivered = results.filter((r) => r.ok).length;
        const errors = results.filter((r) => !r.ok).map((r) => r.error!);
        if (errors.length) console.error(`lead-alert-dispatch: alert ${row.id}: ${errors.length} recipient(s) failed: ${errors.slice(0, 3).join(" | ")}`);

        if (delivered > 0) {
          await done(true);
          sent++;
        } else {
          await done(false, errors.slice(0, 3).join(" | "));
          failed++;
        }
      } catch (e) {
        failed++;
        console.error(`lead-alert-dispatch: alert ${row.id} failed:`, e instanceof Error ? e.message : String(e));
        await done(false, e instanceof Error ? e.message : "error").catch(() => {});
      }
    }

    if (sent || failed) console.log(`lead-alert-dispatch: ${rows.length} claimed, ${sent} sent, ${failed} failed, ${skipped} skipped`);
    return json({ ok: true, claimed: rows.length, sent, failed, skipped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("lead-alert-dispatch failed:", message);
    return json({ ok: false, error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
