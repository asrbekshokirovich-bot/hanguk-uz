// lead-reports
// ----------------------------------------------------------------------------
// The Telegram reports of the lead module (spec §14):
//
//   POST { "kind": "daily" }    09:30 Tashkent — yesterday: leads by source,
//                               answered / not, "10 daqiqada javob %" (only when
//                               lead_settings.control_line_10min is true), talked,
//                               offers, contracts, lost by reason, today's BUGUN volume
//   POST { "kind": "weekly" }   Monday 09:30 — the last 7 days: contracts by
//                               operator and by source, the funnel, lost reasons,
//                               the best ad
//
// The numbers are fn_lead_report(from, to) (results only). Recipients are the
// rows of lead_alert_recipients with reports_daily / reports_weekly.
//
// Called by pg_cron (lead-reports-daily 04:30 UTC, lead-reports-weekly Monday
// 04:30 UTC) with the service-role bearer. A report is sent once per period:
// the send is recorded in lead_alert_outbox (kind 'report', already marked sent,
// so the dispatcher never picks it up) and a repeated call answers
// `already_sent`. Extra body fields, for a human running it by hand:
//   dry:true     build the text and return it, send and record nothing
//   force:true   send even if this period was already sent
//   today:"YYYY-MM-DD"  pretend it is that day (Tashkent)
//
// AUTH: verify_jwt is off at the gateway (config.toml); the caller is checked in
// _shared/service-auth.ts.
//
// Env: TELEGRAM_BOT_TOKEN.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendTelegramMessage } from "../_shared/telegram.ts";
import { isServiceRequest, restJwtVerifier } from "../_shared/service-auth.ts";
import {
  formatDailyReport,
  formatWeeklyReport,
  reportRange,
  tashkentDate,
  type LeadReport,
  type ReportKind,
} from "./format.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");

const verifyJwt = restJwtVerifier(SUPABASE_URL);

/** The end of today in Tashkent, as an instant (for the BUGUN fallback count). */
function endOfTashkentDay(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1) - 5 * 3600 * 1000).toISOString();
}

/** How many leads are on BUGUN now. The same bucket the desk shows; a plain count as fallback. */
async function countBugun(supabase: any, today: string): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .rpc("lead_desk", {}, { count: "exact", head: true })
      .eq("bucket", "bugun");
    if (!error && typeof count === "number") return count;
    if (error) console.error("lead-reports: lead_desk count:", error.message);
  } catch (e) {
    console.error("lead-reports: lead_desk count threw:", e instanceof Error ? e.message : String(e));
  }
  try {
    const { count, error } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .is("merged_into_id", null)
      .neq("stage", "student")
      .lte("next_action_at", endOfTashkentDay(today));
    if (!error && typeof count === "number") return count;
    if (error) console.error("lead-reports: bugun fallback count:", error.message);
  } catch (_e) { /* leave the line out */ }
  return null;
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

  const body = await req.json().catch(() => ({} as any));
  const url = new URL(req.url);
  const rawKind = String(body?.kind ?? url.searchParams.get("kind") ?? "");
  if (rawKind !== "daily" && rawKind !== "weekly") return json({ error: "kind must be 'daily' or 'weekly'" }, 400);
  const kind: ReportKind = rawKind;
  const dry = body?.dry === true || url.searchParams.get("dry") === "1";
  const force = body?.force === true;
  const todayOverride = typeof body?.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.today) ? body.today : null;

  const supabase: any = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const today = todayOverride ?? tashkentDate(Date.now());
    const { from, to } = reportRange(kind, today);
    const key = `${kind}:${from}:${to}`;

    if (!dry && !force) {
      const { data: done } = await supabase
        .from("lead_alert_outbox")
        .select("id")
        .eq("kind", "report")
        .eq("payload->>key", key)
        .not("sent_at", "is", null)
        .limit(1);
      if (done?.length) return json({ ok: true, skipped: "already_sent", key });
    }

    const { data: report, error: repErr } = await supabase.rpc("fn_lead_report", { p_from: from, p_to: to });
    if (repErr) throw new Error(`fn_lead_report: ${repErr.message}`);
    const r = report as LeadReport;

    const { data: settingRows } = await supabase
      .from("lead_settings")
      .select("key, value")
      .in("key", ["control_line_10min", "lost_reasons"]);
    const settings = new Map<string, any>((settingRows ?? []).map((x: any) => [x.key, x.value]));
    const lostLabels: Record<string, string> = {};
    for (const lr of Array.isArray(settings.get("lost_reasons")) ? settings.get("lost_reasons") : []) {
      if (lr?.key && lr?.label) lostLabels[String(lr.key)] = String(lr.label);
    }

    const names: Record<string, string> = {};
    const operatorIds = (r.by_operator ?? []).map((o) => o.operator_id).filter((x): x is string => !!x);
    if (operatorIds.length) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", operatorIds);
      for (const p of (profiles ?? []) as { user_id: string; full_name: string | null }[]) {
        if (p.full_name) names[p.user_id] = p.full_name;
      }
    }

    const text = kind === "daily"
      ? formatDailyReport(r, {
        showControlLine: settings.get("control_line_10min") === true,
        bugunCount: await countBugun(supabase, today),
        lostLabels,
        names,
      })
      : formatWeeklyReport(r, { lostLabels, names });

    const flag = kind === "daily" ? "reports_daily" : "reports_weekly";
    const { data: recipientRows, error: recErr } = await supabase
      .from("lead_alert_recipients")
      .select("chat_id")
      .eq("enabled", true)
      .eq(flag, true);
    if (recErr) console.error("lead-reports: recipients:", recErr.message);
    const chats = [...new Set(((recipientRows ?? []) as { chat_id: string }[])
      .map((x) => String(x.chat_id ?? "").trim())
      .filter(Boolean))];

    if (dry) return json({ ok: true, dry: true, kind, key, recipients: chats.length, text });
    if (!chats.length) {
      console.warn(`lead-reports: no recipient has ${flag}`);
      return json({ ok: true, kind, key, sent: 0, recipients: 0 });
    }
    if (!BOT_TOKEN) {
      console.error("lead-reports: TELEGRAM_BOT_TOKEN is not set — report not sent");
      return json({ ok: true, skipped: "no_telegram_token", kind, key });
    }

    let sent = 0;
    for (const chat of chats) {
      // 403 = that person never pressed Start; the others still get theirs.
      const res = await sendTelegramMessage(BOT_TOKEN, chat, text);
      if (res.ok) sent++;
      else console.error(`lead-reports: send to chat ${chat} failed: ${res.error_code ?? "?"} ${res.description ?? ""}`);
    }

    if (sent > 0) {
      const { error: logErr } = await supabase.from("lead_alert_outbox").insert({
        kind: "report",
        audience: "boss",
        payload: { key, report: kind, from, to, recipients: chats.length, sent },
        sent_at: new Date().toISOString(),
      });
      if (logErr) console.error("lead-reports: could not record the send:", logErr.message);
    }

    console.log(`lead-reports: ${key} sent to ${sent}/${chats.length}`);
    return json({ ok: true, kind, key, sent, recipients: chats.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("lead-reports failed:", message);
    return json({ ok: false, error: message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
