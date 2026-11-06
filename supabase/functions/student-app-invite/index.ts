// student-app-invite (ushlab qolish rejasi P13, U5)
// ----------------------------------------------------------------------------
// Invites contracted students who never opened the app: by Telegram (the
// userbot outbox, as the account that knows the chat) with the login code and
// the app link; with no Telegram, a CRM task for the consultant.
//
// POST { student_ids?: uuid[], all?: true, auto?: true, dry?: true }
//   auto — pg_cron daily: contracts of the last 14 days, never invited.
//   student_ids / all — the CRM (P14), staff only; a student invited in the
//   last 7 days is skipped. dry — who would get what; nothing written.
// STUDENT_INVITE_AUTO=on turns the daily run on; the CRM button works without it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { serviceKey } from "../_shared/keys.ts";
import { requireCaller } from "../_shared/caller.ts";
import { decide, taskFor, telegramText, type Target } from "./invite.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = serviceKey();
const APP_STORE_URL = Deno.env.get("APP_STORE_URL") || null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const caller = await requireCaller(req, "staff", corsHeaders, { allowService: true });
  if (!caller.ok) return caller.response;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    body = {};
  }
  const ids = Array.isArray(body.student_ids) ? body.student_ids.filter((x): x is string => typeof x === "string" && UUID.test(x)) : [];
  const auto = body.auto === true && caller.service;
  const all = body.all === true;
  const dry = body.dry === true;
  if (!auto && !all && ids.length === 0) return json({ error: "no_students" }, 400);
  // the daily run sends nothing until Asrbek turns it on
  if (auto && !dry && Deno.env.get("STUDENT_INVITE_AUTO") !== "on") return json({ ok: true, auto: "off" });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc("fn_student_app_invite_targets", { p_students: ids.length ? ids : null });
  if (error) return json({ error: error.message }, 500);
  const now = new Date();
  const plan = ((data ?? []) as Target[]).map((t) => ({ t, d: decide(t, now, auto) }));

  if (dry) {
    return json({
      ok: true, dry: true,
      telegram: plan.filter((p) => "channel" in p.d && p.d.channel === "telegram").length,
      task: plan.filter((p) => "channel" in p.d && p.d.channel === "task").length,
      skipped: plan.filter((p) => "skip" in p.d).length,
      preview: plan.find((p) => "channel" in p.d && p.d.channel === "telegram")
        ? telegramText({ ...plan.find((p) => "channel" in p.d && p.d.channel === "telegram")!.t, magic_code: "••••••" }, APP_STORE_URL)
        : null,
    });
  }

  const createdBy = caller.service ? null : caller.user.id;
  let telegram = 0, task = 0, failed = 0, skipped = 0;
  for (const { t, d } of plan) {
    if ("skip" in d) {
      skipped++;
      continue;
    }
    if (d.channel === "telegram") {
      const { data: row, error: e } = await admin.from("telegram_outbox")
        .insert({ account_label: t.account_label, chat_id: t.telegram_id, text: telegramText(t, APP_STORE_URL), requested_by: createdBy })
        .select("id").single();
      await admin.from("student_app_invites").insert({
        student_id: t.student_id, channel: "telegram", status: e ? "failed" : "queued",
        outbox_id: row?.id ?? null, error: e?.message ?? null, auto, created_by: createdBy,
      });
      if (e) failed++;
      else telegram++;
    } else {
      const text = taskFor(t, APP_STORE_URL);
      const { data: row, error: e } = await admin.from("tasks").insert({
        title: text.title, description: text.description, priority: "normal", status: "todo",
        student_id: t.student_id, assigned_to: t.consultant, created_by: createdBy, source: "crm",
        due_date: new Date(now.getTime() + 2 * 86_400_000).toISOString(),
      }).select("id").single();
      await admin.from("student_app_invites").insert({
        student_id: t.student_id, channel: "task", status: e ? "failed" : "task_created",
        task_id: row?.id ?? null, error: e?.message ?? null, auto, created_by: createdBy,
      });
      if (e) failed++;
      else task++;
    }
  }
  return json({ ok: true, telegram, task, failed, skipped });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
