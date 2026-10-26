// send-guest-push
// ----------------------------------------------------------------------------
// A push campaign to guests (plan v2, stage 5 app/guest-push; B3): every
// phone that said yes to notifications without signing in
// (fn_guest_push_targets), each in its own language where the text has one,
// else Uzbek. The campaign is kept in push_campaigns with how many it went
// to; the app records push_opened with the campaign key, so the CRM shows
// opens per campaign (analytics_push_campaigns).
//
// POST { campaign, title: {uz, ru?, en?, ko?, vi?}, body: {…}, dry? } with the
// staff member's JWT; owner and admin only. dry: how many it would reach, by
// language — nothing sent or kept. A campaign key is used once.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders } from "../_shared/cors.ts";
import { fcmAccessToken, fcmSend, type ServiceAccount } from "../_shared/fcm.ts";
import { campaignData, checkCampaign, textFor } from "./campaign.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FCM_SERVICE_ACCOUNT_JSON = Deno.env.get("FCM_SERVICE_ACCOUNT_JSON");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization") ?? "";
  const asUser = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who } = await asUser.auth.getUser();
  if (!who?.user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", who.user.id).in("role", ["owner", "admin"]);
  if (!roles?.length) return json({ error: "forbidden" }, 403);

  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch (_e) {
    return json({ error: "bad_json" }, 400);
  }
  const checked = checkCampaign(raw);
  if (!checked.ok) return json({ error: checked.error }, 400);
  const c = checked.value;

  const { data: targets, error: terr } = await admin.rpc("fn_guest_push_targets");
  if (terr) return json({ error: terr.message }, 500);
  const list = (targets ?? []) as { token: string; install_id: string; preferred_lang: string }[];
  const byLang: Record<string, number> = {};
  for (const t of list) byLang[t.preferred_lang] = (byLang[t.preferred_lang] ?? 0) + 1;
  const phones = new Set(list.map((t) => t.install_id)).size;
  if (raw.dry === true) return json({ ok: true, dry: true, tokens: list.length, phones, by_lang: byLang });

  if (!FCM_SERVICE_ACCOUNT_JSON) return json({ error: "FCM_SERVICE_ACCOUNT_JSON is not set" }, 500);
  const { data: row, error: ierr } = await admin
    .from("push_campaigns")
    .insert({ campaign: c.campaign, title: c.title, body: c.body, targeted: list.length, created_by: who.user.id })
    .select("id")
    .single();
  if (ierr) return json({ error: ierr.code === "23505" ? "campaign_exists" : ierr.message }, ierr.code === "23505" ? 409 : 500);

  const sa: ServiceAccount = JSON.parse(FCM_SERVICE_ACCOUNT_JSON);
  const access = await fcmAccessToken(sa);
  let delivered = 0;
  let failed = 0;
  const gone: string[] = [];
  for (const t of list) {
    const text = textFor(c, t.preferred_lang);
    const r = await fcmSend(sa, access, t.token, text.title, text.body, campaignData(c.campaign));
    if (r.ok) delivered++;
    else {
      failed++;
      if (r.gone) gone.push(t.token);
    }
  }
  if (gone.length) await admin.from("app_guest_push_tokens").update({ enabled: false }).in("token", gone);
  await admin.from("push_campaigns").update({ delivered, failed, sent_at: new Date().toISOString() }).eq("id", row.id);
  return json({ ok: true, campaign: c.campaign, tokens: list.length, phones, delivered, failed });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
