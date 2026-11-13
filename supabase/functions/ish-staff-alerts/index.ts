// ish-staff-alerts — Hanguk Ish tells the staff on Telegram (P57, 2026-11-13).
//
// The database puts a business the 사장님 app opened and a worker's
// complaint into ish.staff_alerts
// (hanguk_ish/supabase/migrations/20261113130000_ish_staff_alerts.sql) and
// calls this function through pg_net with the project's secret key — after
// the write, and every minute while something waits (pg_cron
// `ish-staff-alerts`). It sends each message with hanguk.uz's alert bot to
// its alert chat (TELEGRAM_BOT_TOKEN, ALERT_TELEGRAM_CHAT_ID — the ones
// infra-health-check and lead-sla-check use; ISH_ALERT_CHAT_ID, when set,
// sends Hanguk Ish's elsewhere). A message that does not go is retried on the
// database's schedule (1, 2, 4 … 60 minutes, 8 tries).
//
// Auth: server callers only (verify_jwt = false; isServiceRequest). It
// answers at once (202) and sends after the response (EdgeRuntime.waitUntil).
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isServiceRequest } from "../_shared/caller.ts";
import { serviceKey } from "../_shared/keys.ts";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import { outboxStore, runAlerts, type Send } from "./alerts.ts";

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function sender(): Send {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
  const chat = Deno.env.get("ISH_ALERT_CHAT_ID") || Deno.env.get("ALERT_TELEGRAM_CHAT_ID") || "";
  if (!token || !chat) {
    return () => Promise.resolve({ ok: false, description: "TELEGRAM_BOT_TOKEN / ALERT_TELEGRAM_CHAT_ID not set" });
  }
  return async (text) => {
    const r = await sendTelegramMessage(token, chat, text, { parse_mode: "HTML" });
    return { ok: r.ok, description: r.ok ? undefined : `Telegram ${r.error_code ?? ""} ${r.description ?? ""}`.trim() };
  };
}

async function work(): Promise<void> {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey(), {
    db: { schema: "ish" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const stats = await runAlerts(outboxStore(db as any), sender());
    if (stats.sent || stats.failed) console.log(`[ish-staff-alerts] sent=${stats.sent} failed=${stats.failed}`);
  } catch (e) {
    console.error("[ish-staff-alerts] run failed:", e instanceof Error ? e.message : e);
  }
}

Deno.serve((req) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  if (!isServiceRequest(req)) return json(401, { error: "unauthorized" });
  const run = work();
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
    EdgeRuntime.waitUntil(run);
    return json(202, { ok: true });
  }
  return run.then(() => json(200, { ok: true }));
});
